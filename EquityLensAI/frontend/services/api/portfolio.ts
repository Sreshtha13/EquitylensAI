import { apiClient } from './client';
import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
  PortfolioAllocation,
  PortfolioPerformance,
  PortfolioPerformanceRange,
  PortfolioTransaction,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';

export interface ImportPreviewRow {
  index: number;
  type: PortfolioTransactionType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  quantity: number;
  price: number;
  currency: SupportedCurrency;
  fees: number;
  taxes: number;
  totalAmount: number;
  tradeDate: string;
  notes?: string | null;
  isValid: boolean;
  errors: string[];
}

export async function listPortfolios(): Promise<Portfolio[]> {
  return apiClient.get<Portfolio[]>('/api/v1/portfolios');
}

export async function createPortfolio(body: {
  name: string;
  description?: string | null;
  baseCurrency?: SupportedCurrency;
  isDefault?: boolean;
}): Promise<Portfolio> {
  return apiClient.post<Portfolio>('/api/v1/portfolios', body);
}

export async function getPortfolio(portfolioId: string): Promise<Portfolio> {
  return apiClient.get<Portfolio>(`/api/v1/portfolios/${portfolioId}`);
}

export async function updatePortfolio(
  portfolioId: string,
  body: {
    name?: string;
    description?: string | null;
    baseCurrency?: SupportedCurrency;
    isDefault?: boolean;
  },
): Promise<Portfolio> {
  return apiClient.patch<Portfolio>(`/api/v1/portfolios/${portfolioId}`, body);
}

export async function deletePortfolio(portfolioId: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/api/v1/portfolios/${portfolioId}`);
}

export async function getPortfolioHoldings(
  portfolioId: string,
): Promise<{ holdings: PortfolioHolding[]; summary: PortfolioSummary }> {
  return apiClient.get<{ holdings: PortfolioHolding[]; summary: PortfolioSummary }>(
    `/api/v1/portfolios/${portfolioId}/holdings`,
  );
}

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  return apiClient.get<PortfolioSummary>(`/api/v1/portfolios/${portfolioId}/summary`);
}

export async function getPortfolioAllocation(portfolioId: string): Promise<PortfolioAllocation> {
  return apiClient.get<PortfolioAllocation>(`/api/v1/portfolios/${portfolioId}/allocation`);
}

export async function getPortfolioPerformance(
  portfolioId: string,
  range: PortfolioPerformanceRange = '1M',
): Promise<PortfolioPerformance> {
  return apiClient.get<PortfolioPerformance>(
    `/api/v1/portfolios/${portfolioId}/performance?range=${range}`,
  );
}

export async function listPortfolioTransactions(
  portfolioId: string,
  options?: {
    symbol?: string;
    type?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ transactions: PortfolioTransaction[]; total: number }> {
  const query = new URLSearchParams();
  if (options?.symbol) query.set('symbol', options.symbol);
  if (options?.type) query.set('type', options.type);
  if (options?.limit) query.set('limit', String(options.limit));
  if (options?.offset) query.set('offset', String(options.offset));

  const qs = query.toString();
  return apiClient.get<{ transactions: PortfolioTransaction[]; total: number }>(
    `/api/v1/portfolios/${portfolioId}/transactions${qs ? `?${qs}` : ''}`,
  );
}

export async function createPortfolioTransaction(
  portfolioId: string,
  body: {
    type: PortfolioTransactionType;
    symbol?: string | null;
    exchange?: SupportedExchange | null;
    quantity: number;
    price: number;
    currency?: SupportedCurrency;
    fees?: number;
    taxes?: number;
    tradeDate?: string;
    settlementDate?: string | null;
    notes?: string | null;
    splitRatio?: number | null;
  },
): Promise<PortfolioTransaction> {
  return apiClient.post<PortfolioTransaction>(`/api/v1/portfolios/${portfolioId}/transactions`, body);
}

export async function updatePortfolioTransaction(
  portfolioId: string,
  transactionId: string,
  body: Partial<{
    type: PortfolioTransactionType;
    symbol: string | null;
    exchange: SupportedExchange | null;
    quantity: number;
    price: number;
    currency: SupportedCurrency;
    fees: number;
    taxes: number;
    tradeDate: string;
    settlementDate: string | null;
    notes: string | null;
    splitRatio: number | null;
  }>,
): Promise<PortfolioTransaction> {
  return apiClient.patch<PortfolioTransaction>(
    `/api/v1/portfolios/${portfolioId}/transactions/${transactionId}`,
    body,
  );
}

export async function deletePortfolioTransaction(
  portfolioId: string,
  transactionId: string,
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(
    `/api/v1/portfolios/${portfolioId}/transactions/${transactionId}`,
  );
}

export async function previewImportCsv(
  portfolioId: string,
  csvContent: string,
): Promise<{
  previewRows: ImportPreviewRow[];
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  batchId: string;
}> {
  return apiClient.post(`/api/v1/portfolios/${portfolioId}/import/preview`, { csvContent });
}

export async function confirmImportCsv(
  portfolioId: string,
  data: {
    batchId: string;
    rows: ImportPreviewRow[];
  },
): Promise<{ count: number; transactions: PortfolioTransaction[] }> {
  return apiClient.post(`/api/v1/portfolios/${portfolioId}/import/confirm`, data);
}
