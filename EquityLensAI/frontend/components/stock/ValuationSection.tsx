'use client';

import { useState } from 'react';
import type { FinancialAnalysis, FinancialMetric, NormalizedQuote } from '@/types';

type ValuationSectionProps = {
  analysis: FinancialAnalysis;
  quote?: NormalizedQuote | undefined;
};

function formatValuationValue(m: FinancialMetric | null | undefined): { text: string; isNegative: boolean } {
  if (!m || m.value === null || m.value === undefined) {
    return { text: 'N/A', isNegative: false };
  }
  const isNeg = m.value < 0;
  switch (m.unit) {
    case 'x':
    case 'ratio':
      return { text: `${m.value.toFixed(2)}x`, isNegative: isNeg };
    case 'currency':
      if (Math.abs(m.value) >= 1e12) return { text: `${(m.value / 1e12).toFixed(2)}T`, isNegative: isNeg };
      if (Math.abs(m.value) >= 1e9) return { text: `${(m.value / 1e9).toFixed(2)}B`, isNegative: isNeg };
      if (Math.abs(m.value) >= 1e7) return { text: `${(m.value / 1e7).toFixed(2)} Cr`, isNegative: isNeg };
      if (Math.abs(m.value) >= 1e6) return { text: `${(m.value / 1e6).toFixed(2)}M`, isNegative: isNeg };
      return { text: m.value.toLocaleString(), isNegative: isNeg };
    case 'percent':
      return { text: `${m.value.toFixed(2)}%`, isNegative: isNeg };
    default:
      return { text: m.value.toFixed(2), isNegative: isNeg };
  }
}

export function ValuationSection({ analysis, quote }: ValuationSectionProps) {
  const [selectedMetric, setSelectedMetric] = useState<{
    label: string;
    metric: FinancialMetric;
    notes?: string;
  } | null>(null);

  const { valuation, currency, latestAnnual, ttm } = analysis;

  const valuationCards = [
    {
      key: 'peRatio',
      label: 'Price to Earnings (P/E)',
      m: valuation.peRatio,
      subtitle: 'Market Price / Trailing EPS',
      notes:
        'When earnings are negative (net loss), standard P/E is mathematically negative and conventionally interpreted as not meaningful (N/M).',
    },
    {
      key: 'forwardPE',
      label: 'Forward P/E',
      m: valuation.forwardPE,
      subtitle: 'Price / Consensus Projected Earnings',
      notes:
        'Forward P/E requires reliable published consensus estimates. If estimates are not reported by the exchange provider, it is displayed as unavailable.',
    },
    {
      key: 'priceToBook',
      label: 'Price to Book (P/B)',
      m: valuation.priceToBook,
      subtitle: 'Market Cap / Total Stockholder Equity',
      notes:
        'Compares current market value against historical balance sheet net assets. Values < 1.0 indicate stock is trading below book equity.',
    },
    {
      key: 'priceToSales',
      label: 'Price to Sales (P/S)',
      m: valuation.priceToSales,
      subtitle: 'Market Cap / Total Revenue',
      notes: 'Measures market valuation relative to top-line annual or TTM sales.',
    },
    {
      key: 'evToEbitda',
      label: 'EV / EBITDA',
      m: valuation.evToEbitda,
      subtitle: 'Enterprise Value / EBITDA',
      notes:
        'Capital structure-neutral multiple comparing total firm value (equity + net debt) to operating cash generation before depreciation.',
    },
    {
      key: 'evToRevenue',
      label: 'EV / Revenue',
      m: valuation.evToRevenue,
      subtitle: 'Enterprise Value / Total Revenue',
      notes: 'Enterprise-level valuation relative to gross corporate revenue.',
    },
    {
      key: 'priceToFreeCashFlow',
      label: 'Price to Free Cash Flow',
      m: valuation.priceToFreeCashFlow,
      subtitle: 'Market Cap / Free Cash Flow',
      notes: 'Assesses valuation relative to actual cash generated after capital expenditures.',
    },
    {
      key: 'marketCap',
      label: 'Market Capitalization',
      m: valuation.marketCap,
      subtitle: 'Share Price × Outstanding Shares',
      notes: 'Total equity market valuation of all common shares outstanding at latest observed price.',
    },
    {
      key: 'enterpriseValue',
      label: 'Enterprise Value (EV)',
      m: valuation.enterpriseValue,
      subtitle: 'Market Cap + Total Debt - Cash',
      notes: 'Theoretical takeover price reflecting equity plus net debt obligations.',
    },
  ];

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Valuation Intelligence</h3>
          <p className="text-xs text-slate-400">
            Market multiples computed deterministically combining live quotation prices with verified fiscal statements.
          </p>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          <div>Period Base: {ttm ? `TTM (${ttm.periodEndDate})` : `Annual (${latestAnnual.periodEndDate})`}</div>
          {quote && typeof quote.price === 'number' && (
            <div>Price Basis: {currency} {quote.price.toFixed(2)} ({new Date(quote.observedAt).toLocaleDateString()})</div>
          )}
          <div>Currency: <span className="font-semibold text-slate-300">{currency}</span></div>
        </div>
      </div>

      {/* Rules & Transparency Notice */}
      <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200">
        <p>
          <strong>Valuation Multiples Integrity:</strong> Multiples are calculated strictly using verifiable prices and reported statement numbers. No speculative DCF forecasts, price targets, or invented analyst ratings are included. Negative multiples are honestly noted rather than substituted.
        </p>
      </div>

      {/* Valuation Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {valuationCards.map((card) => {
          const { text, isNegative } = formatValuationValue(card.m);
          return (
            <div
              key={card.key}
              onClick={() => setSelectedMetric({ label: card.label, metric: card.m, notes: card.notes })}
              className="cursor-pointer flex flex-col justify-between rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition hover:border-sky-500/40 hover:bg-slate-950/80"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{card.label}</span>
                  {card.m?.formula && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                      fx
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{card.subtitle}</div>

                <div className="mt-3">
                  <span
                    className={`text-2xl font-black font-mono tracking-tight ${
                      isNegative
                        ? 'text-rose-400'
                        : text === 'N/A'
                        ? 'text-slate-500 font-sans text-lg'
                        : 'text-white'
                    }`}
                  >
                    {text}
                  </span>
                  {isNegative && (
                    <span className="ml-2 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                      Negative
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>As of: {card.m?.periodEndDate || 'Latest'}</span>
                <span className="text-sky-400 hover:underline">Formula Details →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Formula Modal / Inspection Drawer */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setSelectedMetric(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-base font-bold text-white">{selectedMetric.label}</h4>
              <button
                onClick={() => setSelectedMetric(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">Calculated Value: </span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatValuationValue(selectedMetric.metric).text}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Deterministic Formula: </span>
                <code className="block mt-1 rounded-xl bg-slate-950 p-2.5 font-mono text-sky-300">
                  {selectedMetric.metric.formula || 'Direct calculation from market inputs'}
                </code>
              </div>
              {selectedMetric.notes && (
                <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3 leading-relaxed text-slate-400">
                  {selectedMetric.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
