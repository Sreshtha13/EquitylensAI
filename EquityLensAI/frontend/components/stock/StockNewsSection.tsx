'use client';

import { useState, useEffect } from 'react';
import { getStockNews } from '@/services/api/news';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsFeedResponse } from '@/types';

export function StockNewsSection({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [data, setData] = useState<NewsFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getStockNews(symbol, exchange, { limit: 15 });
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load news for this stock');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [symbol, exchange]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-white/5 bg-slate-900/40 p-5"
          >
            <div className="h-4 w-28 rounded bg-white/10 mb-3" />
            <div className="h-5 w-full rounded bg-white/10 mb-2" />
            <div className="h-4 w-2/3 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-xs text-rose-300">
        <div className="font-semibold text-sm mb-1">News Unavailable</div>
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
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <h4 className="text-sm font-semibold text-white">No Recent News Found</h4>
        <p className="mt-1 text-xs text-slate-400">
          No verified news articles were found reporting on {symbol} recently.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
        <span>
          Showing verified articles for {symbol} ({exchange})
        </span>
        <span>Source: {data.freshness.provider}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
