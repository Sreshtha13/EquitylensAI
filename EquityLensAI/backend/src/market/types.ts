import type { AssetType, Market } from '@equitylensai/shared';

export type InstrumentRef = {
  symbol: string;
  name: string;
  market: Market;
  assetType: AssetType;
  exchange?: string;
};

export type SearchQuery = {
  query: string;
  market?: Market;
  assetType?: AssetType;
};

export type Quote = {
  instrument: InstrumentRef;
  asOf: string;
  currency: string;
  last: number;
};

export type HistoricalRange = {
  interval: '1d' | '1h' | '1m';
  from: string;
  to: string;
};

export type PricePoint = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export interface MarketProvider {
  readonly id: string;
  search(query: SearchQuery): Promise<InstrumentRef[]>;
  getQuote(ref: InstrumentRef): Promise<Quote>;
  getHistoricalPrices(ref: InstrumentRef, range: HistoricalRange): Promise<PricePoint[]>;
}
