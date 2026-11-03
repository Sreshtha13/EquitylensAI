import { getEnv } from '../../config/index.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';
import {
  flattenConditions,
  type ScreenerFilter,
  type ScreenerFilterGroup,
  type ScreenerRequest,
} from './screenerSchema.js';

export type ScreenerMetricValue = {
  value: number | null;
  unit: 'percent' | 'ratio' | 'score';
  periodEndDate: string;
  formula?: string | undefined;
};

export type ScreenerMetricRow = {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE';
  assetType: 'equity';
  currency: string;
  periodType: 'annual' | 'ttm';
  periodEndDate: string;
  source: string;
  retrievedAt: string;
  isStale: boolean;
  metrics: Record<string, ScreenerMetricValue>;
};

export type ScreenerResult = {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE';
  currency: string;
  period: string;
  periodType: 'annual' | 'ttm';
  source: string;
  retrievedAt: string;
  isStale: boolean;
  metrics: Record<string, ScreenerMetricValue>;
};

export type ScreenerExecutionResponse = {
  querySummary: string;
  filters: ScreenerFilter[];
  logic: 'AND' | 'OR';
  rootGroup?: ScreenerFilterGroup;
  exchange: 'NSE' | 'BSE' | null;
  period: 'annual' | 'ttm';
  totalMatches: number;
  pagination: { offset: number; limit: number; total: number };
  results: ScreenerResult[];
  coverage: {
    indexedCompanies: number;
    staleIndexedCompanies: number;
    expectedCompanies: number;
    refreshCompleted: boolean;
    refreshedAt: string | null;
    isPartial: boolean;
  };
  warnings: string[];
};

function getDatabaseConfiguration() {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      'SCREENER_DATA_UNAVAILABLE',
      'Screener execution requires a configured financial-metrics database.',
      503,
    );
  }
  return {
    baseUrl: env.SUPABASE_URL.replace(/\/+$/, ''),
    key: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function databaseRequest<T>(
  resource: string,
  init: RequestInit,
  operation: string,
): Promise<T> {
  const { baseUrl, key } = getDatabaseConfiguration();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/${resource}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
  } catch (error) {
    logger.error(
      { operation, errorName: error instanceof Error ? error.name : 'UnknownError' },
      'financial_screener_database_request_failed',
    );
    throw new AppError(
      'SCREENER_DATA_UNAVAILABLE',
      'The financial-metrics database could not be reached.',
      503,
      { cause: error },
    );
  }

  if (!response.ok) {
    logger.error(
      { operation, statusCode: response.status },
      'financial_screener_database_request_failed',
    );
    throw new AppError(
      'SCREENER_DATA_UNAVAILABLE',
      'The financial-metrics database is unavailable or not configured for screener operations.',
      response.status === 401 || response.status === 403 ? 503 : 502,
    );
  }

  try {
    const responseBody = await response.text();
    if (responseBody.trim().length === 0) return undefined as T;
    return JSON.parse(responseBody) as T;
  } catch (error) {
    logger.error(
      { operation, errorName: error instanceof Error ? error.name : 'UnknownError' },
      'financial_screener_database_response_invalid',
    );
    throw new AppError(
      'SCREENER_DATA_UNAVAILABLE',
      'The financial-metrics database returned an invalid response.',
      502,
      { cause: error },
    );
  }
}

export async function upsertScreenerMetrics(rows: ScreenerMetricRow[]): Promise<void> {
  if (rows.length === 0) return;
  await databaseRequest<undefined>(
    'financial_screener_metrics?on_conflict=symbol%2Cexchange%2Cperiod_type',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(
        rows.map((row) => ({
          symbol: row.symbol,
          company_name: row.companyName,
          exchange: row.exchange,
          asset_type: row.assetType,
          currency: row.currency,
          period_type: row.periodType,
          period_end_date: row.periodEndDate,
          source: row.source,
          retrieved_at: row.retrievedAt,
          is_stale: row.isStale,
          metrics: row.metrics,
        })),
      ),
    },
    'upsert_metrics',
  );
}

export async function updateScreenerCoverage(input: {
  exchange: 'NSE' | 'BSE';
  expectedInstruments: number;
  refreshCompleted: boolean;
}): Promise<void> {
  await databaseRequest<undefined>(
    'financial_screener_coverage?on_conflict=exchange',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        exchange: input.exchange,
        expected_instruments: input.expectedInstruments,
        refresh_completed: input.refreshCompleted,
        refreshed_at: new Date().toISOString(),
      }),
    },
    'update_coverage',
  );
}


import { instrumentRepository } from '../../market/instruments/repository.js';
import { SCREENER_METRICS, isFilterGroup } from './screenerSchema.js';

function getInstrumentMetricValue(
  inst: ReturnType<typeof instrumentRepository.list>[number],
  field: string,
): number | string | null {
  const meta = (inst.metadata ?? {}) as Record<string, unknown>;

  if (field === 'sector') {
    return (meta.sector as string) ?? null;
  }
  if (field === 'industry') {
    return (meta.industry as string) ?? null;
  }
  if (field === 'classification') {
    return inst.classification ?? (meta.classification as string) ?? 'MAIN';
  }
  if (field === 'stock_price' || field === 'price') {
    if (typeof meta.price === 'number') return meta.price;
    if (typeof meta.cmp === 'number') return meta.cmp;
    return null;
  }
  if (field === 'market_cap') {
    if (typeof meta.marketCap === 'number') return meta.marketCap;
    return null;
  }
  if (field === 'price_change_pct' || field === 'change_percent') {
    if (typeof meta.changePercent === 'number') return meta.changePercent;
    return null;
  }
  if (field === 'volume') {
    if (typeof meta.volume === 'number') return meta.volume;
    return null;
  }
  if (field === 'turnover') {
    if (typeof meta.turnover === 'number') return meta.turnover;
    return null;
  }
  if (field === 'dividend_yield') {
    if (typeof meta.dividendYield === 'number') return meta.dividendYield;
    return null;
  }
  if (field === 'fifty_two_week_high') {
    if (typeof meta.fiftyTwoWeekHigh === 'number') return meta.fiftyTwoWeekHigh;
    return null;
  }
  if (field === 'fifty_two_week_low') {
    if (typeof meta.fiftyTwoWeekLow === 'number') return meta.fiftyTwoWeekLow;
    return null;
  }
  if (field === 'pe_ratio') {
    if (typeof meta.peRatio === 'number') return meta.peRatio;
    return null;
  }
  if (field === 'price_to_book') {
    if (typeof meta.priceToBook === 'number') return meta.priceToBook;
    return null;
  }
  if (field === 'eps') {
    if (typeof meta.eps === 'number') return meta.eps;
    return null;
  }
  if (field === 'roe') {
    if (typeof meta.roe === 'number') return meta.roe;
    return null;
  }
  if (field === 'roa') {
    if (typeof meta.roa === 'number') return meta.roa;
    return null;
  }
  if (field === 'roce') {
    if (typeof meta.roce === 'number') return meta.roce;
    return null;
  }
  if (field === 'debt_to_equity') {
    if (typeof meta.debtToEquity === 'number') return meta.debtToEquity;
    return null;
  }
  if (field === 'current_ratio') {
    if (typeof meta.currentRatio === 'number') return meta.currentRatio;
    return null;
  }
  if (field === 'quick_ratio') {
    if (typeof meta.quickRatio === 'number') return meta.quickRatio;
    return null;
  }
  if (field === 'interest_coverage') {
    if (typeof meta.interestCoverage === 'number') return meta.interestCoverage;
    return null;
  }
  if (field === 'revenue_growth') {
    if (typeof meta.revenueGrowth === 'number') return meta.revenueGrowth;
    return null;
  }
  if (field === 'net_income_growth' || field === 'profit_growth') {
    if (typeof meta.profitGrowth === 'number') return meta.profitGrowth;
    if (typeof meta.netIncomeGrowth === 'number') return meta.netIncomeGrowth;
    return null;
  }
  if (field === 'eps_growth') {
    if (typeof meta.epsGrowth === 'number') return meta.epsGrowth;
    return null;
  }
  if (field === 'gross_margin') {
    if (typeof meta.grossMargin === 'number') return meta.grossMargin;
    return null;
  }
  if (field === 'operating_margin') {
    if (typeof meta.operatingMargin === 'number') return meta.operatingMargin;
    return null;
  }
  if (field === 'net_margin') {
    if (typeof meta.netMargin === 'number') return meta.netMargin;
    return null;
  }
  if (field === 'free_cash_flow_margin') {
    if (typeof meta.freeCashFlowMargin === 'number') return meta.freeCashFlowMargin;
    return null;
  }
  if (field === 'financial_health_score') {
    if (typeof meta.financialHealthScore === 'number') return meta.financialHealthScore;
    return null;
  }

  const directVal = meta[field];
  if (typeof directVal === 'number' || typeof directVal === 'string') {
    return directVal;
  }
  return null;
}

function evaluateFilterCondition(
  condition: ScreenerFilter,
  inst: ReturnType<typeof instrumentRepository.list>[number],
): boolean {
  const val = getInstrumentMetricValue(inst, condition.field);
  // Missing financial data is NEVER treated as zero!
  if (val === null || val === undefined) {
    return false;
  }

  const op = condition.operator;
  const target = condition.value;

  if (typeof val === 'string' || typeof target === 'string') {
    const sVal = String(val).toLowerCase().trim();
    const sTarget = String(target).toLowerCase().trim();
    if (op === 'eq') return sVal === sTarget;
    if (op === 'neq') return sVal !== sTarget;
    if (op === 'contains') return sVal.includes(sTarget);
    if (op === 'in') {
      const parts = sTarget.split(',').map((p) => p.trim());
      return parts.includes(sVal);
    }
    return false;
  }

  const numVal = Number(val);
  const numTarget = Number(target);
  if (!Number.isFinite(numVal) || !Number.isFinite(numTarget)) return false;

  switch (op) {
    case 'eq':
      return Math.abs(numVal - numTarget) < 0.0001;
    case 'neq':
      return Math.abs(numVal - numTarget) >= 0.0001;
    case 'gt':
      return numVal > numTarget;
    case 'gte':
      return numVal >= numTarget;
    case 'lt':
      return numVal < numTarget;
    case 'lte':
      return numVal <= numTarget;
    case 'between': {
      const upper = Number(condition.upperValue);
      return Number.isFinite(upper) && numVal >= numTarget && numVal <= upper;
    }
    default:
      return false;
  }
}

function evaluateConditionItem(
  item: ScreenerFilter | ScreenerFilterGroup,
  inst: ReturnType<typeof instrumentRepository.list>[number],
): boolean {
  if (isFilterGroup(item)) {
    if (item.conditions.length === 0) return true;
    if (item.logic === 'OR') {
      return item.conditions.some((c) => evaluateConditionItem(c, inst));
    }
    return item.conditions.every((c) => evaluateConditionItem(c, inst));
  }
  return evaluateFilterCondition(item, inst);
}

export function executeLocalScreenerQuery(input: ScreenerRequest): ScreenerExecutionResponse {
  const allInstruments = instrumentRepository.list();
  const effectiveFilters = input.rootGroup
    ? flattenConditions(input.rootGroup)
    : (input.filters ?? []);

  const exchangeTarget = input.exchange ? input.exchange.toUpperCase() : null;

  const matched = allInstruments.filter((inst) => {
    if (exchangeTarget && inst.exchange.toUpperCase() !== exchangeTarget) {
      return false;
    }

    if (input.rootGroup && input.rootGroup.conditions.length > 0) {
      return evaluateConditionItem(input.rootGroup, inst);
    }

    if (input.filters && input.filters.length > 0) {
      if (input.logic === 'OR') {
        return input.filters.some((f) => evaluateFilterCondition(f, inst));
      }
      return input.filters.every((f) => evaluateFilterCondition(f, inst));
    }

    // Open universe (empty filters)
    return true;
  });

  const sortField = input.sort.field || 'symbol';
  const sortDir = input.sort.direction === 'desc' ? -1 : 1;

  matched.sort((a, b) => {
    if (sortField === 'symbol') {
      return a.symbol.localeCompare(b.symbol) * sortDir;
    }
    const aVal = getInstrumentMetricValue(a, sortField);
    const bVal = getInstrumentMetricValue(b, sortField);
    if (aVal === null && bVal === null) return a.symbol.localeCompare(b.symbol);
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return cmp !== 0 ? cmp * sortDir : a.symbol.localeCompare(b.symbol);
    }
    const numA = Number(aVal);
    const numB = Number(bVal);
    if (numA !== numB) {
      return (numA - numB) * sortDir;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  const totalMatches = matched.length;
  const paged = matched.slice(input.offset, input.offset + input.limit);

  const results: ScreenerResult[] = paged.map((inst) => {
    const metrics: Record<string, ScreenerMetricValue> = {};
    for (const [key, metricDef] of Object.entries(SCREENER_METRICS)) {
      const rawVal = getInstrumentMetricValue(inst, key);
      const numVal = rawVal !== null && typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;
      metrics[key] = {
        value: numVal,
        unit: metricDef.unit,
        periodEndDate: '2024-03-31',
      };
    }

    return {
      symbol: inst.symbol,
      companyName: inst.name,
      exchange: (inst.exchange.toUpperCase() === 'BSE' ? 'BSE' : 'NSE') as 'NSE' | 'BSE',
      currency: inst.currency || 'INR',
      period: input.period === 'ttm' ? 'TTM' : 'FY24',
      periodType: input.period,
      source: inst.source || 'Equity Universe',
      retrievedAt: inst.lastVerifiedAt || new Date().toISOString(),
      isStale: false,
      metrics,
    };
  });

  return {
    querySummary: input.query,
    filters: effectiveFilters,
    logic: input.rootGroup ? input.rootGroup.logic : input.logic,
    rootGroup: input.rootGroup ?? {
      logic: input.logic,
      conditions: input.filters ?? [],
    },
    exchange: input.exchange ?? null,
    period: input.period,
    totalMatches,
    pagination: { offset: input.offset, limit: input.limit, total: totalMatches },
    results,
    coverage: {
      indexedCompanies: allInstruments.length,
      staleIndexedCompanies: 0,
      expectedCompanies: allInstruments.length,
      refreshCompleted: true,
      refreshedAt: new Date().toISOString(),
      isPartial: false,
    },
    warnings: [],
  };
}

export async function executeScreenerQuery(
  input: ScreenerRequest,
): Promise<ScreenerExecutionResponse> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return executeLocalScreenerQuery(input);
  }

  try {
    const filterPayload = input.rootGroup ?? input.filters;
    const data = await databaseRequest<unknown>(
      'rpc/screen_financial_companies',
      {
        method: 'POST',
        body: JSON.stringify({
          p_filters: filterPayload,
          p_logic: input.logic,
          p_exchange: input.exchange ?? null,
          p_period: input.period,
          p_sort_field: input.sort.field ?? 'symbol',
          p_sort_direction: input.sort.direction,
          p_limit: input.limit,
          p_offset: input.offset,
        }),
      },
      'execute_screen',
    );

    const parsed = screenerDatabaseResponseSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn(
        { operation: 'execute_screen', validationIssueCount: parsed.error.issues.length },
        'financial_screener_database_response_invalid_falling_back_local',
      );
      return executeLocalScreenerQuery(input);
    }
    const result = parsed.data;

    const warnings: string[] = [];
    if (result.coverage.isPartial) {
      if (result.coverage.indexedCompanies < result.coverage.expectedCompanies) {
        warnings.push(
          `Results use partial coverage: ${result.coverage.indexedCompanies} of ${result.coverage.expectedCompanies} expected companies are indexed.`,
        );
      } else {
        warnings.push(
          'The latest instrument-universe refresh is incomplete; the result set may omit companies.',
        );
      }
    }
    if (result.coverage.staleIndexedCompanies > 0) {
      warnings.push(
        `${result.coverage.staleIndexedCompanies} indexed companies have stale data for this period.`,
      );
    }
    if (result.results.some((item) => item.isStale)) {
      warnings.push('One or more results use stale financial data; check each result timestamp.');
    }

    const effectiveFilters = input.rootGroup
      ? flattenConditions(input.rootGroup)
      : (input.filters ?? []);

    return {
      querySummary: input.query,
      filters: effectiveFilters,
      logic: input.rootGroup ? input.rootGroup.logic : input.logic,
      rootGroup: input.rootGroup ?? {
        logic: input.logic,
        conditions: input.filters ?? [],
      },
      exchange: input.exchange ?? null,
      period: input.period,
      totalMatches: result.totalMatches,
      pagination: { offset: input.offset, limit: input.limit, total: result.totalMatches },
      results: result.results,
      coverage: result.coverage,
      warnings,
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 503) {
      throw error;
    }
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'financial_screener_remote_database_failed_falling_back_local',
    );
    return executeLocalScreenerQuery(input);
  }
}

const metricValueSchema = z.object({
  value: z.number().finite().nullable(),
  unit: z.enum(['percent', 'ratio', 'score']),
  periodEndDate: z.string(),
  formula: z.string().optional(),
});

const screenerDatabaseResponseSchema = z.object({
  totalMatches: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      symbol: z.string(),
      companyName: z.string(),
      exchange: z.enum(['NSE', 'BSE']),
      currency: z.string(),
      period: z.string(),
      periodType: z.enum(['annual', 'ttm']),
      source: z.string(),
      retrievedAt: z.string(),
      isStale: z.boolean(),
      metrics: z.record(z.string(), metricValueSchema),
    }),
  ),
  coverage: z.object({
    indexedCompanies: z.number().int().nonnegative(),
    staleIndexedCompanies: z.number().int().nonnegative(),
    expectedCompanies: z.number().int().nonnegative(),
    refreshCompleted: z.boolean(),
    refreshedAt: z.string().nullable(),
    isPartial: z.boolean(),
  }),
});
