import { AppError } from '../../utils/appError.js';
import type {
  HistoricalRange,
  InstrumentRef,
  MarketProvider,
  PricePoint,
  Quote,
  SearchQuery,
} from '../types.js';

export class UnimplementedMarketProvider implements MarketProvider {
  constructor(public readonly id: string) {}

  search(_query: SearchQuery): Promise<InstrumentRef[]> {
    return Promise.reject(this.notImplemented('search'));
  }

  getQuote(_ref: InstrumentRef): Promise<Quote> {
    return Promise.reject(this.notImplemented('getQuote'));
  }

  getHistoricalPrices(_ref: InstrumentRef, _range: HistoricalRange): Promise<PricePoint[]> {
    return Promise.reject(this.notImplemented('getHistoricalPrices'));
  }

  private notImplemented(method: string): AppError {
    return new AppError(
      'MARKET_PROVIDER_NOT_IMPLEMENTED',
      `Market provider "${this.id}" does not implement ${method} in Phase 1`,
      501,
    );
  }
}
