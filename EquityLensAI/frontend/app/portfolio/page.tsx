'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  usePortfolios,
  usePortfolioHoldings,
  usePortfolioAllocation,
  usePortfolioPerformance,
} from '@/hooks/usePortfolio';
import { PortfolioSummaryCard } from '@/components/portfolio/PortfolioSummaryCard';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioAllocationSection } from '@/components/portfolio/PortfolioAllocationSection';
import { PortfolioPerformanceChart } from '@/components/portfolio/PortfolioPerformanceChart';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { CreatePortfolioModal } from '@/components/portfolio/CreatePortfolioModal';
import { ImportExportModal } from '@/components/portfolio/ImportExportModal';
import type { PortfolioPerformanceRange, PortfolioHolding } from '@equitylensai/shared';

export default function PortfolioOverviewPage() {
  const { isAuthenticated, isLoading: isLoadingAuth } = useAuth();

  const { data: portfolios = [], isLoading: isLoadingPortfolios } = usePortfolios();
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<PortfolioPerformanceRange>('1M');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);
  const [selectedStockForTrade, setSelectedStockForTrade] = useState<PortfolioHolding | null>(null);

  // Set active portfolio once loaded
  const currentPortfolioId =
    activePortfolioId || (portfolios.length > 0 ? (portfolios[0]?.id ?? '') : '');
  const activePortfolio = portfolios.find((p) => p.id === currentPortfolioId) || portfolios[0];

  const { data: holdingsData, isLoading: isLoadingHoldings } =
    usePortfolioHoldings(currentPortfolioId);
  const { data: allocationData, isLoading: isLoadingAllocation } =
    usePortfolioAllocation(currentPortfolioId);
  const { data: performanceData, isLoading: isLoadingPerformance } =
    usePortfolioPerformance(currentPortfolioId, timeRange);

  if (isLoadingAuth) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-xl shadow-sky-500/20 text-white">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">
          Portfolio Tracking & Performance Analytics
        </h1>
        <p className="max-w-md text-sm text-slate-300 leading-relaxed">
          Sign in or create an account to record investment transactions, calculate weighted-average
          cost basis, monitor live market valuation, and benchmark your returns against NIFTY 50 and S&P 500.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/login?redirect=/portfolio"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
          >
            Sign In
          </Link>
          <Link
            href="/register?redirect=/portfolio"
            className="rounded-xl border border-white/10 bg-slate-900 px-6 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Create Account
          </Link>
        </div>
      </main>
    );
  }

  // Empty State: User has 0 portfolios
  if (!isLoadingPortfolios && portfolios.length === 0) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">
          Build Your Investment Portfolio
        </h1>
        <p className="max-w-md text-sm text-slate-300 leading-relaxed">
          Create your first investment portfolio to start recording equity trades, dividends, and
          cash balances with zero fabricated market data.
        </p>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-xl shadow-sky-500/20 hover:brightness-110 transition"
        >
          <span className="text-base font-normal">+</span> Create Your First Portfolio
        </button>

        <CreatePortfolioModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(id) => setActivePortfolioId(id)}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* 1. Header & Portfolio Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Investment Portfolios
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic ledger accounting & market performance analytics
            </p>
          </div>

          {/* Portfolio Switcher Dropdown */}
          {portfolios.length > 1 && (
            <select
              value={currentPortfolioId}
              onChange={(e) => setActivePortfolioId(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white focus:border-sky-500 focus:outline-none"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.baseCurrency})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            + New Portfolio
          </button>

          <button
            onClick={() => setImportExportModalOpen(true)}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            CSV Import/Export
          </button>

          <button
            onClick={() => {
              setSelectedStockForTrade(null);
              setTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
          >
            <span>+ Record Trade</span>
          </button>

          {currentPortfolioId && (
            <Link
              href={`/portfolio/${currentPortfolioId}`}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition"
            >
              Detailed Ledger →
            </Link>
          )}
        </div>
      </div>

      {/* 2. Portfolio Summary Metric Cards */}
      <PortfolioSummaryCard
        summary={holdingsData?.summary}
        isLoading={isLoadingHoldings}
      />

      {/* 3. Interactive Historical Performance Chart */}
      <PortfolioPerformanceChart
        performance={performanceData}
        timeRange={timeRange}
        onRangeChange={setTimeRange}
        isLoading={isLoadingPerformance}
      />

      {/* 4. Asset Allocation & Sector Exposure */}
      <PortfolioAllocationSection
        allocation={allocationData}
        baseCurrency={activePortfolio?.baseCurrency}
        isLoading={isLoadingAllocation}
      />

      {/* 5. Holdings Table Preview */}
      <div className="flex flex-col gap-3">
        <HoldingsTable
          holdings={holdingsData?.holdings || []}
          baseCurrency={activePortfolio?.baseCurrency}
          isLoading={isLoadingHoldings}
          onTradeStock={(h) => {
            setSelectedStockForTrade(h);
            setTxModalOpen(true);
          }}
        />
      </div>

      {/* Modals */}
      <CreatePortfolioModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(id) => setActivePortfolioId(id)}
      />

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setSelectedStockForTrade(null);
        }}
        portfolioId={currentPortfolioId}
        initialSymbol={selectedStockForTrade?.symbol}
        initialExchange={selectedStockForTrade?.exchange}
        initialPrice={selectedStockForTrade?.currentPrice ?? undefined}
      />

      {currentPortfolioId && activePortfolio && (
        <ImportExportModal
          isOpen={importExportModalOpen}
          onClose={() => setImportExportModalOpen(false)}
          portfolioId={currentPortfolioId}
          portfolioName={activePortfolio.name}
        />
      )}
    </main>
  );
}
