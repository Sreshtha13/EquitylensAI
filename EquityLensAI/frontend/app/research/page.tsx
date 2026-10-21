'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { HealthScoreCard } from '@/components/financial/HealthScoreCard';
import { FinancialMetricsGrid } from '@/components/financial/FinancialMetricsGrid';
import { FinancialStatementsTable } from '@/components/financial/FinancialStatementsTable';
import { AiResearchPanel } from '@/components/research/AiResearchPanel';
import { useFinancialAnalysis } from '@/hooks/useFinancial';
import type { InstrumentSummary } from '@/types';
import Link from 'next/link';

function ResearchContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || 'RELIANCE';
  const initialExchange = searchParams.get('exchange') || 'NSE';

  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    exchange: string | undefined;
    name: string | undefined;
  }>({
    symbol: initialSymbol,
    exchange: initialExchange,
    name: initialSymbol === 'RELIANCE' ? 'Reliance Industries Limited' : initialSymbol,
  });

  useEffect(() => {
    const sym = searchParams.get('symbol');
    const ex = searchParams.get('exchange');
    if (sym) {
      setSelectedStock((current) =>
        sym !== current.symbol
          ? {
              symbol: sym,
              exchange: ex || undefined,
              name: sym,
            }
          : current,
      );
    }
  }, [searchParams]);

  const {
    data: analysis,
    isLoading,
    error,
    isRefetching,
    refetch,
  } = useFinancialAnalysis(selectedStock.symbol, {
    exchange: selectedStock.exchange,
    periods: 4,
  });

  const handleSelectInstrument = (item: InstrumentSummary) => {
    setSelectedStock({
      symbol: item.symbol,
      exchange: item.exchange,
      name: item.name,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Phase 4 AI + Deterministic Research
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Fundamental Financial Research
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Verified financial analysis and quantitative health scoring, with Gemini interpretation
            grounded in platform evidence. Deterministic metrics remain authoritative; AI-generated
            research is clearly identified and sourced.
          </p>
        </div>

        {/* Quick Nav to Market */}
        <Link
          href="/market"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-sky-500/30 hover:bg-slate-800 hover:text-white"
        >
          <span>View Live Market Quotes</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </Link>
      </div>

      {/* Search Header */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Search Security for Fundamental Analysis
        </label>
        <InstrumentSearch onSelect={handleSelectInstrument} selectedSymbol={selectedStock.symbol} />
      </div>

      {/* Company Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 p-6 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white sm:text-3xl">{selectedStock.symbol}</h2>
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400">
              {selectedStock.exchange ?? 'NSE'}
            </span>
            {isRefetching && (
              <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-slate-300">
            {analysis?.name || selectedStock.name || selectedStock.symbol}
          </p>
          {analysis && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span>
                Currency: <strong className="text-slate-200">{analysis.currency}</strong>
              </span>
              <span>•</span>
              <span>
                Source: <strong className="text-slate-200">{analysis.source}</strong>
              </span>
              <span>•</span>
              <span>
                Retrieved:{' '}
                <strong className="text-slate-200">
                  {new Date(analysis.retrievedAt).toLocaleDateString()}
                </strong>
              </span>
              {analysis.isStale && (
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-400 font-semibold">
                  Serving cached data
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
        >
          {isRefetching ? 'Refreshing...' : 'Refresh Fundamentals'}
        </button>
      </div>

      <AiResearchPanel
        key={`${selectedStock.symbol}:${selectedStock.exchange ?? 'NSE'}`}
        symbol={selectedStock.symbol}
        exchange={selectedStock.exchange ?? 'NSE'}
      />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-6">
          <div className="h-64 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-8" />
          <div className="h-96 w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-8" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && (error || !analysis) && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-300">
          <h3 className="text-lg font-bold">Financial Statements Unavailable</h3>
          <p className="mt-2 text-sm text-rose-300/80 leading-relaxed">
            {error?.message ||
              `Could not retrieve verified financial statement filings for ${selectedStock.symbol}. Ensure the ticker has reported audited annual financial statements with supported exchanges.`}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() =>
                handleSelectInstrument({
                  symbol: 'RELIANCE',
                  exchange: 'NSE',
                  name: 'Reliance Industries',
                  market: 'nse',
                  assetType: 'equity',
                  currency: 'INR',
                })
              }
              className="rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
            >
              Try RELIANCE (NSE)
            </button>
            <button
              onClick={() =>
                handleSelectInstrument({
                  symbol: 'AAPL',
                  exchange: 'NASDAQ',
                  name: 'Apple Inc.',
                  market: 'us',
                  assetType: 'equity',
                  currency: 'USD',
                })
              }
              className="rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
            >
              Try AAPL (NASDAQ)
            </button>
          </div>
        </div>
      )}

      {/* Active Content when loaded */}
      {!isLoading && analysis && (
        <div className="flex flex-col gap-8">
          {/* Health Score Diagnostic */}
          <HealthScoreCard healthScore={analysis.healthScore} />

          {/* Deterministic Ratios Grid */}
          <FinancialMetricsGrid analysis={analysis} />

          {/* Financial Statements Table */}
          <FinancialStatementsTable analysis={analysis} />
        </div>
      )}
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 animate-pulse">
          <div className="h-20 w-1/3 rounded-2xl bg-slate-900/60" />
          <div className="h-64 w-full rounded-3xl bg-slate-900/60" />
        </div>
      }
    >
      <ResearchContent />
    </Suspense>
  );
}
