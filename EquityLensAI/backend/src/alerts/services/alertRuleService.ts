import crypto from 'node:crypto';
import type { AlertRule, AlertEvent, AlertRuleConfig, SupportedExchange } from '@equitylensai/shared';
import { alertRepository } from '../repositories/alertRepository.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import { alertConditionEvaluator } from '../evaluators/alertConditionEvaluator.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import type {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  listAlertsQuerySchema,
} from '../../validation/alertSchemas.js';
import type { z } from 'zod';

const MAX_ACTIVE_RULES_PER_USER = 50;

export class AlertRuleService {
  async createRule(
    userId: string,
    input: z.infer<typeof createAlertRuleSchema>,
  ): Promise<AlertRule> {
    // 1. Quota check
    const activeCount = await alertRepository.countActiveRulesByUser(userId);
    if (activeCount >= MAX_ACTIVE_RULES_PER_USER) {
      throw new AppError(
        'ALERT_QUOTA_EXCEEDED',
        `Maximum limit of ${MAX_ACTIVE_RULES_PER_USER} active alerts reached. Please disable or remove old alerts.`,
        429,
      );
    }

    // 2. Validate instrument if symbol is present
    let cleanSymbol: string | null = null;
    let cleanExchange: SupportedExchange | null = null;

    if (input.symbol && input.symbol.trim().length > 0) {
      cleanSymbol = input.symbol.trim().toUpperCase();
      cleanExchange = (input.exchange ?? 'NSE') as SupportedExchange;

      const instrument = instrumentRepository.getBySymbol(cleanSymbol, cleanExchange);
      if (!instrument) {
        // Fallback check on search if instrument master has it under another exchange
        const matches = instrumentRepository.search(cleanSymbol, { limit: 5 });
        const exactMatch = matches.find((m) => m.symbol.toUpperCase() === cleanSymbol);
        if (exactMatch) {
          cleanExchange = exactMatch.exchange as SupportedExchange;
        } else {
          logger.warn(
            { symbol: cleanSymbol, exchange: cleanExchange },
            'Instrument not found in local master; accepting with warning',
          );
        }
      }
    }

    const now = new Date().toISOString();
    const rule: AlertRule = {
      id: crypto.randomUUID(),
      userId,
      name: input.name,
      alertType: input.alertType,
      symbol: cleanSymbol,
      exchange: cleanExchange,
      ruleConfig: input.ruleConfig as AlertRuleConfig,
      enabled: true,
      cooldownMinutes: input.cooldownMinutes ?? 60,
      lastEvaluatedAt: null,
      lastObservationAt: null,
      lastObservedValue: null,
      lastTriggeredAt: null,
      lastState: null,
      createdAt: now,
      updatedAt: now,
    };

    return alertRepository.createRule(rule);
  }

  async getRule(ruleId: string, userId: string): Promise<AlertRule> {
    const rule = await alertRepository.getRuleById(ruleId, userId);
    if (!rule) {
      throw new AppError('ALERT_NOT_FOUND', `Alert rule '${ruleId}' not found`, 404);
    }
    return rule;
  }

  async listRules(
    userId: string,
    query: z.infer<typeof listAlertsQuerySchema>,
  ): Promise<{ rules: AlertRule[]; total: number; limit: number; offset: number }> {
    const { rules, total } = await alertRepository.listRules(userId, {
      alertType: query.alertType,
      enabled: query.enabled,
      symbol: query.symbol,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      rules,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async updateRule(
    ruleId: string,
    userId: string,
    input: z.infer<typeof updateAlertRuleSchema>,
  ): Promise<AlertRule> {
    await this.getRule(ruleId, userId);

    const updates: Partial<AlertRule> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.cooldownMinutes !== undefined) updates.cooldownMinutes = input.cooldownMinutes;

    if (input.ruleConfig !== undefined) {
      updates.ruleConfig = input.ruleConfig as AlertRuleConfig;
      // When configuration changes, reset evaluation baseline to prevent false crossings
      updates.lastState = null;
      updates.lastObservedValue = null;
    }

    const updated = await alertRepository.updateRule(ruleId, userId, updates);
    if (!updated) {
      throw new AppError('ALERT_NOT_FOUND', `Alert rule '${ruleId}' not found`, 404);
    }

    return updated;
  }

  async deleteRule(ruleId: string, userId: string): Promise<void> {
    const deleted = await alertRepository.deleteRule(ruleId, userId);
    if (!deleted) {
      throw new AppError('ALERT_NOT_FOUND', `Alert rule '${ruleId}' not found`, 404);
    }
  }

  async enableRule(ruleId: string, userId: string): Promise<AlertRule> {
    // Reset state on re-enabling so initial crossing is not falsely triggered
    return this.updateRule(ruleId, userId, {
      enabled: true,
    });
  }

  async disableRule(ruleId: string, userId: string): Promise<AlertRule> {
    return this.updateRule(ruleId, userId, {
      enabled: false,
    });
  }

  async listEvents(ruleId: string, userId: string, limit = 50): Promise<AlertEvent[]> {
    await this.getRule(ruleId, userId); // verifies ownership
    return alertRepository.listEventsByRule(ruleId, userId, limit);
  }

  async previewRule(
    input: z.infer<typeof createAlertRuleSchema>,
  ): Promise<{
    currentObservation: number | null;
    observationTimestamp: string | null;
    conditionSatisfied: boolean;
    explanation: string;
  }> {
    const mockRule: AlertRule = {
      id: 'preview',
      userId: 'preview',
      name: input.name,
      alertType: input.alertType,
      symbol: input.symbol ?? null,
      exchange: (input.exchange as SupportedExchange) ?? 'NSE',
      ruleConfig: input.ruleConfig as AlertRuleConfig,
      enabled: true,
      cooldownMinutes: 0,
      lastEvaluatedAt: null,
      lastObservationAt: null,
      lastObservedValue: null,
      lastTriggeredAt: null,
      lastState: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (input.alertType === 'price' || input.alertType === 'percentage_change' || input.alertType === 'volume') {
      if (!input.symbol) {
        throw new AppError('VALIDATION_ERROR', 'Symbol is required for market alerts preview', 400);
      }
      try {
        const quote = await marketService.getQuote({
          symbol: input.symbol,
          exchange: input.exchange ?? 'NSE',
        });
        const outcome = alertConditionEvaluator.evaluate(mockRule, { quote });
        return {
          currentObservation: outcome.observedValue ?? quote.price,
          observationTimestamp: quote.observedAt,
          conditionSatisfied: outcome.triggered,
          explanation: outcome.triggered
            ? `Condition is currently satisfied based on quote (${quote.price}).`
            : `Condition is not currently met based on quote (${quote.price}).`,
        };
      } catch (err) {
        return {
          currentObservation: null,
          observationTimestamp: null,
          conditionSatisfied: false,
          explanation: `Could not retrieve current quote: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    if (input.alertType === 'financial_metric') {
      if (!input.symbol) {
        throw new AppError('VALIDATION_ERROR', 'Symbol is required for financial alert preview', 400);
      }
      try {
        const financials = await financialService.getFinancialAnalysis({
          symbol: input.symbol,
          exchange: input.exchange ?? 'NSE',
          annualPeriods: 4,
        });
        const outcome = alertConditionEvaluator.evaluate(mockRule, { financials });
        const periodEndDate = financials.latestAnnual?.periodEndDate;
        const fiscalYear = periodEndDate ? periodEndDate.slice(0, 4) : undefined;
        return {
          currentObservation: outcome.observedValue ?? null,
          observationTimestamp: fiscalYear ?? null,
          conditionSatisfied: outcome.triggered,
          explanation: outcome.triggered
            ? `Metric condition is satisfied based on ${fiscalYear ? `FY${fiscalYear}` : 'latest'} reported statements.`
            : `Metric condition is not currently met based on ${fiscalYear ? `FY${fiscalYear}` : 'latest'} reported statements.`,
        };
      } catch (err) {
        return {
          currentObservation: null,
          observationTimestamp: null,
          conditionSatisfied: false,
          explanation: `Could not retrieve financials: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      currentObservation: null,
      observationTimestamp: null,
      conditionSatisfied: false,
      explanation: 'Preview available for price, percentage, volume, and financial metric rules.',
    };
  }
}

export const alertRuleService = new AlertRuleService();
