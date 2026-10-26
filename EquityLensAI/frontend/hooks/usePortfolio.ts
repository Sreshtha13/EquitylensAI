import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  listPortfolios,
  createPortfolio,
  getPortfolio,
  updatePortfolio,
  deletePortfolio,
  getPortfolioHoldings,
  getPortfolioSummary,
  getPortfolioAllocation,
  getPortfolioPerformance,
  listPortfolioTransactions,
  createPortfolioTransaction,
  updatePortfolioTransaction,
  deletePortfolioTransaction,
  previewImportCsv,
  confirmImportCsv,
  type ImportPreviewRow,
} from '@/services/api/portfolio';
import type {
  PortfolioPerformanceRange,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';

export function usePortfolios() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: listPortfolios,
    enabled: isAuthenticated,
  });
}

export function usePortfolio(portfolioId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => getPortfolio(portfolioId!),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

export function usePortfolioHoldings(portfolioId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolioHoldings', portfolioId],
    queryFn: () => getPortfolioHoldings(portfolioId!),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

export function usePortfolioSummary(portfolioId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolioSummary', portfolioId],
    queryFn: () => getPortfolioSummary(portfolioId!),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

export function usePortfolioAllocation(portfolioId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolioAllocation', portfolioId],
    queryFn: () => getPortfolioAllocation(portfolioId!),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

export function usePortfolioPerformance(
  portfolioId?: string,
  range: PortfolioPerformanceRange = '1M',
) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolioPerformance', portfolioId, range],
    queryFn: () => getPortfolioPerformance(portfolioId!, range),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

export function usePortfolioTransactions(
  portfolioId?: string,
  params?: { symbol?: string; type?: string; limit?: number; offset?: number },
) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['portfolioTransactions', portfolioId, params],
    queryFn: () => listPortfolioTransactions(portfolioId!, params),
    enabled: isAuthenticated && Boolean(portfolioId),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string | null;
      baseCurrency?: SupportedCurrency;
      isDefault?: boolean;
    }) => createPortfolio(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portfolioId,
      body,
    }: {
      portfolioId: string;
      body: {
        name?: string;
        description?: string | null;
        baseCurrency?: SupportedCurrency;
        isDefault?: boolean;
      };
    }) => updatePortfolio(portfolioId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', variables.portfolioId] });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (portfolioId: string) => deletePortfolio(portfolioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portfolioId,
      body,
    }: {
      portfolioId: string;
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
      };
    }) => createPortfolioTransaction(portfolioId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioHoldings', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioAllocation', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPerformance', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioTransactions', variables.portfolioId] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portfolioId,
      transactionId,
      body,
    }: {
      portfolioId: string;
      transactionId: string;
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
      }>;
    }) => updatePortfolioTransaction(portfolioId, transactionId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioHoldings', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioAllocation', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPerformance', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioTransactions', variables.portfolioId] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portfolioId,
      transactionId,
    }: {
      portfolioId: string;
      transactionId: string;
    }) => deletePortfolioTransaction(portfolioId, transactionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioHoldings', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioAllocation', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPerformance', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioTransactions', variables.portfolioId] });
    },
  });
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: ({
      portfolioId,
      csvContent,
    }: {
      portfolioId: string;
      csvContent: string;
    }) => previewImportCsv(portfolioId, csvContent),
  });
}

export function useConfirmImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portfolioId,
      data,
    }: {
      portfolioId: string;
      data: { batchId: string; rows: ImportPreviewRow[] };
    }) => confirmImportCsv(portfolioId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioHoldings', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioAllocation', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPerformance', variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioTransactions', variables.portfolioId] });
    },
  });
}
