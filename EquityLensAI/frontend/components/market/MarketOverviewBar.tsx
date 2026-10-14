'use client';

import { useState } from 'react';
import { useMarketOverview, useMarketProviders } from '@/hooks/useMarket';
import type { Market } from '@/types';

export function MarketOverviewBar() {
  const [selectedMarket, setSelectedMarket] = useState<Market>('nse');
  const { data: overview, isLoading, error } = useMarketOverview(selectedMarket);
  const { data: providersData } = useMarketProviders();

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl backdrop-blur-md">
      {/* Top Header & Market Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-3 w-3 items-center justify-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Market Intelligence
          </h2>

          {/* Active provider chips */}
          <div className="hidden sm:flex items-center gap-1.5 pl-2 text-xs text-slate-400">
            {providersData?.providers?.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  p.configured
                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${p.configured ? 'bg-emerald-400' : 'bg-slate-500'}`}
                />
                {p.id === 'angel' ? 'Angel One' : 'Yahoo'}
              </span>
            ))}
          </div>
        </div>

        {/* Market Selector Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950/60 p-1 border border-white/5">
          <button
            onClick={() => setSelectedMarket('nse')}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              selectedMarket === 'nse'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            NSE India
          </button>
          <button
            onClick={() => setSelectedMarket('us')}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              selectedMarket === 'us'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            US Markets
          </button>
        </div>
      </div>

      {/* Index Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-white/5 bg-slate-800/40 p-4"
              />
            ))}
          </>
        )}

        {error && (
          <div className="col-span-full rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
            Failed to load market indices: {error.message}
          </div>
        )}

        {overview?.indices?.map((index) => {
          const isPositive = index.change >= 0;
          return (
            <div
              key={index.symbol}
              className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/40 p-4 transition duration-200 hover:border-sky-500/30 hover:bg-slate-950/70"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400">{index.name}</span>
                  <div className="mt-1 text-xl font-bold tracking-tight text-white">
                    {index.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                    isPositive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <span>{isPositive ? '▲' : '▼'}</span>
                  <span>{Math.abs(index.change).toFixed(2)}</span>
                  <span className="opacity-80">({Math.abs(index.changePercent).toFixed(2)}%)</span>
                </div>
              </div>

              {/* Provenance badge */}
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5 pt-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      overview.freshness === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="capitalize">{overview.source}</span>
                  <span className="text-slate-600">•</span>
                  <span className="capitalize">{overview.freshness}</span>
                </span>
                <span title={`Retrieved: ${overview.retrievedAt}`}>
                  {new Date(overview.retrievedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
