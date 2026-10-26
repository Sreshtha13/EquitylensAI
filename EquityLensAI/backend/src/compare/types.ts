import type {
  ComparisonCompanyTarget,
  ComparisonCompanySummary,
  CompanyComparisonMetricRow,
  CompanyComparisonRequest,
  CompanyComparisonResult,
  SuggestedPeer,
  PeerDiscoveryResult,
  BenchmarkMetricStat,
  PeerBenchmarkResponse,
  HistoricalFinancialPoint,
  NormalizedPricePoint,
  HistoricalComparisonResult,
  AiComparisonSection,
  AiComparisonAnalysis,
  SavedComparison,
  SupportedPeriod,
} from '@equitylensai/shared';

export type {
  ComparisonCompanyTarget,
  ComparisonCompanySummary,
  CompanyComparisonMetricRow,
  CompanyComparisonRequest,
  CompanyComparisonResult,
  SuggestedPeer,
  PeerDiscoveryResult,
  BenchmarkMetricStat,
  PeerBenchmarkResponse,
  HistoricalFinancialPoint,
  NormalizedPricePoint,
  HistoricalComparisonResult,
  AiComparisonSection,
  AiComparisonAnalysis,
  SavedComparison,
  SupportedPeriod,
};

export type SavedComparisonRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  symbols: ComparisonCompanyTarget[];
  metrics: string[] | null;
  period: string;
  scope: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
};
