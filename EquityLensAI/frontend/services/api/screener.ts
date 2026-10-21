import { apiClient } from './client';

export type ScreenerOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
export type ScreenerPeriod = 'annual' | 'ttm';
export type ScreenerField = string;

export type ScreenerFilter = {
  field: ScreenerField;
  operator: ScreenerOperator;
  value: number;
  upperValue?: number | null;
};

export type ScreenerMetricDefinition = {
  id: ScreenerField;
  label: string;
  unit: 'percent' | 'ratio' | 'score';
  aliases: readonly string[];
  analysisPath: string;
  periods: readonly ScreenerPeriod[];
  minimum: number;
  maximum: number;
  availableInFinancialAnalysis: boolean;
  availableForScreenerExecution: boolean;
  statementScope: string;
  missingDataBehavior: string;
};

export type ScreenerInterpretation = {
  querySummary: string;
  filters: ScreenerFilter[];
  logic: 'AND' | 'OR';
  exchange: 'NSE' | 'BSE' | null;
  assetType: 'equity';
  period: ScreenerPeriod;
  sort: { field: string | null; direction: 'asc' | 'desc' };
  limit: number;
  clarificationNeeded: boolean;
  warnings: string[];
  executionAvailable: boolean;
};

export type ScreenerResult = {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE';
  currency: string;
  period: string;
  periodType: ScreenerPeriod;
  source: string;
  retrievedAt: string;
  isStale: boolean;
  metrics: Record<
    string,
    {
      value: number | null;
      unit: 'percent' | 'ratio' | 'score';
      periodEndDate: string;
      formula?: string;
    }
  >;
};

export type ScreenerExecutionResponse = {
  querySummary: string;
  filters: ScreenerFilter[];
  logic: 'AND' | 'OR';
  exchange: 'NSE' | 'BSE' | null;
  period: ScreenerPeriod;
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

export function getScreenerMetrics(signal?: AbortSignal): Promise<ScreenerMetricDefinition[]> {
  return apiClient.get<ScreenerMetricDefinition[]>(
    '/api/v1/ai/screener/metrics',
    signal ? { signal } : undefined,
  );
}

export function interpretScreenerQuery(input: {
  query: string;
  exchange?: 'NSE' | 'BSE';
  period: ScreenerPeriod;
}): Promise<ScreenerInterpretation> {
  return apiClient.post<ScreenerInterpretation>('/api/v1/ai/screener/interpret', input);
}

export function executeScreener(input: {
  query: string;
  exchange?: 'NSE' | 'BSE';
  assetType: 'equity';
  period: ScreenerPeriod;
  filters: ScreenerFilter[];
  logic: 'AND' | 'OR';
  sort: { field: string | null; direction: 'asc' | 'desc' };
  limit: number;
  offset?: number;
}): Promise<ScreenerExecutionResponse> {
  return apiClient.post<ScreenerExecutionResponse>('/api/v1/ai/screener', input);
}
