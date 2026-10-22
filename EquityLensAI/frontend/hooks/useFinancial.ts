'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getFinancialAnalysis,
  getFinancialHealthScore,
  type GetFinancialAnalysisOptions,
} from '@/services/api/financial';

export function useFinancialAnalysis(
  symbol: string | null | undefined,
  options?: GetFinancialAnalysisOptions & { enabled?: boolean | undefined },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['financial', 'analysis', symbol, options?.exchange, options?.periods],
    queryFn: () => getFinancialAnalysis(symbol!, options),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
  });
}

export function useFinancialHealthScore(
  symbol: string | null | undefined,
  exchange?: string | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const isEnabled = Boolean(symbol && (options?.enabled ?? true));

  return useQuery({
    queryKey: ['financial', 'health-score', symbol, exchange],
    queryFn: () => getFinancialHealthScore(symbol!, exchange),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  });
}
