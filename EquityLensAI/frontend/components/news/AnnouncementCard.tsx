'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CorporateAnnouncement, GroundedAiSummary } from '@/types';
import { summarizeAnnouncement } from '@/services/api/news';

function formatCategory(cat: string): string {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatFilingDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function AnnouncementCard({ item }: { item: CorporateAnnouncement }) {
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
      const res = await summarizeAnnouncement(item.id);
      setSummary(res);
      setShowSummary(true);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Could not generate summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-slate-900/60 p-5 shadow-sm transition-all hover:border-emerald-500/40 hover:bg-slate-900/80">
      <div>
        {/* Header badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OFFICIAL DISCLOSURE
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              {item.exchange}
            </span>
            <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-500/20">
              {formatCategory(item.category)}
            </span>
          </div>

          <span className="text-[11px] text-slate-400" title={`Retrieved: ${item.retrievedAt}`}>
            Filed: {formatFilingDate(item.publishedAt)}
          </span>
        </div>

        {/* Company Header */}
        <div className="mt-3 flex items-baseline gap-2">
          <Link
            href={`/stocks/${item.exchange.toLowerCase()}/${item.symbol}`}
            className="text-base font-bold text-white hover:text-sky-400 transition"
          >
            {item.symbol}
          </Link>
          <span className="text-xs text-slate-400 truncate max-w-sm">{item.companyName}</span>
        </div>

        {/* Title */}
        <h4 className="mt-2 text-sm font-semibold leading-snug text-slate-100">
          <Link
            href={`/announcements/${encodeURIComponent(item.id)}`}
            className="hover:underline hover:text-sky-300 transition"
          >
            {item.title}
          </Link>
        </h4>

        {/* Description / Content */}
        {item.description && item.description !== item.title && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
            {item.description}
          </p>
        )}
      </div>

      {/* Footer Meta & Actions */}
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition disabled:opacity-50"
          >
            {isSummarizing ? (
              <span>Summarizing...</span>
            ) : showSummary ? (
              <span>Hide AI Summary</span>
            ) : (
              <>
                <span className="text-indigo-400">✦</span>
                <span>{summary ? 'Show AI Summary' : 'AI Summary'}</span>
              </>
            )}
          </button>

          <Link
            href={`/announcements/${encodeURIComponent(item.id)}`}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            Details
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {item.documentUrl && (
            <a
              href={item.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Original Filing {item.fileSize ? `(${item.fileSize})` : '(PDF)'}</span>
            </a>
          )}

          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-sky-400 transition"
            title="Open official exchange listing"
          >
            <span>Exchange Portal</span>
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
      </div>

      {/* AI Summary Section */}
      {showSummary && summary && (
        <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-3.5 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <span>✦</span> Grounded Filing Interpretation
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
