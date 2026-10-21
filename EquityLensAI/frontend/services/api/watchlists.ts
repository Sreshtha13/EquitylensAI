import { apiClient } from './client';
import type {
  WatchlistSummary,
  WatchlistDetail,
  WatchlistItemWithQuote,
  SupportedExchange,
} from '@equitylensai/shared';

export async function listWatchlists(): Promise<WatchlistSummary[]> {
  return apiClient.get<WatchlistSummary[]>('/api/v1/watchlists');
}

export async function createWatchlist(body: {
  name: string;
  description?: string | null;
}): Promise<WatchlistSummary> {
  return apiClient.post<WatchlistSummary>('/api/v1/watchlists', body);
}

export async function getWatchlistDetail(watchlistId: string): Promise<WatchlistDetail> {
  return apiClient.get<WatchlistDetail>(`/api/v1/watchlists/${watchlistId}`);
}

export async function updateWatchlist(
  watchlistId: string,
  body: { name?: string; description?: string | null },
): Promise<WatchlistSummary> {
  return apiClient.patch<WatchlistSummary>(`/api/v1/watchlists/${watchlistId}`, body);
}

export async function deleteWatchlist(watchlistId: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/api/v1/watchlists/${watchlistId}`);
}

export async function addWatchlistItem(
  watchlistId: string,
  body: { symbol: string; exchange: SupportedExchange; sortOrder?: number },
): Promise<WatchlistItemWithQuote> {
  return apiClient.post<WatchlistItemWithQuote>(`/api/v1/watchlists/${watchlistId}/items`, body);
}

export async function removeWatchlistItem(
  watchlistId: string,
  symbol: string,
  exchange?: SupportedExchange,
): Promise<{ message: string }> {
  let url = `/api/v1/watchlists/${watchlistId}/items/${symbol}`;
  if (exchange) {
    url += `?exchange=${exchange}`;
  }
  return apiClient.delete<{ message: string }>(url);
}

export async function reorderWatchlistItems(
  watchlistId: string,
  symbols: string[],
): Promise<{ message: string }> {
  return apiClient.patch<{ message: string }>(`/api/v1/watchlists/${watchlistId}/items/reorder`, {
    symbols,
  });
}
