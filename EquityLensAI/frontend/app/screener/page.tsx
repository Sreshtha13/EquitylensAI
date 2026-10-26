'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listFavorites } from '@/services/api/favorites';
import { ApiClientError } from '@/services/api/client';
import {
  getScreenerMetrics,
  interpretScreenerQuery,
  runScreener,
  getSavedScreen,
  type ScreenerMetric,
  type ScreenerMetricCatalogItem,
  type ScreenerFilterGroup,
  type ScreenerStrategyDefinition,
  type ScreenerExecutionResponse,
  type ScreenerInterpretation,
  type ScreenerTemplate,
  type ScreenerPeriod,
  type ScreenerFilter,
} from '@/services/api/screener';
import { FilterGroupBuilder } from '@/components/screener/FilterGroupBuilder';
import { ScreenerResultsTable } from '@/components/screener/ScreenerResultsTable';
import { SaveStrategyModal } from '@/components/screener/SaveStrategyModal';
import { TemplatesModal } from '@/components/screener/TemplatesModal';

const EXAMPLE_QUERIES = [
  'Find NSE companies with ROE above 15%, revenue growth above 10%, and debt-to-equity below 0.5.',
  'Show companies with operating margin above 12% and net profit margin above 10%.',
  'Find companies whose ROCE is above 18% or gross margin is above 25% with current ratio above 1.5.',
  'Find companies with quick ratio above 1.0, low debt-to-equity, and positive EPS growth.',
];

function describeApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 429) {
      return 'The screener request limit was reached. Please wait and try again.';
    }
    if (error.status === 0) {
      return 'Unable to reach the EquityLensAI API. Check your connection and try again.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected screener error occurred.';
}

function ScreenerContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const savedIdParam = searchParams.get('savedId');
  const autoRunParam = searchParams.get('autoRun') === 'true';

  // Strategy & Builder State
  const [exchange, setExchange] = useState<'' | 'NSE' | 'BSE'>('');
  const [period, setPeriod] = useState<ScreenerPeriod>('annual');
  const [rootGroup, setRootGroup] = useState<ScreenerFilterGroup>({
    logic: 'AND',
    conditions: [
      {
        field: 'roe',
        operator: 'gt',
        value: 15,
      },
    ],
  });

  // Natural Language State
  const [nlQuery, setNlQuery] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<ScreenerInterpretation | null>(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [execution, setExecution] = useState<ScreenerExecutionResponse | null>(null);
  const [currentSort, setCurrentSort] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [paginationOffset, setPaginationOffset] = useState(0);

  // Catalog & Modals
  const [metricsCatalog, setMetricsCatalog] = useState<ScreenerMetricCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [loadedSavedStrategyName, setLoadedSavedStrategyName] = useState<string | null>(null);

  // Favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: listFavorites,
    enabled: isAuthenticated,
  });

  // Fetch metric catalog
  useEffect(() => {
    const controller = new AbortController();
    getScreenerMetrics(controller.signal)
      .then((data) => {
        setMetricsCatalog(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(describeApiError(err));
        }
      });
    return () => controller.abort();
  }, []);

  // Load saved screen if savedId in query param
  useEffect(() => {
    if (!savedIdParam) return;

    let isMounted = true;
    getSavedScreen(savedIdParam)
      .then((saved) => {
        if (!isMounted) return;
        const def = saved.definition;
        const validEx = def.exchange === 'NSE' || def.exchange === 'BSE' ? def.exchange : '';
        setExchange(validEx);
        setPeriod(def.period);
        setRootGroup(def.rootGroup);
        setLoadedSavedStrategyName(saved.name);
        if (def.sort && def.sort.field) {
          setCurrentSort({
            field: def.sort.field,
            direction: def.sort.direction,
          });
        }
        if (autoRunParam) {
          const s = def.sort && def.sort.field ? { field: def.sort.field, direction: def.sort.direction } : null;
          executeCurrentScreen(def.rootGroup, validEx, def.period, s, 0);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setPageError(`Failed to load saved strategy: ${describeApiError(err)}`);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIdParam, autoRunParam]);

  async function handleNlInterpret(e: React.FormEvent) {
    e.preventDefault();
    if (!nlQuery.trim()) {
      setPageError('Please enter a natural-language screening request.');
      return;
    }

    setPageError(null);
    setIsInterpreting(true);

    try {
      const result = await interpretScreenerQuery({
        query: nlQuery.trim(),
        ...(exchange ? { exchange } : {}),
        period,
      });

      setInterpretation(result);

      if (result.exchange) {
        setExchange(result.exchange);
      }
      if (result.period) {
        setPeriod(result.period);
      }

      if (result.filters.length > 0) {
        setRootGroup({
          logic: result.logic,
          conditions: result.filters.map((f: ScreenerFilter) => ({
            field: f.field as ScreenerMetric,
            operator: f.operator,
            value: f.value,
            ...(f.upperValue !== undefined && f.upperValue !== null ? { upperValue: f.upperValue } : {}),
          })),
        });
      }
    } catch (err: unknown) {
      setPageError(describeApiError(err));
      setInterpretation(null);
    } finally {
      setIsInterpreting(false);
    }
  }

  async function executeCurrentScreen(
    groupToRun: ScreenerFilterGroup = rootGroup,
    selectedExchange: '' | 'NSE' | 'BSE' = exchange,
    selectedPeriod: ScreenerPeriod = period,
    sortOverride: { field: string; direction: 'asc' | 'desc' } | null = currentSort,
    offset = paginationOffset,
  ) {
    setPageError(null);
    setIsExecuting(true);

    const definition: ScreenerStrategyDefinition = {
      schemaVersion: 1,
      rootGroup: groupToRun,
      period: selectedPeriod,
      exchange: selectedExchange || null,
      sort: {
        field: sortOverride?.field ?? null,
        direction: sortOverride?.direction ?? 'desc',
      },
    };

    try {
      const resp = await runScreener({
        definition,
        query: nlQuery.trim() || undefined,
      });
      setExecution(resp);
      setPaginationOffset(offset);
    } catch (err: unknown) {
      setPageError(describeApiError(err));
    } finally {
      setIsExecuting(false);
    }
  }

  function handleApplyTemplate(template: ScreenerTemplate) {
    const def = template.definition;
    setRootGroup(def.rootGroup);
    setPeriod(def.period);
    if (def.exchange === 'NSE' || def.exchange === 'BSE') {
      setExchange(def.exchange);
    } else {
      setExchange('');
    }
    setLoadedSavedStrategyName(template.name);
    setExecution(null);
    setInterpretation(null);
  }

  function handleReset() {
    setRootGroup({
      logic: 'AND',
      conditions: [
        {
          field: 'roe',
          operator: 'gt',
          value: 15,
        },
      ],
    });
    setExecution(null);
    setInterpretation(null);
    setNlQuery('');
    setLoadedSavedStrategyName(null);
    setPageError(null);
  }

  function handleSortChange(field: string, direction: 'asc' | 'desc') {
    const nextSort = { field, direction };
    setCurrentSort(nextSort);
    executeCurrentScreen(rootGroup, exchange, period, nextSort, 0);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <span>Research & Discovery</span>
            <span>·</span>
            <span>Quantitative Screener</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
            Advanced Stock Screener
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Build multi-condition fundamental screens using deterministic ratios, valuation multiples, and growth metrics. No simulated or fabricated numbers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsTemplatesModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Templates</span>
          </button>
          <Link
            href="/screener/saved"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span>Saved Strategies</span>
          </Link>
        </div>
      </header>

      {/* Active Strategy Badge */}
      {loadedSavedStrategyName && (
        <div className="flex items-center justify-between rounded-2xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Active strategy: <strong className="text-white">{loadedSavedStrategyName}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setLoadedSavedStrategyName(null)}
            className="text-xs text-sky-400 hover:text-white"
          >
            Clear preset
          </button>
        </div>
      )}

      {/* Natural Language Prompt Assistant */}
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl sm:p-7">
        <form onSubmit={handleNlInterpret} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label htmlFor="nl-screener-query" className="text-sm font-bold text-white flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/20 text-sky-400 text-xs">
                AI
              </span>
              <span>Ask with Natural Language</span>
            </label>
            <span className="text-[11px] text-slate-400">
              Converts natural language into reviewable, editable filter conditions
            </span>
          </div>

          <textarea
            id="nl-screener-query"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Find NSE companies with ROE above 15%, revenue growth above 10%, and debt-to-equity below 0.5"
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase mr-1">Examples:</span>
              {EXAMPLE_QUERIES.slice(0, 2).map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNlQuery(ex)}
                  className="rounded-lg border border-white/5 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-400/40 hover:text-white transition"
                >
                  {ex.length > 55 ? `${ex.slice(0, 55)}…` : ex}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isInterpreting || !nlQuery.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-500/20"
            >
              {isInterpreting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>Interpreting…</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Interpret with AI</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Interpretation Details */}
        {interpretation && (
          <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-950/20 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-200">
                Interpreted Summary: {interpretation.querySummary}
              </span>
              <span className="text-slate-400">
                Logic: {interpretation.logic} · Period: {interpretation.period}
              </span>
            </div>
            {interpretation.warnings.length > 0 && (
              <ul className="list-inside list-disc text-amber-200/90 space-y-0.5">
                {interpretation.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            )}
            {interpretation.clarificationNeeded && (
              <p className="text-amber-300 font-medium">
                Interpretation contains ambiguities. Review the visual conditions below before running.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Universe & Period Selector Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Exchange:</span>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as '' | 'NSE' | 'BSE')}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
            >
              <option value="">All Exchanges (NSE & BSE)</option>
              <option value="NSE">NSE Only</option>
              <option value="BSE">BSE Only</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as ScreenerPeriod)}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
            >
              <option value="annual">Annual Statements</option>
              <option value="ttm">Trailing 12 Months (TTM)</option>
            </select>
          </label>
        </div>

        <div className="text-xs text-slate-500">
          Missing data strictly excludes instruments · Deterministic execution
        </div>
      </section>

      {/* Errors */}
      {catalogError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">
          Catalog Error: {catalogError}
        </div>
      )}
      {pageError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">
          {pageError}
        </div>
      )}

      {/* Advanced Filter Builder */}
      <FilterGroupBuilder
        group={rootGroup}
        onChange={setRootGroup}
        metrics={metricsCatalog}
        depth={1}
      />

      {/* Screen Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-5">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-white/20 hover:text-white transition"
        >
          Reset Filters
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            disabled={rootGroup.conditions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-sky-400/40 hover:text-white disabled:opacity-40"
          >
            <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>Save Strategy</span>
          </button>

          <button
            type="button"
            onClick={() => executeCurrentScreen(rootGroup, exchange, period, currentSort, 0)}
            disabled={isExecuting || rootGroup.conditions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 shadow-lg shadow-sky-500/20"
          >
            {isExecuting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                <span>Running Screen…</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Run Screen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Table */}
      {execution && (
        <ScreenerResultsTable
          execution={execution}
          metricsCatalog={metricsCatalog}
          isExecuting={isExecuting}
          onPageChange={(newOffset) =>
            executeCurrentScreen(rootGroup, exchange, period, currentSort, newOffset)
          }
          onSortChange={handleSortChange}
          currentSort={currentSort}
          favorites={favorites}
        />
      )}

      {/* Save Strategy Modal */}
      <SaveStrategyModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        definition={{
          schemaVersion: 1,
          rootGroup,
          exchange: exchange || null,
          period,
          sort: {
            field: currentSort?.field ?? null,
            direction: currentSort?.direction ?? 'desc',
          },
        }}
        metrics={metricsCatalog}
        onSuccess={() => {
          setLoadedSavedStrategyName('Custom Strategy');
        }}
      />

      {/* Strategy Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
      />
    </main>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center p-6 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </main>
      }
    >
      <ScreenerContent />
    </Suspense>
  );
}
