'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CompanyComparisonResult, CompanyComparisonMetricRow } from '@equitylensai/shared';

type ComparisonTableProps = {
  result: CompanyComparisonResult;
  onRemoveCompany?: (symbol: string) => void;
};

export function ComparisonTable({ result, onRemoveCompany }: ComparisonTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const categories = [
    'All',
    'Valuation',
    'Profitability',
    'Growth',
    'Financial Strength',
    'Cash Flow',
    'Health',
  ];

  const filteredMetrics =
    selectedCategory === 'All'
      ? result.metricsRows
      : result.metricsRows.filter((m) => m.category.toLowerCase() === selectedCategory.toLowerCase());

  const formatValue = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-500 font-mono">—</span>;
    }

    switch (unit) {
      case 'percent':
        return (
          <span className={`font-mono font-medium ${value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {value.toFixed(2)}%
          </span>
        );
      case 'ratio':
        return <span className="font-mono text-slate-200">{value.toFixed(2)}x</span>;
      case 'score':
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
              value >= 70
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : value >= 50
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {value} / 100
          </span>
        );
      case 'currency':
        return (
          <span className="font-mono text-slate-200">
            {value >= 1e7 ? `₹${(value / 1e7).toFixed(2)} Cr` : `₹${value.toLocaleString()}`}
          </span>
        );
      default:
        return <span className="font-mono text-slate-200">{value.toLocaleString()}</span>;
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400">
          Period: <span className="uppercase font-semibold text-sky-400">{result.period}</span> ({result.scope})
        </div>
      </div>

      {/* Comparison Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-xs text-slate-400">
              <th className="py-3 px-4 font-semibold w-64 min-w-[16rem]">Company / Metric</th>
              {result.companies.map((c) => (
                <th key={c.symbol} className="py-3 px-4 font-semibold min-w-[14rem]">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/stocks/${c.exchange.toLowerCase()}/${encodeURIComponent(c.symbol)}`}
                      className="group flex flex-col"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white group-hover:text-sky-400 transition">
                          {c.symbol}
                        </span>
                        <span className="rounded bg-white/10 px-1 py-0.2 text-[10px] text-slate-300">
                          {c.exchange}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-[12rem]">
                        {c.name}
                      </span>
                    </Link>
                    {onRemoveCompany && (
                      <button
                        onClick={() => onRemoveCompany(c.symbol)}
                        className="text-slate-500 hover:text-rose-400 text-sm ml-2 transition"
                        title="Remove from comparison"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {/* Overview Rows */}
            <tr className="bg-slate-950/40">
              <td className="py-2.5 px-4 font-medium text-slate-400">Sector & Industry</td>
              {result.companies.map((c) => (
                <td key={c.symbol} className="py-2.5 px-4">
                  <div className="text-[11px] text-slate-200 font-medium">{c.sector || '—'}</div>
                  <div className="text-[10px] text-slate-400 truncate">{c.industry || '—'}</div>
                </td>
              ))}
            </tr>

            <tr className="bg-slate-950/40">
              <td className="py-2.5 px-4 font-medium text-slate-400">Market Capitalization</td>
              {result.companies.map((c) => (
                <td key={c.symbol} className="py-2.5 px-4 font-mono text-slate-200">
                  {c.marketCap !== null && c.marketCap !== undefined ? (
                    c.currency === 'INR' ? (
                      `₹${Math.round(c.marketCap / 1e7).toLocaleString()} Cr`
                    ) : (
                      `$${Math.round(c.marketCap / 1e6).toLocaleString()} M`
                    )
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              ))}
            </tr>

            <tr className="bg-slate-950/40">
              <td className="py-2.5 px-4 font-medium text-slate-400">Latest Eligible Price</td>
              {result.companies.map((c) => (
                <td key={c.symbol} className="py-2.5 px-4">
                  {c.price !== null && c.price !== undefined ? (
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-semibold text-white">
                        {c.currency === 'INR' ? '₹' : '$'}
                        {c.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      {c.isStale && (
                        <span className="rounded bg-amber-500/10 px-1 text-[9px] text-amber-400 border border-amber-500/20">
                          Stale
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 font-mono">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Metric Rows */}
            {filteredMetrics.map((m: CompanyComparisonMetricRow) => {
              const rowValues = result.companies.map((c) => m.values[c.symbol]);
              const validNums = rowValues.filter(
                (v): v is number => typeof v === 'number' && !Number.isNaN(v),
              );
              const maxVal = validNums.length > 1 ? Math.max(...validNums) : null;
              const minVal = validNums.length > 1 ? Math.min(...validNums) : null;

              return (
                <tr key={m.metricId} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4 relative">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{m.label}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTooltip(activeTooltip === m.metricId ? null : m.metricId)
                        }
                        className="rounded-full bg-white/10 px-1.5 text-[10px] text-slate-400 hover:text-white"
                        title="Metric details"
                      >
                        ?
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500">{m.category}</div>

                    {/* Metric Description Tooltip */}
                    {activeTooltip === m.metricId && (
                      <div className="absolute left-4 top-full z-20 mt-1 max-w-sm rounded-lg border border-white/10 bg-slate-800 p-3 shadow-xl text-[11px] text-slate-300 backdrop-blur-md">
                        <div className="font-semibold text-white mb-1">{m.label}</div>
                        <div>{m.description}</div>
                        <div className="mt-1 text-[10px] text-slate-400">Unit: {m.unit}</div>
                      </div>
                    )}
                  </td>

                  {result.companies.map((c) => {
                    const val = m.values[c.symbol];
                    const isMax = maxVal !== null && val === maxVal;
                    const isMin = minVal !== null && val === minVal;

                    return (
                      <td key={c.symbol} className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {formatValue(val, m.unit)}
                          {isMax && (
                            <span
                              className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-400 font-mono"
                              title="Highest in comparison group"
                            >
                              high
                            </span>
                          )}
                          {isMin && (
                            <span
                              className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono"
                              title="Lowest in comparison group"
                            >
                              low
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 space-y-1">
          <div className="text-xs font-semibold text-amber-300">Data Coverage & Notice</div>
          {result.warnings.map((w, idx) => (
            <div key={idx} className="text-[11px] text-amber-200/80">
              • {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
