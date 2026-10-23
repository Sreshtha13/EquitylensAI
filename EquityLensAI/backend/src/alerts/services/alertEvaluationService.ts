import crypto from 'node:crypto';
import type {
  AlertRule,
  AlertEvent,
  AppNotification,
  NormalizedQuote,
  FinancialAnalysis,
  CorporateAnnouncement,
  NewsItem,
  NotificationCategory,
} from '@equitylensai/shared';
import { alertRepository } from '../repositories/alertRepository.js';
import { notificationRepository } from '../../notifications/repositories/notificationRepository.js';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import { newsRepository } from '../../news/repositories/newsRepository.js';
import { userRepository } from '../../db/userRepository.js';
import { alertConditionEvaluator } from '../evaluators/alertConditionEvaluator.js';
import { logger } from '../../utils/logger.js';
import type { EvaluationJobSummary } from '../types.js';

function mapAlertTypeToNotificationCategory(alertType: string): NotificationCategory {
  switch (alertType) {
    case 'price':
      return 'price_alert';
    case 'percentage_change':
      return 'percentage_alert';
    case 'volume':
      return 'volume_alert';
    case 'financial_metric':
      return 'financial_alert';
    case 'announcement':
      return 'announcement_alert';
    case 'news':
      return 'news_alert';
    default:
      return 'system';
  }
}

export class AlertEvaluationService {
  private isEvaluating = false;

  async evaluateAll(): Promise<EvaluationJobSummary> {
    const startTime = Date.now();
    if (this.isEvaluating) {
      logger.warn('Alert evaluation cycle already running; skipping concurrent run');
      return {
        evaluatedCount: 0,
        triggeredCount: 0,
        skippedCount: 0,
        duplicatesPrevented: 0,
        errorsCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isEvaluating = true;
    let evaluatedCount = 0;
    let triggeredCount = 0;
    let skippedCount = 0;
    let duplicatesPrevented = 0;
    let errorsCount = 0;

    try {
      const enabledRules = await alertRepository.getAllEnabledRules();
      if (enabledRules.length === 0) {
        return {
          evaluatedCount: 0,
          triggeredCount: 0,
          skippedCount: 0,
          duplicatesPrevented: 0,
          errorsCount: 0,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // 1. Group rules to batch observations
      const quoteRules = enabledRules.filter(
        (r) => r.alertType === 'price' || r.alertType === 'percentage_change' || r.alertType === 'volume',
      );
      const financialRules = enabledRules.filter((r) => r.alertType === 'financial_metric');
      const announcementRules = enabledRules.filter((r) => r.alertType === 'announcement');
      const newsRules = enabledRules.filter((r) => r.alertType === 'news');

      // 2. Batch fetch quotes for market rules
      const quotesMap = new Map<string, NormalizedQuote>();
      const quoteKeys = Array.from(
        new Set(
          quoteRules
            .filter((r) => Boolean(r.symbol))
            .map((r) => `${(r.exchange || 'NSE').toUpperCase()}:${r.symbol!.toUpperCase()}`),
        ),
      );

      for (const key of quoteKeys) {
        const [exchange, symbol] = key.split(':');
        if (!symbol || !exchange) continue;
        try {
          const quote = await marketService.getQuote({ symbol, exchange });
          quotesMap.set(key, quote);
        } catch (err) {
          logger.debug({ err, symbol, exchange }, 'Failed to fetch quote during evaluation');
        }
      }

      // 3. Batch fetch financials for financial rules
      const financialsMap = new Map<string, FinancialAnalysis>();
      const financialKeys = Array.from(
        new Set(
          financialRules
            .filter((r) => Boolean(r.symbol))
            .map((r) => `${(r.exchange || 'NSE').toUpperCase()}:${r.symbol!.toUpperCase()}`),
        ),
      );

      for (const key of financialKeys) {
        const [exchange, symbol] = key.split(':');
        if (!symbol || !exchange) continue;
        try {
          const analysis = await financialService.getFinancialAnalysis({ symbol, exchange, annualPeriods: 4 });
          financialsMap.set(key, analysis);
        } catch (err) {
          logger.debug({ err, symbol, exchange }, 'Failed to fetch financials during evaluation');
        }
      }

      // 4. Announcements & News feeds
      let latestAnnouncements: CorporateAnnouncement[] = [];
      if (announcementRules.length > 0) {
        try {
          const feed = await newsRepository.getAnnouncements({ limit: 50 });
          latestAnnouncements = feed.items;
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch announcements feed during evaluation');
        }
      }

      let latestNews: NewsItem[] = [];
      if (newsRules.length > 0) {
        try {
          const feed = await newsRepository.getNews({ limit: 50 });
          latestNews = feed.items;
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch news feed during evaluation');
        }
      }

      // 5. User watchlists cache for watchlist-scoped rules
      const userWatchlistsMap = new Map<string, string[]>();

      // 6. Evaluate each rule safely
      for (const rule of enabledRules) {
        evaluatedCount++;
        try {
          let contextWatchlistSymbols: string[] | undefined;
          if (
            (rule.ruleConfig.type === 'announcement' && rule.ruleConfig.scope === 'watchlist') ||
            (rule.ruleConfig.type === 'news' && rule.ruleConfig.scope === 'watchlist')
          ) {
            if (!userWatchlistsMap.has(rule.userId)) {
              const watchlists = await userRepository.listWatchlists(rule.userId);
              const symbols = new Set<string>();
              for (const w of watchlists) {
                const items = await userRepository.listWatchlistItems(w.id);
                for (const item of items) {
                  symbols.add(item.symbol.toUpperCase());
                }
              }
              userWatchlistsMap.set(rule.userId, Array.from(symbols));
            }
            contextWatchlistSymbols = userWatchlistsMap.get(rule.userId);
          }

          const stockKey = rule.symbol
            ? `${(rule.exchange || 'NSE').toUpperCase()}:${rule.symbol.toUpperCase()}`
            : undefined;

          const quote = stockKey ? quotesMap.get(stockKey) : undefined;
          const financials = stockKey ? financialsMap.get(stockKey) : undefined;

          const outcome = alertConditionEvaluator.evaluate(rule, {
            quote,
            financials,
            announcements: latestAnnouncements,
            news: latestNews,
            watchlistSymbols: contextWatchlistSymbols,
          });

          if (outcome.skipped) {
            skippedCount++;
            await alertRepository.updateRule(rule.id, rule.userId, {
              lastEvaluatedAt: new Date().toISOString(),
            });
            continue;
          }

          if (!outcome.triggered) {
            await alertRepository.updateRule(rule.id, rule.userId, {
              lastEvaluatedAt: new Date().toISOString(),
              lastState: outcome.newState !== undefined ? outcome.newState : rule.lastState,
              lastObservedValue:
                outcome.observedValue !== undefined ? outcome.observedValue : rule.lastObservedValue,
              lastObservationAt:
                outcome.observationTimestamp !== undefined
                  ? outcome.observationTimestamp
                  : rule.lastObservationAt,
            });
            continue;
          }

          // Triggered!
          const nowStr = new Date().toISOString();
          const dedupKey =
            outcome.deduplicationKey ??
            `${rule.id}_${outcome.observationTimestamp ?? nowStr}_${outcome.observedValue ?? 'met'}`;

          const event: AlertEvent = {
            id: crypto.randomUUID(),
            ruleId: rule.id,
            userId: rule.userId,
            alertType: rule.alertType,
            symbol: rule.symbol,
            exchange: rule.exchange,
            triggerTimestamp: outcome.observationTimestamp ?? nowStr,
            observedValue: outcome.observedValue ?? null,
            thresholdContext: outcome.metadata ?? {},
            source: 'EquityLensAI Alert Engine',
            deduplicationKey: dedupKey,
            status: 'triggered',
            createdAt: nowStr,
          };

          const { created } = await alertRepository.createEvent(event);

          if (!created) {
            duplicatesPrevented++;
            continue;
          }

          triggeredCount++;

          // Check user preferences before creating in-app notification
          const preferences = await notificationRepository.getPreferences(rule.userId);
          if (preferences.inAppEnabled) {
            const notification: AppNotification = {
              id: crypto.randomUUID(),
              userId: rule.userId,
              alertEventId: event.id,
              category: mapAlertTypeToNotificationCategory(rule.alertType),
              title: outcome.title ?? `Alert Triggered: ${rule.name}`,
              message: outcome.message ?? `Condition for '${rule.name}' was met.`,
              read: false,
              readAt: null,
              symbol: rule.symbol,
              exchange: rule.exchange,
              sourceUrl: outcome.sourceUrl ?? null,
              metadata: outcome.metadata ?? {},
              createdAt: nowStr,
            };

            await notificationRepository.createNotification(notification);
          }

          // Update rule state and lastTriggeredAt
          await alertRepository.updateRule(rule.id, rule.userId, {
            lastTriggeredAt: nowStr,
            lastEvaluatedAt: nowStr,
            lastState: outcome.newState !== undefined ? outcome.newState : rule.lastState,
            lastObservedValue:
              outcome.observedValue !== undefined ? outcome.observedValue : rule.lastObservedValue,
            lastObservationAt:
              outcome.observationTimestamp !== undefined
                ? outcome.observationTimestamp
                : rule.lastObservationAt,
          });
        } catch (ruleErr) {
          errorsCount++;
          logger.error({ err: ruleErr, ruleId: rule.id }, 'Error evaluating alert rule');
        }
      }
    } finally {
      this.isEvaluating = false;
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      {
        evaluatedCount,
        triggeredCount,
        skippedCount,
        duplicatesPrevented,
        errorsCount,
        durationMs,
      },
      'Alert evaluation cycle finished',
    );

    return {
      evaluatedCount,
      triggeredCount,
      skippedCount,
      duplicatesPrevented,
      errorsCount,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }
}

export const alertEvaluationService = new AlertEvaluationService();
