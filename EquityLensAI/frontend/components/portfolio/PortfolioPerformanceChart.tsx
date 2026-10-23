'use client';

import { useState } from 'react';
import type { PortfolioPerformance, PortfolioPerformanceRange } from '@equitylensai/shared';

type PortfolioPerformanceChartProps = {
  performance?: PortfolioPerformance | undefined;
  timeRange: PortfolioPerformanceRange;
  onRangeChange: (range: PortfolioPerformanceRange) => void;
  isLoading?: boolean | undefined;
};

const RANGES: PortfolioPerformanceRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];

export function PortfolioPerformanceChart({
  performance,
  timeRange,
  onRangeChange,
  isLoading,
}: PortfolioPerformanceChartProps) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  if (isLoading || !performance) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl animate-pulse">
        <div className="h-6 w-44 rounded bg-slate-800" />
        <div className="mt-6 h-64 w-full rounded-xl bg-slate-800/50" />
      </div>
    );
  }

  const history = performance.history || [];
  const metrics = performance.metrics;
  const isPositiveReturn = metrics.totalReturnPercent >= 0;
  const alpha = metrics.alpha;

  // Build SVG Path from history points
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  const validVals = history.map((p) => p.portfolioValue);
  const minVal = validVals.length > 0 ? Math.min(...validVals) * 0.98 : 0;
  const maxVal = validVals.length > 0 ? Math.max(...validVals) * 1.02 : 100;
  const rangeY = maxVal - minVal || 1;

  const getCoordinates = (val: number, idx: number, total: number) => {
    const x = paddingX + (idx / Math.max(1, total - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((val - minVal) / rangeY) * (height - 2 * paddingY);
    return { x, y };
  };

  const points = history.map((p, i) => getCoordinates(p.portfolioValue, i, history.length));

  const pathD =
    points.length > 0
      ? `M ${points[0]!.x} ${points[0]!.y} ` +
        points
          .slice(1)
          .map((pt) => `L ${pt.x} ${pt.y}`)
          .join(' ')
      : '';

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1]!.x} ${height - paddingY} L ${points[0]!.x} ${
          height - paddingY
        } Z`
      : '';

  const hoveredPoint =
    hoveredPointIndex !== null && history[hoveredPointIndex] ? history[hoveredPointIndex] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
      {/* Top Header: Title & Time Range Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Performance Analytics & Benchmark Comparison
          </h2>
          <p className="text-xs text-slate-400">
            Comparing portfolio returns against {metrics.benchmarkName} ({metrics.benchmarkSymbol})
          </p>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center space-x-1 rounded-xl border border-white/10 bg-slate-950 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                timeRange === r
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Portfolio Return
          </span>
          <div
            className={`mt-1 text-lg font-black ${
              isPositiveReturn ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositiveReturn ? '+' : ''}
            {metrics.totalReturnPercent.toFixed(2)}%
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {metrics.benchmarkName} Return
          </span>
          <div className="mt-1 text-lg font-black text-slate-200">
            {metrics.benchmarkReturnPercent !== null && metrics.benchmarkReturnPercent !== undefined
              ? `${metrics.benchmarkReturnPercent >= 0 ? '+' : ''}${metrics.benchmarkReturnPercent.toFixed(2)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Alpha (Outperformance)
          </span>
          <div
            className={`mt-1 text-lg font-black ${
              alpha !== null && alpha !== undefined && alpha >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {alpha !== null && alpha !== undefined ? `${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Net Cash Flow
          </span>
          <div className="mt-1 text-lg font-black text-white">
            {metrics.netCashFlow >= 0 ? '+' : ''}
            {metrics.netCashFlow.toLocaleString('en-IN', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart Area */}
      <div className="relative mt-6 w-full">
        {history.length < 2 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-white/5 bg-slate-950/40 text-xs text-slate-400">
            Not enough historical observations to render performance chart.
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-60 w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={paddingY}
                x2={width - paddingX}
                y2={paddingY}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="0.5"
              />
              <line
                x1={paddingX}
                y1={height / 2}
                x2={width - paddingX}
                y2={height / 2}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="0.5"
              />
              <line
                x1={paddingX}
                y1={height - paddingY}
                x2={width - paddingX}
                y2={height - paddingY}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Area Under Curve */}
              {areaD && <path d={areaD} fill="url(#portfolioGradient)" />}

              {/* Portfolio Curve */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover Indicator Line & Circles */}
              {hoveredPointIndex !== null && points[hoveredPointIndex] && (
                <g>
                  <line
                    x1={points[hoveredPointIndex]!.x}
                    y1={paddingY}
                    x2={points[hoveredPointIndex]!.x}
                    y2={height - paddingY}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={points[hoveredPointIndex]!.x}
                    cy={points[hoveredPointIndex]!.y}
                    r="5"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Transparent Touch / Hover Overlay Zones */}
            <div className="absolute inset-0 flex">
              {history.map((_, idx) => (
                <div
                  key={idx}
                  className="h-full flex-1 cursor-crosshair"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                />
              ))}
            </div>

            {/* Hover Tooltip Card */}
            {hoveredPoint && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs">
                <span className="font-mono text-slate-400">Date: {hoveredPoint.date}</span>
                <span className="font-bold text-white">
                  Valuation: {hoveredPoint.portfolioValue.toLocaleString('en-IN')}
                </span>
                {hoveredPoint.benchmarkReturnPercent !== null &&
                  hoveredPoint.benchmarkReturnPercent !== undefined && (
                    <span className="text-slate-400">
                      {metrics.benchmarkName}: {hoveredPoint.benchmarkReturnPercent.toFixed(2)}%
                    </span>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Methodology and Data Disclaimers */}
      <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-400 space-y-1">
        {performance.calculationNotes.map((note, i) => (
          <p key={i}>• {note}</p>
        ))}
      </div>
    </div>
  );
}
