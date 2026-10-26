'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  ComparisonCompanyTarget,
  CompanyComparisonResult,
  PeerBenchmarkResponse,
  HistoricalComparisonResult,
  SupportedPeriod,
} from '@equitylensai/shared';
import {
  compareCompanies,
  getPeerBenchmarks,
  getHistoricalComparison,
  exportComparisonCsv,
} from '@/services/api/compare';
import { CompanySelector } from '@/components/compare/CompanySelector';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { PeerBenchmarkCards } from '@/components/compare/PeerBenchmarkCards';
import { HistoricalCompareChart } from '@/components/compare/HistoricalCompareChart';
import { AiComparisonPanel } from '@/components/compare/AiComparisonPanel';
import { SaveComparisonModal } from '@/components/compare/SaveComparisonModal';

function CompareWorkbench() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize selected companies from URL or default to TCS and INFY
  const [selectedCompanies, setSelectedCompanies] = useState<ComparisonCompanyTarget[]>(() => {
    const symsParam = searchParams.get('symbols');
    if (symsParam) {
      const parts = symsParam.split(',').filter(Boolean);
      return parts.map((p) => {
        const [sym, exch] = p.split(':');
        return {
          symbol: (sym || '').toUpperCase(),
          exchange: (exch || 'NSE').toUpperCase(),
        };
      });
    }
    return [
      { symbol: 'TCS', exchange: 'NSE' },
      { symbol: 'INFY', exchange: 'NSE' },
    ];
  });

  const [period, setPeriod] = useState<SupportedPeriod>('annual');
  const [scope, setScope] = useState<'consolidated' | 'standalone'>('consolidated');
  const [historyInterval, setHistoryInterval] = useState<'1M' | '3M' | '6M' | '1Y' | '5Y'>('1Y');

  // Async States
  const [comparisonResult, setComparisonResult] = useState<CompanyComparisonResult | null>(null);
  const [benchmarks, setBenchmarks] = useState<PeerBenchmarkResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalComparisonResult | null>(null);

  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [isLoadingBenchmarks, setIsLoadingBenchmarks] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync state with URL params
  const updateUrl = useCallback((targets: ComparisonCompanyTarget[]) => {
    if (targets.length === 0) return;
    const str = targets.map((t) => `${t.symbol}:${t.exchange}`).join(',');
    router.replace(`/compare?symbols=${encodeURIComponent(str)}`, { scroll: false });
  }, [router]);

  // Load comparison data
  const runComparison = useCallback(async (targets: ComparisonCompanyTarget[]) => {
    if (targets.length < 2) {
      setComparisonResult(null);
      setBenchmarks(null);
      setHistoricalData(null);
      return;
    }

    setIsLoadingComparison(true);
    setIsLoadingBenchmarks(true);
    setIsLoadingHistory(true);
    setError(null);

    // 1. Primary fundamental comparison
    try {
      const compRes = await compareCompanies({
        symbols: targets,
        period,
        scope,
      });
      setComparisonResult(compRes);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to retrieve comparative financial data.',
      );
    } finally {
      setIsLoadingComparison(false);
    }

    // 2. Peer Benchmarks
    try {
      const benchRes = await getPeerBenchmarks(targets, period, scope);
      setBenchmarks(benchRes);
    } catch {
      setBenchmarks(null);
    } finally {
      setIsLoadingBenchmarks(false);
    }

    // 3. Historical Trends & Normalized Prices
    try {
      const histRes = await getHistoricalComparison(targets, historyInterval, period);
      setHistoricalData(histRes);
    } catch {
      setHistoricalData(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [period, scope, historyInterval]);

  // Fetch when selections change
  useEffect(() => {
    runComparison(selectedCompanies);
  }, [selectedCompanies, runComparison]);

  // Handler for adding a company
  const handleAddCompany = (target: ComparisonCompanyTarget) => {
    if (selectedCompanies.some((c) => c.symbol.toUpperCase() === target.symbol.toUpperCase())) {
      return;
    }
    if (selectedCompanies.length >= 5) return;

    const next = [...selectedCompanies, target];
    setSelectedCompanies(next);
    updateUrl(next);
  };

  // Handler for removing a company
  const handleRemoveCompany = (symbol: string) => {
    const next = selectedCompanies.filter((c) => c.symbol.toUpperCase() !== symbol.toUpperCase());
    setSelectedCompanies(next);
    updateUrl(next);
  };

  // Re-fetch historical data when interval changes
  const handleIntervalChange = async (interval: '1M' | '3M' | '6M' | '1Y' | '5Y') => {
    setHistoryInterval(interval);
    if (selectedCompanies.length < 2) return;
    setIsLoadingHistory(true);
    try {
      const histRes = await getHistoricalComparison(selectedCompanies, interval, period);
      setHistoricalData(histRes);
    } catch {
      // keep current
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Page Title & Workbench Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Company Comparison & Benchmarking
            </h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
              Phase 12
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Multi-company valuation, profitability, leverage, growth, and historical performance analysis for NSE/BSE equities.
          </p>
        </div>

        {/* Global Workbench Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reporting Period & Scope Controls */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-white/10 p-1 text-xs">
            <button
              onClick={() => setPeriod('annual')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                period === 'annual' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setPeriod('ttm')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                period === 'ttm' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              TTM
            </button>
          </div>

          <div className="flex items-center rounded-lg bg-slate-900 border border-white/10 p-1 text-xs">
            <button
              onClick={() => setScope('consolidated')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                scope === 'consolidated' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Consolidated
            </button>
            <button
              onClick={() => setScope('standalone')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                scope === 'standalone' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Standalone
            </button>
          </div>

          {/* Export CSV Button */}
          {comparisonResult && (
            <button
              onClick={() => exportComparisonCsv(comparisonResult)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <span>📥</span>
              <span>Export CSV</span>
            </button>
          )}

          {/* Save Comparison Button */}
          {selectedCompanies.length >= 2 && (
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/20"
            >
              <span>💾</span>
              <span>Save Set</span>
            </button>
          )}

          {/* Link to Saved Comparisons Dashboard */}
          <Link
            href="/compare/saved"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <span>📁</span>
            <span>Saved Sets</span>
          </Link>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-400 flex items-center justify-between">
          <span>{saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* 1. Company Selector */}
      <CompanySelector
        selectedCompanies={selectedCompanies}
        onAddCompany={handleAddCompany}
        onRemoveCompany={handleRemoveCompany}
        maxCompanies={5}
      />

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-300">
          <div className="font-semibold mb-1">Comparison Error</div>
          <div>{error}</div>
        </div>
      )}

      {selectedCompanies.length < 2 && (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center space-y-2">
          <div className="text-3xl">⚖️</div>
          <div className="text-sm font-semibold text-white">Compare at least two companies</div>
          <div className="text-xs text-slate-400 max-w-sm mx-auto">
            Use the search bar above to select two or more companies to view comprehensive side-by-side fundamentals, valuation multiples, and historical trends.
          </div>
        </div>
      )}

      {selectedCompanies.length >= 2 && (
        <>
          {/* 2. Side-by-Side Financial Comparison Table */}
          {isLoadingComparison ? (
            <div className="h-64 rounded-xl border border-white/10 bg-slate-900/40 flex items-center justify-center text-xs text-slate-400 animate-pulse">
              Retrieving verified company statements and calculating valuation multiples...
            </div>
          ) : comparisonResult ? (
            <ComparisonTable
              result={comparisonResult}
              onRemoveCompany={handleRemoveCompany}
            />
          ) : null}

          {/* 3. Peer Benchmark Cards */}
          <PeerBenchmarkCards
            benchmarks={benchmarks}
            isLoading={isLoadingBenchmarks}
          />

          {/* 4. Historical Trend & Normalized Price Performance Chart */}
          <HistoricalCompareChart
            historicalData={historicalData}
            isLoading={isLoadingHistory}
            currentInterval={historyInterval}
            onIntervalChange={handleIntervalChange}
          />

          {/* 5. Evidence-Backed AI Comparative Analysis Panel */}
          <AiComparisonPanel
            selectedSymbols={selectedCompanies}
            period={period}
          />
        </>
      )}

      {/* Save Comparison Modal */}
      <SaveComparisonModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        selectedSymbols={selectedCompanies}
        period={period}
        scope={scope}
        onSaved={(saved) => {
          setSaveSuccessMsg(`Comparison "${saved.name}" successfully saved!`);
        }}
      />
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-12 text-center text-xs text-slate-400 animate-pulse">
          Loading comparison workbench...
        </div>
      }
    >
      <CompareWorkbench />
    </Suspense>
  );
}
