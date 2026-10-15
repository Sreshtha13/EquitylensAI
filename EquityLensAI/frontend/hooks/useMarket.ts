'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getStockHistory,
  getStockQuote,
  getMarketOverview,
  getMarketProviders,
  searchStocks,
} from '@/services/api/market';
import type { CandleInterval, Market } from '@/types';

export function useStockSearch(
  query: string,
  options?: {
    market?: Market | undefined;
    assetType?: string | undefined;
    limit?: number | undefined;
    enabled?: boolean | undefined;
  }
) {
  const trimmed = query.trim();
  const isEnabled = options?.enabled !== undefined ? options.enabled : trimmed.length >= 1;

  return useQuery({
    queryKey: ['stocks', 'search', trimmed, options?.market, options?.assetType, options?.limit],
    queryFn: () =>
      searchStocks(trimmed, {
        market: options?.market,
        assetType: options?.assetType,
        limit: options?.limit,
      }),
    enabled: isEnabled,
    staleTime: 30_000,
  });
}

export function useStockQuote(
  symbol: string | null | undefined,
  exchange?: string | undefined,
  options?: { refetchInterval?: number | false | undefined; enabled?: boolean | undefined }
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['stocks', 'quote', symbol, exchange],
    queryFn: () => getStockQuote(symbol!, exchange),
    enabled: isEnabled,
    refetchInterval: options?.refetchInterval ?? 15_000,
    staleTime: 10_000,
  });
}

export function useStockHistory(
  symbol: string | null | undefined,
  options?: {
    exchange?: string | undefined;
    interval?: CandleInterval | undefined;
    from?: string | undefined;
    to?: string | undefined;
    enabled?: boolean | undefined;
  }
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['stocks', 'history', symbol, options?.exchange, options?.interval, options?.from, options?.to],
    queryFn: () =>
      getStockHistory(symbol!, {
        exchange: options?.exchange,
        interval: options?.interval,
        from: options?.from,
        to: options?.to,
      }),
    enabled: isEnabled,
    staleTime: 60_000,
  });
}

export function useMarketOverview(
  market: Market = 'nse',
  options?: { refetchInterval?: number | false | undefined }
) {
  return useQuery({
    queryKey: ['market', 'overview', market],
    queryFn: () => getMarketOverview(market),
    refetchInterval: options?.refetchInterval ?? 15_000,
    staleTime: 10_000,
  });
}

export function useMarketProviders() {
  return useQuery({
    queryKey: ['market', 'providers'],
    queryFn: () => getMarketProviders(),
    staleTime: 60_000,
  });
}
