'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAnnouncementDetail, summarizeAnnouncement } from '@/services/api/news';
import type { CorporateAnnouncement, GroundedAiSummary } from '@/types';

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const announcementId = params.id as string;

  const [announcement, setAnnouncement] = useState<CorporateAnnouncement | null>(null);
  const [summary, setSummary] = useState<GroundedAiSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!announcementId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAnnouncementDetail(announcementId);
        setAnnouncement(data);
        if (data.aiSummary) {
          setSummary(data.aiSummary);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Announcement not found');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [announcementId]);

  const handleSummarize = async () => {
    if (!announcementId) return;
    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const res = await summarizeAnnouncement(announcementId);
      setSummary(res);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Could not generate grounded summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-4" />
        <div className="h-8 w-3/4 bg-white/10 rounded mb-6" />
        <div className="h-48 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Announcement Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">
          {error || 'The requested disclosure could not be loaded.'}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Breadcrumb / Back button */}
      <div className="mb-6 flex items-center justify-between text-xs text-slate-400">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 hover:text-white transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Back to Announcements</span>
        </button>

        <span className="text-slate-500">ID: {announcement.id}</span>
      </div>

      {/* Main Announcement Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 md:p-8 shadow-lg">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Official Disclosure
          </span>
          <span className="rounded bg-slate-800 px-2.5 py-1 font-medium text-slate-300">
            {announcement.exchange}
          </span>
          <span className="rounded bg-slate-800 px-2.5 py-1 text-amber-300 border border-amber-500/20 capitalize">
            {announcement.category.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Company Title */}
        <div className="flex items-baseline gap-3 mb-2">
          <Link
            href={`/stocks/${announcement.exchange.toLowerCase()}/${announcement.symbol}`}
            className="text-2xl font-bold text-white hover:text-sky-400 transition"
          >
            {announcement.symbol}
          </Link>
          <span className="text-sm text-slate-400">{announcement.companyName}</span>
        </div>

        {/* Headline */}
        <h1 className="text-xl md:text-2xl font-bold leading-snug text-slate-100 mb-6">
          {announcement.title}
        </h1>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-white/5 bg-slate-950/60 mb-6 text-xs">
          <div>
            <div className="text-slate-500 mb-0.5">Filing Date (IST)</div>
            <div className="text-slate-200 font-medium">
              {new Date(announcement.publishedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Retrieved At</div>
            <div className="text-slate-200 font-medium">
              {new Date(announcement.retrievedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">ISIN</div>
            <div className="text-slate-200 font-medium">{announcement.isin || 'N/A'}</div>
          </div>
        </div>

        {/* Full Filing Description / Excerpt */}
        {announcement.description && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Official Disclosure Details
            </h3>
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
              {announcement.description}
            </div>
          </div>
        )}

        {/* Document Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            {announcement.documentUrl ? (
              <a
                href={announcement.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-sm shadow-emerald-500/20"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>
                  Download Official Filing Document{' '}
                  {announcement.fileSize ? `(${announcement.fileSize})` : '(PDF)'}
                </span>
              </a>
            ) : (
              <span className="text-xs text-slate-500">No external PDF attachment supplied</span>
            )}

            <a
              href={announcement.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <span>Exchange Source</span>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          <button
            type="button"
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition disabled:opacity-50"
          >
            {isSummarizing ? (
              <span>Analyzing with Gemini...</span>
            ) : (
              <>
                <span className="text-indigo-400">✦</span>
                <span>{summary ? 'Regenerate Grounded Summary' : 'Generate AI Summary'}</span>
              </>
            )}
          </button>
        </div>

        {/* AI Summary Box */}
        {summary && (
          <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-5 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-300 flex items-center gap-1.5 text-sm">
                <span>✦</span> Grounded AI Filing Interpretation
              </span>
              <span className="text-[10px] text-slate-400">{summary.model}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{summary.summary}</p>
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="mt-3">
                <div className="font-semibold text-slate-300 mb-1">Key Takeaways:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {summary.keyPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-[11px] italic text-slate-400 border-t border-indigo-500/10 pt-2">
              Disclaimer: {summary.disclaimer}
            </p>
          </div>
        )}

        {summaryError && <p className="mt-3 text-xs text-rose-400">{summaryError}</p>}
      </div>
    </div>
  );
}
