'use client';

import { useState, useEffect, useRef } from 'react';
import type { ComparisonCompanyTarget, SuggestedPeer } from '@equitylensai/shared';
import { searchStocks } from '@/services/api/market';
import { getSuggestedPeers } from '@/services/api/compare';

type CompanySelectorProps = {
  selectedCompanies: ComparisonCompanyTarget[];
  onAddCompany: (target: ComparisonCompanyTarget) => void;
  onRemoveCompany: (symbol: string) => void;
  maxCompanies?: number;
};

export function CompanySelector({
  selectedCompanies,
  onAddCompany,
  onRemoveCompany,
  maxCompanies = 5,
}: CompanySelectorProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; exchange: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestedPeers, setSuggestedPeers] = useState<SuggestedPeer[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [peerMethod, setPeerMethod] = useState<string | null>(null);
  const [peerWarning, setPeerWarning] = useState<string | null>(null);
  const [showPeerModal, setShowPeerModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await searchStocks(query.trim(), { limit: 10 });
        if (resp && resp.items) {
          const mapped = resp.items.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            exchange: r.exchange || 'NSE',
          }));
          setSearchResults(mapped);
          setDropdownOpen(true);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Load suggested peers for the primary selected company
  const loadPeers = async () => {
    if (selectedCompanies.length === 0) return;
    const base = selectedCompanies[0]!;
    setLoadingPeers(true);
    setShowPeerModal(true);
    setPeerWarning(null);
    try {
      const res = await getSuggestedPeers(base.symbol, base.exchange);
      setSuggestedPeers(res.peers || []);
      setPeerMethod(res.matchingMethod);
      if (res.warnings && res.warnings.length > 0) {
        setPeerWarning(res.warnings[0]!);
      }
    } catch {
      setSuggestedPeers([]);
      setPeerWarning('Could not discover peers for this company.');
    } finally {
      setLoadingPeers(false);
    }
  };

  const isSelected = (sym: string) =>
    selectedCompanies.some((c) => c.symbol.toUpperCase() === sym.toUpperCase());

  const isMaxReached = selectedCompanies.length >= maxCompanies;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Compare Companies</h2>
          <p className="text-xs text-slate-400">
            Select 2 to {maxCompanies} NSE/BSE listed companies for side-by-side fundamental & valuation analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              selectedCompanies.length < 2
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {selectedCompanies.length} / {maxCompanies} selected
          </span>
          {selectedCompanies.length > 0 && !isMaxReached && (
            <button
              onClick={loadPeers}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 transition hover:bg-sky-500/20"
            >
              <span>✨</span>
              <span>Find Peers</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Company Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedCompanies.map((c) => (
          <div
            key={c.symbol}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800/80 px-3 py-1.5 shadow-sm transition hover:border-sky-500/40"
          >
            <span className="text-xs font-bold text-sky-400">{c.symbol}</span>
            <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] uppercase font-medium text-slate-300">
              {c.exchange}
            </span>
            <button
              type="button"
              onClick={() => onRemoveCompany(c.symbol)}
              title={`Remove ${c.symbol}`}
              className="ml-1 text-slate-400 hover:text-rose-400 transition text-sm leading-none"
            >
              ×
            </button>
          </div>
        ))}

        {selectedCompanies.length === 0 && (
          <div className="text-xs text-slate-400 italic">
            No companies selected yet. Search and add at least two companies to compare.
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setDropdownOpen(true);
            }}
            disabled={isMaxReached}
            placeholder={
              isMaxReached
                ? `Maximum limit of ${maxCompanies} companies reached`
                : 'Search by symbol or company name (e.g. TCS, INFY, RELIANCE)...'
            }
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
          />
          {isSearching && (
            <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-pulse">
              Searching...
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {dropdownOpen && searchResults.length > 0 && !isMaxReached && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-slate-900 shadow-xl backdrop-blur-md">
            {searchResults.map((r) => {
              const alreadySelected = isSelected(r.symbol);
              return (
                <div
                  key={`${r.exchange}:${r.symbol}`}
                  onClick={() => {
                    if (!alreadySelected) {
                      onAddCompany({ symbol: r.symbol, exchange: r.exchange });
                      setQuery('');
                      setDropdownOpen(false);
                    }
                  }}
                  className={`flex items-center justify-between px-4 py-2.5 text-xs transition cursor-pointer ${
                    alreadySelected
                      ? 'bg-white/5 opacity-50 cursor-not-allowed text-slate-400'
                      : 'hover:bg-sky-500/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sky-400">{r.symbol}</span>
                    <span className="text-slate-400 truncate max-w-xs">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {r.exchange}
                    </span>
                    {alreadySelected ? (
                      <span className="text-[10px] text-amber-400">Added</span>
                    ) : (
                      <span className="text-[10px] text-sky-400 hover:underline">+ Add</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested Peers Modal / Flyout */}
      {showPeerModal && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-300">
                Peer Discovery for {selectedCompanies[0]?.symbol}
              </span>
              {peerMethod && (
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300 capitalize">
                  {peerMethod.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowPeerModal(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          {loadingPeers ? (
            <div className="py-2 text-xs text-slate-400 animate-pulse">
              Scanning verified industry metadata for comparable peers...
            </div>
          ) : peerWarning && suggestedPeers.length === 0 ? (
            <div className="text-xs text-amber-300/90">{peerWarning}</div>
          ) : suggestedPeers.length === 0 ? (
            <div className="text-xs text-slate-400">No peers found matching the verified classification.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {suggestedPeers.map((p) => {
                const alreadySelected = isSelected(p.symbol);
                return (
                  <button
                    key={p.symbol}
                    disabled={alreadySelected || isMaxReached}
                    onClick={() => {
                      onAddCompany({ symbol: p.symbol, exchange: p.exchange });
                    }}
                    className={`flex flex-col text-left p-2.5 rounded-lg border transition ${
                      alreadySelected
                        ? 'border-white/5 bg-slate-900/40 opacity-50 cursor-not-allowed'
                        : 'border-white/10 bg-slate-900/80 hover:border-sky-500/50 hover:bg-slate-800/90'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-sky-400">{p.symbol}</span>
                      <span className="text-[10px] rounded bg-white/10 px-1 text-slate-300">
                        {p.exchange}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-200 truncate">{p.name}</span>
                    <span className="text-[10px] text-emerald-400 mt-1">{p.matchRationale}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
