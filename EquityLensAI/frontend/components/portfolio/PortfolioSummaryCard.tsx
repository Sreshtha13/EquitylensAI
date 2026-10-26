'use client';

import type { PortfolioSummary } from '@equitylensai/shared';

type PortfolioSummaryCardProps = {
  summary?: PortfolioSummary | undefined;
  isLoading?: boolean | undefined;
};

export function PortfolioSummaryCard({ summary, isLoading }: PortfolioSummaryCardProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-xl"
          />
        ))}
      </div>
    );
  }

  const curr = summary.baseCurrency === 'USD' ? '$' : '₹';
  const totalValue = summary.totalPortfolioValue ?? 0;
  const costBasis = summary.totalCostBasis ?? 0;
  const unrealizedPnL = summary.unrealizedPnL ?? 0;
  const unrealizedPercent = summary.unrealizedPnLPercent ?? 0;
  const isPositiveUnrealized = unrealizedPnL >= 0;

  const totalReturn = summary.totalReturn ?? 0;
  const totalReturnPercent = summary.totalReturnPercent ?? 0;
  const isPositiveTotalReturn = totalReturn >= 0;

  const getStatusBadge = () => {
    switch (summary.valuationStatus) {
      case 'complete':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            100% Priced
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {summary.valuationCoveragePercent}% Coverage ({summary.unpricedHoldingsCount} unpriced)
          </span>
        );
      case 'empty':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            Empty Portfolio
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
            Quotes Unavailable
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 4 Primary Summary Metric Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total Portfolio Value */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Portfolio Value
            </span>
            {getStatusBadge()}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl">
              {curr}
              {totalValue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Invested Cost:</span>
            <span className="font-medium text-slate-300">
              {curr}
              {costBasis.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* 2. Unrealized P&L */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Unrealized P&L
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black sm:text-3xl ${
                isPositiveUnrealized ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveUnrealized ? '+' : ''}
              {curr}
              {unrealizedPnL.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Return on Cost:</span>
            <span
              className={`font-semibold ${
                isPositiveUnrealized ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveUnrealized ? '▲ +' : '▼ '}
              {unrealizedPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 3. Realized P&L & Dividends */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Realized Gains & Income
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black sm:text-3xl ${
                summary.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.realizedPnL >= 0 ? '+' : ''}
              {curr}
              {summary.realizedPnL.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Dividend Income:</span>
            <span className="font-medium text-emerald-400">
              +{curr}
              {summary.totalDividends.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* 4. Cash Balance & Total Return */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cash Balance
            </span>
            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
              Available
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl">
              {curr}
              {summary.cashBalance.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Return:</span>
            <span
              className={`font-semibold ${
                isPositiveTotalReturn ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveTotalReturn ? '+' : ''}
              {curr}
              {totalReturn.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ({totalReturnPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Freshness & Compliance Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Last updated: {new Date(summary.lastValuationAt).toLocaleTimeString()}
          </span>
          <span>•</span>
          <span>Holdings: {summary.holdingsCount}</span>
          {summary.totalFees > 0 && (
            <>
              <span>•</span>
              <span>
                Fees: {curr}
                {summary.totalFees.toFixed(2)}
              </span>
            </>
          )}
        </div>
        <span className="italic text-slate-400">
          Portfolio calculations are informational and based on recorded ledger transactions.
        </span>
      </div>
    </div>
  );
}
