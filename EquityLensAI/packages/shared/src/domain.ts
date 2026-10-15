export const ASSET_TYPES = ['equity', 'etf', 'index', 'crypto', 'commodity', 'forex'] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const MARKETS = [
  'nse',
  'bse',
  'us',
  'jp',
  'uk',
  'hk',
  'crypto',
  'commodity',
  'forex',
] as const;

export type Market = (typeof MARKETS)[number];

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
};

// ─── Phase 2: Shared market data contracts ───────────────────────────────────

/** Freshness level of a market data observation */
export type DataFreshness = 'live' | 'delayed' | 'eod' | 'historical' | 'stale' | 'unavailable';

/** Normalized instrument returned from search */
export type InstrumentSummary = {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetType: AssetType;
  currency: string;
  /** Provider-internal token (opaque; do not display to users) */
  providerToken?: string | undefined;
  /** ISIN if available */
  isin?: string | undefined;
};

/** Normalized quote with explicit provenance */
export type NormalizedQuote = {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetType: AssetType;
  currency: string;
  /** Last traded price — null if unavailable */
  price: number | null;
  /** Absolute change from previous close — null if unavailable */
  change: number | null;
  /** Percentage change from previous close — null if unavailable */
  changePercent: number | null;
  /** Open price for current session — null if unavailable */
  open: number | null;
  /** Day high — null if unavailable */
  high: number | null;
  /** Day low — null if unavailable */
  low: number | null;
  /** Previous close — null if unavailable */
  previousClose: number | null;
  /** Volume — null if unavailable (e.g. indices) */
  volume: number | null;
  /** Data provider identifier */
  source: string;
  /** ISO 8601 timestamp of the price observation */
  observedAt: string;
  /** ISO 8601 timestamp of when the backend retrieved this data */
  retrievedAt: string;
  freshness: DataFreshness;
  /** True if this is a cached value that may be older than the TTL */
  isStale: boolean;
};

/** A single OHLCV candle */
export type PriceCandle = {
  /** ISO 8601 timestamp (beginning of period) */
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume — null if not provided by the source (e.g. indices) */
  volume: number | null;
  /** Adjusted close — null unless provider explicitly supplies it */
  adjustedClose: number | null;
};

export const CANDLE_INTERVALS = [
  'ONE_MINUTE',
  'THREE_MINUTE',
  'FIVE_MINUTE',
  'TEN_MINUTE',
  'FIFTEEN_MINUTE',
  'THIRTY_MINUTE',
  'ONE_HOUR',
  'ONE_DAY',
] as const;

/** Supported candle intervals (verified against Angel One SmartAPI) */
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

/** Normalized historical price result */
export type HistoricalPrices = {
  symbol: string;
  exchange: string;
  interval: CandleInterval;
  fromDate: string;
  toDate: string;
  candles: PriceCandle[];
  source: string;
  retrievedAt: string;
};

/** Market index snapshot */
export type IndexSnapshot = {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  source: string;
  observedAt: string;
};

/** Market overview — only verified data, unsupported fields omitted */
export type MarketOverview = {
  market: Market;
  indices: IndexSnapshot[];
  /**
   * Gainers/losers are NOT included in Phase 2.
   * Angel One does not provide a reliable universe-wide feed.
   * Included fields represent what the provider actually supports.
   */
  retrievedAt: string;
  source: string;
  freshness: DataFreshness;
  isStale: boolean;
};

// ─── Phase 3: Financial Data & Deterministic Financial Intelligence ──────────

/** Fiscal period type */
export type FiscalPeriodType = 'annual' | 'quarterly' | 'ttm';

/** Income Statement for one fiscal period */
export type IncomeStatement = {
  symbol: string;
  periodType: FiscalPeriodType;
  /** Fiscal year end date YYYY-MM-DD */
  periodEndDate: string;
  currency: string;
  totalRevenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  researchAndDevelopment: number | null;
  sellingGeneralAdministrative: number | null;
  totalOperatingExpenses: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  totalOtherIncomeExpense: number | null;
  incomeBeforeTax: number | null;
  incomeTaxExpense: number | null;
  netIncome: number | null;
  basicEPS: number | null;
  dilutedEPS: number | null;
  basicSharesOutstanding: number | null;
  dilutedSharesOutstanding: number | null;
  ebitda: number | null;
  source: string;
  retrievedAt: string;
};

/** Balance Sheet for one fiscal period */
export type BalanceSheet = {
  symbol: string;
  periodType: FiscalPeriodType;
  periodEndDate: string;
  currency: string;
  cash: number | null;
  shortTermInvestments: number | null;
  netReceivables: number | null;
  inventory: number | null;
  totalCurrentAssets: number | null;
  longTermInvestments: number | null;
  propertyPlantEquipment: number | null;
  goodwill: number | null;
  intangibleAssets: number | null;
  totalAssets: number | null;
  shortTermDebt: number | null;
  accountsPayable: number | null;
  totalCurrentLiabilities: number | null;
  longTermDebt: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;
  totalStockholderEquity: number | null;
  source: string;
  retrievedAt: string;
};

/** Cash Flow Statement for one fiscal period */
export type CashFlowStatement = {
  symbol: string;
  periodType: FiscalPeriodType;
  periodEndDate: string;
  currency: string;
  netIncome: number | null;
  deprecationAndAmortization: number | null;
  changesInWorkingCapital: number | null;
  operatingCashFlow: number | null;
  capitalExpenditures: number | null;
  investingCashFlow: number | null;
  dividendsPaid: number | null;
  financingCashFlow: number | null;
  freeCashFlow: number | null;
  source: string;
  retrievedAt: string;
};

/** All financial statements for one period */
export type FinancialStatements = {
  symbol: string;
  periodType: FiscalPeriodType;
  periodEndDate: string;
  income: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlowStatement;
  source: string;
  retrievedAt: string;
  isStale: boolean;
};

/** Multi-period financial history */
export type FinancialHistory = {
  symbol: string;
  periodType: FiscalPeriodType;
  periods: FinancialStatements[];
  source: string;
  retrievedAt: string;
};

/** A calculated metric with full provenance. value is null if inputs were insufficient. */
export type FinancialMetric = {
  value: number | null;
  /** Human-readable formula used e.g. "NetIncome / Revenue * 100" */
  formula: string;
  /** Unit of the result */
  unit: 'ratio' | 'percent' | 'currency' | 'x' | 'days';
  periodEndDate: string;
  isBlended: boolean | undefined;
};

export type ProfitabilityMetrics = {
  grossMargin: FinancialMetric;
  operatingMargin: FinancialMetric;
  netMargin: FinancialMetric;
  returnOnAssets: FinancialMetric;
  returnOnEquity: FinancialMetric;
  returnOnCapitalEmployed: FinancialMetric;
  ebitdaMargin: FinancialMetric;
};

export type LiquidityMetrics = {
  currentRatio: FinancialMetric;
  quickRatio: FinancialMetric;
  cashRatio: FinancialMetric;
  operatingCashFlowRatio: FinancialMetric;
};

export type LeverageMetrics = {
  debtToEquity: FinancialMetric;
  debtToAssets: FinancialMetric;
  equityMultiplier: FinancialMetric;
  interestCoverageRatio: FinancialMetric;
  netDebtToEbitda: FinancialMetric;
};

export type CashFlowMetrics = {
  freeCashFlowMargin: FinancialMetric;
  freeCashFlowYield: FinancialMetric;
  operatingCashFlowToNetIncome: FinancialMetric;
  capexToRevenue: FinancialMetric;
};

export type GrowthMetrics = {
  revenueGrowthYoY: FinancialMetric;
  grossProfitGrowthYoY: FinancialMetric;
  operatingIncomeGrowthYoY: FinancialMetric;
  netIncomeGrowthYoY: FinancialMetric;
  epsGrowthYoY: FinancialMetric;
  freeCashFlowGrowthYoY: FinancialMetric;
  revenueCAGR: FinancialMetric | null;
};

export type ValuationMetrics = {
  peRatio: FinancialMetric;
  forwardPE: FinancialMetric;
  priceToSales: FinancialMetric;
  priceToBook: FinancialMetric;
  evToEbitda: FinancialMetric;
  evToRevenue: FinancialMetric;
  priceToFreeCashFlow: FinancialMetric;
  marketCap: FinancialMetric;
  enterpriseValue: FinancialMetric;
};

export type HealthScoreDimension = {
  name: string;
  score: number;
  maxScore: number;
  rationale: string;
  keyMetrics: string[];
};

export type FinancialHealthScore = {
  symbol: string;
  overallScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  summary: string;
  dimensions: {
    profitability: HealthScoreDimension;
    liquidity: HealthScoreDimension;
    leverage: HealthScoreDimension;
    cashFlow: HealthScoreDimension;
    growth: HealthScoreDimension;
  };
  dataQualityWarnings: string[];
  asOfPeriod: string;
  scoredAt: string;
};

/** Fully assembled financial analysis for one symbol */
export type FinancialAnalysis = {
  symbol: string;
  name: string;
  currency: string;
  latestAnnual: FinancialStatements;
  ttm: FinancialStatements | null;
  annualHistory: FinancialStatements[];
  profitability: ProfitabilityMetrics;
  liquidity: LiquidityMetrics;
  leverage: LeverageMetrics;
  cashFlow: CashFlowMetrics;
  growth: GrowthMetrics;
  valuation: ValuationMetrics;
  healthScore: FinancialHealthScore;
  source: string;
  retrievedAt: string;
  isStale: boolean;
};
