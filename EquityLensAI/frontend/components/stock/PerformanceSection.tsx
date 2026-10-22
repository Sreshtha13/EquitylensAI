'use client';

import { useStockPerformance } from '@/hooks/useStocks';
import type { HistoricalPerformancePeriod } from '@equitylensai/shared';

type PerformanceSectionProps = {
  symbol: string;
  exchange: string;
};

export function PerformanceSection({ symbol, exchange }: PerformanceSectionProps) {
  const { data: performance, isLoading, error, refetch } = useStockPerformance(symbol, exchange);

  const currencySymbol =
    exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'US' ? '$' : '₹';

  if (isLoading) {
    return (
      <div className="w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6 sm:p-8">
        <div className="h-6 w-52 rounded bg-slate-800" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !performance) {
    return (
      <div className="w-full rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 sm:p-8 text-rose-300">
        <h3 className="text-lg font-bold">Historical Performance Unavailable</h3>
        <p className="mt-2 text-xs leading-relaxed text-rose-300/80">
          {error?.message || `Unable to compute historical return statistics for ${symbol}.`}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  const { periods, methodology, source, retrievedAt } = performance;

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Historical Performance Analytics</h3>
          <p className="text-xs text-slate-400">
            Deterministic returns, volatility, and max drawdown computed from verified historical
            daily observations.
          </p>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          <div>Source: {source === 'angel' ? 'Angel One SmartAPI' : 'Yahoo Finance'}</div>
          <div>Calculated: {new Date(retrievedAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Notice Banner: Price Return vs Total Return */}
      <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-sky-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            <strong>Capital Gain & Price Return:</strong> Figures reflect changes in trading closing
            prices. Dividends and total shareholder return (TSR) are not assumed unless the series
            is explicitly marked as dividend-adjusted.
          </span>
        </div>
      </div>

      {/* Multi-Period Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {periods.map((p: HistoricalPerformancePeriod) => {
          const isPos = p.cumulativeReturnPercent >= 0;
          return (
            <div
              key={p.period}
              className="flex flex-col justify-between rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition hover:border-white/15 hover:bg-slate-950/80"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {p.label}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      p.priceType === 'adjusted'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-white/5'
                    }`}
                  >
                    {p.priceType}
                  </span>
                </div>

                {/* Primary Return Metric */}
                <div className="mt-3">
                  <div
                    className={`text-2xl font-black font-mono tracking-tight ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPos ? '+' : ''}
                    {p.cumulativeReturnPercent.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Cumulative price return</div>
                </div>

                {/* Secondary Metrics */}
                <div className="mt-4 space-y-2 border-t border-white/5 pt-3 text-xs">
                  {/* Annualized Return (CAGR) */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Annualized (CAGR):</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {p.annualizedReturnPercent !== null ? (
                        <span
                          className={
                            p.annualizedReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {p.annualizedReturnPercent >= 0 ? '+' : ''}
                          {p.annualizedReturnPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </span>
                  </div>

                  {/* Volatility */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Volatility (Ann.):</span>
                    <span className="font-mono font-semibold text-slate-300">
                      {p.annualizedVolatilityPercent !== null
                        ? `${p.annualizedVolatilityPercent.toFixed(2)}%`
                        : '—'}
                    </span>
                  </div>

                  {/* Max Drawdown */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Max Drawdown:</span>
                    <span className="font-mono font-semibold text-rose-400">
                      {p.maxDrawdownPercent !== null ? `${p.maxDrawdownPercent.toFixed(2)}%` : '—'}
                    </span>
                  </div>

                  {/* Range High / Low */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Range:</span>
                    <span className="font-mono text-slate-300">
                      {currencySymbol}
                      {p.low.toFixed(1)} – {currencySymbol}
                      {p.high.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Observation details */}
              <div className="mt-4 border-t border-white/5 pt-2.5 text-[10px] text-slate-500 flex justify-between">
                <span>{p.observations} bars</span>
                <span>
                  {p.startDate} → {p.endDate}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology and Disclaimers Accordion */}
      <div className="mt-8 rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-400 space-y-2">
        <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
          Calculation Methodology & Rules
        </h4>
        <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
          <li>
            <strong>Cumulative Return:</strong> {methodology.cumulativeReturn}
          </li>
          <li>
            <strong>Annualized Return (CAGR):</strong> {methodology.annualizedReturn}
          </li>
          <li>
            <strong>Volatility:</strong> {methodology.volatility}
          </li>
          <li>
            <strong>Maximum Drawdown:</strong> {methodology.maxDrawdown}
          </li>
          <li>
            <strong>Disclaimer:</strong> {methodology.disclaimer}
          </li>
        </ul>
      </div>
    </div>
  );
}
