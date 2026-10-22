'use client';

import { useState } from 'react';
import { MarketOverviewBar } from '@/components/market/MarketOverviewBar';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { QuoteCard } from '@/components/market/QuoteCard';
import { HistoricalCandles } from '@/components/market/HistoricalCandles';
import type { InstrumentSummary } from '@/types';

export default function MarketPage() {
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; exchange?: string }>({
    symbol: 'RELIANCE',
    exchange: 'NSE',
  });

  const handleSelectInstrument = (item: InstrumentSummary) => {
    setSelectedStock({
      symbol: item.symbol,
      exchange: item.exchange,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* Page Title & Mission */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Phase 2 Market Infrastructure
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Real Market Intelligence
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
          Production-grade market data streaming from verified providers (Angel One SmartAPI & Yahoo
          Finance). Every price, volume, and tick contains strict data provenance with zero mock or
          hallucinated values.
        </p>
      </div>

      {/* Market Overview Ticker */}
      <MarketOverviewBar />

      {/* Search Section */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Search Tradable Universe
        </label>
        <InstrumentSearch onSelect={handleSelectInstrument} selectedSymbol={selectedStock.symbol} />
      </div>

      {/* Active Quote Card */}
      <QuoteCard symbol={selectedStock.symbol} exchange={selectedStock.exchange} />

      {/* Historical Candle Data */}
      <HistoricalCandles symbol={selectedStock.symbol} exchange={selectedStock.exchange} />
    </div>
  );
}
