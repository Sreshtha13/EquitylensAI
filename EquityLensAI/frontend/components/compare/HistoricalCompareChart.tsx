'use client';

import { useState, useMemo } from 'react';
import type {
  HistoricalComparisonResult,
  HistoricalFinancialPoint,
} from '@equitylensai/shared';

type HistoricalCompareChartProps = {
  historicalData: HistoricalComparisonResult | null;
  isLoading?: boolean;
  currentInterval: '1M' | '3M' | '6M' | '1Y' | '5Y';
  onIntervalChange: (interval: '1M' | '3M' | '6M' | '1Y' | '5Y') => void;
};

const COMPANY_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e'];

export function HistoricalCompareChart({
  historicalData,
  isLoading,
  currentInterval,
  onIntervalChange,
}: HistoricalCompareChartProps) {
  const [viewMode, setViewMode] = useState<'price' | 'financial'>('price');
  const [financialMetric, setFinancialMetric] = useState<
    'revenue' | 'netIncome' | 'operatingMargin' | 'roe'
  >('revenue');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const intervals: Array<'1M' | '3M' | '6M' | '1Y' | '5Y'> = ['1M', '3M', '6M', '1Y', '5Y'];

  const pricePoints = useMemo(() => {
    return historicalData?.pricePerformance?.points || [];
  }, [historicalData]);

  const symbols = useMemo(() => {
    if (pricePoints.length === 0) return [];
    return Object.keys(pricePoints[0]?.values || {});
  }, [pricePoints]);

  // Color lookup map
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    symbols.forEach((sym, idx) => {
      map.set(sym, COMPANY_COLORS[idx % COMPANY_COLORS.length]!);
    });
    return map;
  }, [symbols]);

  // Compute SVG Bounds for normalized price chart
  const { svgPointsMap, yBase100 } = useMemo<{
    svgPointsMap: Record<string, string>;
    yBase100: number;
  }>(() => {
    if (pricePoints.length === 0 || symbols.length === 0) {
      return { svgPointsMap: {}, yBase100: 50 };
    }

    let min = 100;
    let max = 100;

    for (const pt of pricePoints) {
      for (const sym of symbols) {
        const v = pt.values[sym];
        if (typeof v === 'number') {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }

    // Add padding
    const range = Math.max(max - min, 5);
    const paddedMin = Math.floor(min - range * 0.05);
    const paddedMax = Math.ceil(max + range * 0.05);

    const width = 800;
    const height = 260;

    const map: Record<string, string> = {};
    for (const sym of symbols) {
      const coords: string[] = [];
      pricePoints.forEach((pt, idx) => {
        const val = pt.values[sym];
        if (typeof val === 'number') {
          const x = (idx / Math.max(pricePoints.length - 1, 1)) * width;
          const y = height - ((val - paddedMin) / (paddedMax - paddedMin)) * height;
          coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
      });
      map[sym] = coords.join(' ');
    }

    const yBase = height - ((100 - paddedMin) / (paddedMax - paddedMin)) * height;

    return { minVal: paddedMin, maxVal: paddedMax, svgPointsMap: map, yBase100: yBase };
  }, [pricePoints, symbols]);

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
      {/* Header with Mode Switcher & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Historical Trend & Performance Comparison</h3>
          <p className="text-xs text-slate-400">
            {viewMode === 'price'
              ? 'Multi-company historical stock performance normalized to 100 at the start of the window.'
              : 'Historical fiscal-year financial statement progression.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-white/10">
            <button
              onClick={() => setViewMode('price')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'price'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stock Performance
            </button>
            <button
              onClick={() => setViewMode('financial')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'financial'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Financial Trends
            </button>
          </div>

          {/* Interval Switcher for Price Mode */}
          {viewMode === 'price' && (
            <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-white/10">
              {intervals.map((iv) => (
                <button
                  key={iv}
                  onClick={() => onIntervalChange(iv)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                    currentInterval === iv
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
          )}

          {/* Metric Selector for Financial Mode */}
          {viewMode === 'financial' && (
            <select
              value={financialMetric}
              onChange={(e) =>
                setFinancialMetric(
                  e.target.value as 'revenue' | 'netIncome' | 'operatingMargin' | 'roe',
                )
              }
              className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="revenue">Revenue</option>
              <option value="netIncome">Net Income</option>
              <option value="operatingMargin">Operating Margin (%)</option>
              <option value="roe">ROE (%)</option>
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400 animate-pulse">
          Loading historical multi-company time series...
        </div>
      ) : viewMode === 'price' ? (
        /* Normalized Price Performance Chart */
        <div className="space-y-3">
          {/* Legend and Return Summary */}
          <div className="flex flex-wrap items-center gap-3">
            {symbols.map((sym) => {
              const color = colorMap.get(sym) || '#38bdf8';
              const ret = historicalData?.pricePerformance?.summaryReturns?.[sym];
              return (
                <div
                  key={sym}
                  className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-slate-950/60 px-2.5 py-1 text-xs"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-white">{sym}</span>
                  {ret !== undefined && ret !== null && (
                    <span
                      className={`font-mono font-medium ${
                        ret >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ret >= 0 ? '+' : ''}
                      {ret.toFixed(2)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {pricePoints.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-500">
              No historical price observations available for the selected interval.
            </div>
          ) : (
            <div className="relative rounded-lg border border-white/5 bg-slate-950/80 p-3 overflow-hidden">
              <svg
                viewBox="0 0 800 260"
                className="w-full h-64 overflow-visible"
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Horizontal Baseline at 100 */}
                <line
                  x1="0"
                  y1={yBase100}
                  x2="800"
                  y2={yBase100}
                  stroke="#ffffff"
                  strokeOpacity="0.15"
                  strokeDasharray="4 4"
                />
                <text
                  x="805"
                  y={yBase100 + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  100 (Base)
                </text>

                {/* Series Polylines */}
                {symbols.map((sym) => (
                  <polyline
                    key={sym}
                    fill="none"
                    stroke={colorMap.get(sym) || '#38bdf8'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgPointsMap[sym] || ''}
                  />
                ))}

                {/* Hover interactive overlay */}
                {hoverIndex !== null && pricePoints[hoverIndex] && (
                  <>
                    <line
                      x1={(hoverIndex / Math.max(pricePoints.length - 1, 1)) * 800}
                      y1="0"
                      x2={(hoverIndex / Math.max(pricePoints.length - 1, 1)) * 800}
                      y2="260"
                      stroke="#ffffff"
                      strokeOpacity="0.3"
                      strokeDasharray="2 2"
                    />
                  </>
                )}

                {/* Invisible hover capture rects */}
                {pricePoints.map((_, idx) => {
                  const stepW = 800 / pricePoints.length;
                  return (
                    <rect
                      key={idx}
                      x={idx * stepW}
                      y="0"
                      width={stepW}
                      height="260"
                      fill="transparent"
                      onMouseEnter={() => setHoverIndex(idx)}
                    />
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoverIndex !== null && pricePoints[hoverIndex] && (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded bg-slate-900 border border-white/10 px-3 py-1.5 text-[11px] text-slate-300">
                  <span className="font-semibold text-white">
                    {pricePoints[hoverIndex]!.date}
                  </span>
                  {symbols.map((sym) => {
                    const val = pricePoints[hoverIndex]!.values[sym];
                    return (
                      <span key={sym} className="flex items-center gap-1 font-mono">
                        <span style={{ color: colorMap.get(sym) }}>{sym}:</span>
                        <span className="text-white">
                          {val !== null && val !== undefined ? val.toFixed(2) : '—'}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Financial Statement Trends Table / Grid */
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Comparing annual historical {financialMetric} progression across verified reporting periods:
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Company</th>
                  <th className="py-2.5 px-3 font-semibold">FY-4</th>
                  <th className="py-2.5 px-3 font-semibold">FY-3</th>
                  <th className="py-2.5 px-3 font-semibold">FY-2</th>
                  <th className="py-2.5 px-3 font-semibold">FY-1 / Latest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {symbols.map((sym) => {
                  const pts: HistoricalFinancialPoint[] =
                    historicalData?.financialTrends?.[sym] || [];
                  const sortedPts = [...pts].sort((a, b) =>
                    a.periodEndDate.localeCompare(b.periodEndDate),
                  );
                  const color = colorMap.get(sym) || '#38bdf8';

                  return (
                    <tr key={sym} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-white">{sym}</span>
                      </td>

                      {[0, 1, 2, 3].map((slotIdx) => {
                        const pt = sortedPts[slotIdx];
                        if (!pt) {
                          return (
                            <td key={slotIdx} className="py-2.5 px-3 font-mono text-slate-500">
                              —
                            </td>
                          );
                        }

                        let valDisplay = '—';
                        if (financialMetric === 'revenue') {
                          valDisplay =
                            pt.revenue !== null
                              ? `₹${Math.round(pt.revenue / 1e7).toLocaleString()} Cr`
                              : '—';
                        } else if (financialMetric === 'netIncome') {
                          valDisplay =
                            pt.netIncome !== null
                              ? `₹${Math.round(pt.netIncome / 1e7).toLocaleString()} Cr`
                              : '—';
                        } else if (financialMetric === 'operatingMargin') {
                          valDisplay =
                            pt.operatingMargin !== null ? `${pt.operatingMargin.toFixed(2)}%` : '—';
                        } else if (financialMetric === 'roe') {
                          valDisplay = pt.roe !== null ? `${pt.roe.toFixed(2)}%` : '—';
                        }

                        return (
                          <td key={slotIdx} className="py-2.5 px-3 font-mono text-slate-200">
                            <div>{valDisplay}</div>
                            <div className="text-[10px] text-slate-500">{pt.fiscalYear}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
