'use client';

import { useState } from 'react';
import type { FinancialAnalysis, FinancialMetric } from '@/types';

type FinancialMetricsGridProps = {
  analysis: FinancialAnalysis;
};

type MetricCategory = 'all' | 'profitability' | 'liquidity' | 'leverage' | 'cashFlow' | 'growth' | 'valuation';

function formatMetricValue(m: FinancialMetric | null | undefined): string {
  if (!m || m.value === null || m.value === undefined) return 'N/A';
  switch (m.unit) {
    case 'percent':
      return `${m.value >= 0 ? '' : '-'}${Math.abs(m.value).toFixed(2)}%`;
    case 'ratio':
    case 'x':
      return `${m.value.toFixed(2)}${m.unit === 'x' ? 'x' : ''}`;
    case 'currency':
      if (Math.abs(m.value) >= 1e12) return `${(m.value / 1e12).toFixed(2)}T`;
      if (Math.abs(m.value) >= 1e9) return `${(m.value / 1e9).toFixed(2)}B`;
      if (Math.abs(m.value) >= 1e7) return `${(m.value / 1e7).toFixed(2)} Cr`;
      if (Math.abs(m.value) >= 1e6) return `${(m.value / 1e6).toFixed(2)}M`;
      return m.value.toLocaleString();
    default:
      return m.value.toFixed(2);
  }
}

export function FinancialMetricsGrid({ analysis }: FinancialMetricsGridProps) {
  const [activeCategory, setActiveCategory] = useState<MetricCategory>('all');
  const [activeFormula, setActiveFormula] = useState<string | null>(null);

  const { profitability, liquidity, leverage, cashFlow, growth, valuation } = analysis;

  const categories = [
    {
      id: 'profitability' as const,
      name: 'Profitability',
      badge: 'Margin & Return',
      metrics: [
        { label: 'Gross Margin', m: profitability.grossMargin },
        { label: 'Operating Margin', m: profitability.operatingMargin },
        { label: 'Net Profit Margin', m: profitability.netMargin },
        { label: 'EBITDA Margin', m: profitability.ebitdaMargin },
        { label: 'Return on Equity (ROE)', m: profitability.returnOnEquity },
        { label: 'Return on Assets (ROA)', m: profitability.returnOnAssets },
        { label: 'Return on Capital (ROCE)', m: profitability.returnOnCapitalEmployed },
      ],
    },
    {
      id: 'liquidity' as const,
      name: 'Liquidity',
      badge: 'Short-term Health',
      metrics: [
        { label: 'Current Ratio', m: liquidity.currentRatio },
        { label: 'Quick Ratio', m: liquidity.quickRatio },
        { label: 'Cash Ratio', m: liquidity.cashRatio },
        { label: 'Operating Cash Flow Ratio', m: liquidity.operatingCashFlowRatio },
      ],
    },
    {
      id: 'leverage' as const,
      name: 'Leverage & Solvency',
      badge: 'Debt Structure',
      metrics: [
        { label: 'Debt to Equity', m: leverage.debtToEquity },
        { label: 'Debt to Assets', m: leverage.debtToAssets },
        { label: 'Equity Multiplier', m: leverage.equityMultiplier },
        { label: 'Interest Coverage', m: leverage.interestCoverageRatio },
        { label: 'Net Debt / EBITDA', m: leverage.netDebtToEbitda },
      ],
    },
    {
      id: 'cashFlow' as const,
      name: 'Cash Flow',
      badge: 'Cash Generation',
      metrics: [
        { label: 'Free Cash Flow Margin', m: cashFlow.freeCashFlowMargin },
        { label: 'Free Cash Flow Yield', m: cashFlow.freeCashFlowYield },
        { label: 'OCF to Net Income', m: cashFlow.operatingCashFlowToNetIncome },
        { label: 'CapEx to Revenue', m: cashFlow.capexToRevenue },
      ],
    },
    {
      id: 'growth' as const,
      name: 'Growth (YoY)',
      badge: 'Trajectory',
      metrics: [
        { label: 'Revenue Growth', m: growth.revenueGrowthYoY },
        { label: 'Gross Profit Growth', m: growth.grossProfitGrowthYoY },
        { label: 'Operating Income Growth', m: growth.operatingIncomeGrowthYoY },
        { label: 'Net Income Growth', m: growth.netIncomeGrowthYoY },
        { label: 'EPS Growth', m: growth.epsGrowthYoY },
        { label: 'FCF Growth', m: growth.freeCashFlowGrowthYoY },
        { label: 'Revenue CAGR', m: growth.revenueCAGR },
      ],
    },
    {
      id: 'valuation' as const,
      name: 'Valuation Multiples',
      badge: 'Market Multiples',
      metrics: [
        { label: 'P/E Ratio (TTM)', m: valuation.peRatio },
        { label: 'Price to Book (P/B)', m: valuation.priceToBook },
        { label: 'Price to Sales (P/S)', m: valuation.priceToSales },
        { label: 'EV / EBITDA', m: valuation.evToEbitda },
        { label: 'EV / Revenue', m: valuation.evToRevenue },
        { label: 'Price to Free Cash Flow', m: valuation.priceToFreeCashFlow },
        { label: 'Market Capitalization', m: valuation.marketCap },
        { label: 'Enterprise Value', m: valuation.enterpriseValue },
      ],
    },
  ];

  const visibleCategories =
    activeCategory === 'all'
      ? categories
      : categories.filter((c) => c.id === activeCategory);

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Category Pills Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Deterministic Financial Ratios
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Every ratio is derived via pure mathematical formula with traceable source inputs. Click any card to inspect the formula.
          </p>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-slate-950/60 p-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeCategory === 'all'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Ratios
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === c.id
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ratios Display */}
      <div className="mt-6 space-y-8">
        {visibleCategories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                {cat.name}
              </h4>
              <span className="rounded-md border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {cat.badge}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cat.metrics.map(({ label, m }) => {
                const formatted = formatMetricValue(m);
                const isUnavailable = formatted === 'N/A';
                const isSelected = activeFormula === label;

                return (
                  <div
                    key={label}
                    onClick={() => setActiveFormula(isSelected ? null : label)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? 'border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                        : 'border-white/5 bg-slate-950/40 hover:border-white/15 hover:bg-slate-950/70'
                    }`}
                  >
                    <div className="text-xs text-slate-400">{label}</div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span
                        className={`text-lg font-bold sm:text-xl ${
                          isUnavailable
                            ? 'text-slate-500 italic text-sm'
                            : 'text-white'
                        }`}
                      >
                        {formatted}
                      </span>
                      {m?.periodEndDate && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.periodEndDate.slice(0, 4)}
                        </span>
                      )}
                    </div>

                    {/* Formula popup/preview */}
                    {isSelected && m?.formula && (
                      <div className="mt-3 border-t border-sky-500/20 pt-2 text-[10px] text-sky-300/90 font-mono">
                        <span className="font-semibold text-sky-400">Formula:</span> {m.formula}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
