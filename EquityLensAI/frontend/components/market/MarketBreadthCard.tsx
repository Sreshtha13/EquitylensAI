'use client';

import { useMarketBreadth } from '@/hooks/useMarket';

export function MarketBreadthCard() {
  const { data: breadth, isLoading, isError } = useMarketBreadth();

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl animate-pulse">
        <div className="h-5 w-48 rounded bg-slate-800 mb-4" />
        <div className="h-6 w-full rounded bg-slate-800/60 mb-6" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !breadth) {
    return null;
  }

  const advances = breadth.advances;
  const declines = breadth.declines;
  const unchanged = breadth.unchanged;
  const total = advances + declines + unchanged || 1;

  const advancePct = Math.round((advances / total) * 100);
  const declinePct = Math.round((declines / total) * 100);
  const unchangedPct = 100 - advancePct - declinePct;

  const adRatio = declines > 0 ? (advances / declines).toFixed(2) : advances > 0 ? `${advances}.0` : '1.0';

  return (
    <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
      {/* Title & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/60">
        <div>
          <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Market Breadth & Momentum
            <span className="text-xs font-mono font-medium text-slate-400">
              A/D Ratio: <strong className="text-emerald-400">{adRatio}</strong>
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Intraday participation across verified benchmark constituents
          </p>
        </div>

        {/* Coverage Disclaimer Badge */}
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">
            Representative Benchmark Coverage: {breadth.coverage?.trackedCount ?? 25} active securities of {breadth.coverage?.totalUniverseCount?.toLocaleString('en-IN') ?? '13,617'} total universe
          </span>
        </div>
      </div>

      {/* Visual Advance / Decline Bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Advances: {advances} ({advancePct}%)
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            Unchanged: {unchanged} ({unchangedPct}%)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            Declines: {declines} ({declinePct}%)
            <span className="h-2 w-2 rounded-full bg-rose-400" />
          </span>
        </div>

        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-950 p-0.5 border border-slate-800">
          <div
            style={{ width: `${advancePct}%` }}
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-500"
            title={`Advances: ${advances}`}
          />
          <div
            style={{ width: `${unchangedPct}%` }}
            className="h-full bg-slate-700 transition-all duration-500"
            title={`Unchanged: ${unchanged}`}
          />
          <div
            style={{ width: `${declinePct}%` }}
            className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-r-full transition-all duration-500"
            title={`Declines: ${declines}`}
          />
        </div>
      </div>

      {/* Breadth Statistics Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400">New 52-Week Highs</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {breadth.new52WeekHighs ?? breadth.highs52w ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">at / near high</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400">New 52-Week Lows</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-rose-400">
              {breadth.new52WeekLows ?? breadth.lows52w ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">at / near low</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400">Upper Circuit Limit</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {breadth.upperCircuits}
            </span>
            <span className="text-[11px] text-slate-500">locked +5%/+10%/+20%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400">Lower Circuit Limit</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-rose-400">
              {breadth.lowerCircuits}
            </span>
            <span className="text-[11px] text-slate-500">locked -5%/-10%/-20%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
