import { apiClient } from './client';
import type {
  ComparisonCompanyTarget,
  CompanyComparisonRequest,
  CompanyComparisonResult,
  PeerDiscoveryResult,
  PeerBenchmarkResponse,
  HistoricalComparisonResult,
  AiComparisonAnalysis,
  SavedComparison,
  SupportedPeriod,
} from '@equitylensai/shared';

export type {
  ComparisonCompanyTarget,
  CompanyComparisonRequest,
  CompanyComparisonResult,
  PeerDiscoveryResult,
  PeerBenchmarkResponse,
  HistoricalComparisonResult,
  AiComparisonAnalysis,
  SavedComparison,
  SupportedPeriod,
};

// ─── Company Comparison ──────────────────────────────────────────────────────

export function compareCompanies(
  request: CompanyComparisonRequest,
): Promise<CompanyComparisonResult> {
  return apiClient.post<CompanyComparisonResult>('/api/v1/compare', request);
}

// ─── Peer Discovery ──────────────────────────────────────────────────────────

export function getSuggestedPeers(
  symbol: string,
  exchange = 'NSE',
): Promise<PeerDiscoveryResult> {
  return apiClient.get<PeerDiscoveryResult>(
    `/api/v1/compare/peers/${encodeURIComponent(symbol)}?exchange=${encodeURIComponent(exchange)}`,
  );
}

// ─── Peer Benchmark Statistics ───────────────────────────────────────────────

export function getPeerBenchmarks(
  symbols: ComparisonCompanyTarget[],
  period: SupportedPeriod = 'annual',
  scope: 'consolidated' | 'standalone' = 'consolidated',
): Promise<PeerBenchmarkResponse> {
  return apiClient.post<PeerBenchmarkResponse>('/api/v1/compare/benchmarks', {
    symbols,
    period,
    scope,
  });
}

// ─── Historical Trend Comparison ─────────────────────────────────────────────

export function getHistoricalComparison(
  symbols: ComparisonCompanyTarget[],
  interval: '1M' | '3M' | '6M' | '1Y' | '5Y' = '1Y',
  period: SupportedPeriod = 'annual',
): Promise<HistoricalComparisonResult> {
  return apiClient.post<HistoricalComparisonResult>('/api/v1/compare/history', {
    symbols,
    interval,
    period,
  });
}

// ─── Evidence-Backed AI Comparative Analysis ─────────────────────────────────

export function getAiComparisonAnalysis(
  symbols: ComparisonCompanyTarget[],
  period: SupportedPeriod = 'annual',
): Promise<AiComparisonAnalysis> {
  return apiClient.post<AiComparisonAnalysis>('/api/v1/ai/comparison-analysis', {
    symbols,
    period,
  });
}

// ─── Saved Comparisons Persistence ───────────────────────────────────────────

export function listSavedComparisons(): Promise<SavedComparison[]> {
  return apiClient.get<SavedComparison[]>('/api/v1/compare/saved');
}

export function getSavedComparison(id: string): Promise<SavedComparison> {
  return apiClient.get<SavedComparison>(`/api/v1/compare/saved/${id}`);
}

export function createSavedComparison(payload: {
  name: string;
  description?: string;
  symbols: ComparisonCompanyTarget[];
  period?: SupportedPeriod;
  scope?: 'consolidated' | 'standalone';
  metrics?: string[];
}): Promise<SavedComparison> {
  return apiClient.post<SavedComparison>('/api/v1/compare/saved', payload);
}

export function updateSavedComparison(
  id: string,
  payload: {
    name?: string;
    description?: string;
    symbols?: ComparisonCompanyTarget[];
    period?: SupportedPeriod;
    scope?: 'consolidated' | 'standalone';
    metrics?: string[];
  },
): Promise<SavedComparison> {
  return apiClient.patch<SavedComparison>(`/api/v1/compare/saved/${id}`, payload);
}

export function deleteSavedComparison(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/compare/saved/${id}`);
}

export function duplicateSavedComparison(id: string): Promise<SavedComparison> {
  return apiClient.post<SavedComparison>(`/api/v1/compare/saved/${id}/duplicate`, {});
}

// ─── CSV Export Utility ──────────────────────────────────────────────────────

export function exportComparisonCsv(
  result: CompanyComparisonResult,
  filename = 'equitylens_company_comparison.csv',
): void {
  if (!result.companies || result.companies.length === 0) return;

  const symbols = result.companies.map((c) => c.symbol);
  const companyHeaders = result.companies.map(
    (c) => `"${c.name.replace(/"/g, '""')} (${c.symbol})"`,
  );

  const headers = ['Category', 'Metric', 'Unit', ...companyHeaders];
  const rows: string[] = [];

  // Metadata summary rows
  rows.push(['Overview', 'Exchange', 'Text', ...result.companies.map((c) => c.exchange)].join(','));
  rows.push(['Overview', 'Sector', 'Text', ...result.companies.map((c) => `"${(c.sector || 'N/A').replace(/"/g, '""')}"`)].join(','));
  rows.push(['Overview', 'Industry', 'Text', ...result.companies.map((c) => `"${(c.industry || 'N/A').replace(/"/g, '""')}"`)].join(','));
  rows.push(['Overview', 'Market Cap (₹ Cr)', 'Currency', ...result.companies.map((c) => c.marketCap ? String(Math.round(c.marketCap / 1e7)) : 'N/A')].join(','));
  rows.push(['Overview', 'Latest Price (₹)', 'Currency', ...result.companies.map((c) => c.price !== null ? String(c.price) : 'N/A')].join(','));

  // Metric rows
  for (const m of result.metricsRows) {
    const vals = symbols.map((sym) => {
      const v = m.values[sym];
      return v !== null && v !== undefined ? String(v) : 'N/A';
    });
    rows.push([
      `"${m.category.replace(/"/g, '""')}"`,
      `"${m.label.replace(/"/g, '""')}"`,
      m.unit,
      ...vals,
    ].join(','));
  }

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
}
