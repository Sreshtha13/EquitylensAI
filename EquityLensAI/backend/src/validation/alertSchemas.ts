import { z } from 'zod';
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

const unusualVolumeConfigSchema = z.object({
  type: z.literal('unusual_volume'),
  multiplier: z.number().positive('Multiplier must be positive').finite(),
  baselineDays: z.union([z.literal(5), z.literal(10), z.literal(20)]),
});

const rsiConfigSchema = z.object({
  type: z.literal('rsi'),
  condition: z.enum(RSI_CONDITIONS),
  threshold: z.number().min(0).max(100, 'RSI threshold must be between 0 and 100'),
  period: z.number().int().min(2).max(100).optional(),
});

const macdConfigSchema = z.object({
  type: z.literal('macd'),
  condition: z.enum(MACD_CONDITIONS),
  fastPeriod: z.number().int().min(2).optional(),
  slowPeriod: z.number().int().min(5).optional(),
  signalPeriod: z.number().int().min(2).optional(),
});

const movingAverageConfigSchema = z.object({
  type: z.literal('moving_average'),
  condition: z.enum(MA_CONDITIONS),
  period: z.union([z.literal(20), z.literal(50), z.literal(200)]).optional(),
});

const highLowConfigSchema = z.object({
  type: z.literal('52w_high_low'),
  condition: z.enum(HIGH_LOW_CONDITIONS),
  tolerancePercent: z.number().min(0).max(50).optional(),
});

const circuitConfigSchema = z.object({
  type: z.literal('circuit'),
  condition: z.enum(CIRCUIT_CONDITIONS),
});

const announcementConfigSchema = z.object({
  type: z.literal('announcement'),
  scope: z.enum(['stock', 'watchlist']),
  categories: z.array(z.enum(ANNOUNCEMENT_CATEGORIES)).optional(),
});

const corporateActionConfigSchema = z.object({
  type: z.literal('corporate_action'),
  actionType: z.enum(CORPORATE_ACTION_TYPES),
});

const financialResultsConfigSchema = z.object({
  type: z.literal('financial_results'),
  scope: z.enum(['stock', 'watchlist']),
});

const financialMetricConfigSchema = z.object({
  type: z.literal('financial_metric'),
  metric: z.enum(FINANCIAL_ALERT_METRICS),
  operator: z.enum(COMPARISON_OPERATORS),
  thresholdValue: z.number().finite('Threshold value must be finite'),
  periodType: z.enum(['annual', 'quarterly', 'ttm']).optional(),
});

const indexMovementConfigSchema = z.object({
  type: z.literal('index_movement'),
  indexSymbol: z.enum(SUPPORTED_INDICES),
  condition: z.enum(['rises_above', 'falls_below', 'percent_change']),
  threshold: z.number().finite(),
});

const watchlistEventConfigSchema = z.object({
  type: z.literal('watchlist_event'),
  eventType: z.enum(WATCHLIST_EVENT_TYPES),
  thresholdPercent: z.number().positive().optional(),
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
  unusualVolumeConfigSchema,
  rsiConfigSchema,
  macdConfigSchema,
  movingAverageConfigSchema,
  highLowConfigSchema,
  circuitConfigSchema,
  announcementConfigSchema,
  corporateActionConfigSchema,
  financialResultsConfigSchema,
  financialMetricConfigSchema,
  indexMovementConfigSchema,
  watchlistEventConfigSchema,
  newsConfigSchema,
]);

export const createAlertRuleSchema = z
  .object({
    name: z.string().min(1, 'Rule name is required').max(150, 'Rule name too long').trim(),
    alertType: z.enum(ALERT_TYPES),
    symbol: z.string().trim().toUpperCase().optional().nullable(),
    exchange: z.enum(SUPPORTED_EXCHANGES).optional().nullable(),
    status: z.enum(ALERT_STATUSES).optional().default('ACTIVE'),
    triggerType: z.enum(ALERT_TRIGGER_TYPES).optional().default('recurring'),
    expiresAt: z.string().datetime().optional().nullable(),
    deliveryChannels: z.array(z.enum(['in_app', 'email', 'push'])).optional().default(['in_app']),
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
    const requiresSymbol = [
      'price',
      'percentage_change',
      'volume',
      'unusual_volume',
      'rsi',
      'macd',
      'moving_average',
      '52w_high_low',
      'circuit',
      'financial_metric',
    ];
    if (requiresSymbol.includes(val.alertType) && (!val.symbol || val.symbol.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbol'],
        message: `Symbol is required for ${val.alertType} alerts`,
      });
    }

    // Announcement / News / Financial Results with scope 'stock' requires symbol
    if (
      (val.ruleConfig.type === 'announcement' ||
        val.ruleConfig.type === 'financial_results' ||
        val.ruleConfig.type === 'news') &&
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
  status: z.enum(ALERT_STATUSES).optional(),
  triggerType: z.enum(ALERT_TRIGGER_TYPES).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  deliveryChannels: z.array(z.enum(['in_app', 'email', 'push'])).optional(),
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
  archived: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateAlertPreferencesSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  emailAddress: z.string().email().optional().nullable(),
  pushEnabled: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  percentageAlerts: z.boolean().optional(),
  volumeAlerts: z.boolean().optional(),
  technicalAlerts: z.boolean().optional(),
  financialAlerts: z.boolean().optional(),
  announcementAlerts: z.boolean().optional(),
  newsAlerts: z.boolean().optional(),
  marketSummaries: z.boolean().optional(),
  researchUpdates: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  digestFrequency: z.enum(['realtime', 'daily', 'weekly', 'off']).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  timeZone: z.string().optional(),
});

export const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional().nullable(),
});
