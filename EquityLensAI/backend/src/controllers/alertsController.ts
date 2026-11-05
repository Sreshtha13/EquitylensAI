import type { Request, Response } from 'express';
import { alertRuleService } from '../alerts/services/alertRuleService.js';
import { alertScheduler } from '../alerts/services/alertScheduler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  listAlertsQuerySchema,
} from '../validation/alertSchemas.js';
import {
  ALERT_TYPES,
  ALERT_STATUSES,
  ALERT_TRIGGER_TYPES,
  PRICE_CONDITIONS,
  PERCENTAGE_CHANGE_PERIODS,
  PERCENTAGE_DIRECTIONS,
  RSI_CONDITIONS,
  MACD_CONDITIONS,
  MA_CONDITIONS,
  HIGH_LOW_CONDITIONS,
  CIRCUIT_CONDITIONS,
  CORPORATE_ACTION_TYPES,
  SUPPORTED_INDICES,
  WATCHLIST_EVENT_TYPES,
  FINANCIAL_ALERT_METRICS,
  COMPARISON_OPERATORS,
  NOTIFICATION_CATEGORIES,
  ANNOUNCEMENT_CATEGORIES,
} from '@equitylensai/shared';

export const alertsController = {
  async listAlerts(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const query = listAlertsQuerySchema.parse(req.query);
    const result = await alertRuleService.listRules(userId, query);
    sendSuccess(res, result);
  },

  async getStats(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const stats = await alertRuleService.getStats(userId);
    sendSuccess(res, stats);
  },

  async createAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = createAlertRuleSchema.parse(req.body);
    const rule = await alertRuleService.createRule(userId, input);
    sendSuccess(res, rule, 201);
  },

  async getAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    const rule = await alertRuleService.getRule(alertId, userId);
    sendSuccess(res, rule);
  },

  async updateAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    const input = updateAlertRuleSchema.parse(req.body);
    const rule = await alertRuleService.updateRule(alertId, userId, input);
    sendSuccess(res, rule);
  },

  async deleteAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    await alertRuleService.deleteRule(alertId, userId);
    sendSuccess(res, { deleted: true, alertId });
  },

  async enableAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    const rule = await alertRuleService.enableRule(alertId, userId);
    sendSuccess(res, rule);
  },

  async disableAlert(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    const rule = await alertRuleService.disableRule(alertId, userId);
    sendSuccess(res, rule);
  },

  async listEvents(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const alertId = req.params.alertId!;
    const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : 50;
    const events = await alertRuleService.listEvents(alertId, userId, limit);
    sendSuccess(res, { events, count: events.length });
  },

  async previewAlert(req: Request, res: Response): Promise<void> {
    const input = createAlertRuleSchema.parse(req.body);
    const preview = await alertRuleService.previewRule(input);
    sendSuccess(res, preview);
  },

  getSupportedTypes(_req: Request, res: Response): void {
    sendSuccess(res, {
      alertTypes: ALERT_TYPES,
      alertStatuses: ALERT_STATUSES,
      triggerTypes: ALERT_TRIGGER_TYPES,
      priceConditions: PRICE_CONDITIONS,
      percentagePeriods: PERCENTAGE_CHANGE_PERIODS,
      percentageDirections: PERCENTAGE_DIRECTIONS,
      rsiConditions: RSI_CONDITIONS,
      macdConditions: MACD_CONDITIONS,
      maConditions: MA_CONDITIONS,
      highLowConditions: HIGH_LOW_CONDITIONS,
      circuitConditions: CIRCUIT_CONDITIONS,
      corporateActionTypes: CORPORATE_ACTION_TYPES,
      supportedIndices: SUPPORTED_INDICES,
      watchlistEventTypes: WATCHLIST_EVENT_TYPES,
      financialMetrics: FINANCIAL_ALERT_METRICS,
      comparisonOperators: COMPARISON_OPERATORS,
      notificationCategories: NOTIFICATION_CATEGORIES,
      announcementCategories: ANNOUNCEMENT_CATEGORIES,
    });
  },

  async evaluateAlerts(_req: Request, res: Response): Promise<void> {
    const summary = await alertScheduler.runEvaluation();
    sendSuccess(res, summary);
  },

  getSchedulerStatus(_req: Request, res: Response): void {
    const status = alertScheduler.getStatus();
    sendSuccess(res, status);
  },
};
