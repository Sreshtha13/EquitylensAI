import { z } from 'zod';
import {
  ALERT_TYPES,
  PRICE_CONDITIONS,
  PERCENTAGE_CHANGE_PERIODS,
  PERCENTAGE_DIRECTIONS,
  FINANCIAL_ALERT_METRICS,
  COMPARISON_OPERATORS,
  NOTIFICATION_CATEGORIES,
  SUPPORTED_EXCHANGES,
  ANNOUNCEMENT_CATEGORIES,
} from '@equitylensai/shared';

const priceConfigSchema = z.object({
  type: z.literal('price'),
  condition: z.enum(PRICE_CONDITIONS),
  targetPrice: z.number().positive('Target price must be greater than 0').finite(),
  currency: z.string().optional(),
});

const percentageChangeConfigSchema = z.object({
  type: z.literal('percentage_change'),
  period: z.enum(PERCENTAGE_CHANGE_PERIODS),
  targetPercent: z.number().positive('Target percentage must be positive').finite(),
  direction: z.enum(PERCENTAGE_DIRECTIONS),
});

const volumeConfigSchema = z.object({
  type: z.literal('volume'),
  condition: z.literal('exceeds'),
  targetVolume: z.number().positive('Target volume must be greater than 0').finite(),
});

const financialMetricConfigSchema = z.object({
  type: z.literal('financial_metric'),
  metric: z.enum(FINANCIAL_ALERT_METRICS),
  operator: z.enum(COMPARISON_OPERATORS),
  thresholdValue: z.number().finite('Threshold value must be finite'),
  periodType: z.enum(['annual', 'quarterly', 'ttm']).optional(),
});

const announcementConfigSchema = z.object({
  type: z.literal('announcement'),
  scope: z.enum(['stock', 'watchlist']),
  categories: z.array(z.enum(ANNOUNCEMENT_CATEGORIES)).optional(),
});

const newsConfigSchema = z.object({
  type: z.literal('news'),
  scope: z.enum(['stock', 'watchlist']),
  keywords: z.array(z.string().min(1).max(50)).optional(),
});

export const alertRuleConfigSchema = z.discriminatedUnion('type', [
  priceConfigSchema,
  percentageChangeConfigSchema,
  volumeConfigSchema,
  financialMetricConfigSchema,
  announcementConfigSchema,
  newsConfigSchema,
]);

export const createAlertRuleSchema = z
  .object({
    name: z.string().min(1, 'Rule name is required').max(150, 'Rule name too long').trim(),
    alertType: z.enum(ALERT_TYPES),
    symbol: z.string().trim().toUpperCase().optional().nullable(),
    exchange: z.enum(SUPPORTED_EXCHANGES).optional().nullable(),
    cooldownMinutes: z.number().int().min(0).max(43200).default(60),
    ruleConfig: alertRuleConfigSchema,
  })
  .superRefine((val, ctx) => {
    // AlertType must match ruleConfig.type
    if (val.alertType !== val.ruleConfig.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ruleConfig'],
        message: `ruleConfig type '${val.ruleConfig.type}' does not match alertType '${val.alertType}'`,
      });
    }

    // Stock-specific rules require symbol
    const requiresSymbol = ['price', 'percentage_change', 'volume', 'financial_metric'];
    if (requiresSymbol.includes(val.alertType) && (!val.symbol || val.symbol.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbol'],
        message: `Symbol is required for ${val.alertType} alerts`,
      });
    }

    // Announcement / News with scope 'stock' requires symbol
    if (
      (val.ruleConfig.type === 'announcement' || val.ruleConfig.type === 'news') &&
      val.ruleConfig.scope === 'stock' &&
      (!val.symbol || val.symbol.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbol'],
        message: 'Symbol is required when scope is set to stock',
      });
    }
  });

export const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(150).trim().optional(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).max(43200).optional(),
  ruleConfig: alertRuleConfigSchema.optional(),
});

export const listAlertsQuerySchema = z.object({
  alertType: z.enum(ALERT_TYPES).optional(),
  enabled: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  symbol: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateAlertPreferencesSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  emailAddress: z.string().email().optional().nullable(),
  priceAlerts: z.boolean().optional(),
  percentageAlerts: z.boolean().optional(),
  volumeAlerts: z.boolean().optional(),
  financialAlerts: z.boolean().optional(),
  announcementAlerts: z.boolean().optional(),
  newsAlerts: z.boolean().optional(),
  digestFrequency: z.enum(['realtime', 'daily', 'off']).optional(),
});
