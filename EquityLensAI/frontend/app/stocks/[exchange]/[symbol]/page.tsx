'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useStockQuote } from '@/hooks/useMarket';
import { useCompanyProfile, useStockResolution } from '@/hooks/useStocks';
import { useFinancialAnalysis } from '@/hooks/useFinancial';
import { StockHeader } from '@/components/stock/StockHeader';
import { StockChart } from '@/components/stock/StockChart';
import { CompanyOverviewSection } from '@/components/stock/CompanyOverviewSection';
import { PerformanceSection } from '@/components/stock/PerformanceSection';
import { ValuationSection } from '@/components/stock/ValuationSection';
import { FinancialStatementsTable } from '@/components/financial/FinancialStatementsTable';
import { FinancialMetricsGrid } from '@/components/financial/FinancialMetricsGrid';
import { HealthScoreCard } from '@/components/financial/HealthScoreCard';
import { AiResearchPanel } from '@/components/research/AiResearchPanel';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import type { InstrumentSummary } from '@/types';

type TabKey =
  | 'overview'
  | 'chart'
  | 'profile'
  | 'financials'
  | 'ratios'
  | 'valuation'
  | 'health'
  | 'performance'
  | 'ai';

const TABS: Array<{ key: TabKey; label: string; badge?: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'chart', label: 'Price Chart' },
  { key: 'profile', label: 'Company Profile' },
  { key: 'financials', label: 'Financial Statements' },
  { key: 'ratios', label: 'Financial Ratios' },
  { key: 'valuation', label: 'Valuation' },
  { key: 'health', label: 'Financial Health' },
  { key: 'performance', label: 'Historical Performance' },
  { key: 'ai', label: 'AI Research', badge: 'Gemini' },
];

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ exchange: string; symbol: string }>;
}) {
  const { exchange: rawExchange, symbol: rawSymbol } = use(params);

  // Normalize exchange & symbol
  const cleanExchange = decodeURIComponent(rawExchange || 'NSE').toUpperCase();
  const cleanSymbol = decodeURIComponent(rawSymbol || '').toUpperCase().trim();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 1. Resolve Instrument Master
  const {
    isLoading: isResolving,
    isError: isResolveError,
  } = useStockResolution(cleanSymbol, cleanExchange);

  // 2. Quote (independent polling)
  const {
    data: quote,
    isLoading: isLoadingQuote,
    isRefetching: isRefetchingQuote,
    error: quoteError,
    refetch: refetchQuote,
  } = useStockQuote(cleanSymbol, cleanExchange, {
    refetchInterval: 15_000,
    enabled: !isResolveError,
  });

  // 3. Company Profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useCompanyProfile(cleanSymbol, cleanExchange, {
    enabled: !isResolveError,
  });

  // 4. Financial Analysis (Statements, Deterministic Ratios, Valuation, Health Score)
  const {
    data: financialAnalysis,
    isLoading: isLoadingFinancials,
    error: financialsError,
    refetch: refetchFinancials,
  } = useFinancialAnalysis(cleanSymbol, {
    exchange: cleanExchange,
    periods: 4,
    enabled: !isResolveError,
  });

  // Handle instrument search select
  const handleSelectStock = (item: InstrumentSummary) => {
    window.location.href = `/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`;
  };

  // ─── 404 / Unknown Instrument State ───────────────────────────────────────────
  if (!isResolving && isResolveError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 sm:p-12 shadow-2xl backdrop-blur-xl max-w-xl w-full">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="mt-4 text-2xl font-black text-white">Stock Not Found</h1>
          <p className="mt-2 text-sm text-rose-200/80 leading-relaxed">
            No supported security matching <strong className="text-white">{cleanSymbol}</strong> on exchange{' '}
            <strong className="text-white">{cleanExchange}</strong> exists in our instrument master.
          </p>

          <p className="mt-4 text-xs text-slate-400">
            Search for listed securities across supported exchanges (NSE, BSE, NASDAQ, NYSE):
          </p>

          <div className="mt-4 text-left">
            <InstrumentSearch onSelect={handleSelectStock} />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <span className="text-slate-500 self-center">Popular:</span>
            <Link
              href="/stocks/NSE/RELIANCE"
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:text-white"
            >
              RELIANCE (NSE)
            </Link>
            <Link
              href="/stocks/NSE/TCS"
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:text-white"
            >
              TCS (NSE)
            </Link>
            <Link
              href="/stocks/NSE/INFY"
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:text-white"
            >
              INFY (NSE)
            </Link>
            <Link
              href="/stocks/NASDAQ/AAPL"
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:text-white"
            >
              AAPL (NASDAQ)
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      {/* Breadcrumb Navigation & Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/market" className="hover:text-slate-200 transition">
            Market
          </Link>
          <span>/</span>
          <span className="text-slate-500">{cleanExchange}</span>
          <span>/</span>
          <span className="font-semibold text-white">{cleanSymbol}</span>
        </nav>

        <div className="w-full sm:w-80">
          <InstrumentSearch onSelect={handleSelectStock} selectedSymbol={cleanSymbol} />
        </div>
      </div>

      {/* 1. Header & Market Summary */}
      <StockHeader
        symbol={cleanSymbol}
        exchange={cleanExchange}
        profile={profile}
        quote={quote}
        isLoadingQuote={isLoadingQuote}
        isRefetchingQuote={isRefetchingQuote}
        quoteError={quoteError as Error | null}
        onRefreshQuote={refetchQuote}
      />

      {/* 2. Navigation Tab Bar */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <nav className="flex space-x-1.5 rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 shadow-xl backdrop-blur-xl min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-sky-500/10 text-sky-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 3. Section Content Rendering (Independent Loading & Error Isolation) */}
      <div className="flex flex-col gap-8">
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-8">
            {/* Interactive Chart */}
            <StockChart symbol={cleanSymbol} exchange={cleanExchange} />

            {/* Quick Two-Column Layout: Overview + Health Score */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <CompanyOverviewSection
                profile={profile}
                isLoading={isLoadingProfile}
                error={profileError as Error | null}
              />

              {financialAnalysis ? (
                <HealthScoreCard healthScore={financialAnalysis.healthScore} />
              ) : isLoadingFinancials ? (
                <div className="h-64 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 text-xs text-slate-400 flex items-center justify-center">
                  Financial health score calculation requires audited annual filings.
                </div>
              )}
            </div>

            {/* Quick Valuation Snapshot */}
            {financialAnalysis && (
              <ValuationSection analysis={financialAnalysis} quote={quote} />
            )}

            {/* Quick Performance Highlights */}
            <PerformanceSection symbol={cleanSymbol} exchange={cleanExchange} />
          </div>
        )}

        {/* TAB: CHART */}
        {activeTab === 'chart' && (
          <div className="flex flex-col gap-6">
            <StockChart symbol={cleanSymbol} exchange={cleanExchange} />
          </div>
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-6">
            <CompanyOverviewSection
              profile={profile}
              isLoading={isLoadingProfile}
              error={profileError as Error | null}
            />
          </div>
        )}

        {/* TAB: FINANCIAL STATEMENTS */}
        {activeTab === 'financials' && (
          <div className="flex flex-col gap-6">
            {isLoadingFinancials ? (
              <div className="h-96 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
            ) : financialsError || !financialAnalysis ? (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-300">
                <h4 className="text-base font-bold">Financial Statements Unavailable</h4>
                <p className="mt-2 text-xs text-rose-300/80 leading-relaxed">
                  {financialsError?.message ||
                    `Audited financial statement filings could not be retrieved for ${cleanSymbol}. Ensure the company files annual reports on supported exchanges.`}
                </p>
                <button
                  onClick={() => refetchFinancials()}
                  className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition"
                >
                  Retry Statements
                </button>
              </div>
            ) : (
              <FinancialStatementsTable analysis={financialAnalysis} />
            )}
          </div>
        )}

        {/* TAB: RATIOS */}
        {activeTab === 'ratios' && (
          <div className="flex flex-col gap-6">
            {isLoadingFinancials ? (
              <div className="h-96 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
            ) : financialsError || !financialAnalysis ? (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-300 text-xs">
                Financial ratios require reported income and balance sheet statements.
              </div>
            ) : (
              <FinancialMetricsGrid analysis={financialAnalysis} />
            )}
          </div>
        )}

        {/* TAB: VALUATION */}
        {activeTab === 'valuation' && (
          <div className="flex flex-col gap-6">
            {isLoadingFinancials ? (
              <div className="h-80 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
            ) : financialsError || !financialAnalysis ? (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-300 text-xs">
                Valuation multiples require reported earnings and cash flows.
              </div>
            ) : (
              <ValuationSection analysis={financialAnalysis} quote={quote} />
            )}
          </div>
        )}

        {/* TAB: FINANCIAL HEALTH */}
        {activeTab === 'health' && (
          <div className="flex flex-col gap-6">
            {isLoadingFinancials ? (
              <div className="h-80 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
            ) : financialsError || !financialAnalysis ? (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-300 text-xs">
                Financial health scoring requires at least 2 consecutive reporting periods.
              </div>
            ) : (
              <HealthScoreCard healthScore={financialAnalysis.healthScore} />
            )}
          </div>
        )}

        {/* TAB: HISTORICAL PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="flex flex-col gap-6">
            <PerformanceSection symbol={cleanSymbol} exchange={cleanExchange} />
          </div>
        )}

        {/* TAB: AI RESEARCH */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-6">
            <AiResearchPanel
              key={`${cleanSymbol}:${cleanExchange}`}
              symbol={cleanSymbol}
              exchange={cleanExchange}
            />
          </div>
        )}
      </div>
    </main>
  );
}
