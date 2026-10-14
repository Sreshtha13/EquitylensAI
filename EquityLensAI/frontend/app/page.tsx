import Link from 'next/link';
import { ApiStatus } from '@/components/common/ApiStatus';
import { PageShell } from '@/components/common/PageShell';
import { MarketOverviewBar } from '@/components/market/MarketOverviewBar';

export default function HomePage() {
  return (
    <PageShell
      title="EquityLensAI"
      description="Production-grade AI equity research and market intelligence platform. Phase 2 introduces genuine live market data infrastructure backed by Angel One SmartAPI and Yahoo Finance with rigorous data provenance."
    >
      <div className="flex flex-col gap-8">
        {/* Call to action for Phase 2 Market Dashboard */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 via-slate-900/60 to-slate-950 p-6 shadow-xl backdrop-blur-md">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/20 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
              Live Market Data Active
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">
              Explore Live Market Tickers & Quotes
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              Search equities and indices across Indian and US exchanges. Inspect OHLCV statistics,
              candlestick history, and strict provenance records.
            </p>
          </div>

          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 active:scale-95"
          >
            Open Market Terminal →
          </Link>
        </div>

        {/* Live Overview Bar */}
        <MarketOverviewBar />

        {/* System Health Status */}
        <ApiStatus />
      </div>
    </PageShell>
  );
}
