'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listFavorites, addFavorite, removeFavorite } from '@/services/api/favorites';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { CreateAlertModal } from '../alerts/CreateAlertModal';
import { TransactionModal } from '../portfolio/TransactionModal';
import type { CompanyProfile, NormalizedQuote, SupportedExchange } from '@equitylensai/shared';

type StockHeaderProps = {
  symbol: string;
  exchange: string;
  profile?: CompanyProfile | undefined;
  quote?: NormalizedQuote | undefined;
  isLoadingQuote?: boolean;
  isRefetchingQuote?: boolean;
  quoteError?: Error | null;
  onRefreshQuote?: () => void;
};

export function StockHeader({
  symbol,
  exchange,
  profile,
  quote,
  isLoadingQuote,
  isRefetchingQuote,
  quoteError,
  onRefreshQuote,
}: StockHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: listFavorites,
    enabled: isAuthenticated,
  });

  const isFavorite = favorites.some(
    (f) =>
      f.symbol.toUpperCase() === symbol.toUpperCase() &&
      (!exchange || f.exchange.toUpperCase() === exchange.toUpperCase()),
  );

  const handleFavoriteClick = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const targetExchange = (exchange || 'NSE') as SupportedExchange;
    if (isFavorite) {
      await removeFavorite(symbol, targetExchange);
    } else {
      await addFavorite(symbol, targetExchange);
    }
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
  };

  const currencySymbol = quote?.currency === 'INR' || profile?.currency === 'INR' ? '₹' : '$';
  const isPositive = (quote?.change ?? 0) >= 0;
  const displayName = profile?.name || quote?.name || symbol;

  return (
    <div className="relative w-full rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Top Bar: Identity, Exchange, Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{symbol}</h1>

            {/* Favorite Star Button */}
            <button
              type="button"
              onClick={handleFavoriteClick}
              className="p-1 text-slate-400 hover:text-amber-400 transition"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg
                className={`h-6 w-6 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`}
                viewBox="0 0 20 20"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>
            </button>

            {/* Exchange Badge */}
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400">
              {exchange}
            </span>

            {/* Market & Sector Badge */}
            {profile?.sector && (
              <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                {profile.sector}
              </span>
            )}

            {isRefetchingQuote && (
              <span
                className="inline-flex h-2 w-2 animate-ping rounded-full bg-sky-400"
                title="Updating quote..."
              />
            )}
          </div>

          <h2 className="mt-1 text-base font-medium text-slate-300 sm:text-lg">{displayName}</h2>

          {profile?.isin && (
            <div className="mt-1 text-xs font-mono text-slate-500">
              ISIN: <span className="text-slate-400">{profile.isin}</span>
            </div>
          )}
        </div>

        {/* Action Controls & Provenance Badge */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWatchlistModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow hover:bg-slate-700 hover:text-white transition"
            >
              <svg
                className="h-4 w-4 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Add to Watchlist</span>
            </button>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  router.push(`/login?redirect=/stocks/${exchange}/${symbol}`);
                  return;
                }
                setAlertModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow hover:bg-slate-700 hover:text-white transition"
            >
              <svg
                className="h-4 w-4 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span>Set Alert</span>
            </button>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  router.push(`/login?redirect=/stocks/${exchange}/${symbol}`);
                  return;
                }
                setPortfolioModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-300 shadow hover:bg-sky-500/20 hover:text-white transition"
            >
              <svg
                className="h-4 w-4 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span>Add to Portfolio</span>
            </button>

            <Link
              href={`/compare?symbols=${encodeURIComponent(`${symbol}:${exchange || 'NSE'}`)}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow hover:bg-slate-700 hover:text-white transition"
              title="Compare with peers on Workbench"
            >
              <span className="text-sky-400 font-bold">⚖️</span>
              <span>Compare</span>
            </Link>

            {onRefreshQuote && (
              <button
                onClick={onRefreshQuote}
                disabled={isLoadingQuote || isRefetchingQuote}
                className="rounded-xl border border-white/10 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition"
                title="Refresh quote"
                aria-label="Refresh quote"
              >
                <svg
                  className={`h-4 w-4 ${isRefetchingQuote ? 'animate-spin text-sky-400' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Freshness & Provenance Pill */}
          {quote && (
            <div className="flex flex-col items-end gap-1">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  quote.freshness === 'live'
                    ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/10'
                    : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    quote.freshness === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="capitalize">{quote.freshness}</span>
                <span className="opacity-60">•</span>
                <span>{quote.source === 'angel' ? 'Angel One SmartAPI' : 'Yahoo Finance'}</span>
              </div>

              {quote.isStale && (
                <span className="text-[11px] font-medium text-amber-400">
                  Cached observation (stale)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Quote Price Hero */}
      {isLoadingQuote ? (
        <div className="mt-6 flex animate-pulse items-baseline gap-4">
          <div className="h-12 w-44 rounded-xl bg-slate-800" />
          <div className="h-8 w-28 rounded-xl bg-slate-800" />
        </div>
      ) : quoteError || !quote ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-300">
          <span className="font-semibold">Live quote currently unavailable.</span>{' '}
          {quoteError?.message ||
            'Market quote feed is temporarily unreachable from connected providers. Fundamentals and historical charts remain operational.'}
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline gap-4">
            <div className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl font-mono">
              {quote.price !== null
                ? `${currencySymbol}${quote.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '—'}
            </div>

            {quote.change !== null && (
              <div
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-bold font-mono ${
                  isPositive
                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'
                }`}
              >
                <span>{isPositive ? '▲' : '▼'}</span>
                <span>{Math.abs(quote.change).toFixed(2)}</span>
                <span className="opacity-80">
                  ({quote.changePercent !== null ? Math.abs(quote.changePercent).toFixed(2) : 0}%)
                </span>
              </div>
            )}
          </div>

          {/* Quick Statistics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Open
              </div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                {quote.open !== null ? `${currencySymbol}${quote.open.toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Day High
              </div>
              <div className="mt-1 text-sm font-bold text-emerald-400 font-mono">
                {quote.high !== null ? `${currencySymbol}${quote.high.toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Day Low
              </div>
              <div className="mt-1 text-sm font-bold text-rose-400 font-mono">
                {quote.low !== null ? `${currencySymbol}${quote.low.toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Prev Close
              </div>
              <div className="mt-1 text-sm font-bold text-slate-200 font-mono">
                {quote.previousClose !== null
                  ? `${currencySymbol}${quote.previousClose.toFixed(2)}`
                  : '—'}
              </div>
            </div>

            <div className="col-span-2 rounded-2xl border border-white/5 bg-slate-950/50 p-3.5 sm:col-span-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Volume
              </div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                {quote.volume !== null ? quote.volume.toLocaleString() : '—'}
              </div>
            </div>
          </div>

          {/* Timestamps Provenance Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              Quote Timestamp:{' '}
              <span className="text-slate-400">{new Date(quote.observedAt).toLocaleString()}</span>
            </div>
            <div>
              Retrieved:{' '}
              <span className="text-slate-400">
                {new Date(quote.retrievedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add To Watchlist Modal */}
      <AddToWatchlistModal
        symbol={symbol}
        exchange={exchange}
        isOpen={watchlistModalOpen}
        onClose={() => setWatchlistModalOpen(false)}
      />

      {/* Set Alert Modal */}
      <CreateAlertModal
        initialSymbol={symbol}
        initialExchange={(exchange || 'NSE') as SupportedExchange}
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
      />

      {/* Add To Portfolio Modal */}
      <TransactionModal
        initialSymbol={symbol}
        initialExchange={exchange}
        initialPrice={quote?.price ?? undefined}
        isOpen={portfolioModalOpen}
        onClose={() => setPortfolioModalOpen(false)}
      />
    </div>
  );
}
