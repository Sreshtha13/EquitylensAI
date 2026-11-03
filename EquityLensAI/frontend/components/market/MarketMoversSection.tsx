'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTopGainers, useTopLosers, useVolumeShockers } from '@/hooks/useMarket';
import type { StockMoverItem, VolumeShockerItem } from '@/types';

type MoverTab = 'gainers' | 'losers' | 'volume-shockers';

export function MarketMoversSection() {
  const [activeTab, setActiveTab] = useState<MoverTab>('gainers');
  const [limit, setLimit] = useState<number>(10);
  const [exchangeFilter, setExchangeFilter] = useState<string>('ALL');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [comparisonDays, setComparisonDays] = useState<5 | 10 | 20>(10);

  const gainersQuery = useTopGainers({
    exchange: exchangeFilter,
    classification: classificationFilter !== 'ALL' ? classificationFilter : undefined,
    limit,
  });

  const losersQuery = useTopLosers({
    exchange: exchangeFilter,
    classification: classificationFilter !== 'ALL' ? classificationFilter : undefined,
    limit,
  });

  const shockersQuery = useVolumeShockers({
    days: comparisonDays,
    exchange: exchangeFilter !== 'ALL' ? exchangeFilter : undefined,
    limit,
  });

  const isLoading =
    activeTab === 'gainers'
      ? gainersQuery.isLoading
      : activeTab === 'losers'
      ? losersQuery.isLoading
      : shockersQuery.isLoading;

  const items =
    activeTab === 'gainers'
      ? (gainersQuery.data?.items ?? [])
      : activeTab === 'losers'
      ? (losersQuery.data?.items ?? [])
      : (shockersQuery.data?.items ?? []);

  return (
    <section className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
      {/* Top Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800/60">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Market Movers & Velocity
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Real-time percentage leaders, laggards, and historical volume anomalies
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('gainers')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'gainers'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Top Gainers
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'losers'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Top Losers
          </button>
          <button
            onClick={() => setActiveTab('volume-shockers')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'volume-shockers'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Volume Shockers
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Exchange Filter */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            {['ALL', 'NSE', 'BSE'].map((ex) => (
              <button
                key={ex}
                onClick={() => setExchangeFilter(ex)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  exchangeFilter === ex
                    ? 'bg-slate-800 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ex === 'ALL' ? 'All Exchanges' : ex}
              </button>
            ))}
          </div>

          {/* Classification Filter (for Gainers/Losers) */}
          {activeTab !== 'volume-shockers' && (
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              {[
                { id: 'ALL', label: 'All Segments' },
                { id: 'MAINBOARD_EQUITY', label: 'Mainboard' },
                { id: 'SME_EQUITY', label: 'SME' },
              ].map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => setClassificationFilter(seg.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    classificationFilter === seg.id
                      ? 'bg-slate-800 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          )}

          {/* Volume Shocker Benchmark Days Selector */}
          {activeTab === 'volume-shockers' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-medium">Baseline:</span>
              <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                {[5, 10, 20].map((d) => (
                  <button
                    key={d}
                    onClick={() => setComparisonDays(d as 5 | 10 | 20)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      comparisonDays === d
                        ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d}D Avg
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Limit Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Show:</span>
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            {[5, 10, 20].map((l) => (
              <button
                key={l}
                onClick={() => setLimit(l)}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  limit === l ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Top {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Company & Symbol</th>
              <th className="py-3 px-3">Exchange</th>
              <th className="py-3 px-4 text-right">Last Price</th>
              <th className="py-3 px-4 text-right">Change</th>
              <th className="py-3 px-4 text-right">% Change</th>
              {activeTab === 'volume-shockers' ? (
                <>
                  <th className="py-3 px-4 text-right">Current Vol</th>
                  <th className="py-3 px-4 text-right">{comparisonDays}D Avg Vol</th>
                  <th className="py-3 px-4 text-right">Volume Multiple</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4 text-right">Session Volume</th>
                  <th className="py-3 px-4 text-right">Traded Turnover</th>
                </>
              )}
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={8} className="py-4 px-4">
                    <div className="h-4 rounded bg-slate-800/50 w-full" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No securities matched the selected filters.</p>
                  <p className="mt-1 text-xs text-slate-500">Try broadening your exchange or segment filter.</p>
                </td>
              </tr>
            ) : (
              items.map((item: StockMoverItem | VolumeShockerItem) => {
                const isPositive = item.changePercent > 0;
                const isZero = item.changePercent === 0;
                const shocker = activeTab === 'volume-shockers' ? (item as VolumeShockerItem) : null;
                const turnoverCr = item.turnover ? (item.turnover / 10000000).toFixed(2) : '-';

                return (
                  <tr
                    key={`${item.exchange}:${item.symbol}`}
                    className="group hover:bg-slate-900/60 transition-colors"
                  >
                    {/* Symbol & Name */}
                    <td className="py-3 px-4">
                      <Link
                        href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                        className="flex flex-col hover:text-sky-300"
                      >
                        <span className="font-bold text-white group-hover:text-sky-400 transition-colors">
                          {item.symbol}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {item.name}
                        </span>
                      </Link>
                    </td>

                    {/* Exchange & Segment */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
                          {item.exchange}
                        </span>
                        {item.classification === 'SME_EQUITY' && (
                          <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                            SME
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                      ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Absolute Change */}
                    <td
                      className={`py-3 px-4 text-right font-mono font-medium ${
                        isPositive ? 'text-emerald-400' : isZero ? 'text-slate-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {item.change.toFixed(2)}
                    </td>

                    {/* % Change */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block font-mono font-semibold px-2 py-0.5 rounded text-xs ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isZero
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {(item.changePercent ?? 0).toFixed(2)}%
                      </span>
                    </td>

                    {/* Volume Shockers Specific columns */}
                    {shocker ? (
                      <>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {(shocker.volume ?? shocker.currentVolume ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {shocker.historicalAvgVolume?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              shocker.volumeRatio >= 2
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {shocker.volumeRatio?.toFixed(2)}x
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {item.volume?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          ₹{turnoverCr} Cr
                        </td>
                      </>
                    )}

                    {/* Action link */}
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-sky-600/30 hover:text-sky-300 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all"
                      >
                        Research
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
