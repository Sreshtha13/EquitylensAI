'use client';

import { useState, useEffect } from 'react';
import { getStockAnnouncements } from '@/services/api/news';
import { AnnouncementCard } from '@/components/news/AnnouncementCard';
import type { AnnouncementsFeedResponse } from '@/types';

export function StockAnnouncementsSection({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: string;
}) {
  const [data, setData] = useState<AnnouncementsFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getStockAnnouncements(symbol, exchange, { limit: 15 });
        setData(res);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load official announcements for this stock',
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [symbol, exchange]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-white/5 bg-slate-900/40 p-5"
          >
            <div className="h-4 w-40 rounded bg-white/10 mb-2" />
            <div className="h-5 w-3/4 rounded bg-white/10 mb-2" />
            <div className="h-4 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-xs text-rose-300">
        <div className="font-semibold text-sm mb-1">Exchange Disclosures Unavailable</div>
        <p>{error}</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center">
        <svg
          className="mx-auto h-10 w-10 text-slate-500 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h4 className="text-sm font-semibold text-white">No Corporate Disclosures Found</h4>
        <p className="mt-1 text-xs text-slate-400">
          No official filings were found for {symbol} on {exchange}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
        <span>
          Official filings submitted by {symbol} to {exchange}
        </span>
        <span>Provider: {data.freshness.provider}</span>
      </div>

      <div className="space-y-4">
        {data.items.map((item) => (
          <AnnouncementCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
