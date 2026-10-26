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


export async function executeScreenerQuery(
  input: ScreenerRequest,
): Promise<ScreenerExecutionResponse> {
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
    logger.error(
      { operation: 'execute_screen', validationIssueCount: parsed.error.issues.length },
      'financial_screener_database_response_invalid',
    );
    throw new AppError(
      'SCREENER_DATA_UNAVAILABLE',
      'The database returned an invalid screener response.',
      502,
    );
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
