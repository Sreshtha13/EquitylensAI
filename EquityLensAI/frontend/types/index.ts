export type {
  ApiError,
  ApiResponse,
  ApiSuccess,
  AssetType,
  CandleInterval,
  DataFreshness,
  HistoricalPrices,
  IndexSnapshot,
  InstrumentSummary,
  Market,
  MarketOverview,
  NormalizedQuote,
  Pagination,
  PriceCandle,
  // Phase 3 Financial
  FiscalPeriodType,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialStatements,
  FinancialHistory,
  FinancialMetric,
  ProfitabilityMetrics,
  LiquidityMetrics,
  LeverageMetrics,
  CashFlowMetrics,
  GrowthMetrics,
  ValuationMetrics,
  HealthScoreDimension,
  FinancialHealthScore,
  FinancialAnalysis,
} from '@equitylensai/shared';

export type HealthStatus = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export type SearchStocksResponse = {
  query: string;
  total: number;
  items: import('@equitylensai/shared').InstrumentSummary[];
};

export type ProviderStatus = {
  id: string;
  name: string;
  configured: boolean;
  isPrimaryForNSE: boolean;
};

export type MarketProvidersResponse = {
  providers: ProviderStatus[];
};
