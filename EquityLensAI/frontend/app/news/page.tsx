'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMarketNews } from '@/services/api/news';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsItem, NewsFeedResponse } from '@/types';

const CATEGORIES = [
  { id: '', label: 'All News' },
  { id: 'Market News', label: 'Markets & Equities' },
  { id: 'Quarterly Earnings', label: 'Earnings' },
  { id: 'Economy', label: 'Macro & Economy' },
  { id: 'Banking', label: 'Banking & Finance' },
  { id: 'IT Technology', label: 'Tech & IT' },
];

export default function MarketNewsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newsResponse, setNewsResponse] = useState<NewsFeedResponse | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async (category: string, pageNum: number, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const data = await getMarketNews({
        category: category || undefined,
        limit: 20,
        page: pageNum,
      });

      setNewsResponse(data);
      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load market news');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadNews(selectedCategory, 1, false);
  }, [selectedCategory, loadNews]);

  const handleLoadMore = () => {
    if (newsResponse?.pagination.hasMore && !isLoadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadNews(selectedCategory, nextPage, true);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page Title & Provenance Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
              Live Verified Feed
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Market News & Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time verified reporting from reputable financial publishers. No fabricated news.
          </p>
        </div>

        {newsResponse?.freshness && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-300">
            <svg
              className="h-4 w-4 text-sky-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <span className="text-slate-400">Source: </span>
              <span className="font-medium text-slate-200">{newsResponse.freshness.provider}</span>
            </div>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/25'
                : 'border border-white/10 bg-slate-900 text-slate-300 hover:border-white/20 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-sm text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadNews(selectedCategory, page, false)}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-white/5 bg-slate-900/40 p-5"
            >
              <div className="h-4 w-32 rounded bg-white/10 mb-4" />
              <div className="h-6 w-full rounded bg-white/10 mb-2" />
              <div className="h-6 w-3/4 rounded bg-white/10 mb-4" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-500"
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
          <h3 className="mt-3 text-base font-semibold text-white">No News Items Available</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            No verified news items were returned for the selected filter from the provider.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>

          {newsResponse?.pagination.hasMore && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More News</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
