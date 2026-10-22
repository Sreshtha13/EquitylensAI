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
  quarterlyHistory: FinancialStatements[];
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

// ─── Phase 6: Authentication, User Profiles, Watchlists, Favorites & Preferences ───

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  emailConfirmed?: boolean;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  tokenType?: string;
};

export type UserProfile = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const SUPPORTED_EXCHANGES = ['NSE', 'BSE', 'US'] as const;
export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

export const SUPPORTED_CURRENCIES = ['INR', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_PERIODS = ['annual', 'ttm'] as const;
export type SupportedPeriod = (typeof SUPPORTED_PERIODS)[number];

export const SUPPORTED_LANDING_PAGES = [
  '/watchlists',
  '/market',
  '/screener',
  '/research',
  '/favorites',
] as const;
export type SupportedLandingPage = (typeof SUPPORTED_LANDING_PAGES)[number];

export const THEME_OPTIONS = ['dark', 'light', 'system'] as const;
export type ThemeOption = (typeof THEME_OPTIONS)[number];

export const TABLE_DENSITY_OPTIONS = ['compact', 'comfortable'] as const;
export type TableDensityOption = (typeof TABLE_DENSITY_OPTIONS)[number];

export type UserPreferences = {
  userId: string;
  defaultExchange: SupportedExchange;
  preferredCurrency: SupportedCurrency;
  preferredPeriod: SupportedPeriod;
  defaultLandingPage: SupportedLandingPage;
  theme: ThemeOption;
  tableDensity: TableDensityOption;
  updatedAt: string;
};

export type WatchlistSummary = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistItemWithQuote = {
  id: string;
  watchlistId: string;
  symbol: string;
  exchange: string;
  name: string;
  assetType: AssetType;
  currency: string;
  addedAt: string;
  sortOrder: number;
  quote: NormalizedQuote | null;
};

export type WatchlistDetail = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items: WatchlistItemWithQuote[];
};

export type FavoriteItemWithQuote = {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  name: string;
  assetType: AssetType;
  currency: string;
  addedAt: string;
  quote: NormalizedQuote | null;
};

// ─── Phase 7: Stock Detail & Company Intelligence ──────────────────────────

/** Verified company profile information */
export type CompanyProfile = {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetType: AssetType;
  currency: string;
  isin: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  headquarters: string | null;
  employees: number | null;
  sharesOutstanding: number | null;
  floatShares: number | null;
  fiscalYearEnd: string | null;
  source: string;
  retrievedAt: string;
};

export const PERFORMANCE_PERIODS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'] as const;
export type PerformancePeriodCode = (typeof PERFORMANCE_PERIODS)[number];

/** Calculated historical performance metrics for a specific window */
export type HistoricalPerformancePeriod = {
  period: PerformancePeriodCode;
  label: string;
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  cumulativeReturnPercent: number;
  annualizedReturnPercent: number | null;
  annualizedVolatilityPercent: number | null;
  maxDrawdownPercent: number | null;
  high: number;
  low: number;
  observations: number;
  priceType: 'adjusted' | 'unadjusted';
  isSufficient: boolean;
};

/** Full multi-period performance intelligence */
export type StockPerformanceResponse = {
  symbol: string;
  exchange: string;
  source: string;
  retrievedAt: string;
  periods: HistoricalPerformancePeriod[];
  methodology: {
    cumulativeReturn: string;
    annualizedReturn: string;
    volatility: string;
    maxDrawdown: string;
    disclaimer: string;
  };
};

// ─── Phase 8: Market News, Corporate Announcements & Event Intelligence ────

export const SOURCE_TYPES = [
  'official_exchange',
  'news_publisher',
  'company_ir',
  'regulatory',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ANNOUNCEMENT_CATEGORIES = [
  'financial_results',
  'board_meetings',
  'dividend',
  'bonus_issue',
  'stock_split',
  'rights_issue',
  'fundraising',
  'mergers_acquisitions',
  'shareholding_pattern',
  'management_changes',
  'credit_rating',
  'governance',
  'regulatory',
  'updates',
  'general',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export type CompanyAssociation = {
  symbol: string;
  exchange: string;
  companyName?: string;
  confidence: number;
  method: 'isin' | 'token' | 'symbol_exchange' | 'symbol_exact' | 'name_match';
};

export type GroundedAiSummary = {
  summary: string;
  keyPoints?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral' | 'unspecified';
  generatedAt: string;
  model: string;
  isHeadlineOnly: boolean;
  disclaimer: string;
};

/** Normalized market news item from verified news publishers */
export type NewsItem = {
  id: string;
  providerId: string;
  externalId?: string | null;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: SourceType;
  publishedAt: string | null;
  retrievedAt: string;
  language?: string | null;
  contentExcerpt?: string | null;
  category?: string | null;
  symbols: CompanyAssociation[];
  aiSummary?: GroundedAiSummary | null;
};

/** Verified official corporate announcement from stock exchanges or company filings */
export type CorporateAnnouncement = {
  id: string;
  providerId: string;
  externalId?: string | null;
  symbol: string;
  companyName: string;
  exchange: string;
  isin?: string | null;
  title: string;
  category: AnnouncementCategory;
  description: string | null;
  publishedAt: string;
  receivedAt?: string | null;
  sourceUrl: string;
  documentUrl?: string | null;
  fileSize?: string | null;
  retrievedAt: string;
  aiSummary?: GroundedAiSummary | null;
};

export type NewsFeedResponse = {
  items: NewsItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  freshness: {
    lastRetrievedAt: string;
    provider: string;
    isStale: boolean;
  };
};

export type AnnouncementsFeedResponse = {
  items: CorporateAnnouncement[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  freshness: {
    lastRetrievedAt: string;
    provider: string;
    isStale: boolean;
  };
};

export type WatchlistNewsResponse = {
  items: NewsItem[];
  symbolsWatched: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  freshness: {
    lastRetrievedAt: string;
    provider: string;
    isStale: boolean;
  };
};

export type ProviderHealthInfo = {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'unavailable';
  lastSuccessAt: string | null;
  lastError: string | null;
  coverage: string;
};

export type NewsIngestionStatus = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  status: 'idle' | 'running' | 'success' | 'failed';
  itemsRetrieved: number;
  itemsInserted: number;
  duplicatesCount: number;
  providers: ProviderHealthInfo[];
};
