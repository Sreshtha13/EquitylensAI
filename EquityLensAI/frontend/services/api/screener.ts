import { apiClient } from './client';
import type {
  SavedScreen,
  ScreenerCondition,
  ScreenerFilterGroup,
  ScreenerMetric,
  ScreenerMetricCatalogItem,
  ScreenerOperator,
  ScreenerPeriod,
  ScreenerRunRecord,
  ScreenerStrategyDefinition,
  ScreenerTemplate,
} from '@equitylensai/shared';

export type {
  SavedScreen,
  ScreenerCondition,
  ScreenerFilterGroup,
  ScreenerMetric,
  ScreenerMetricCatalogItem,
  ScreenerOperator,
  ScreenerPeriod,
  ScreenerRunRecord,
  ScreenerStrategyDefinition,
  ScreenerTemplate,
};

export type ScreenerField = ScreenerMetric | string;

export type ScreenerFilter = {
  id?: string;
  field: ScreenerField;
  operator: ScreenerOperator;
  value: number;
  upperValue?: number | null;
};

export type ScreenerMetricDefinition = ScreenerMetricCatalogItem;

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
  rootGroup?: ScreenerFilterGroup;
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

// ─── API Endpoints ──────────────────────────────────────────────────────────

export function getScreenerMetrics(signal?: AbortSignal): Promise<ScreenerMetricDefinition[]> {
  return apiClient.get<ScreenerMetricDefinition[]>(
    '/api/v1/screener/metrics',
    signal ? { signal } : undefined,
  );
}

export function getScreenerTemplates(signal?: AbortSignal): Promise<ScreenerTemplate[]> {
  return apiClient.get<ScreenerTemplate[]>(
    '/api/v1/screener/templates',
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
  query?: string;
  exchange?: 'NSE' | 'BSE';
  assetType?: 'equity';
  period: ScreenerPeriod;
  filters?: ScreenerFilter[];
  logic?: 'AND' | 'OR';
  rootGroup?: ScreenerFilterGroup;
  sort?: { field: string | null; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}): Promise<ScreenerExecutionResponse> {
  return apiClient.post<ScreenerExecutionResponse>('/api/v1/screener/run', input);
}

export function runScreener(input: {
  definition: ScreenerStrategyDefinition;
  query?: string | undefined;
}): Promise<ScreenerExecutionResponse> {
  return apiClient.post<ScreenerExecutionResponse>('/api/v1/screener/run', {
    ...input.definition,
    ...(input.query ? { query: input.query } : {}),
  });
}

// ─── Saved Screening Strategies ─────────────────────────────────────────────

export function listSavedScreens(): Promise<SavedScreen[]> {
  return apiClient.get<SavedScreen[]>('/api/v1/screener/saved');
}

export function getSavedScreen(screenId: string): Promise<SavedScreen> {
  return apiClient.get<SavedScreen>(`/api/v1/screener/saved/${screenId}`);
}

export function createSavedScreen(input: {
  name: string;
  description?: string | null;
  definition: ScreenerStrategyDefinition;
}): Promise<SavedScreen> {
  return apiClient.post<SavedScreen>('/api/v1/screener/saved', input);
}

export function updateSavedScreen(
  screenId: string,
  input: {
    name?: string;
    description?: string | null;
    definition?: ScreenerStrategyDefinition;
  },
): Promise<SavedScreen> {
  return apiClient.patch<SavedScreen>(`/api/v1/screener/saved/${screenId}`, input);
}

export function deleteSavedScreen(screenId: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/api/v1/screener/saved/${screenId}`);
}

export function duplicateSavedScreen(screenId: string): Promise<SavedScreen> {
  return apiClient.post<SavedScreen>(`/api/v1/screener/saved/${screenId}/duplicate`, {});
}

export function runSavedScreen(
  screenId: string,
  options?: { limit?: number; offset?: number },
): Promise<ScreenerExecutionResponse> {
  return apiClient.post<ScreenerExecutionResponse>(
    `/api/v1/screener/saved/${screenId}/run`,
    options ?? {},
  );
}

// ─── Screening History & Runs ───────────────────────────────────────────────

export function listScreenerRuns(limit = 50): Promise<ScreenerRunRecord[]> {
  return apiClient.get<ScreenerRunRecord[]>(`/api/v1/screener/runs?limit=${limit}`);
}

export function getScreenerRun(runId: string): Promise<ScreenerRunRecord> {
  return apiClient.get<ScreenerRunRecord>(`/api/v1/screener/runs/${runId}`);
}

// ─── CSV Export Utility ─────────────────────────────────────────────────────

export function exportScreenerResultsCsv(
  results: ScreenerResult[],
  activeMetrics: ScreenerMetricDefinition[] = [],
  filename = 'equitylens_screener_results.csv',
): void {
  if (results.length === 0) return;

  const metricMap = new Map<string, ScreenerMetricDefinition>(
    activeMetrics.map((m) => [m.id, m]),
  );
  const metricKeys =
    activeMetrics.length > 0
      ? activeMetrics.map((m) => m.id)
      : Array.from(new Set(results.flatMap((r) => Object.keys(r.metrics))));

  const headers = ['Symbol', 'Company Name', 'Exchange', 'Currency', 'Period', 'Is Stale'];
  for (const mId of metricKeys) {
    const m = metricMap.get(mId);
    headers.push(m ? `${m.label} (${m.unit})` : mId);
  }

  const rows = results.map((r) => {
    const row = [
      `"${r.symbol.replace(/"/g, '""')}"`,
      `"${r.companyName.replace(/"/g, '""')}"`,
      r.exchange,
      r.currency,
      r.period,
      r.isStale ? 'YES' : 'NO',
    ];
    for (const mId of metricKeys) {
      const val = r.metrics[mId]?.value;
      row.push(val !== null && val !== undefined ? String(val) : 'N/A');
    }
    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
