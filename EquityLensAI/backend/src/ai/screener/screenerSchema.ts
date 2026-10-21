import { z } from 'zod';

export type ScreenerMetric =
  | 'roe'
  | 'roa'
  | 'roce'
  | 'net_margin'
  | 'debt_to_equity'
  | 'revenue_growth'
  | 'net_income_growth'
  | 'free_cash_flow_margin'
  | 'current_ratio'
  | 'pe_ratio'
  | 'price_to_book'
  | 'financial_health_score';
export type ScreenerPeriod = 'annual' | 'ttm';
export type ScreenerOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

type ScreenerMetricDefinition = {
  label: string;
  unit: 'percent' | 'ratio' | 'score';
  aliases: readonly string[];
  analysisPath: string;
  periods: readonly ScreenerPeriod[];
  minimum: number;
  maximum: number;
};

export const SCREENER_METRICS: Record<ScreenerMetric, ScreenerMetricDefinition> = {
  roe: {
    label: 'Return on equity (ROE)',
    unit: 'percent',
    aliases: ['return on equity', 'roe'],
    analysisPath: 'profitability.returnOnEquity',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  roa: {
    label: 'Return on assets (ROA)',
    unit: 'percent',
    aliases: ['return on assets', 'roa'],
    analysisPath: 'profitability.returnOnAssets',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  roce: {
    label: 'Return on capital employed (ROCE)',
    unit: 'percent',
    aliases: ['return on capital employed', 'roce'],
    analysisPath: 'profitability.returnOnCapitalEmployed',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  net_margin: {
    label: 'Net profit margin',
    unit: 'percent',
    aliases: ['net profit margin', 'net margin'],
    analysisPath: 'profitability.netMargin',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  debt_to_equity: {
    label: 'Debt-to-equity',
    unit: 'ratio',
    aliases: ['debt-to-equity', 'debt to equity', 'd/e'],
    analysisPath: 'leverage.debtToEquity',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 10000,
  },
  revenue_growth: {
    label: 'Revenue growth year over year',
    unit: 'percent',
    aliases: ['revenue growth', 'sales growth'],
    analysisPath: 'growth.revenueGrowthYoY',
    periods: ['annual'],
    minimum: -1000,
    maximum: 10000,
  },
  net_income_growth: {
    label: 'Net income growth year over year',
    unit: 'percent',
    aliases: ['net income growth', 'profit growth'],
    analysisPath: 'growth.netIncomeGrowthYoY',
    periods: ['annual'],
    minimum: -10000,
    maximum: 10000,
  },
  free_cash_flow_margin: {
    label: 'Free cash flow margin',
    unit: 'percent',
    aliases: ['free cash flow margin', 'fcf margin'],
    analysisPath: 'cashFlow.freeCashFlowMargin',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  current_ratio: {
    label: 'Current ratio',
    unit: 'ratio',
    aliases: ['current ratio'],
    analysisPath: 'liquidity.currentRatio',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 10000,
  },
  pe_ratio: {
    label: 'Price-to-earnings ratio',
    unit: 'ratio',
    aliases: ['price-to-earnings', 'price to earnings', 'p/e'],
    analysisPath: 'valuation.peRatio',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  price_to_book: {
    label: 'Price-to-book ratio',
    unit: 'ratio',
    aliases: ['price-to-book', 'price to book', 'p/b'],
    analysisPath: 'valuation.priceToBook',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  financial_health_score: {
    label: 'Financial health score',
    unit: 'score',
    aliases: ['financial health score', 'health score'],
    analysisPath: 'healthScore.overallScore',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 100,
  },
};

export const screenerOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between']);

export const screenerPeriodSchema = z.enum(['annual', 'ttm']);

const filterShape = z
  .object({
    field: z.string().min(1).max(60),
    operator: screenerOperatorSchema,
    value: z.number().finite(),
    upperValue: z.number().finite().nullable().optional(),
  })
  .strict();

export const screenerFilterSchema = filterShape.superRefine((filter, context) => {
  const metric = SCREENER_METRICS[filter.field as ScreenerMetric];
  if (!metric) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['field'],
      message: 'This metric is not in the screener allowlist.',
    });
    return;
  }

  if (filter.value < metric.minimum || filter.value > metric.maximum) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `Value must be between ${metric.minimum} and ${metric.maximum}.`,
    });
  }

  if (filter.operator === 'between') {
    if (
      filter.upperValue === undefined ||
      filter.upperValue === null ||
      filter.upperValue <= filter.value ||
      filter.upperValue > metric.maximum
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['upperValue'],
        message: 'A between filter requires a greater upper value within the metric range.',
      });
    }
  } else if (filter.upperValue !== undefined && filter.upperValue !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['upperValue'],
      message: 'upperValue is only valid with the between operator.',
    });
  }
});

export const screenerInterpretationRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    exchange: z.enum(['NSE', 'BSE']).optional(),
    period: screenerPeriodSchema.default('annual'),
  })
  .strict();

export const screenerRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    exchange: z.enum(['NSE', 'BSE']).optional(),
    assetType: z.literal('equity').default('equity'),
    period: screenerPeriodSchema.default('annual'),
    filters: z.array(screenerFilterSchema).min(1).max(5),
    logic: z.enum(['AND', 'OR']),
    sort: z
      .object({
        field: z.string().max(60).nullable(),
        direction: z.enum(['asc', 'desc']),
      })
      .strict()
      .default({ field: 'symbol', direction: 'asc' }),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(100000).default(0),
  })
  .strict()
  .superRefine((request, context) => {
    for (const [index, filter] of request.filters.entries()) {
      const metric = SCREENER_METRICS[filter.field as ScreenerMetric];
      if (metric && !metric.periods.includes(request.period)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['filters', index, 'field'],
          message: `${metric.label} is not available for the ${request.period} period.`,
        });
      }
    }
    if (
      request.sort.field !== null &&
      request.sort.field !== 'symbol' &&
      !(request.sort.field in SCREENER_METRICS)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sort', 'field'],
        message: 'Sorting is limited to the metric allowlist or symbol.',
      });
    }
  });

export const screenerModelResponseSchema = z
  .object({
    querySummary: z.string().trim().min(1).max(200),
    filters: z
      .array(
        z
          .object({
            field: z.string().min(1).max(60),
            operator: screenerOperatorSchema,
            value: z.number().finite(),
            upperValue: z.number().finite().nullable(),
          })
          .strict(),
      )
      .max(5),
    logic: z.enum(['AND', 'OR']),
    exchange: z.enum(['NSE', 'BSE']).nullable(),
    period: screenerPeriodSchema,
    sort: z
      .object({
        field: z.string().max(60).nullable(),
        direction: z.enum(['asc', 'desc']),
      })
      .strict(),
    limit: z.number().int().min(1).max(100),
    clarificationNeeded: z.boolean(),
    warnings: z.array(z.string().trim().min(1).max(250)).max(5),
  })
  .strict();

export const screenerModelJsonSchema = {
  type: 'OBJECT',
  properties: {
    querySummary: { type: 'STRING' },
    filters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING', enum: Object.keys(SCREENER_METRICS) },
          operator: { type: 'STRING', enum: screenerOperatorSchema.options },
          value: { type: 'NUMBER' },
          upperValue: { type: 'NUMBER', nullable: true },
        },
        required: ['field', 'operator', 'value', 'upperValue'],
      },
    },
    logic: { type: 'STRING', enum: ['AND', 'OR'] },
    exchange: { type: 'STRING', enum: ['NSE', 'BSE'], nullable: true },
    period: { type: 'STRING', enum: ['annual', 'ttm'] },
    sort: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          enum: [...Object.keys(SCREENER_METRICS), 'symbol'],
          nullable: true,
        },
        direction: { type: 'STRING', enum: ['asc', 'desc'] },
      },
      required: ['field', 'direction'],
    },
    limit: { type: 'INTEGER' },
    clarificationNeeded: { type: 'BOOLEAN' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'querySummary',
    'filters',
    'logic',
    'exchange',
    'period',
    'sort',
    'limit',
    'clarificationNeeded',
    'warnings',
  ],
};

export type ScreenerInterpretationRequest = z.input<typeof screenerInterpretationRequestSchema>;
export type NormalizedScreenerInterpretationRequest = z.output<
  typeof screenerInterpretationRequestSchema
>;
export type ScreenerRequest = z.infer<typeof screenerRequestSchema>;
export type ScreenerFilter = z.infer<typeof screenerFilterSchema>;
export type ScreenerPeriodType = z.infer<typeof screenerPeriodSchema>;
export type ScreenerModelResponse = z.infer<typeof screenerModelResponseSchema>;

export function getScreenerMetricCatalog() {
  return Object.entries(SCREENER_METRICS).map(([id, metric]) => ({
    id,
    ...metric,
    availableInFinancialAnalysis: true,
    availableForScreenerExecution: true,
    statementScope:
      'provider-reported statement scope; not classified as consolidated or standalone',
    missingDataBehavior: 'excluded; missing values are never treated as zero',
  }));
}
