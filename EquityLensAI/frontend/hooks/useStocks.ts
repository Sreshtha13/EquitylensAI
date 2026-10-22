'use client';

import { useQuery } from '@tanstack/react-query';
import { getCompanyProfile, getStockPerformance, resolveStock } from '@/services/api/stocks';

export function useCompanyProfile(
  symbol: string | null | undefined,
  exchange?: string | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['stocks', 'profile', symbol, exchange],
    queryFn: () => getCompanyProfile(symbol!, exchange),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useStockPerformance(
  symbol: string | null | undefined,
  exchange?: string | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['stocks', 'performance', symbol, exchange],
    queryFn: () => getStockPerformance(symbol!, exchange),
    enabled: isEnabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

export function useStockResolution(
  symbol: string | null | undefined,
  exchange?: string | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['stocks', 'resolve', symbol, exchange],
    queryFn: () => resolveStock(symbol!, exchange),
    enabled: isEnabled,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false,
  });
}
