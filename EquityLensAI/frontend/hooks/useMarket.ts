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
  },
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
  options?: { refetchInterval?: number | false | undefined; enabled?: boolean | undefined },
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
  },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: [
      'stocks',
      'history',
      symbol,
      options?.exchange,
      options?.interval,
      options?.from,
      options?.to,
    ],
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
  options?: { refetchInterval?: number | false | undefined },
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

export function useMarketIndices(options?: { refetchInterval?: number | false | undefined }) {
  return useQuery({
    queryKey: ['market', 'indices'],
    queryFn: async () => {
      const { getMarketIndices } = await import('@/services/api/market');
      return getMarketIndices();
    },
    refetchInterval: options?.refetchInterval ?? 15_000,
    staleTime: 10_000,
  });
}

export function useMarketBreadth(options?: { refetchInterval?: number | false | undefined }) {
  return useQuery({
    queryKey: ['market', 'breadth'],
    queryFn: async () => {
      const { getMarketBreadth } = await import('@/services/api/market');
      return getMarketBreadth();
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useTopGainers(options?: {
  exchange?: string | undefined;
  classification?: string | undefined;
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'movers', 'gainers', options?.exchange, options?.classification, options?.limit],
    queryFn: async () => {
      const { getTopGainers } = await import('@/services/api/market');
      return getTopGainers({
        exchange: options?.exchange,
        classification: options?.classification,
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useTopLosers(options?: {
  exchange?: string | undefined;
  classification?: string | undefined;
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'movers', 'losers', options?.exchange, options?.classification, options?.limit],
    queryFn: async () => {
      const { getTopLosers } = await import('@/services/api/market');
      return getTopLosers({
        exchange: options?.exchange,
        classification: options?.classification,
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useVolumeShockers(options?: {
  days?: 5 | 10 | 20 | undefined;
  limit?: number | undefined;
  exchange?: string | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'volume-shockers', options?.days, options?.limit, options?.exchange],
    queryFn: async () => {
      const { getVolumeShockers } = await import('@/services/api/market');
      return getVolumeShockers({
        days: options?.days,
        limit: options?.limit,
        exchange: options?.exchange,
      });
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useMostActive(options?: {
  by?: 'volume' | 'turnover' | undefined;
  limit?: number | undefined;
  exchange?: string | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'most-active', options?.by, options?.limit, options?.exchange],
    queryFn: async () => {
      const { getMostActive } = await import('@/services/api/market');
      return getMostActive({
        by: options?.by,
        limit: options?.limit,
        exchange: options?.exchange,
      });
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useMostWatched(options?: {
  windowDays?: number | undefined;
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'most-watched', options?.windowDays, options?.limit],
    queryFn: async () => {
      const { getMostWatched } = await import('@/services/api/market');
      return getMostWatched({
        windowDays: options?.windowDays,
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    staleTime: 30_000,
  });
}

export function useTrendingStocks(options?: {
  limit?: number | undefined;
  exchange?: string | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'trending', options?.limit, options?.exchange],
    queryFn: async () => {
      const { getTrendingStocks } = await import('@/services/api/market');
      return getTrendingStocks({
        limit: options?.limit,
        exchange: options?.exchange,
      });
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 15_000,
  });
}

export function useSectorPerformance(options?: { refetchInterval?: number | false | undefined }) {
  return useQuery({
    queryKey: ['market', 'sectors'],
    queryFn: async () => {
      const { getSectorPerformance } = await import('@/services/api/market');
      return getSectorPerformance();
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    staleTime: 30_000,
  });
}

export function useHighsLows(options?: {
  type?: 'highs' | 'lows' | 'all' | undefined;
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'highs-lows', options?.type, options?.limit],
    queryFn: async () => {
      const { getHighsLows } = await import('@/services/api/market');
      return getHighsLows({
        type: options?.type,
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    staleTime: 30_000,
  });
}

export function useCircuitStocks(options?: {
  type?: 'UPPER' | 'LOWER' | undefined;
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'circuits', options?.type, options?.limit],
    queryFn: async () => {
      const { getCircuitStocks } = await import('@/services/api/market');
      return getCircuitStocks({
        type: options?.type,
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    staleTime: 30_000,
  });
}

export function useNewListings(options?: {
  limit?: number | undefined;
  refetchInterval?: number | false | undefined;
}) {
  return useQuery({
    queryKey: ['market', 'new-listings', options?.limit],
    queryFn: async () => {
      const { getNewListings } = await import('@/services/api/market');
      return getNewListings({
        limit: options?.limit,
      });
    },
    refetchInterval: options?.refetchInterval ?? 120_000,
    staleTime: 60_000,
  });
}
