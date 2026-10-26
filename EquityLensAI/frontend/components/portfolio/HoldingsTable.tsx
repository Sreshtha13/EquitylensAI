'use client';

import Link from 'next/link';
import type { PortfolioHolding } from '@equitylensai/shared';

type HoldingsTableProps = {
  holdings: PortfolioHolding[];
  baseCurrency?: string | undefined;
  onTradeStock?: ((holding: PortfolioHolding) => void) | undefined;
  isLoading?: boolean | undefined;
};

export function HoldingsTable({
  holdings,
  baseCurrency = 'INR',
  onTradeStock,
  isLoading,
}: HoldingsTableProps) {
  const curr = baseCurrency === 'USD' ? '$' : '₹';

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
        <div className="h-6 w-36 animate-pulse rounded bg-slate-800" />
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center backdrop-blur-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-white">No Holdings in this Portfolio</h3>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">
          Record a BUY transaction or import your historical transactions to start tracking
          performance and asset allocation.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Current Holdings ({holdings.length})
          </h2>
          <p className="text-xs text-slate-400">
            Real-time market valuation derived from authoritative transaction ledger
          </p>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/5 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Asset</th>
              <th className="px-4 py-3.5 text-right">Shares</th>
              <th className="px-4 py-3.5 text-right">Avg Cost</th>
              <th className="px-4 py-3.5 text-right">Live Price</th>
              <th className="px-4 py-3.5 text-right">Market Value</th>
              <th className="px-4 py-3.5 text-right">Unrealized P&L</th>
              <th className="px-4 py-3.5 text-right">Allocation</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {holdings.map((h) => {
              const isPositive = (h.unrealizedPnL ?? 0) >= 0;
              const hasPrice = h.currentPrice !== null;

              return (
                <tr
                  key={`${h.symbol}-${h.exchange}`}
                  className="hover:bg-white/[0.02] transition"
                >
                  {/* Asset Symbol & Name */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/stocks/${h.exchange}/${h.symbol}`}
                          className="font-bold text-white hover:text-sky-400 transition"
                        >
                          {h.symbol}
                        </Link>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                          {h.exchange}
                        </span>
                        {h.assetType === 'etf' && (
                          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                            ETF
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {h.name}
                      </span>
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-4 text-right font-medium text-slate-200">
                    {h.quantity.toLocaleString('en-IN', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 4,
                    })}
                  </td>

                  {/* Avg Cost */}
                  <td className="px-4 py-4 text-right text-slate-300">
                    {curr}
                    {h.averageBuyPrice.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* Live Price */}
                  <td className="px-4 py-4 text-right">
                    {hasPrice ? (
                      <span className="font-semibold text-white">
                        {curr}
                        {h.currentPrice!.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Unpriced</span>
                    )}
                  </td>

                  {/* Market Value */}
                  <td className="px-4 py-4 text-right">
                    {h.marketValue !== null ? (
                      <span className="font-bold text-white">
                        {curr}
                        {h.marketValue.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Unrealized P&L */}
                  <td className="px-4 py-4 text-right">
                    {h.unrealizedPnL !== null ? (
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-semibold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {curr}
                          {h.unrealizedPnL.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span
                          className={`text-[10px] ${
                            isPositive ? 'text-emerald-400/80' : 'text-rose-400/80'
                          }`}
                        >
                          {isPositive ? '▲ +' : '▼ '}
                          {h.unrealizedPnLPercent?.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Allocation % */}
                  <td className="px-4 py-4 text-right font-medium text-slate-300">
                    {h.allocationPercent !== null ? `${h.allocationPercent.toFixed(1)}%` : '—'}
                  </td>

                  {/* Quote Freshness Badge */}
                  <td className="px-4 py-4 text-center">
                    {h.quoteFreshness === 'live' ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                        Live
                      </span>
                    ) : h.quoteFreshness === 'delayed' ? (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-400 border border-sky-500/20">
                        Delayed
                      </span>
                    ) : h.isStale ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                        Stale
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-medium text-slate-400">
                        N/A
                      </span>
                    )}
                  </td>

                  {/* Quick Action */}
                  <td className="px-6 py-4 text-right">
                    {onTradeStock && (
                      <button
                        onClick={() => onTradeStock(h)}
                        className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                      >
                        Trade
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
