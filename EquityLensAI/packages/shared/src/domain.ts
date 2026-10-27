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

// ==========================================
// Phase 9: Alerts & Notifications System
// ==========================================

export const ALERT_TYPES = [
  'price',
  'percentage_change',
  'volume',
  'financial_metric',
  'announcement',
  'news',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const PRICE_CONDITIONS = [
  'rises_above',
  'falls_below',
  'crosses_above',
  'crosses_below',
] as const;
export type PriceCondition = (typeof PRICE_CONDITIONS)[number];

export const PERCENTAGE_CHANGE_PERIODS = ['1d', '1w', '1m'] as const;
export type PercentageChangePeriod = (typeof PERCENTAGE_CHANGE_PERIODS)[number];

export const PERCENTAGE_DIRECTIONS = ['up', 'down', 'any'] as const;
export type PercentageDirection = (typeof PERCENTAGE_DIRECTIONS)[number];

export const FINANCIAL_ALERT_METRICS = [
  'roe',
  'roce',
  'debtToEquity',
  'operatingMargin',
  'netMargin',
  'freeCashFlow',
  'peRatio',
  'pbRatio',
  'currentRatio',
] as const;
export type FinancialAlertMetric = (typeof FINANCIAL_ALERT_METRICS)[number];

export const COMPARISON_OPERATORS = ['gt', 'lt', 'gte', 'lte'] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export type PriceAlertConfig = {
  condition: PriceCondition;
  targetPrice: number;
  currency?: string | undefined;
};

export type PercentageChangeAlertConfig = {
  period: PercentageChangePeriod;
  targetPercent: number;
  direction: PercentageDirection;
};

export type VolumeAlertConfig = {
  condition: 'exceeds';
  targetVolume: number;
};

export type FinancialMetricAlertConfig = {
  metric: FinancialAlertMetric;
  operator: ComparisonOperator;
  thresholdValue: number;
  periodType?: 'annual' | 'quarterly' | 'ttm' | undefined;
};

export type AnnouncementAlertConfig = {
  scope: 'stock' | 'watchlist';
  categories?: AnnouncementCategory[] | undefined;
};

export type NewsAlertConfig = {
  scope: 'stock' | 'watchlist';
  keywords?: string[] | undefined;
};

export type AlertRuleConfig =
  | ({ type: 'price' } & PriceAlertConfig)
  | ({ type: 'percentage_change' } & PercentageChangeAlertConfig)
  | ({ type: 'volume' } & VolumeAlertConfig)
  | ({ type: 'financial_metric' } & FinancialMetricAlertConfig)
  | ({ type: 'announcement' } & AnnouncementAlertConfig)
  | ({ type: 'news' } & NewsAlertConfig);

export type AlertRule = {
  id: string;
  userId: string;
  name: string;
  alertType: AlertType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  ruleConfig: AlertRuleConfig;
  enabled: boolean;
  cooldownMinutes: number;
  lastEvaluatedAt: string | null;
  lastObservationAt: string | null;
  lastObservedValue: number | null;
  lastTriggeredAt: string | null;
  lastState: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertEvent = {
  id: string;
  ruleId: string;
  userId: string;
  alertType: AlertType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  triggerTimestamp: string;
  observedValue: number | null;
  thresholdContext: Record<string, unknown>;
  source: string;
  deduplicationKey: string;
  status: 'triggered' | 'acknowledged' | 'failed';
  createdAt: string;
};

export const NOTIFICATION_CATEGORIES = [
  'price_alert',
  'percentage_alert',
  'volume_alert',
  'financial_alert',
  'announcement_alert',
  'news_alert',
  'system',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type AppNotification = {
  id: string;
  userId: string;
  alertEventId?: string | null;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  readAt?: string | null;
  symbol?: string | null;
  exchange?: SupportedExchange | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type UserAlertPreferences = {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  emailAddress?: string | null;
  priceAlerts: boolean;
  percentageAlerts: boolean;
  volumeAlerts: boolean;
  financialAlerts: boolean;
  announcementAlerts: boolean;
  newsAlerts: boolean;
  digestFrequency: 'realtime' | 'daily' | 'off';
  updatedAt: string;
};

// ─── Phase 10: Portfolio Tracking & Investment Performance Analytics ─────────

export const PORTFOLIO_TRANSACTION_TYPES = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'FEE',
  'DEPOSIT',
  'WITHDRAWAL',
  'SPLIT',
] as const;
export type PortfolioTransactionType = (typeof PORTFOLIO_TRANSACTION_TYPES)[number];

export const PORTFOLIO_PERFORMANCE_RANGES = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'] as const;
export type PortfolioPerformanceRange = (typeof PORTFOLIO_PERFORMANCE_RANGES)[number];

export type Portfolio = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  baseCurrency: SupportedCurrency;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  type: PortfolioTransactionType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  quantity: number;
  price: number;
  currency: SupportedCurrency;
  fees: number;
  taxes: number;
  totalAmount: number;
  tradeDate: string;
  settlementDate?: string | null;
  notes?: string | null;
  splitRatio?: number | null;
  externalReference?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioHolding = {
  symbol: string;
  exchange: SupportedExchange;
  name: string;
  assetType: AssetType;
  quantity: number;
  averageBuyPrice: number;
  totalCostBasis: number;
  currentPrice: number | null;
  currency: string;
  marketValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPercent: number | null;
  realizedPnL: number;
  dividendIncome: number;
  allocationPercent: number | null;
  quoteFreshness: DataFreshness;
  quoteSource: string | null;
  quoteObservedAt: string | null;
  isStale: boolean;
  unpriced: boolean;
};

export type PortfolioSummary = {
  portfolioId: string;
  name: string;
  baseCurrency: SupportedCurrency;
  holdingsCount: number;
  totalCostBasis: number;
  currentHoldingsValue: number | null;
  cashBalance: number;
  totalPortfolioValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPercent: number | null;
  realizedPnL: number;
  totalDividends: number;
  totalFees: number;
  totalReturn: number | null;
  totalReturnPercent: number | null;
  netDeposits: number;
  valuationStatus: 'complete' | 'partial' | 'empty' | 'unavailable';
  valuationCoveragePercent: number;
  unpricedHoldingsCount: number;
  lastValuationAt: string;
};

export type PortfolioAllocation = {
  portfolioId: string;
  assetAllocation: Array<{
    category: string;
    marketValue: number;
    percentage: number;
  }>;
  sectorAllocation: Array<{
    sector: string;
    marketValue: number;
    percentage: number;
  }>;
  concentration: {
    topHoldingWeight: number | null;
    top5HoldingsWeight: number | null;
    totalHoldings: number;
  };
  sectorCoveragePercent: number;
  unclassifiedValue: number;
};

export type PortfolioPerformancePoint = {
  date: string;
  portfolioValue: number;
  investedCapital: number;
  benchmarkValue?: number | null;
  benchmarkReturnPercent?: number | null;
  portfolioReturnPercent?: number | null;
};

export type PortfolioPerformance = {
  portfolioId: string;
  timeRange: PortfolioPerformanceRange;
  history: PortfolioPerformancePoint[];
  metrics: {
    startValue: number;
    endValue: number;
    netCashFlow: number;
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturnPercent?: number | null;
    benchmarkSymbol: string;
    benchmarkName: string;
    benchmarkReturnPercent?: number | null;
    alpha?: number | null;
  };
  valuationCoveragePercent: number;
  calculationNotes: string[];
};

export type PortfolioSnapshot = {
  id: string;
  portfolioId: string;
  valuationDate: string;
  holdingsValue: number;
  cashBalance: number;
  totalValue: number;
  totalCostBasis: number;
  realizedPnL: number;
  unrealizedPnL: number;
  currency: SupportedCurrency;
  coveragePercent: number;
  createdAt: string;
};

// ─── Phase 11: Advanced Stock Screener & Saved Strategies ────────────────────

export const SCREENER_METRIC_DOMAINS = [
  'profitability',
  'growth',
  'valuation',
  'leverage',
  'liquidity',
  'cash_flow',
  'financial_health',
] as const;
export type ScreenerMetricDomain = (typeof SCREENER_METRIC_DOMAINS)[number];

export const SCREENER_SUPPORTED_METRICS = [
  'roe',
  'roa',
  'roce',
  'gross_margin',
  'operating_margin',
  'net_margin',
  'debt_to_equity',
  'current_ratio',
  'quick_ratio',
  'interest_coverage',
  'revenue_growth',
  'net_income_growth',
  'eps_growth',
  'free_cash_flow_margin',
  'pe_ratio',
  'price_to_book',
  'financial_health_score',
] as const;
export type ScreenerMetric = (typeof SCREENER_SUPPORTED_METRICS)[number];

export const SCREENER_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
] as const;
export type ScreenerOperator = (typeof SCREENER_OPERATORS)[number];
export type ScreenerPeriod = SupportedPeriod;

export type ScreenerCondition = {
  id?: string | undefined;
  field: ScreenerMetric;
  operator: ScreenerOperator;
  value: number;
  upperValue?: number | null | undefined;
};

export type ScreenerFilterGroup = {
  id?: string | undefined;
  logic: 'AND' | 'OR';
  conditions: Array<ScreenerCondition | ScreenerFilterGroup>;
};

export type ScreenerStrategyDefinition = {
  schemaVersion: 1;
  rootGroup: ScreenerFilterGroup;
  exchange?: SupportedExchange | null;
  period: SupportedPeriod;
  sort: {
    field: string | null;
    direction: 'asc' | 'desc';
  };
  selectedColumns?: string[];
};

export type SavedScreen = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  definition: ScreenerStrategyDefinition;
  lastRunAt: string | null;
  lastResultCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ScreenerTemplateCategory =
  | 'quality'
  | 'value'
  | 'growth'
  | 'conservative'
  | 'cash_flow'
  | 'health';

export type ScreenerTemplate = {
  id: string;
  name: string;
  description: string;
  category: ScreenerTemplateCategory;
  definition: ScreenerStrategyDefinition;
  highlights: string[];
  assumptions: string;
};

export type ScreenerRunRecord = {
  id: string;
  userId: string;
  savedScreenId?: string | null;
  definition: ScreenerStrategyDefinition;
  resultCount: number;
  durationMs: number;
  executedAt: string;
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

export type ScreenerMetricCatalogItem = {
  id: ScreenerMetric;
  label: string;
  description: string;
  category: ScreenerMetricDomain;
  unit: 'percent' | 'ratio' | 'score';
  aliases: readonly string[];
  analysisPath: string;
  periods: readonly SupportedPeriod[];
  minimum: number;
  maximum: number;
  availableInFinancialAnalysis: boolean;
  availableForScreenerExecution: boolean;
  statementScope: string;
  missingDataBehavior: string;
};

// ─── Phase 12: Comparative Company Analysis & Peer Benchmarking ─────────────

export type ComparisonCompanyTarget = {
  symbol: string;
  exchange: string;
};

export type ComparisonCompanySummary = {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  marketCap: number | null;
  price: number | null;
  quoteObservedAt: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  isStale: boolean;
};

export type CompanyComparisonMetricRow = {
  metricId: string;
  label: string;
  category: string;
  unit: 'percent' | 'ratio' | 'score' | 'currency' | 'number';
  description: string;
  values: Record<string, number | null>;
};

export type CompanyComparisonRequest = {
  symbols: ComparisonCompanyTarget[];
  period?: SupportedPeriod | undefined;
  scope?: 'consolidated' | 'standalone' | undefined;
  metrics?: string[] | undefined;
};

export type CompanyComparisonResult = {
  companies: ComparisonCompanySummary[];
  period: SupportedPeriod;
  scope: 'consolidated' | 'standalone';
  metricsRows: CompanyComparisonMetricRow[];
  retrievedAt: string;
  warnings: string[];
};

export type SuggestedPeer = {
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  matchScore: number;
  matchRationale: string;
};

export type PeerDiscoveryResult = {
  baseCompany: {
    symbol: string;
    exchange: string;
    name: string;
    sector: string | null;
    industry: string | null;
  };
  peers: SuggestedPeer[];
  matchingMethod: 'industry_exact' | 'sector_match' | 'market_cap_tier' | 'manual';
  warnings: string[];
};

export type BenchmarkMetricStat = {
  metricId: string;
  label: string;
  unit: string;
  sampleSize: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  ranks: Record<
    string,
    {
      value: number | null;
      rank: number | null;
      percentile: number | null;
      diffFromMedian: number | null;
      diffFromMean: number | null;
    }
  >;
};

export type PeerBenchmarkResponse = {
  symbols: string[];
  period: SupportedPeriod;
  benchmarks: BenchmarkMetricStat[];
  calculatedAt: string;
  warnings: string[];
};

export type HistoricalFinancialPoint = {
  periodEndDate: string;
  fiscalYear?: string | undefined;
  revenue: number | null;
  netIncome: number | null;
  operatingMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  freeCashFlow: number | null;
};

export type NormalizedPricePoint = {
  date: string;
  values: Record<string, number | null>;
};

export type HistoricalComparisonResult = {
  period: SupportedPeriod;
  financialTrends: Record<string, HistoricalFinancialPoint[]>;
  pricePerformance: {
    interval: '1M' | '3M' | '6M' | '1Y' | '5Y';
    startDate: string;
    endDate: string;
    points: NormalizedPricePoint[];
    summaryReturns: Record<string, number | null>;
  };
};

export type AiComparisonSection = {
  title: string;
  content: string;
  evidenceIds: string[];
};

export type AiComparisonAnalysis = {
  summary: string;
  sections: AiComparisonSection[];
  disclaimer: string;
  model: string;
  generatedAt: string;
};

export type SavedComparison = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  symbols: ComparisonCompanyTarget[];
  metrics?: string[] | undefined;
  period: SupportedPeriod;
  scope: 'consolidated' | 'standalone';
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
};

// ─── Phase 13: Research Workbench, Investment Reports & Exportable Analysis ──

export const RESEARCH_PROJECT_STATUSES = [
  'draft',
  'in_progress',
  'ready_for_review',
  'finalized',
  'archived',
] as const;
export type ResearchProjectStatus = (typeof RESEARCH_PROJECT_STATUSES)[number];

export const RESEARCH_REPORT_STATUSES = [
  'draft',
  'in_progress',
  'ready_for_review',
  'finalized',
  'archived',
] as const;
export type ResearchReportStatus = (typeof RESEARCH_REPORT_STATUSES)[number];

export const REPORT_TEMPLATE_IDS = [
  'fundamental_analysis',
  'financial_statement_review',
  'valuation_multiples',
  'peer_comparison',
  'growth_profitability',
  'financial_risk',
  'announcement_impact',
  'comprehensive_research',
] as const;
export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export const REPORT_SECTION_TYPES = [
  'cover_metadata',
  'executive_summary',
  'company_profile',
  'market_overview',
  'financial_analysis',
  'comparative_analysis',
  'news_and_developments',
  'risks_and_uncertainties',
  'research_notes',
  'conclusion_open_questions',
  'sources_and_methodology',
  'custom',
] as const;
export type ReportSectionType = (typeof REPORT_SECTION_TYPES)[number];

export const NOTE_TAGS = ['observation', 'assumption', 'question', 'risk'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const EVIDENCE_TYPES = [
  'quote',
  'financial_statement',
  'financial_ratio',
  'health_score',
  'company_profile',
  'peer_benchmark',
  'corporate_announcement',
  'news_item',
  'user_note',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type ResearchEvidenceItem = {
  id: string;
  evidenceType: EvidenceType;
  title: string;
  sourceReference: string;
  sourceUrl?: string | null | undefined;
  observedAt?: string | null | undefined;
  reportingPeriod?: string | null | undefined;
  currency?: string | null | undefined;
  units?: string | null | undefined;
  value?: string | number | boolean | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type ResearchReportSection = {
  id: string;
  sectionType: ReportSectionType;
  title: string;
  content: string;
  structuredData?: Record<string, unknown> | undefined;
  position: number;
  status: 'draft' | 'reviewed' | 'final';
  generatedBy: 'system' | 'ai' | 'user';
  evidenceIds: string[];
  updatedAt: string;
};

export type ResearchNote = {
  id: string;
  researchProjectId: string;
  reportId?: string | null | undefined;
  sectionId?: string | null | undefined;
  userId: string;
  tag: NoteTag;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchReport = {
  id: string;
  researchProjectId: string;
  userId: string;
  title: string;
  templateId: ReportTemplateId | string;
  status: ResearchReportStatus;
  schemaVersion: number;
  sections: ResearchReportSection[];
  evidence: ResearchEvidenceItem[];
  notes: ResearchNote[];
  version: number;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string | null | undefined;
  lastRefreshedAt?: string | null | undefined;
};

export type ResearchReportVersion = {
  id: string;
  reportId: string;
  versionNumber: number;
  contentSnapshot: {
    title: string;
    templateId: string;
    sections: ResearchReportSection[];
    evidence: ResearchEvidenceItem[];
    notes: ResearchNote[];
  };
  summaryNotes?: string | null | undefined;
  createdAt: string;
  createdBy: string;
};

export type ResearchProject = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  symbol: string;
  exchange: string;
  companyName: string;
  status: ResearchProjectStatus;
  reportsCount?: number | undefined;
  notesCount?: number | undefined;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null | undefined;
};

export type ReportTemplateDefinition = {
  id: ReportTemplateId;
  name: string;
  description: string;
  recommendedFor: string;
  defaultSections: Array<{
    sectionType: ReportSectionType;
    title: string;
    description: string;
    required: boolean;
  }>;
  supportedDataSources: string[];
  limitations: string[];
};

export type RefreshReportDiff = {
  reportId: string;
  generatedAt: string;
  refreshedAt: string;
  hasChanges: boolean;
  changesSummary: {
    priceChanged: boolean;
    oldPrice: number | null;
    newPrice: number | null;
    priceChangePct: number | null;
    newFinancialsAvailable: boolean;
    latestPeriod: string | null;
    newAnnouncementsCount: number;
    newNewsCount: number;
  };
  affectedSections: ReportSectionType[];
  disclaimer: string;
};


