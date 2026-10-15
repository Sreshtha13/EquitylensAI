import { apiClient } from './client';
import type { FinancialAnalysis, FinancialHealthScore } from '@/types';

export type GetFinancialAnalysisOptions = {
  exchange?: string | undefined;
  periods?: number | undefined;
};

/**
 * Fetch the full financial analysis for a symbol.
 * Includes statements, calculated ratios, valuation multiples, and health score.
 */
export async function getFinancialAnalysis(
  symbol: string,
  options?: GetFinancialAnalysisOptions
): Promise<FinancialAnalysis> {
  const params = new URLSearchParams();
  if (options?.exchange) params.set('exchange', options.exchange);
  if (options?.periods) params.set('periods', String(options.periods));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<FinancialAnalysis>(
    `/api/v1/financial/${encodeURIComponent(symbol)}/analysis${qStr}`
  );
}

/**
 * Fetch only the financial health score for a symbol (lightweight).
 */
export async function getFinancialHealthScore(
  symbol: string,
  exchange?: string
): Promise<FinancialHealthScore> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<FinancialHealthScore>(
    `/api/v1/financial/${encodeURIComponent(symbol)}/health-score${qStr}`
  );
}
