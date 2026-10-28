import { z } from 'zod';
import type {
  ScreenerMetricDomain,
} from '@equitylensai/shared';

export type ScreenerMetric =
  | 'roe'
  | 'roa'
  | 'roce'
  | 'gross_margin'
  | 'operating_margin'
  | 'net_margin'
  | 'debt_to_equity'
  | 'current_ratio'
  | 'quick_ratio'
  | 'interest_coverage'
  | 'revenue_growth'
  | 'net_income_growth'
  | 'eps_growth'
  | 'free_cash_flow_margin'
  | 'pe_ratio'
  | 'price_to_book'
  | 'financial_health_score';

export type ScreenerPeriod = 'annual' | 'ttm';
export type ScreenerOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export type ScreenerMetricDefinition = {
  label: string;
  description: string;
  category: ScreenerMetricDomain;
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
    description: 'Net income returned as a percentage of shareholders equity (Net Income / Equity * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['return on equity', 'roe'],
    analysisPath: 'profitability.returnOnEquity',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  roa: {
    label: 'Return on assets (ROA)',
    description: 'Net income generated relative to total assets (Net Income / Total Assets * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['return on assets', 'roa'],
    analysisPath: 'profitability.returnOnAssets',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  roce: {
    label: 'Return on capital employed (ROCE)',
    description: 'Operating profit relative to capital employed (EBIT / (Total Assets - Current Liabilities) * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['return on capital employed', 'roce'],
    analysisPath: 'profitability.returnOnCapitalEmployed',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  gross_margin: {
    label: 'Gross profit margin',
    description: 'Gross profit as a percentage of total revenue (Gross Profit / Revenue * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['gross profit margin', 'gross margin', 'gp margin'],
    analysisPath: 'profitability.grossMargin',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  operating_margin: {
    label: 'Operating profit margin',
    description: 'Operating income (EBIT) as a percentage of revenue (Operating Income / Revenue * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['operating profit margin', 'operating margin', 'ebit margin', 'operating profit'],
    analysisPath: 'profitability.operatingMargin',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  net_margin: {
    label: 'Net profit margin',
    description: 'Net income as a percentage of total revenue (Net Income / Revenue * 100).',
    category: 'profitability',
    unit: 'percent',
    aliases: ['net profit margin', 'net margin'],
    analysisPath: 'profitability.netMargin',
    periods: ['annual', 'ttm'],
    minimum: -1000,
    maximum: 1000,
  },
  debt_to_equity: {
    label: 'Debt-to-equity',
    description: 'Total short and long-term debt relative to shareholders equity.',
    category: 'leverage',
    unit: 'ratio',
    aliases: ['debt-to-equity', 'debt to equity', 'd/e'],
    analysisPath: 'leverage.debtToEquity',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 10000,
  },
  current_ratio: {
    label: 'Current ratio',
    description: 'Current assets divided by current liabilities; measures short-term liquidity.',
    category: 'liquidity',
    unit: 'ratio',
    aliases: ['current ratio'],
    analysisPath: 'liquidity.currentRatio',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 10000,
  },
  quick_ratio: {
    label: 'Quick ratio (Acid Test)',
    description: 'Liquid assets (Current Assets - Inventory) relative to current liabilities.',
    category: 'liquidity',
    unit: 'ratio',
    aliases: ['quick ratio', 'acid test', 'acid-test ratio'],
    analysisPath: 'liquidity.quickRatio',
    periods: ['annual', 'ttm'],
    minimum: 0,
    maximum: 10000,
  },
  interest_coverage: {
    label: 'Interest coverage ratio',
    description: 'Operating income divided by absolute interest expense (EBIT / |Interest Expense|).',
    category: 'leverage',
    unit: 'ratio',
    aliases: ['interest coverage', 'interest coverage ratio', 'times interest earned'],
    analysisPath: 'leverage.interestCoverageRatio',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 100000,
  },
  revenue_growth: {
    label: 'Revenue growth year over year',
    description: 'Annual percentage change in total revenue compared to prior year.',
    category: 'growth',
    unit: 'percent',
    aliases: ['revenue growth', 'sales growth'],
    analysisPath: 'growth.revenueGrowthYoY',
    periods: ['annual'],
    minimum: -1000,
    maximum: 10000,
  },
  net_income_growth: {
    label: 'Net income growth year over year',
    description: 'Annual percentage change in net income compared to prior year.',
    category: 'growth',
    unit: 'percent',
    aliases: ['net income growth', 'profit growth'],
    analysisPath: 'growth.netIncomeGrowthYoY',
    periods: ['annual'],
    minimum: -10000,
    maximum: 10000,
  },
  eps_growth: {
    label: 'Diluted EPS growth year over year',
    description: 'Annual percentage change in diluted earnings per share YoY.',
    category: 'growth',
    unit: 'percent',
    aliases: ['eps growth', 'earnings per share growth', 'diluted eps growth'],
    analysisPath: 'growth.epsGrowthYoY',
    periods: ['annual'],
    minimum: -10000,
    maximum: 10000,
  },
  free_cash_flow_margin: {
    label: 'Free cash flow margin',
    description: 'Free cash flow as a percentage of total revenue (Free Cash Flow / Revenue * 100).',
    category: 'cash_flow',
    unit: 'percent',
    aliases: ['free cash flow margin', 'fcf margin'],
    analysisPath: 'cashFlow.freeCashFlowMargin',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  pe_ratio: {
    label: 'Price-to-earnings ratio',
    description: 'Market stock price divided by earnings per share; evaluates valuation relative to profit.',
    category: 'valuation',
    unit: 'ratio',
    aliases: ['price-to-earnings', 'price to earnings', 'p/e'],
    analysisPath: 'valuation.peRatio',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  price_to_book: {
    label: 'Price-to-book ratio',
    description: 'Market stock price divided by book value per share.',
    category: 'valuation',
    unit: 'ratio',
    aliases: ['price-to-book', 'price to book', 'p/b'],
    analysisPath: 'valuation.priceToBook',
    periods: ['annual', 'ttm'],
    minimum: -10000,
    maximum: 10000,
  },
  financial_health_score: {
    label: 'Financial health score',
    description: 'Deterministic 0–100 composite financial health score evaluated across profitability, liquidity, leverage, cash flow, and growth.',
    category: 'financial_health',
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
    id: z.string().optional(),
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

export type ScreenerFilter = z.infer<typeof screenerFilterSchema>;
export type ScreenerCondition = ScreenerFilter;

export type ScreenerFilterGroup = {
  id?: string | undefined;
  logic: 'AND' | 'OR';
  conditions: Array<ScreenerCondition | ScreenerFilterGroup>;
};

export function isFilterGroup(item: unknown): item is ScreenerFilterGroup {
  return (
    typeof item === 'object' &&
    item !== null &&
    'logic' in item &&
    'conditions' in item &&
    Array.isArray((item as ScreenerFilterGroup).conditions)
  );
}

export function countConditions(group: ScreenerFilterGroup): number {
  let count = 0;
  for (const item of group.conditions) {
    if (isFilterGroup(item)) {
      count += countConditions(item);
    } else {
      count += 1;
    }
  }
  return count;
}

export function getGroupDepth(group: ScreenerFilterGroup, currentDepth = 1): number {
  let maxDepth = currentDepth;
  for (const item of group.conditions) {
    if (isFilterGroup(item)) {
      const depth = getGroupDepth(item, currentDepth + 1);
      if (depth > maxDepth) maxDepth = depth;
    }
  }
  return maxDepth;
}

export function flattenConditions(group: ScreenerFilterGroup): ScreenerCondition[] {
  const list: ScreenerCondition[] = [];
  for (const item of group.conditions) {
    if (isFilterGroup(item)) {
      list.push(...flattenConditions(item));
    } else {
      list.push(item);
    }
  }
  return list;
}

export const screenerFilterGroupSchema: z.ZodType<ScreenerFilterGroup, z.ZodTypeDef, unknown> = z.lazy(() =>
  z
    .object({
      id: z.string().optional(),
      logic: z.enum(['AND', 'OR']),
      conditions: z.array(z.union([screenerFilterSchema, screenerFilterGroupSchema])).min(1),
    })
    .strict()
    .superRefine((group, context) => {
      const typedGroup = group as ScreenerFilterGroup;
      const depth = getGroupDepth(typedGroup);
      if (depth > 3) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['conditions'],
          message: `Nested filter group depth exceeds limit of 3 (current: ${depth}).`,
        });
      }
      const totalConditions = countConditions(typedGroup);
      if (totalConditions > 15) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['conditions'],
          message: `Total filter conditions exceed limit of 15 (current: ${totalConditions}).`,
        });
      }
    }),
);

export const screenerStrategyDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    rootGroup: screenerFilterGroupSchema,
    exchange: z.enum(['NSE', 'BSE']).nullable().optional(),
    period: screenerPeriodSchema.default('annual'),
    sort: z
      .object({
        field: z.string().max(60).nullable(),
        direction: z.enum(['asc', 'desc']),
      })
      .strict()
      .default({ field: 'symbol', direction: 'asc' }),
    selectedColumns: z.array(z.string().max(60)).max(20).optional(),
  })
  .strict()
  .superRefine((def, context) => {
    const conditions = flattenConditions(def.rootGroup);
    for (const [index, filter] of conditions.entries()) {
      const metric = SCREENER_METRICS[filter.field as ScreenerMetric];
      if (metric && !metric.periods.includes(def.period)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rootGroup', 'conditions', index, 'field'],
          message: `${metric.label} is not available for the ${def.period} period.`,
        });
      }
    }
    if (
      def.sort.field !== null &&
      def.sort.field !== 'symbol' &&
      !(def.sort.field in SCREENER_METRICS)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sort', 'field'],
        message: 'Sorting is limited to the metric allowlist or symbol.',
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
    query: z.string().trim().min(1).max(500).default('Custom stock screen'),
    exchange: z.enum(['NSE', 'BSE']).nullable().optional(),
    assetType: z.literal('equity').default('equity'),
    period: screenerPeriodSchema.default('annual'),
    filters: z.array(screenerFilterSchema).min(1).max(15).optional(),
    logic: z.enum(['AND', 'OR']).default('AND'),
    rootGroup: screenerFilterGroupSchema.optional(),
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
    if (!request.rootGroup && (!request.filters || request.filters.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filters'],
        message: 'At least one filter condition or a root group must be provided.',
      });
      return;
    }

    const conditions: ScreenerCondition[] = request.rootGroup
      ? flattenConditions(request.rootGroup)
      : (request.filters ?? []);

    for (const [index, filter] of conditions.entries()) {
      const metric = SCREENER_METRICS[filter.field as ScreenerMetric];
      if (metric && !metric.periods.includes(request.period)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: request.rootGroup ? ['rootGroup', 'conditions', index, 'field'] : ['filters', index, 'field'],
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
      .max(10),
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
export type ScreenerPeriodType = z.infer<typeof screenerPeriodSchema>;
export type ScreenerModelResponse = z.infer<typeof screenerModelResponseSchema>;
export type ScreenerStrategyDefinition = z.infer<typeof screenerStrategyDefinitionSchema>;

export function getScreenerMetricCatalog() {
  return Object.entries(SCREENER_METRICS).map(([id, metric]) => ({
    id: id as ScreenerMetric,
    ...metric,
    availableInFinancialAnalysis: true,
    availableForScreenerExecution: true,
    statementScope:
      'provider-reported statement scope; not classified as consolidated or standalone',
    missingDataBehavior: 'excluded; missing values are never treated as zero',
  }));
}
