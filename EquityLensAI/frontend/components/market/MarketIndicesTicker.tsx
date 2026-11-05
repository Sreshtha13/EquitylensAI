'use client';

import { useMarketIndices } from '@/hooks/useMarket';
import type { IndexSnapshot } from '@/types';

export function MarketIndicesTicker() {
  const { data, isLoading, isError, refetch } = useMarketIndices();

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800/50 p-3" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data?.indices?.length) {
    return (
      <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center">
        <p className="text-sm text-slate-400">Unable to retrieve live market indices at this moment.</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-xs font-medium text-sky-400 hover:text-sky-300 underline"
        >
          Retry connection
        </button>
      </div>
    );
  }

  const indices = data.indices;
  const firstStatus = indices[0]?.marketStatus || 'CLOSED';
  const statusColor =
    firstStatus === 'OPEN'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : firstStatus === 'PRE_MARKET' || firstStatus === 'POST_MARKET'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-slate-700/30 text-slate-400 border-slate-700/50';

  return (
    <section className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-xl transition-all">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Major Market Indices
              <span className="text-xs font-normal text-slate-400">NSE & BSE Benchmarks</span>
            </h2>
          </div>
        </div>

        {/* Market Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${firstStatus === 'OPEN' ? 'bg-emerald-400 animate-pulse' : firstStatus === 'CLOSED' ? 'bg-slate-400' : 'bg-amber-400'}`} />
            <span>Market {firstStatus.replace('_', ' ')}</span>
          </div>
          <span className="text-xs text-slate-500">Live verified quotes</span>
        </div>
      </div>

      {/* Index Cards Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {indices.map((idx: IndexSnapshot) => {
          const isPositive = idx.change >= 0;
          const isZero = idx.change === 0;
          const displayValue = (idx.currentValue ?? idx.value)?.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          });

          return (
            <div
              key={idx.symbol}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900/60"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300 truncate max-w-[100px]">{idx.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {idx.exchange || (idx.symbol === 'SENSEX' ? 'BSE' : 'NSE')}
                  </span>
                </div>
                <div className="mt-2 text-base font-bold font-mono text-white tracking-tight">
                  {displayValue}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs font-medium">
                <span className={`flex items-center font-mono ${isPositive ? 'text-emerald-400' : isZero ? 'text-slate-400' : 'text-rose-400'}`}>
                  {isPositive && !isZero ? '+' : ''}
                  {idx.change.toFixed(2)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold ${
                    isPositive && !isZero
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isZero
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {isPositive && !isZero ? '+' : ''}
                  {(idx.changePercent ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
