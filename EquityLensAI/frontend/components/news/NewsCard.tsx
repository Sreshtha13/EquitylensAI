'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { NewsItem, GroundedAiSummary } from '@/types';
import { summarizeNews } from '@/services/api/news';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Recently published';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 5) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function NewsCard({ item }: { item: NewsItem }) {
  const [summary, setSummary] = useState<GroundedAiSummary | null>(item.aiSummary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const handleSummarize = async () => {
    if (summary) {
      setShowSummary(!showSummary);
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const res = await summarizeNews(item.id);
      setSummary(res);
      setShowSummary(true);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Could not generate summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-sm transition-all hover:border-white/20 hover:bg-slate-900/80">
      <div>
        {/* Header meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-400">{item.sourceName}</span>
            <span className="text-slate-600">•</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
              News Publisher
            </span>
          </div>
          <time dateTime={item.publishedAt || ''} title={item.publishedAt || ''}>
            {formatRelativeTime(item.publishedAt)}
          </time>
        </div>

        {/* Title */}
        <h3 className="mt-2.5 text-base font-semibold leading-snug text-slate-100 group-hover:text-white transition">
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
          >
            {item.title}
          </a>
        </h3>

        {/* Excerpt */}
        {item.contentExcerpt && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-300">
            {item.contentExcerpt}
          </p>
        )}

        {/* Associated Companies */}
        {item.symbols && item.symbols.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Related:</span>
            {item.symbols.map((s) => (
              <Link
                key={`${s.exchange}:${s.symbol}`}
                href={`/stocks/${s.exchange.toLowerCase()}/${s.symbol.toUpperCase()}`}
                className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 transition hover:bg-sky-500/20 hover:border-sky-500/50"
              >
                <span>{s.symbol}</span>
                <span className="text-[9px] text-sky-400/70">{s.exchange}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={handleSummarize}
          disabled={isSummarizing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition disabled:opacity-50"
        >
          {isSummarizing ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
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
              <span>Summarizing...</span>
            </>
          ) : showSummary ? (
            <span>Hide AI Summary</span>
          ) : (
            <>
              <span className="text-indigo-400">✦</span>
              <span>{summary ? 'Show AI Summary' : 'AI Summary'}</span>
            </>
          )}
        </button>

        <a
          href={item.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-400 transition"
        >
          <span>Read at {item.sourceName}</span>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      {/* AI Summary Section */}
      {showSummary && summary && (
        <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-3.5 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <span>✦</span> Grounded AI Interpretation
            </span>
            <span className="text-[10px] text-slate-400">{summary.model}</span>
          </div>
          <p className="leading-relaxed text-slate-200">{summary.summary}</p>
          {summary.keyPoints && summary.keyPoints.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-300">
              {summary.keyPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] italic text-slate-400 border-t border-indigo-500/10 pt-1.5">
            Disclaimer: {summary.disclaimer}
          </p>
        </div>
      )}

      {summaryError && <p className="mt-2 text-[11px] text-rose-400">{summaryError}</p>}
    </article>
  );
}
