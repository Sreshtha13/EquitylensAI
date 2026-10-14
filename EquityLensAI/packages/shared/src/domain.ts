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
