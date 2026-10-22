'use client';

import type { FinancialHealthScore, HealthScoreDimension } from '@/types';

type HealthScoreCardProps = {
  healthScore: FinancialHealthScore;
  isLoading?: boolean;
};

export function HealthScoreCard({ healthScore, isLoading }: HealthScoreCardProps) {
  if (isLoading) {
    return (
      <div className="w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <div className="h-6 w-48 rounded bg-slate-800" />
        <div className="mt-4 h-24 w-full rounded bg-slate-800/40" />
      </div>
    );
  }

  const { overallScore, grade, summary, dimensions, dataQualityWarnings, asOfPeriod, scoredAt } =
    healthScore;

  // Grade badge color
  const gradeStyles: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    'A+': {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      glow: 'shadow-emerald-500/20',
    },
    A: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      glow: 'shadow-emerald-500/20',
    },
    B: {
      bg: 'bg-sky-500/15',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
      glow: 'shadow-sky-500/20',
    },
    C: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      glow: 'shadow-amber-500/20',
    },
    D: {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      glow: 'shadow-orange-500/20',
    },
    F: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      glow: 'shadow-rose-500/20',
    },
  };

  const defaultStyle = {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
  };
  const style = gradeStyles[grade] || defaultStyle;

  const dimensionEntries: Array<{
    key: string;
    label: string;
    weight: string;
    data: HealthScoreDimension;
  }> = [
    { key: 'profitability', label: 'Profitability', weight: '25%', data: dimensions.profitability },
    { key: 'liquidity', label: 'Liquidity', weight: '20%', data: dimensions.liquidity },
    { key: 'leverage', label: 'Solvency & Leverage', weight: '20%', data: dimensions.leverage },
    { key: 'cashFlow', label: 'Cash Flow Quality', weight: '20%', data: dimensions.cashFlow },
    { key: 'growth', label: 'Growth Trajectory', weight: '15%', data: dimensions.growth },
  ];

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Deterministic Health Score Engine
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Financial Health Diagnostic
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Calculated as of period ending{' '}
            <span className="font-semibold text-slate-200">{asOfPeriod}</span> • Scored at{' '}
            <span className="font-semibold text-slate-200">
              {new Date(scoredAt).toLocaleString()}
            </span>
          </p>
        </div>

        {/* Big Score Badge */}
        <div
          className={`flex items-center gap-4 rounded-2xl border ${style.border} ${style.bg} px-6 py-3.5 shadow-xl ${style.glow}`}
        >
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Composite Score
            </div>
            <div className="text-3xl font-black text-white sm:text-4xl">
              {overallScore}
              <span className="text-base font-normal text-slate-400">/100</span>
            </div>
          </div>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${style.border} bg-slate-900/80 text-2xl font-black ${style.text}`}
          >
            {grade}
          </div>
        </div>
      </div>

      {/* Summary narrative */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
        <p>{summary}</p>
      </div>

      {/* 5-Dimension Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {dimensionEntries.map(({ key, label, weight, data }) => {
          const scorePercent = Math.min(100, Math.max(0, data.score));
          const scoreColor =
            scorePercent >= 75
              ? 'bg-emerald-500 text-emerald-400'
              : scorePercent >= 50
                ? 'bg-sky-500 text-sky-400'
                : scorePercent >= 35
                  ? 'bg-amber-500 text-amber-400'
                  : 'bg-rose-500 text-rose-400';

          return (
            <div
              key={key}
              className="flex flex-col justify-between rounded-2xl border border-white/5 bg-slate-900/50 p-4 transition hover:border-white/15"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{label}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                    {weight}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{data.score}</span>
                  <span className="text-xs text-slate-500">/100</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${scoreColor.split(' ')[0]}`}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>

              <p className="mt-3 line-clamp-3 text-[11px] leading-tight text-slate-400">
                {data.rationale}
              </p>
            </div>
          );
        })}
      </div>

      {/* Warnings & Transparency Audit */}
      {dataQualityWarnings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300/90">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Data Transparency & Metric Exclusions ({dataQualityWarnings.length})
          </div>
          <p className="mt-1 text-[11px] text-amber-300/70">
            In compliance with our zero-hallucination standard, unavailable line items were never
            filled with dummy zeros. Instead, they were excluded from the dimension denominator
            without penalty:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-amber-200/80">
            {dataQualityWarnings.slice(0, 4).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
