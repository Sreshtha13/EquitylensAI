import type {
  AssetType,
  CandleInterval,
  DataFreshness,
  HistoricalPrices,
  IndexSnapshot,
  InstrumentSummary,
  Market,
  MarketOverview,
  NormalizedQuote,
  PriceCandle,
  CompanyProfile,
  StockPerformanceResponse,
  SecurityClassification,
  ListingStatus,
  MarketBreadth,
  StockMoverItem,
  VolumeShockerItem,
  MostWatchedStockItem,
  TrendingStockItem,
  SectorPerformanceItem,
  CircuitStockItem,
  NewListingItem,
} from '@equitylensai/shared';

export type {
  AssetType,
  CandleInterval,
  DataFreshness,
  HistoricalPrices,
  IndexSnapshot,
  InstrumentSummary,
  Market,
  MarketOverview,
  NormalizedQuote,
  PriceCandle,
  CompanyProfile,
  StockPerformanceResponse,
  SecurityClassification,
  ListingStatus,
  MarketBreadth,
  StockMoverItem,
  VolumeShockerItem,
  MostWatchedStockItem,
  TrendingStockItem,
  SectorPerformanceItem,
  CircuitStockItem,
  NewListingItem,
};

export type InstrumentRecord = {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetType: AssetType;
  currency: string;
  providerToken?: string | undefined;
  isin?: string | undefined;
  tickSize?: number | undefined;
  lotSize?: number | undefined;
  classification?: SecurityClassification | undefined;
  listingStatus?: ListingStatus | undefined;
  scripCode?: string | undefined;
  series?: string | undefined;
  firstDiscoveredAt?: string | undefined;
  lastDiscoveredAt?: string | undefined;
  lastVerifiedAt?: string | undefined;
  dataCompleteness?: 'COMPLETE' | 'PARTIAL' | 'BASIC' | undefined;
  historicalSymbols?: string[] | undefined;
  source?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type SearchInstrumentsQuery = {
  query: string;
  market?: Market | undefined;
  exchange?: string | undefined;
  assetType?: AssetType | undefined;
  classification?: SecurityClassification | undefined;
  listingStatus?: ListingStatus | undefined;
  limit?: number | undefined;
};

export type QuoteRequest = {
  symbol: string;
  exchange?: string | undefined;
  token?: string | undefined;
};

export type HistoricalRequest = {
  symbol: string;
  exchange?: string | undefined;
  token?: string | undefined;
  interval: CandleInterval;
  from: string; // ISO 8601 or YYYY-MM-DD HH:mm
  to: string; // ISO 8601 or YYYY-MM-DD HH:mm
};

export interface MarketProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getQuote(request: QuoteRequest): Promise<NormalizedQuote>;
  getHistoricalPrices(request: HistoricalRequest): Promise<HistoricalPrices>;
  getIndices?(symbols?: string[]): Promise<IndexSnapshot[]>;
}

export type ProviderStatus = {
  id: string;
  name: string;
  configured: boolean;
  isPrimaryForNSE: boolean;
};
