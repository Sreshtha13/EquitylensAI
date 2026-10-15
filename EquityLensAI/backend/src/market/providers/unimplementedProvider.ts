import { AppError } from '../../utils/appError.js';
import type {
  HistoricalPrices,
  HistoricalRequest,
  IndexSnapshot,
  MarketProvider,
  NormalizedQuote,
  QuoteRequest,
} from '../types.js';

export class UnimplementedMarketProvider implements MarketProvider {
  readonly name: string;

  constructor(public readonly id: string, name?: string) {
    this.name = name || id;
  }

  isConfigured(): boolean {
    return false;
  }

  getQuote(_request: QuoteRequest): Promise<NormalizedQuote> {
    return Promise.reject(this.notImplemented('getQuote'));
  }

  getHistoricalPrices(_request: HistoricalRequest): Promise<HistoricalPrices> {
    return Promise.reject(this.notImplemented('getHistoricalPrices'));
  }

  getIndices?(_symbols?: string[]): Promise<IndexSnapshot[]> {
    return Promise.reject(this.notImplemented('getIndices'));
  }

  private notImplemented(method: string): AppError {
    return new AppError(
      'MARKET_PROVIDER_NOT_IMPLEMENTED',
      `Market provider "${this.id}" does not implement ${method}`,
      501
    );
  }
}
