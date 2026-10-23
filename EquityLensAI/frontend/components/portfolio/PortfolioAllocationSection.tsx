'use client';

import type { PortfolioAllocation } from '@equitylensai/shared';

type PortfolioAllocationSectionProps = {
  allocation?: PortfolioAllocation | undefined;
  baseCurrency?: string | undefined;
  isLoading?: boolean | undefined;
};

const SECTOR_COLORS = [
  '#38bdf8', // sky
  '#818cf8', // indigo
  '#c084fc', // purple
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // rose
  '#2dd4bf', // teal
  '#a78bfa', // violet
  '#94a3b8', // slate
];

export function PortfolioAllocationSection({
  allocation,
  baseCurrency = 'INR',
  isLoading,
}: PortfolioAllocationSectionProps) {
  const curr = baseCurrency === 'USD' ? '$' : '₹';

  if (isLoading || !allocation) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-pulse">
        <div className="h-64 rounded-2xl border border-white/10 bg-slate-900/60 p-6" />
        <div className="h-64 rounded-2xl border border-white/10 bg-slate-900/60 p-6" />
      </div>
    );
  }

  const assetAllocation = allocation.assetAllocation || [];
  const sectorAllocation = allocation.sectorAllocation || [];
  const concentration = allocation.concentration;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Asset Class Allocation */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Asset Class Allocation
            </h3>
            <p className="text-xs text-slate-400">Equities, ETFs, and Cash balance breakdown</p>
          </div>
        </div>

        {assetAllocation.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No assets available to allocate.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {assetAllocation.map((item, idx) => {
              const color = SECTOR_COLORS[idx % SECTOR_COLORS.length];
              return (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{item.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        {curr}
                        {item.marketValue.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="font-bold text-white">{item.percentage}%</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Sector Allocation & Concentration */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Sector Exposure & Diversification
            </h3>
            <p className="text-xs text-slate-400">
              Verified corporate sector classifications ({allocation.sectorCoveragePercent}% coverage)
            </p>
          </div>
        </div>

        {/* Concentration Badges */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Top Holding Weight
            </span>
            <div className="mt-0.5 text-base font-black text-white">
              {concentration.topHoldingWeight !== null ? `${concentration.topHoldingWeight}%` : '—'}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Top 5 Holdings Weight
            </span>
            <div className="mt-0.5 text-base font-black text-white">
              {concentration.top5HoldingsWeight !== null
                ? `${concentration.top5HoldingsWeight}%`
                : '—'}
            </div>
          </div>
        </div>

        {/* Sectors List */}
        {sectorAllocation.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No sector data available.
          </div>
        ) : (
          <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-none">
            {sectorAllocation.map((sec, idx) => {
              const color = SECTOR_COLORS[idx % SECTOR_COLORS.length];
              return (
                <div key={sec.sector} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{sec.sector}</span>
                    <span className="font-bold text-white">{sec.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${sec.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
