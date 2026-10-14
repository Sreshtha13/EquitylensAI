import { apiClient } from './client';
import type {
  CandleInterval,
  HistoricalPrices,
  Market,
  MarketOverview,
  MarketProvidersResponse,
  NormalizedQuote,
  SearchStocksResponse,
} from '@/types';

export async function searchStocks(
  query: string,
  options?: {
    market?: Market | undefined;
    assetType?: string | undefined;
    limit?: number | undefined;
  }
): Promise<SearchStocksResponse> {
  const params = new URLSearchParams();
  params.set('q', query);
  if (options?.market) params.set('market', options.market);
  if (options?.assetType) params.set('assetType', options.assetType);
  if (options?.limit) params.set('limit', String(options.limit));

  return apiClient.get<SearchStocksResponse>(`/api/v1/stocks/search?${params.toString()}`);
}

export async function getStockQuote(
  symbol: string,
  exchange?: string
): Promise<NormalizedQuote> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<NormalizedQuote>(`/api/v1/stocks/${encodeURIComponent(symbol)}/quote${qStr}`);
}

export async function getStockHistory(
  symbol: string,
  options?: {
    exchange?: string | undefined;
    interval?: CandleInterval | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }
): Promise<HistoricalPrices> {
  const params = new URLSearchParams();
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.interval) params.set('interval', options.interval);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<HistoricalPrices>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/history${qStr}`
  );
}

export async function getMarketOverview(market: Market = 'nse'): Promise<MarketOverview> {
  return apiClient.get<MarketOverview>(`/api/v1/market/overview?market=${market}`);
}

export async function getMarketProviders(): Promise<MarketProvidersResponse> {
  return apiClient.get<MarketProvidersResponse>('/api/v1/market/providers');
}
