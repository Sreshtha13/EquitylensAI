'use client';

import Link from 'next/link';
import { useSectorPerformance } from '@/hooks/useMarket';
import type { SectorPerformanceItem } from '@/types';

export function SectorPerformanceGrid() {
  const { data, isLoading, isError } = useSectorPerformance();
  const sectors = data?.sectors ?? [];

  return (
    <section className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-2 pb-5 border-b border-slate-800/60">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          Sector & Industry Performance
        </h2>
        <p className="text-xs text-slate-400">
          Constituent aggregations, advance/decline ratios, and top movers across major economic sectors
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800/40 animate-pulse" />
          ))
        ) : isError || sectors.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-400 text-xs">
            Sector performance data currently refreshing.
          </div>
        ) : (
          sectors.map((sec: SectorPerformanceItem) => {
            const isPositive = sec.performancePercent > 0;
            const isZero = sec.performancePercent === 0;

            return (
              <div
                key={sec.sector}
                className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{sec.sector}</span>
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isZero
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {(sec.performancePercent ?? sec.averageChangePercent ?? 0).toFixed(2)}%
                    </span>
                  </div>

                  {/* Advance / Decline for sector */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                      ▲ {sec.advances} Adv
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {sec.totalConstituents} constituents
                    </span>
                    <span className="flex items-center gap-1 text-rose-400 font-mono text-[11px]">
                      ▼ {sec.declines} Dec
                    </span>
                  </div>
                </div>

                {/* Top constituents */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col gap-1.5 text-[11px]">
                  {sec.topGainer && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Leader:</span>
                      <Link
                        href={`/stocks/NSE/${encodeURIComponent(sec.topGainer.symbol)}`}
                        className="font-mono font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        {sec.topGainer.symbol}
                        <span className="text-[10px]">
                          (+{(sec.topGainer.changePercent ?? 0).toFixed(2)}%)
                        </span>
                      </Link>
                    </div>
                  )}

                  {sec.topLoser && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Laggard:</span>
                      <Link
                        href={`/stocks/NSE/${encodeURIComponent(sec.topLoser.symbol)}`}
                        className="font-mono font-semibold text-rose-400 hover:underline flex items-center gap-1"
                      >
                        {sec.topLoser.symbol}
                        <span className="text-[10px]">
                          ({(sec.topLoser.changePercent ?? 0).toFixed(2)}%)
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
