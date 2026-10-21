import { apiClient } from './client';
import type { FavoriteItemWithQuote, SupportedExchange } from '@equitylensai/shared';

export async function listFavorites(): Promise<FavoriteItemWithQuote[]> {
  return apiClient.get<FavoriteItemWithQuote[]>('/api/v1/favorites');
}

export async function addFavorite(
  symbol: string,
  exchange: SupportedExchange = 'NSE',
): Promise<FavoriteItemWithQuote> {
  return apiClient.post<FavoriteItemWithQuote>('/api/v1/favorites', {
    symbol,
    exchange,
  });
}

export async function removeFavorite(
  symbol: string,
  exchange?: SupportedExchange,
): Promise<{ message: string }> {
  let url = `/api/v1/favorites/${symbol}`;
  if (exchange) {
    url += `?exchange=${exchange}`;
  }
  return apiClient.delete<{ message: string }>(url);
}
