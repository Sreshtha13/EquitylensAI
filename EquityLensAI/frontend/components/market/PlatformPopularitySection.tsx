'use client';

import Link from 'next/link';
import { useMostWatched, useTrendingStocks } from '@/hooks/useMarket';
import type { MostWatchedStockItem, TrendingStockItem } from '@/types';

export function PlatformPopularitySection() {
  const { data: watchedData, isLoading: isWatchedLoading } = useMostWatched({ windowDays: 7, limit: 6 });
  const { data: trendingData, isLoading: isTrendingLoading } = useTrendingStocks({ limit: 6 });

  const watchedItems = watchedData?.items ?? [];
  const trendingItems = trendingData?.items ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* 1. Most Watched on EquityLensAI */}
      <section className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
                Most Watched on EquityLensAI
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Derived from verified platform watchlists over the last 7 days
              </p>
            </div>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
              Platform Activity
            </span>
          </div>

          <div className="mt-4">
            {isWatchedLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-slate-800/40" />
                ))}
              </div>
            ) : watchedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-slate-300">No Watchlist Activity Recorded</h3>
                <p className="mt-1 text-[11px] text-slate-500 max-w-xs">
                  Be the first to add stocks to your EquityLensAI watchlists to populate collective community insights.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-800/40">
                {watchedItems.map((item: MostWatchedStockItem, idx: number) => {
                  const isPositive = (item.changePercent ?? 0) > 0;
                  const isZero = (item.changePercent ?? 0) === 0;

                  return (
                    <div
                      key={`${item.exchange}:${item.symbol}`}
                      className="flex items-center justify-between py-3 group hover:bg-slate-900/40 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-500 w-4">
                          {idx + 1}
                        </span>
                        <div>
                          <Link
                            href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                            className="font-bold text-sm text-white group-hover:text-sky-400 transition-colors flex items-center gap-1.5"
                          >
                            {item.symbol}
                            <span className="text-[10px] font-mono text-slate-400 px-1 rounded bg-slate-800">
                              {item.exchange}
                            </span>
                          </Link>
                          <span className="text-[11px] text-slate-400 truncate max-w-[150px] block">
                            {item.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          {item.price !== null ? (
                            <div className="text-xs font-bold font-mono text-white">
                              ₹{item.price.toFixed(2)}
                            </div>
                          ) : null}
                          {item.changePercent !== null ? (
                            <div
                              className={`text-[11px] font-mono font-medium ${
                                isPositive ? 'text-emerald-400' : isZero ? 'text-slate-400' : 'text-rose-400'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {item.changePercent.toFixed(2)}%
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-xs font-mono font-semibold text-indigo-300">
                            {item.watchlistCount}
                            <span className="text-[10px] text-indigo-400">watchers</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>* Metrics reflect user watchlist saves, not trading execution volume.</span>
          <Link href="/watchlists" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Manage your watchlists →
          </Link>
        </div>
      </section>

      {/* 2. Trending Stocks */}
      <section className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400" />
                Trending Equities
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Multi-factor score: volume expansion, momentum, and platform research interest
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              Window: 24 Hours
            </span>
          </div>

          <div className="mt-4">
            {isTrendingLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-slate-800/40" />
                ))}
              </div>
            ) : trendingItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No trending signals calculated at this moment.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-800/40">
                {trendingItems.map((item: TrendingStockItem) => {
                  const isPositive = item.changePercent > 0;
                  const isZero = item.changePercent === 0;

                  return (
                    <div
                      key={`${item.exchange}:${item.symbol}`}
                      className="flex flex-col gap-1.5 py-3 group hover:bg-slate-900/40 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                            className="font-bold text-sm text-white group-hover:text-sky-400 transition-colors flex items-center gap-1.5"
                          >
                            {item.symbol}
                            <span className="text-[10px] font-mono text-slate-400 px-1 rounded bg-slate-800">
                              {item.exchange}
                            </span>
                          </Link>
                          <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-white">
                              ₹{item.price.toFixed(2)}
                            </span>
                            <span
                              className={`ml-1.5 text-xs font-mono font-semibold ${
                                isPositive ? 'text-emerald-400' : isZero ? 'text-slate-400' : 'text-rose-400'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {(item.changePercent ?? 0).toFixed(2)}%
                            </span>
                          </div>

                          <div className="inline-flex items-center rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                            {item.trendingScore}
                            <span className="text-[9px] text-amber-500 ml-0.5">pts</span>
                          </div>
                        </div>
                      </div>

                      {/* Transparent Reasons */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {item.reasons?.map((reason: string, rIdx: number) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/80 border border-slate-700/60 rounded px-2 py-0.5"
                          >
                            <span className="h-1 w-1 rounded-full bg-sky-400" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>* Transparent scoring isolates market price actions from user research intensity.</span>
        </div>
      </section>
    </div>
  );
}
