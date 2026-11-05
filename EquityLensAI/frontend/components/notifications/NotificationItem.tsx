'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@equitylensai/shared';
import {
  useMarkNotificationRead,
  useDeleteNotification,
  useArchiveNotification,
  useUnarchiveNotification,
} from '@/hooks/useNotifications';

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();
  const archiveNotif = useArchiveNotification();
  const unarchiveNotif = useUnarchiveNotification();

  const getCategoryIcon = () => {
    switch (notification.category) {
      case 'price_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        );
      case 'percentage_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        );
      case 'volume_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        );
      case 'technical_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
        );
      case 'financial_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      case 'announcement_alert':
      case 'corporate_action_alert':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
        );
      case 'research_report':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-white/10">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  const handleCardClick = () => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    } else if (notification.symbol) {
      router.push(`/stocks/${notification.exchange || 'NSE'}/${notification.symbol}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative rounded-2xl border p-4 transition cursor-pointer hover:border-white/20 ${
        notification.read
          ? 'border-white/5 bg-slate-900/40 text-slate-400'
          : 'border-sky-500/30 bg-slate-900/90 text-white shadow-md shadow-sky-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {getCategoryIcon()}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white truncate">{notification.title}</h4>
              {!notification.read && (
                <span className="h-2 w-2 rounded-full bg-sky-400 ring-4 ring-sky-400/20 shrink-0" />
              )}
              {notification.archived && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 uppercase">
                  Archived
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{notification.message}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span>{new Date(notification.createdAt).toLocaleString()}</span>
              {notification.symbol && (
                <Link
                  href={`/stocks/${notification.exchange || 'NSE'}/${notification.symbol}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-sky-400 hover:underline"
                >
                  View {notification.symbol} →
                </Link>
              )}
              {notification.sourceUrl && (
                <a
                  href={notification.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Filing Source</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!notification.read && (
            <button
              onClick={() => markRead.mutate(notification.id)}
              disabled={markRead.isPending}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Mark as read"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}

          {notification.archived ? (
            <button
              onClick={() => unarchiveNotif.mutate(notification.id)}
              disabled={unarchiveNotif.isPending}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Unarchive notification"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => archiveNotif.mutate(notification.id)}
              disabled={archiveNotif.isPending}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Archive notification"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          )}

          <button
            onClick={() => deleteNotif.mutate(notification.id)}
            disabled={deleteNotif.isPending}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
            title="Delete notification"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
