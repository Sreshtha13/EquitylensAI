'use client';

import { useRouter } from 'next/navigation';
import { MarketIndicesTicker } from '@/components/market/MarketIndicesTicker';
import { MarketBreadthCard } from '@/components/market/MarketBreadthCard';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { MarketMoversSection } from '@/components/market/MarketMoversSection';
import { MostActiveSection } from '@/components/market/MostActiveSection';
import { PlatformPopularitySection } from '@/components/market/PlatformPopularitySection';
import { SectorPerformanceGrid } from '@/components/market/SectorPerformanceGrid';
import { MarketDiscoveryTabs } from '@/components/market/MarketDiscoveryTabs';
import type { InstrumentSummary } from '@/types';

export default function MarketIntelligenceDashboard() {
  const router = useRouter();

  const handleSelectStock = (stock: InstrumentSummary) => {
    // Navigate directly to the dedicated institutional stock research page
    router.push(`/stocks/${encodeURIComponent(stock.exchange)}/${encodeURIComponent(stock.symbol)}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 py-8">
      {/* Top Header & Search Hero */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Live Market Intelligence Terminal
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Indian & Global Markets
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Market-wide discovery across 13,600+ reconciled NSE and BSE equities. Verified data feeds,
            volume shockers, breadth dynamics, and platform community engagement.
          </p>
        </div>

        {/* Global Security Search Bar */}
        <div className="w-full lg:w-96 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Search 13,600+ NSE & BSE Universe
          </label>
          <InstrumentSearch onSelect={handleSelectStock} />
        </div>
      </div>

      {/* 1. Market Indices Header Ticker */}
      <MarketIndicesTicker />

      {/* 2. Market Breadth & Sentiment Snapshot */}
      <MarketBreadthCard />

      {/* 3, 4, 5. Top Gainers, Top Losers, and Volume Shockers */}
      <MarketMoversSection />

      {/* 6. Most Active by Volume & Turnover */}
      <MostActiveSection />

      {/* 7 & 8. Most Watched on EquityLensAI & Trending Stocks */}
      <PlatformPopularitySection />

      {/* 9. Sector Performance Heatmap & Constituents */}
      <SectorPerformanceGrid />

      {/* 10. Market Discovery (52W Highs/Lows, Circuits, New Listings) */}
      <MarketDiscoveryTabs />
    </div>
  );
}
