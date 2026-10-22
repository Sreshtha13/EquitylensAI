'use client';

import { useState, useEffect } from 'react';
import { getWatchlistNews } from '@/services/api/news';
import { NewsCard } from '@/components/news/NewsCard';
import type { WatchlistNewsResponse } from '@/types';

export function WatchlistNewsSection() {
  const [data, setData] = useState<WatchlistNewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getWatchlistNews({ limit: 20 });
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load news for your watchlists');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-white/5 bg-slate-900/40 p-5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-300">
        {error}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    const watched = data?.symbolsWatched || [];
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-xs text-slate-400">
        {watched.length === 0 ? (
          <p>Add stocks to your watchlists or favorites to see relevant market news here.</p>
        ) : (
          <p>No recent news found for your tracked stocks ({watched.join(', ')}).</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Aggregated news for {data.symbolsWatched.length} watched symbol
          {data.symbolsWatched.length === 1 ? '' : 's'}:{' '}
          <span className="font-semibold text-slate-300">
            {data.symbolsWatched.slice(0, 8).join(', ')}
            {data.symbolsWatched.length > 8 ? '...' : ''}
          </span>
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-sky-400 font-medium">
          Deduplicated
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
