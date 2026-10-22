'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAnnouncements } from '@/services/api/news';
import { AnnouncementCard } from '@/components/news/AnnouncementCard';
import type {
  CorporateAnnouncement,
  AnnouncementsFeedResponse,
  AnnouncementCategory,
} from '@/types';

const ANNOUNCEMENT_CATEGORIES_LIST: Array<{ id: AnnouncementCategory | ''; label: string }> = [
  { id: '', label: 'All Disclosures' },
  { id: 'financial_results', label: 'Financial Results' },
  { id: 'board_meetings', label: 'Board Meetings' },
  { id: 'dividend', label: 'Dividends' },
  { id: 'bonus_issue', label: 'Bonus & Splits' },
  { id: 'fundraising', label: 'Fundraising' },
  { id: 'shareholding_pattern', label: 'Shareholding' },
  { id: 'management_changes', label: 'Management' },
  { id: 'regulatory', label: 'Regulatory / SEBI' },
  { id: 'updates', label: 'Company Updates' },
];

export default function AnnouncementsFeedPage() {
  const [selectedCategory, setSelectedCategory] = useState<AnnouncementCategory | ''>('');
  const [selectedExchange, setSelectedExchange] = useState<string>('');
  const [response, setResponse] = useState<AnnouncementsFeedResponse | null>(null);
  const [items, setItems] = useState<CorporateAnnouncement[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(
    async (cat: AnnouncementCategory | '', exch: string, pageNum: number, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const data = await getAnnouncements({
          category: cat || undefined,
          exchange: exch || undefined,
          limit: 20,
          page: pageNum,
        });

        setResponse(data);
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load corporate announcements');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    setPage(1);
    loadAnnouncements(selectedCategory, selectedExchange, 1, false);
  }, [selectedCategory, selectedExchange, loadAnnouncements]);

  const handleLoadMore = () => {
    if (response?.pagination.hasMore && !isLoadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadAnnouncements(selectedCategory, selectedExchange, nextPage, true);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
              Official Exchange Disclosures
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Corporate Announcements & Filings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Mandatory regulatory filings and corporate action notices submitted to NSE & BSE.
          </p>
        </div>

        {/* Exchange Filter Toggle */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 p-1 text-xs">
          {['', 'NSE', 'BSE'].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setSelectedExchange(ex)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                selectedExchange === ex
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {ex === '' ? 'All Exchanges' : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        {ANNOUNCEMENT_CATEGORIES_LIST.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm shadow-emerald-500/25'
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
            onClick={() => loadAnnouncements(selectedCategory, selectedExchange, page, false)}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-white/5 bg-slate-900/40 p-5"
            >
              <div className="h-4 w-48 rounded bg-white/10 mb-3" />
              <div className="h-5 w-3/4 rounded bg-white/10 mb-2" />
              <div className="h-4 w-1/2 rounded bg-white/5" />
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-white">No Corporate Announcements</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            No official exchange disclosures were found matching your current filter.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </div>

          {response?.pagination.hasMore && (
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
                    <span>Loading more filings...</span>
                  </>
                ) : (
                  <span>Load More Filings</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
