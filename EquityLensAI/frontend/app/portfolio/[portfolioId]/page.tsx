'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  usePortfolio,
  usePortfolioHoldings,
  usePortfolioAllocation,
  usePortfolioPerformance,
  usePortfolioTransactions,
  useDeletePortfolio,
} from '@/hooks/usePortfolio';
import { PortfolioSummaryCard } from '@/components/portfolio/PortfolioSummaryCard';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { TransactionHistoryTable } from '@/components/portfolio/TransactionHistoryTable';
import { PortfolioPerformanceChart } from '@/components/portfolio/PortfolioPerformanceChart';
import { PortfolioAllocationSection } from '@/components/portfolio/PortfolioAllocationSection';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { ImportExportModal } from '@/components/portfolio/ImportExportModal';
import type {
  PortfolioPerformanceRange,
  PortfolioHolding,
  PortfolioTransaction,
} from '@equitylensai/shared';

type PortfolioDetailPageProps = {
  params: Promise<{ portfolioId: string }>;
};

type DetailTab = 'holdings' | 'ledger' | 'performance' | 'allocation';

export default function PortfolioDetailPage({ params }: PortfolioDetailPageProps) {
  const { portfolioId } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<DetailTab>('holdings');
  const [timeRange, setTimeRange] = useState<PortfolioPerformanceRange>('1M');

  // Modals
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null);
  const [selectedStockForTrade, setSelectedStockForTrade] = useState<PortfolioHolding | null>(null);

  const { data: portfolio, isLoading: isLoadingPortfolio, error: portfolioError } =
    usePortfolio(portfolioId);
  const { data: holdingsData, isLoading: isLoadingHoldings } =
    usePortfolioHoldings(portfolioId);
  const { data: transactionsData, isLoading: isLoadingTransactions } =
    usePortfolioTransactions(portfolioId);
  const { data: allocationData, isLoading: isLoadingAllocation } =
    usePortfolioAllocation(portfolioId);
  const { data: performanceData, isLoading: isLoadingPerformance } =
    usePortfolioPerformance(portfolioId, timeRange);

  const deletePortfolioMutation = useDeletePortfolio();

  if (isLoadingAuth || isLoadingPortfolio) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </main>
    );
  }

  if (!isAuthenticated) {
    router.push(`/login?redirect=/portfolio/${portfolioId}`);
    return null;
  }

  if (portfolioError || !portfolio) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <h1 className="text-xl font-bold text-white">Portfolio Not Found</h1>
        <p className="text-xs text-slate-400">
          The requested portfolio does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/portfolio"
          className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Overview
        </Link>
      </main>
    );
  }

  const handleDeletePortfolio = async () => {
    if (confirm(`Are you sure you want to delete portfolio "${portfolio.name}"? This action cannot be undone.`)) {
      await deletePortfolioMutation.mutateAsync(portfolio.id);
      router.push('/portfolio');
    }
  };

  const tabs: Array<{ id: DetailTab; label: string; badge?: number | undefined }> = [
    { id: 'holdings', label: 'Holdings', badge: holdingsData?.holdings.length },
    { id: 'ledger', label: 'Transaction Ledger', badge: transactionsData?.total },
    { id: 'performance', label: 'Performance & Benchmark' },
    { id: 'allocation', label: 'Asset & Sector Allocation' },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/portfolio" className="hover:text-slate-200 transition">
            Portfolios
          </Link>
          <span>/</span>
          <span className="font-semibold text-white">{portfolio.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setImportExportModalOpen(true)}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Import / Export CSV
          </button>

          <button
            onClick={() => {
              setEditingTransaction(null);
              setSelectedStockForTrade(null);
              setTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
          >
            <span>+ Record Trade</span>
          </button>

          <button
            onClick={handleDeletePortfolio}
            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Portfolio Title & Meta Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white sm:text-3xl">{portfolio.name}</h1>
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400">
              {portfolio.baseCurrency}
            </span>
            {portfolio.isDefault && (
              <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                Primary Default
              </span>
            )}
          </div>
          {portfolio.description && (
            <p className="mt-1 text-xs text-slate-300 max-w-xl">{portfolio.description}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <PortfolioSummaryCard
        summary={holdingsData?.summary}
        isLoading={isLoadingHoldings}
      />

      {/* Navigation Tabs */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <nav className="flex space-x-1.5 rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 shadow-xl backdrop-blur-xl min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-sky-500/10 text-sky-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex flex-col gap-6">
        {/* TAB: HOLDINGS */}
        {activeTab === 'holdings' && (
          <HoldingsTable
            holdings={holdingsData?.holdings || []}
            baseCurrency={portfolio.baseCurrency}
            isLoading={isLoadingHoldings}
            onTradeStock={(h) => {
              setSelectedStockForTrade(h);
              setEditingTransaction(null);
              setTxModalOpen(true);
            }}
          />
        )}

        {/* TAB: LEDGER HISTORY */}
        {activeTab === 'ledger' && (
          <TransactionHistoryTable
            transactions={transactionsData?.transactions || []}
            portfolioId={portfolioId}
            isLoading={isLoadingTransactions}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setSelectedStockForTrade(null);
              setTxModalOpen(true);
            }}
          />
        )}

        {/* TAB: PERFORMANCE */}
        {activeTab === 'performance' && (
          <PortfolioPerformanceChart
            performance={performanceData}
            timeRange={timeRange}
            onRangeChange={setTimeRange}
            isLoading={isLoadingPerformance}
          />
        )}

        {/* TAB: ALLOCATION */}
        {activeTab === 'allocation' && (
          <PortfolioAllocationSection
            allocation={allocationData}
            baseCurrency={portfolio.baseCurrency}
            isLoading={isLoadingAllocation}
          />
        )}
      </div>

      {/* Modals */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTransaction(null);
          setSelectedStockForTrade(null);
        }}
        portfolioId={portfolioId}
        initialSymbol={selectedStockForTrade?.symbol}
        initialExchange={selectedStockForTrade?.exchange}
        initialPrice={selectedStockForTrade?.currentPrice ?? undefined}
        editingTransaction={editingTransaction}
      />

      <ImportExportModal
        isOpen={importExportModalOpen}
        onClose={() => setImportExportModalOpen(false)}
        portfolioId={portfolioId}
        portfolioName={portfolio.name}
      />
    </main>
  );
}
