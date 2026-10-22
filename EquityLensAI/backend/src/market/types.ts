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
};

export type SearchInstrumentsQuery = {
  query: string;
  market?: Market | undefined;
  assetType?: AssetType | undefined;
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
