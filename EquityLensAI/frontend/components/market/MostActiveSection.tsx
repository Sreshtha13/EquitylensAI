'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMostActive } from '@/hooks/useMarket';
import type { StockMoverItem } from '@/types';

export function MostActiveSection() {
  const [activeBy, setActiveBy] = useState<'volume' | 'turnover'>('turnover');
  const [exchange, setExchange] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isError } = useMostActive({
    by: activeBy,
    exchange: exchange !== 'ALL' ? exchange : undefined,
    limit,
  });

  const items = data?.items ?? [];

  return (
    <section className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800/60">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Most Active Securities
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Highest liquidity equities ranked by traded volume quantity and aggregate turnover
          </p>
        </div>

        {/* Subtabs for Volume vs Turnover */}
        <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveBy('turnover')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeBy === 'turnover'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Turnover (Value)
          </button>
          <button
            onClick={() => setActiveBy('volume')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeBy === 'volume'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Volume (Shares)
          </button>
        </div>
      </div>

      {/* Filter and limits */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Exchange:</span>
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            {['ALL', 'NSE', 'BSE'].map((ex) => (
              <button
                key={ex}
                onClick={() => setExchange(ex)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  exchange === ex ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ex === 'ALL' ? 'All' : ex}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
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

      {/* Grid or Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-3">Exchange</th>
              <th className="py-3 px-4 text-right">Last Price</th>
              <th className="py-3 px-4 text-right">% Change</th>
              <th className="py-3 px-4 text-right">
                {activeBy === 'volume' ? 'Total Shares Traded' : 'Turnover (₹ Cr)'}
              </th>
              <th className="py-3 px-4 text-right">
                {activeBy === 'volume' ? 'Turnover (₹ Cr)' : 'Total Shares Traded'}
              </th>
              <th className="py-3 px-4 text-center">Research</th>
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
            ) : items.length === 0 || isError ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No activity data available for the selected filters.
                </td>
              </tr>
            ) : (
              items.map((item: StockMoverItem, idx: number) => {
                const isPositive = item.changePercent > 0;
                const isZero = item.changePercent === 0;
                const turnoverCr = item.turnover ? (item.turnover / 10000000).toFixed(2) : '-';

                return (
                  <tr
                    key={`${item.exchange}:${item.symbol}`}
                    className="group hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{idx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <Link
                        href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                        className="flex flex-col group-hover:text-sky-300"
                      >
                        <span className="font-bold text-white group-hover:text-sky-400 transition-colors">
                          {item.symbol}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {item.name}
                        </span>
                      </Link>
                    </td>

                    <td className="py-3 px-3">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
                        {item.exchange}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                      ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

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

                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {activeBy === 'volume'
                        ? item.volume?.toLocaleString('en-IN')
                        : `₹${turnoverCr} Cr`}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {activeBy === 'volume'
                        ? `₹${turnoverCr} Cr`
                        : item.volume?.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-sky-600/30 hover:text-sky-300 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all"
                      >
                        Details →
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
