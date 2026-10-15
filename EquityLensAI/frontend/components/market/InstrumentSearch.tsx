'use client';

import { useState, useEffect, useRef } from 'react';
import { useStockSearch } from '@/hooks/useMarket';
import type { InstrumentSummary, Market } from '@/types';

type InstrumentSearchProps = {
  onSelect: (instrument: InstrumentSummary) => void;
  selectedSymbol?: string;
};

export function InstrumentSearch({ onSelect, selectedSymbol }: InstrumentSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<Market | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 250ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading } = useStockSearch(debouncedQuery, {
    market: marketFilter,
    limit: 12,
    enabled: debouncedQuery.length >= 1,
  });

  const handleSelect = (item: InstrumentSummary) => {
    onSelect(item);
    setSearchTerm(item.symbol);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-4 text-slate-400">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search symbols or companies (e.g. RELIANCE, TCS, INFY, AAPL, NVDA)..."
          className="w-full rounded-2xl border border-white/10 bg-slate-900/90 py-3.5 pl-11 pr-24 text-sm text-white placeholder-slate-500 shadow-inner backdrop-blur-md outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
        />

        {/* Clear button */}
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setIsOpen(false);
            }}
            className="absolute right-4 text-xs text-slate-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && debouncedQuery.length >= 1 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
          {/* Quick Filter Bar */}
          <div className="flex items-center gap-2 border-b border-white/5 bg-slate-950/60 px-4 py-2 text-xs">
            <span className="text-slate-400">Market:</span>
            <button
              onClick={() => setMarketFilter(undefined)}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                marketFilter === undefined
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMarketFilter('nse')}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                marketFilter === 'nse'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              NSE (India)
            </button>
            <button
              onClick={() => setMarketFilter('us')}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                marketFilter === 'us'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              US
            </button>
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5 p-1">
            {isLoading && (
              <div className="p-4 text-center text-xs text-slate-400">
                Searching verified instruments universe...
              </div>
            )}

            {!isLoading && (!data || data.items.length === 0) && (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching instruments found for &quot;{debouncedQuery}&quot;
              </div>
            )}

            {data?.items.map((item) => {
              const isSelected = selectedSymbol === item.symbol;
              return (
                <button
                  key={`${item.exchange}:${item.symbol}`}
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                    isSelected ? 'bg-sky-500/10 text-sky-200' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-xs font-bold text-sky-400">
                      {item.symbol}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.exchange} • {item.currency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-300">
                      {item.assetType}
                    </span>
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      {item.market}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
