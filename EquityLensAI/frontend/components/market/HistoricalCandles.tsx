'use client';

import { useState } from 'react';
import { useStockHistory } from '@/hooks/useMarket';
import type { CandleInterval } from '@/types';

type HistoricalCandlesProps = {
  symbol: string;
  exchange?: string | undefined;
};

export function HistoricalCandles({ symbol, exchange }: HistoricalCandlesProps) {
  const [interval, setInterval] = useState<CandleInterval>('ONE_DAY');

  const { data: history, isLoading, error } = useStockHistory(symbol, {
    exchange,
    interval,
  });

  const currencySymbol = exchange === 'NASDAQ' || exchange === 'NYSE' ? '$' : '₹';

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl sm:p-8">
      {/* Header and Interval Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-bold text-white">Historical Price Action</h2>
          <p className="text-xs text-slate-400">
            Verified OHLCV candles retrieved from {history?.source || 'connected market provider'}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-950/70 p-1 border border-white/5">
          {(
            [
              { label: '1 Day', val: 'ONE_DAY' },
              { label: '1 Hour', val: 'ONE_HOUR' },
              { label: '15 Min', val: 'FIFTEEN_MINUTE' },
            ] as const
          ).map((item) => (
            <button
              key={item.val}
              onClick={() => setInterval(item.val)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                interval === item.val
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="mt-6 flex h-48 items-center justify-center text-xs text-slate-400">
          Loading historical candlestick data...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
          Failed to load historical candles: {error.message}
        </div>
      )}

      {history && history.candles.length > 0 && (
        <div className="mt-6">
          {/* Quick Range Stats */}
          {(() => {
            const highs = history.candles.map((c) => c.high);
            const lows = history.candles.map((c) => c.low);
            const maxHigh = Math.max(...highs);
            const minLow = Math.min(...lows);
            const firstOpen = history.candles[0]?.open ?? 0;
            const lastClose = history.candles[history.candles.length - 1]?.close ?? 0;
            const periodChange = lastClose - firstOpen;
            const periodPercent = firstOpen > 0 ? (periodChange / firstOpen) * 100 : 0;
            const isPos = periodChange >= 0;

            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Period High</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {currencySymbol}{maxHigh.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Period Low</div>
                  <div className="text-sm font-bold text-rose-400">
                    {currencySymbol}{minLow.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Candles Recorded</div>
                  <div className="text-sm font-bold text-white">
                    {history.candles.length} periods
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Period Delta</div>
                  <div className={`text-sm font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPos ? '+' : ''}{periodChange.toFixed(2)} ({periodPercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Candle Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Open</th>
                  <th className="px-4 py-3">High</th>
                  <th className="px-4 py-3">Low</th>
                  <th className="px-4 py-3">Close</th>
                  <th className="px-4 py-3">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/30">
                {history.candles
                  .slice(-10)
                  .reverse()
                  .map((c, idx) => {
                    const isGreen = c.close >= c.open;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-2.5 font-mono text-slate-400">
                          {new Date(c.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {currencySymbol}{c.open.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-emerald-400">
                          {currencySymbol}{c.high.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-rose-400">
                          {currencySymbol}{c.low.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2.5 font-semibold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currencySymbol}{c.close.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {c.volume !== null ? c.volume.toLocaleString() : '—'}
                        </td>
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
