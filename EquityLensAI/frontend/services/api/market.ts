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
    exchange?: string | undefined;
    assetType?: string | undefined;
    classification?: string | undefined;
    listingStatus?: string | undefined;
    limit?: number | undefined;
  },
): Promise<SearchStocksResponse> {
  const params = new URLSearchParams();
  params.set('q', query);
  if (options?.market) params.set('market', options.market);
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.assetType) params.set('assetType', options.assetType);
  if (options?.classification) params.set('classification', options.classification);
  if (options?.listingStatus) params.set('listingStatus', options.listingStatus);
  if (options?.limit) params.set('limit', String(options.limit));

  return apiClient.get<SearchStocksResponse>(`/api/v1/stocks/search?${params.toString()}`);
}

export async function getStockQuote(symbol: string, exchange?: string): Promise<NormalizedQuote> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<NormalizedQuote>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/quote${qStr}`,
  );
}

export async function getStockHistory(
  symbol: string,
  options?: {
    exchange?: string | undefined;
    interval?: CandleInterval | undefined;
    from?: string | undefined;
    to?: string | undefined;
  },
): Promise<HistoricalPrices> {
  const params = new URLSearchParams();
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.interval) params.set('interval', options.interval);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<HistoricalPrices>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/history${qStr}`,
  );
}

export async function getMarketOverview(market: Market = 'nse'): Promise<MarketOverview> {
  return apiClient.get<MarketOverview>(`/api/v1/market/overview?market=${market}`);
}

export async function getMarketProviders(): Promise<MarketProvidersResponse> {
  return apiClient.get<MarketProvidersResponse>('/api/v1/market/providers');
}

export async function getMarketIndices(): Promise<{ indices: import('@/types').IndexSnapshot[]; total: number }> {
  return apiClient.get<{ indices: import('@/types').IndexSnapshot[]; total: number }>('/api/v1/markets/indices');
}

export async function getMarketBreadth(): Promise<import('@/types').MarketBreadth> {
  return apiClient.get<import('@/types').MarketBreadth>('/api/v1/markets/breadth');
}

export async function getTopGainers(options?: {
  exchange?: string | undefined;
  classification?: string | undefined;
  limit?: number | undefined;
}): Promise<{ items: import('@/types').StockMoverItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.classification) params.set('classification', options.classification);
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').StockMoverItem[]; total: number }>(`/api/v1/markets/movers/gainers${qStr}`);
}

export async function getTopLosers(options?: {
  exchange?: string | undefined;
  classification?: string | undefined;
  limit?: number | undefined;
}): Promise<{ items: import('@/types').StockMoverItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.classification) params.set('classification', options.classification);
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').StockMoverItem[]; total: number }>(`/api/v1/markets/movers/losers${qStr}`);
}

export async function getVolumeShockers(options?: {
  days?: 5 | 10 | 20 | undefined;
  limit?: number | undefined;
  exchange?: string | undefined;
}): Promise<{ items: import('@/types').VolumeShockerItem[]; total: number; days: number }> {
  const params = new URLSearchParams();
  if (options?.days) params.set('days', String(options.days));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.exchange) params.set('exchange', options.exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').VolumeShockerItem[]; total: number; days: number }>(`/api/v1/markets/movers/volume-shockers${qStr}`);
}

export async function getMostActive(options?: {
  by?: 'volume' | 'turnover' | undefined;
  limit?: number | undefined;
  exchange?: string | undefined;
}): Promise<{ items: import('@/types').StockMoverItem[]; total: number; by: 'volume' | 'turnover' }> {
  const params = new URLSearchParams();
  if (options?.by) params.set('by', options.by);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.exchange) params.set('exchange', options.exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').StockMoverItem[]; total: number; by: 'volume' | 'turnover' }>(`/api/v1/markets/most-active${qStr}`);
}

export async function getMostWatched(options?: {
  windowDays?: number | undefined;
  limit?: number | undefined;
}): Promise<{ items: import('@/types').MostWatchedStockItem[]; total: number; windowDays: number }> {
  const params = new URLSearchParams();
  if (options?.windowDays) params.set('windowDays', String(options.windowDays));
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').MostWatchedStockItem[]; total: number; windowDays: number }>(`/api/v1/markets/most-watched${qStr}`);
}

export async function getTrendingStocks(options?: {
  limit?: number | undefined;
  exchange?: string | undefined;
}): Promise<{ items: import('@/types').TrendingStockItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.exchange) params.set('exchange', options.exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').TrendingStockItem[]; total: number }>(`/api/v1/markets/trending${qStr}`);
}

export async function getSectorPerformance(): Promise<{ sectors: import('@/types').SectorPerformanceItem[]; total: number }> {
  return apiClient.get<{ sectors: import('@/types').SectorPerformanceItem[]; total: number }>('/api/v1/markets/sectors');
}

export async function getHighsLows(options?: {
  type?: 'highs' | 'lows' | 'all' | undefined;
  limit?: number | undefined;
}): Promise<{ highs: import('@/types').StockMoverItem[]; lows: import('@/types').StockMoverItem[] }> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ highs: import('@/types').StockMoverItem[]; lows: import('@/types').StockMoverItem[] }>(`/api/v1/markets/highs-lows${qStr}`);
}

export async function getCircuitStocks(options?: {
  type?: 'UPPER' | 'LOWER' | undefined;
  limit?: number | undefined;
}): Promise<{ items: import('@/types').CircuitStockItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').CircuitStockItem[]; total: number }>(`/api/v1/markets/circuits${qStr}`);
}

export async function getNewListings(options?: {
  limit?: number | undefined;
}): Promise<{ items: import('@/types').NewListingItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<{ items: import('@/types').NewListingItem[]; total: number }>(`/api/v1/markets/new-listings${qStr}`);
}
