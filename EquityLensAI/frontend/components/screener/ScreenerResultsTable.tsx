'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { SupportedExchange } from '@equitylensai/shared';
import { addFavorite, removeFavorite } from '@/services/api/favorites';
import { useAuth } from '@/hooks/useAuth';
import {
  exportScreenerResultsCsv,
  type ScreenerExecutionResponse,
  type ScreenerMetricCatalogItem,
} from '@/services/api/screener';
import { AddToWatchlistModal } from './AddToWatchlistModal';

interface ScreenerResultsTableProps {
  execution: ScreenerExecutionResponse;
  metricsCatalog: ScreenerMetricCatalogItem[];
  isExecuting: boolean;
  onPageChange: (newOffset: number) => void;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  currentSort?: { field: string; direction: 'asc' | 'desc' } | null;
  favorites: Array<{ symbol: string; exchange: string }>;
}

export function ScreenerResultsTable({
  execution,
  metricsCatalog,
  isExecuting,
  onPageChange,
  onSortChange,
  currentSort,
  favorites,
}: ScreenerResultsTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [watchlistTargetStock, setWatchlistTargetStock] = useState<{
    symbol: string;
    exchange: string;
    companyName?: string;
  } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const metricsMap = new Map<string, ScreenerMetricCatalogItem>(
    metricsCatalog.map((m) => [m.id, m]),
  );

  const isFav = (symbol: string, ex: string) =>
    favorites.some((f) => f.symbol === symbol && f.exchange === ex);

  async function handleToggleFavorite(symbol: string, ex: string) {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const targetEx = (ex || 'NSE') as SupportedExchange;
    try {
      if (isFav(symbol, ex)) {
        await removeFavorite(symbol, targetEx);
      } else {
        await addFavorite(symbol, targetEx);
      }
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch {
      // ignore
    }
  }

  function handleExportCsv() {
    exportScreenerResultsCsv(
      execution.results,
      metricsCatalog,
      `screener-results-${Date.now()}.csv`,
    );
  }

  function handleHeaderSort(fieldId: string) {
    if (!onSortChange) return;
    if (currentSort?.field === fieldId) {
      onSortChange(fieldId, currentSort.direction === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(fieldId, 'desc');
    }
  }

  // Derive unique metric IDs evaluated in results
  const evaluatedMetricIds = Array.from(
    new Set(execution.results.flatMap((r) => Object.keys(r.metrics))),
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl sm:p-7 space-y-6">
      {/* Header & Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white">Screening Results</h2>
            <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-0.5 text-xs font-bold text-sky-300">
              {execution.totalMatches.toLocaleString()} matches
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Evaluated against {execution.coverage.indexedCompanies.toLocaleString()} of{' '}
            {execution.coverage.expectedCompanies.toLocaleString()} indexed companies in the database universe.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={execution.results.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Coverage & Freshness Banner */}
      {execution.coverage.isPartial && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200 leading-relaxed">
          <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-bold">Partial Financial Coverage Notice</p>
            <p className="mt-0.5 text-amber-200/80">
              Some instruments in the index do not have current persisted financial statements. Companies with missing metric observations are excluded to ensure deterministic correctness.
            </p>
          </div>
        </div>
      )}

      {/* Execution Warnings */}
      {execution.warnings.length > 0 && (
        <ul className="list-inside list-disc space-y-1 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-200/90">
          {execution.warnings.map((w, idx) => (
            <li key={idx}>{w}</li>
          ))}
        </ul>
      )}

      {/* Toast Notification */}
      {successToast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      {execution.results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
          <svg className="h-12 w-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-base font-semibold text-slate-200">No qualifying companies found</p>
          <p className="mt-1 text-xs max-w-md text-slate-500">
            No active companies matched all required conditions in this universe. Missing data is never treated as zero or a match.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/60">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3.5 font-semibold">Company / Symbol</th>
                <th className="px-3 py-3.5 font-semibold">Exch</th>
                <th className="px-3 py-3.5 font-semibold">Period</th>
                {evaluatedMetricIds.map((mId) => {
                  const meta = metricsMap.get(mId);
                  const isSorted = currentSort?.field === mId;
                  return (
                    <th
                      key={mId}
                      className="px-3 py-3.5 font-semibold cursor-pointer select-none hover:text-white transition"
                      onClick={() => handleHeaderSort(mId)}
                      title={meta?.description || mId}
                    >
                      <div className="flex items-center gap-1">
                        <span>{meta?.label || mId}</span>
                        {isSorted && (
                          <span className="text-sky-400">
                            {currentSort?.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-3.5 font-semibold">Data Freshness</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {execution.results.map((result) => {
                const favActive = isFav(result.symbol, result.exchange);
                return (
                  <tr
                    key={`${result.exchange}:${result.symbol}`}
                    className="hover:bg-white/[0.02] transition"
                  >
                    {/* Company */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(result.symbol, result.exchange)}
                          title={favActive ? 'Remove from favorites' : 'Add to favorites'}
                          className="text-slate-600 hover:text-amber-400 transition"
                        >
                          <svg
                            className={`h-4 w-4 ${
                              favActive
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-600 hover:text-slate-400'
                            }`}
                            viewBox="0 0 20 20"
                            fill={favActive ? 'currentColor' : 'none'}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                            />
                          </svg>
                        </button>
                        <div>
                          <Link
                            href={`/stocks/${encodeURIComponent(result.exchange)}/${encodeURIComponent(result.symbol)}`}
                            className="font-bold text-white hover:text-sky-300 transition"
                          >
                            {result.companyName}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <span className="font-mono text-slate-300">{result.symbol}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Exchange */}
                    <td className="px-3 py-3.5">
                      <span className="rounded-md border border-white/10 bg-slate-950 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                        {result.exchange}
                      </span>
                    </td>

                    {/* Period */}
                    <td className="px-3 py-3.5 text-xs text-slate-400">
                      {result.period} · {result.periodType.toUpperCase()}
                    </td>

                    {/* Dynamic Metric Columns */}
                    {evaluatedMetricIds.map((mId) => {
                      const obs = result.metrics[mId];
                      let display = '—';
                      let colorClass = 'text-slate-400';

                      if (obs && obs.value !== null && obs.value !== undefined) {
                        colorClass = 'text-white font-medium';
                        if (obs.unit === 'percent') {
                          display = `${obs.value.toFixed(2)}%`;
                        } else if (obs.unit === 'ratio') {
                          display = `${obs.value.toFixed(2)}x`;
                        } else if (obs.unit === 'score') {
                          display = `${obs.value}/100`;
                        } else {
                          display = obs.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                        }
                      }

                      return (
                        <td
                          key={mId}
                          className={`px-3 py-3.5 tabular-nums text-xs ${colorClass}`}
                          title={obs?.formula}
                        >
                          {display}
                        </td>
                      );
                    })}

                    {/* Freshness */}
                    <td className="px-3 py-3.5 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          result.isStale
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${result.isStale ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        {result.isStale ? 'Stale' : 'Current'}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        {new Date(result.retrievedAt).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setWatchlistTargetStock({
                              symbol: result.symbol,
                              exchange: result.exchange,
                              companyName: result.companyName,
                            })
                          }
                          className="rounded-lg border border-white/10 bg-slate-900 p-1.5 text-slate-400 hover:border-sky-400/40 hover:text-sky-300 transition"
                          title="Add to Watchlist"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <Link
                          href={`/stocks/${encodeURIComponent(result.exchange)}/${encodeURIComponent(result.symbol)}`}
                          className="rounded-lg border border-white/10 bg-slate-900 p-1.5 text-slate-400 hover:border-white/30 hover:text-white transition"
                          title="View Stock Details"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
        <div>
          Showing {execution.results.length ? execution.pagination.offset + 1 : 0}–
          {execution.pagination.offset + execution.results.length} of {execution.totalMatches} matches
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onPageChange(Math.max(0, execution.pagination.offset - execution.pagination.limit))
            }
            disabled={isExecuting || execution.pagination.offset === 0}
            className="rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(execution.pagination.offset + execution.pagination.limit)}
            disabled={
              isExecuting ||
              execution.pagination.offset + execution.results.length >= execution.totalMatches
            }
            className="rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Watchlist Modal */}
      {watchlistTargetStock && (
        <AddToWatchlistModal
          isOpen={true}
          onClose={() => setWatchlistTargetStock(null)}
          stock={watchlistTargetStock}
          onSuccess={(wlName) => {
            setSuccessToast(
              `Added ${watchlistTargetStock.symbol} to "${wlName}" successfully.`,
            );
          }}
        />
      )}
    </section>
  );
}
