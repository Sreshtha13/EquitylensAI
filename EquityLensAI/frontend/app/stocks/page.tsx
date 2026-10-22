'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import type { InstrumentSummary } from '@/types';

export default function StocksIndexPage() {
  const router = useRouter();

  const handleSelectStock = (item: InstrumentSummary) => {
    router.push(`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`);
  };

  const featuredStocks = [
    { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries Ltd.', sector: 'Energy & Petrochemicals' },
    { symbol: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services Ltd.', sector: 'Information Technology' },
    { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank Ltd.', sector: 'Financial Services' },
    { symbol: 'INFY', exchange: 'NSE', name: 'Infosys Ltd.', sector: 'Information Technology' },
    { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank Ltd.', sector: 'Financial Services' },
    { symbol: 'BHARTIARTL', exchange: 'NSE', name: 'Bharti Airtel Ltd.', sector: 'Telecommunications' },
    { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.', sector: 'Technology & Hardware' },
    { symbol: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corporation', sector: 'Software & Cloud' },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Company Intelligence & Stock Research
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Search Listed Companies
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
          Access verified company intelligence, live quotes, interactive OHLCV charts, multi-year audited financial statements, deterministic ratios, valuation multiples, and Gemini-powered research.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="w-full max-w-xl">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
          Search Security by Ticker or Name
        </label>
        <InstrumentSearch onSelect={handleSelectStock} />
      </div>

      {/* Featured Equities Directory */}
      <div className="mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Featured Bluechips & Equities
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredStocks.map((stock) => (
            <Link
              key={`${stock.exchange}:${stock.symbol}`}
              href={`/stocks/${stock.exchange}/${stock.symbol}`}
              className="flex flex-col justify-between rounded-2xl border border-white/5 bg-slate-900/60 p-4 transition hover:border-sky-500/30 hover:bg-slate-800/60 shadow-lg backdrop-blur-xl"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-white">{stock.symbol}</span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                    {stock.exchange}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-300 truncate">{stock.name}</div>
                <div className="mt-2 text-[11px] text-slate-500">{stock.sector}</div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-2 text-[11px] font-semibold text-sky-400 flex items-center justify-between">
                <span>View Full Intelligence</span>
                <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
