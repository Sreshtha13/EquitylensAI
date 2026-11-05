'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useHighsLows, useCircuitStocks, useNewListings } from '@/hooks/useMarket';
import type { StockMoverItem, CircuitStockItem, NewListingItem } from '@/types';

type DiscoveryTab = 'highs-lows' | 'circuits' | 'new-listings';

export function MarketDiscoveryTabs() {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('highs-lows');
  const [circuitType, setCircuitType] = useState<'UPPER' | 'LOWER'>('UPPER');
  const [highLowType, setHighLowType] = useState<'highs' | 'lows'>('highs');

  const { data: highsLowsData, isLoading: isHighsLowsLoading } = useHighsLows({
    type: 'all',
    limit: 10,
  });

  const { data: circuitsData, isLoading: isCircuitsLoading } = useCircuitStocks({
    type: circuitType,
    limit: 10,
  });

  const { data: newListingsData, isLoading: isNewListingsLoading } = useNewListings({
    limit: 10,
  });

  return (
    <section className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800/60">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Market Discovery & Anomalies
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            52-week breakout levels, circuit breaker limit locks, and recently admitted market listings
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('highs-lows')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'highs-lows'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            52-Week Highs / Lows
          </button>
          <button
            onClick={() => setActiveTab('circuits')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'circuits'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Circuit Limits
          </button>
          <button
            onClick={() => setActiveTab('new-listings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'new-listings'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Listings
          </button>
        </div>
      </div>

      {/* Tab 1: 52-Week Highs and Lows */}
      {activeTab === 'highs-lows' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setHighLowType('highs')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                highLowType === 'highs'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              ▲ 52-Week Highs (Breakouts)
            </button>
            <button
              onClick={() => setHighLowType('lows')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                highLowType === 'lows'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              ▼ 52-Week Lows (Downtrends)
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-3">Exchange</th>
                  <th className="py-3 px-4 text-right">Current Price</th>
                  <th className="py-3 px-4 text-right">% Change</th>
                  <th className="py-3 px-4 text-right">
                    {highLowType === 'highs' ? '52-Week High' : '52-Week Low'}
                  </th>
                  <th className="py-3 px-4 text-right">Volume</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isHighsLowsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-4 rounded bg-slate-800/50 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  (highLowType === 'highs'
                    ? (highsLowsData?.highs ?? [])
                    : (highsLowsData?.lows ?? [])
                  ).map((item: StockMoverItem) => (
                    <tr key={`${item.exchange}:${item.symbol}`} className="hover:bg-slate-900/60">
                      <td className="py-3 px-4 font-bold text-white">
                        <Link
                          href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                          className="hover:text-sky-300"
                        >
                          {item.symbol}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {item.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          {item.exchange}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-semibold ${
                          item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.changePercent >= 0 ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        ₹{highLowType === 'highs' ? (item.high52w?.toFixed(2) ?? '-') : (item.low52w?.toFixed(2) ?? '-')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {item.volume.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                          className="text-xs text-sky-400 hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Circuit Breakers */}
      {activeTab === 'circuits' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setCircuitType('UPPER')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                circuitType === 'UPPER'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Upper Circuit (+5% / +10% / +20%)
            </button>
            <button
              onClick={() => setCircuitType('LOWER')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                circuitType === 'LOWER'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Lower Circuit (-5% / -10% / -20%)
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-3">Exchange</th>
                  <th className="py-3 px-4 text-right">Lock Price</th>
                  <th className="py-3 px-4 text-right">Session Change</th>
                  <th className="py-3 px-4 text-right">Volume Traded</th>
                  <th className="py-3 px-4 text-center">Circuit Limit</th>
                  <th className="py-3 px-4 text-center">Research</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isCircuitsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-4 rounded bg-slate-800/50 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (circuitsData?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No stocks currently locked at {circuitType.toLowerCase()} circuit band limits in the active sample.
                    </td>
                  </tr>
                ) : (
                  circuitsData?.items?.map((item: CircuitStockItem) => (
                    <tr key={`${item.exchange}:${item.symbol}`} className="hover:bg-slate-900/60">
                      <td className="py-3 px-4 font-bold text-white">
                        <Link
                          href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                          className="hover:text-sky-300"
                        >
                          {item.symbol}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {item.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          {item.exchange}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-semibold ${
                          item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.changePercent >= 0 ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {item.volume.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                            circuitType === 'UPPER'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {circuitType === 'UPPER' ? 'UPPER' : 'LOWER'} {item.limitPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                          className="text-xs text-sky-400 hover:underline"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: New Listings */}
      {activeTab === 'new-listings' && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-3">Exchange</th>
                  <th className="py-3 px-4">Admission Date</th>
                  <th className="py-3 px-4">Discovered At</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isNewListingsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-4 px-4">
                        <div className="h-4 rounded bg-slate-800/50 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (newListingsData?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No newly admitted IPO listings discovered in the last ingestion cycle.
                    </td>
                  </tr>
                ) : (
                  newListingsData?.items?.map((item: NewListingItem) => (
                    <tr key={`${item.exchange}:${item.symbol}`} className="hover:bg-slate-900/60">
                      <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">{item.symbol}</td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          {item.exchange}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.listingDate || 'Recent'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(item.firstDiscoveredAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                          className="text-xs text-sky-400 hover:underline"
                        >
                          Research Company →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
