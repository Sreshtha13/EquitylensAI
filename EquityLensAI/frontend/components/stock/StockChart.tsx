'use client';

import { useMemo, useState, useRef } from 'react';
import { useStockHistory } from '@/hooks/useMarket';
import type { CandleInterval } from '@/types';

type TimeRangeKey = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';

type RangeOption = {
  key: TimeRangeKey;
  label: string;
  days: number | null;
  interval: CandleInterval;
};

const TIME_RANGES: RangeOption[] = [
  { key: '1D', label: '1D', days: 1, interval: 'FIFTEEN_MINUTE' },
  { key: '1W', label: '1W', days: 7, interval: 'ONE_DAY' },
  { key: '1M', label: '1M', days: 30, interval: 'ONE_DAY' },
  { key: '3M', label: '3M', days: 90, interval: 'ONE_DAY' },
  { key: '6M', label: '6M', days: 180, interval: 'ONE_DAY' },
  { key: '1Y', label: '1Y', days: 365, interval: 'ONE_DAY' },
  { key: '3Y', label: '3Y', days: 3 * 365, interval: 'ONE_DAY' },
  { key: '5Y', label: '5Y', days: 5 * 365, interval: 'ONE_DAY' },
  { key: 'MAX', label: 'MAX', days: null, interval: 'ONE_DAY' },
];

type StockChartProps = {
  symbol: string;
  exchange: string;
};

export function StockChart({ symbol, exchange }: StockChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('1Y');
  const [chartMode, setChartMode] = useState<'line' | 'candlestick'>('line');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const activeRangeConfig = useMemo(
    () => TIME_RANGES.find((r) => r.key === selectedRange) || TIME_RANGES[5]!,
    [selectedRange],
  );

  const { fromDate, toDate } = useMemo(() => {
    const to = new Date();
    const from =
      activeRangeConfig.days === null ? new Date('1900-01-01T00:00:00.000Z') : new Date();
    if (activeRangeConfig.days !== null) {
      from.setDate(from.getDate() - activeRangeConfig.days);
    }
    return {
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
    };
  }, [activeRangeConfig.days]);

  const {
    data: history,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useStockHistory(symbol, {
    exchange,
    interval: activeRangeConfig.interval,
    from: fromDate,
    to: toDate,
  });

  const currencySymbol =
    exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'US' ? '$' : '₹';

  // Process candles: sort chronologically and filter valid closes
  const candles = useMemo(() => {
    if (!history?.candles || history.candles.length === 0) return [];
    return [...history.candles]
      .filter((c) => Number.isFinite(c.close) && c.close > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [history?.candles]);

  const hasAdjusted = useMemo(
    () =>
      candles.length > 0 &&
      candles.every((c) => typeof c.adjustedClose === 'number' && c.adjustedClose > 0),
    [candles],
  );

  // SVG Drawing Dimensions
  const svgWidth = 800;
  const svgHeight = 420;
  const padding = { top: 20, right: 65, bottom: 90, left: 10 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const priceChartHeight = svgHeight - padding.top - padding.bottom;
  const volumeChartHeight = 55;
  const volumeChartTop = svgHeight - padding.bottom + 20;

  // Min Price, Max Volume & Price Range
  const { minPrice, maxVolume, priceRange } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 0, maxVolume: 1, priceRange: 100 };
    }
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    for (const c of candles) {
      const h = c.high ?? c.close;
      const l = c.low ?? c.close;
      if (h > max) max = h;
      if (l < min) min = l;
      if (c.volume && c.volume > maxVol) maxVol = c.volume;
    }

    if (min === max) {
      min = min * 0.95;
      max = max * 1.05;
    }

    // Add 4% buffer top and bottom
    const span = max - min;
    const paddedMin = Math.max(0, min - span * 0.04);
    const paddedMax = max + span * 0.04;

    return {
      minPrice: paddedMin,
      maxVolume: maxVol > 0 ? maxVol : 1,
      priceRange: paddedMax - paddedMin || 1,
    };
  }, [candles]);

  // Coordinate projection helpers
  const getX = (index: number) => {
    if (candles.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (candles.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    const norm = (price - minPrice) / priceRange;
    return padding.top + (1 - norm) * priceChartHeight;
  };

  const getVolY = (volume: number | null) => {
    if (!volume || maxVolume <= 0) return volumeChartTop + volumeChartHeight;
    const h = (volume / maxVolume) * volumeChartHeight;
    return volumeChartTop + volumeChartHeight - h;
  };

  // Line path and Area path
  const { linePath, areaPath } = useMemo(() => {
    if (candles.length === 0) return { linePath: '', areaPath: '' };
    const points = candles.map((c, i) => {
      const x =
        candles.length <= 1
          ? padding.left + chartWidth / 2
          : padding.left + (i / (candles.length - 1)) * chartWidth;
      const norm = (c.close - minPrice) / priceRange;
      const y = padding.top + (1 - norm) * priceChartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const xLast = candles.length <= 1 ? padding.left + chartWidth / 2 : padding.left + chartWidth;
    const xFirst = candles.length <= 1 ? padding.left + chartWidth / 2 : padding.left;
    const yBottom = padding.top + priceChartHeight;
    const line = `M ${points.join(' L ')}`;
    const area = `${line} L ${xLast.toFixed(1)},${yBottom.toFixed(1)} L ${xFirst.toFixed(1)},${yBottom.toFixed(1)} Z`;
    return { linePath: line, areaPath: area };
  }, [candles, minPrice, priceRange, chartWidth, padding.left, padding.top, priceChartHeight]);

  // Overall period statistics
  const periodStats = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0]!;
    const last = candles[candles.length - 1]!;
    const delta = last.close - first.close;
    const deltaPct = first.close > 0 ? (delta / first.close) * 100 : 0;
    return {
      firstPrice: first.close,
      lastPrice: last.close,
      delta,
      deltaPct,
      isPositive: delta >= 0,
      high: Math.max(...candles.map((c) => c.high ?? c.close)),
      low: Math.min(...candles.map((c) => c.low ?? c.close)),
    };
  }, [candles]);

  const activeCandle =
    hoveredIndex !== null && candles[hoveredIndex] ? candles[hoveredIndex] : null;

  // Mouse hover event handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (candles.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const relativeX = (mouseX / svgRect.width) * svgWidth;
    const clampedX = Math.max(padding.left, Math.min(padding.left + chartWidth, relativeX));
    const ratio = (clampedX - padding.left) / chartWidth;
    const index = Math.round(ratio * (candles.length - 1));
    setHoveredIndex(Math.max(0, Math.min(candles.length - 1, index)));
  };

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
      {/* Header Controls: Time Ranges & View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">Interactive Price Action</h3>
          <p className="text-xs text-slate-400">
            {candles.length} verified trading periods ·{' '}
            {hasAdjusted ? 'Adjusted close series' : 'Unadjusted market prices'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center rounded-xl border border-white/5 bg-slate-950/70 p-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setSelectedRange(r.key);
                  setHoveredIndex(null);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRange === r.key
                    ? 'bg-sky-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Mode Toggle: Line vs Candlestick */}
          <div className="flex items-center rounded-xl border border-white/5 bg-slate-950/70 p-1">
            <button
              onClick={() => setChartMode('line')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                chartMode === 'line' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Line Chart"
            >
              Line
            </button>
            <button
              onClick={() => setChartMode('candlestick')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                chartMode === 'candlestick'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Candlestick Chart"
            >
              Candles
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Hover / Range Summary Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
        {activeCandle ? (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500">Date: </span>
              <span className="font-semibold text-slate-200">
                {new Date(activeCandle.timestamp).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-500">O: </span>
              <span className="font-semibold text-white">
                {currencySymbol}
                {activeCandle.open.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">H: </span>
              <span className="font-semibold text-emerald-400">
                {currencySymbol}
                {activeCandle.high.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">L: </span>
              <span className="font-semibold text-rose-400">
                {currencySymbol}
                {activeCandle.low.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">C: </span>
              <span className="font-semibold text-sky-400">
                {currencySymbol}
                {activeCandle.close.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Vol: </span>
              <span className="font-semibold text-slate-300">
                {activeCandle.volume ? activeCandle.volume.toLocaleString() : '—'}
              </span>
            </div>
          </div>
        ) : periodStats ? (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Period Return: </span>
              <span
                className={`font-mono font-bold ${
                  periodStats.isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {periodStats.isPositive ? '+' : ''}
                {periodStats.delta.toFixed(2)} ({periodStats.deltaPct.toFixed(2)}%)
              </span>
            </div>
            <div>
              <span className="text-slate-500">Range High: </span>
              <span className="font-mono font-semibold text-emerald-400">
                {currencySymbol}
                {periodStats.high.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Range Low: </span>
              <span className="font-mono font-semibold text-rose-400">
                {currencySymbol}
                {periodStats.low.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Hover chart for bar details</div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">Viewing price history</div>
        )}

        {isRefetching && (
          <span className="text-xs text-sky-400 animate-pulse">Updating price data...</span>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="relative mt-4 w-full" ref={containerRef}>
        {isLoading ? (
          <div className="flex h-72 w-full animate-pulse items-center justify-center rounded-2xl border border-white/5 bg-slate-950/50">
            <div className="text-xs text-slate-400">Loading verified price history...</div>
          </div>
        ) : error ? (
          <div className="flex h-72 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-300">
            <svg
              className="h-8 w-8 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs max-w-sm">
              Unable to load historical data for {symbol} ({exchange}). {error.message}
            </p>
            <button
              onClick={() => refetch()}
              className="rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition"
            >
              Retry Loading
            </button>
          </div>
        ) : candles.length === 0 ? (
          <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-white/5 bg-slate-950/40 text-xs text-slate-400">
            No historical price records found for this time range from active market providers.
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 bg-slate-950/60 p-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Price Grid Lines & Axis Ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const price = minPrice + (1 - pct) * priceRange;
                const y = padding.top + pct * priceChartHeight;
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + chartWidth}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left + chartWidth + 6}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {currencySymbol}
                      {price.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Volume Separator Line */}
              <line
                x1={padding.left}
                y1={volumeChartTop - 8}
                x2={padding.left + chartWidth}
                y2={volumeChartTop - 8}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={padding.left}
                y={volumeChartTop - 12}
                fill="#475569"
                fontSize="9"
                fontWeight="600"
                className="uppercase tracking-wider"
              >
                Volume
              </text>

              {/* Volume Bars */}
              {candles.map((c, i) => {
                const x = getX(i);
                const y = getVolY(c.volume);
                const barWidth = Math.max(1, chartWidth / candles.length - 1);
                const isGreen = c.close >= c.open;
                return (
                  <rect
                    key={`vol-${i}`}
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, volumeChartTop + volumeChartHeight - y)}
                    fill={isGreen ? 'rgba(52, 211, 153, 0.45)' : 'rgba(244, 63, 94, 0.45)'}
                  />
                );
              })}

              {/* Line Mode Rendering */}
              {chartMode === 'line' && (
                <>
                  <path d={areaPath} fill="url(#chartGradient)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Candlestick Mode Rendering */}
              {chartMode === 'candlestick' &&
                candles.map((c, i) => {
                  const x = getX(i);
                  const isGreen = c.close >= c.open;
                  const color = isGreen ? '#10b981' : '#f43f5e';
                  const yHigh = getY(c.high);
                  const yLow = getY(c.low);
                  const yOpen = getY(c.open);
                  const yClose = getY(c.close);
                  const topBody = Math.min(yOpen, yClose);
                  const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
                  const candleWidth = Math.max(
                    2,
                    Math.min(10, (chartWidth / candles.length) * 0.75),
                  );

                  return (
                    <g key={`candle-${i}`}>
                      {/* Wick Line */}
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.2" />
                      {/* Body Rect */}
                      <rect
                        x={x - candleWidth / 2}
                        y={topBody}
                        width={candleWidth}
                        height={bodyHeight}
                        fill={color}
                      />
                    </g>
                  );
                })}

              {/* Date Ticks on X-Axis */}
              {candles.length > 0 &&
                [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const idx = Math.min(candles.length - 1, Math.round(pct * (candles.length - 1)));
                  const candle = candles[idx];
                  if (!candle) return null;
                  const x = getX(idx);
                  return (
                    <text
                      key={`date-${i}`}
                      x={x}
                      y={svgHeight - 12}
                      textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
                      fill="#64748b"
                      fontSize="10"
                    >
                      {new Date(candle.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </text>
                  );
                })}

              {/* Interactive Hover Crosshair */}
              {hoveredIndex !== null && candles[hoveredIndex] && (
                <g>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={getX(hoveredIndex)}
                    y1={padding.top}
                    x2={getX(hoveredIndex)}
                    y2={volumeChartTop + volumeChartHeight}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeDasharray="3 3"
                  />
                  {/* Horizontal Crosshair Line */}
                  <line
                    x1={padding.left}
                    y1={getY(candles[hoveredIndex]!.close)}
                    x2={padding.left + chartWidth}
                    y2={getY(candles[hoveredIndex]!.close)}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeDasharray="3 3"
                  />
                  {/* Active Point Circle */}
                  <circle
                    cx={getX(hoveredIndex)}
                    cy={getY(candles[hoveredIndex]!.close)}
                    r="4.5"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Chart Footer Provenance */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-white/5 pt-3">
        <div className="flex items-center gap-2">
          <span>
            Source: {history?.source === 'angel' ? 'Angel One SmartAPI' : 'Yahoo Finance'}
          </span>
          <span>•</span>
          <span>
            Retrieved:{' '}
            {history?.retrievedAt ? new Date(history.retrievedAt).toLocaleTimeString() : 'Recent'}
          </span>
        </div>
        <div>
          Interval: <span className="text-slate-400 font-mono">{activeRangeConfig.interval}</span>
        </div>
      </div>
    </div>
  );
}
