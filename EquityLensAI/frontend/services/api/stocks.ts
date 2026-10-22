import { apiClient } from './client';
import type { CompanyProfile, InstrumentSummary, StockPerformanceResponse } from '@/types';

/**
 * Fetch verified company profile and corporate metadata.
 */
export async function getCompanyProfile(
  symbol: string,
  exchange?: string,
): Promise<CompanyProfile> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<CompanyProfile>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/profile${qStr}`,
  );
}

/**
 * Fetch calculated historical performance metrics (1M, 3M, 6M, 1Y, 3Y, 5Y, MAX).
 */
export async function getStockPerformance(
  symbol: string,
  exchange?: string,
): Promise<StockPerformanceResponse> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<StockPerformanceResponse>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/performance${qStr}`,
  );
}

/**
 * Resolve stock against the verified instrument master.
 */
export async function resolveStock(symbol: string, exchange?: string): Promise<InstrumentSummary> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<InstrumentSummary>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/resolve${qStr}`,
  );
}
