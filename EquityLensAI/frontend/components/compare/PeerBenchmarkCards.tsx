'use client';

import type { PeerBenchmarkResponse, BenchmarkMetricStat } from '@equitylensai/shared';

type PeerBenchmarkCardsProps = {
  benchmarks: PeerBenchmarkResponse | null;
  isLoading?: boolean;
};

export function PeerBenchmarkCards({ benchmarks, isLoading }: PeerBenchmarkCardsProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="text-xs text-slate-400 animate-pulse">
          Calculating peer benchmark statistics and relative percentiles...
        </div>
      </div>
    );
  }

  if (!benchmarks || !benchmarks.benchmarks || benchmarks.benchmarks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Peer Benchmark & Relative Positioning</h3>
          <p className="text-xs text-slate-400">
            Deterministic peer group statistics, median differences, and relative percentiles.
          </p>
        </div>
        <div className="rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-500/20">
          Sample size: {benchmarks.symbols.length} companies
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {benchmarks.benchmarks.map((stat: BenchmarkMetricStat) => {
          const isSufficient = stat.sampleSize >= 2;
          const rankEntries = Object.entries(stat.ranks || {});

          return (
            <div
              key={stat.metricId}
              className="rounded-lg border border-white/10 bg-slate-950/60 p-3.5 space-y-2.5 transition hover:border-white/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{stat.label}</span>
                <span className="text-[10px] rounded bg-white/10 px-1.5 py-0.5 text-slate-400 uppercase">
                  {stat.unit}
                </span>
              </div>

              {/* Benchmark Summary Stats */}
              <div className="grid grid-cols-3 gap-2 rounded bg-slate-900/80 p-2 text-center text-[11px]">
                <div>
                  <div className="text-[10px] text-slate-500">Median</div>
                  <div className="font-mono font-medium text-sky-400">
                    {stat.median !== null ? stat.median.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Mean</div>
                  <div className="font-mono text-slate-300">
                    {stat.mean !== null ? stat.mean.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Range</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {stat.min !== null && stat.max !== null
                      ? `${stat.min.toFixed(1)} – ${stat.max.toFixed(1)}`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Company Relative Standing */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Company Positioning
                </div>
                {rankEntries.map(([sym, r]) => {
                  return (
                    <div
                      key={sym}
                      className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-none"
                    >
                      <span className="font-medium text-slate-200">{sym}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300">
                          {r.value !== null ? r.value.toFixed(2) : '—'}
                        </span>

                        {isSufficient && r.rank !== null ? (
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[10px] font-mono font-semibold text-sky-300">
                              #{r.rank}
                            </span>
                            {r.percentile !== null && (
                              <span className="text-[10px] text-slate-400">
                                ({r.percentile}th %tile)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Insufficient n</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isSufficient && (
                <div className="text-[10px] text-amber-400/80 italic pt-1">
                  * Minimum 2 valid observations required for rank computation.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {benchmarks.warnings && benchmarks.warnings.length > 0 && (
        <div className="text-[11px] text-amber-300/80">
          Note: {benchmarks.warnings.join(' ')}
        </div>
      )}
    </div>
  );
}
