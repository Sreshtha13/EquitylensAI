'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import type { NotificationCategory } from '@equitylensai/shared';

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');

  const { data, isLoading } = useNotifications({
    unreadOnly: unreadOnly ? true : undefined,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });

  const markAllRead = useMarkAllNotificationsRead();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In for Notifications</h1>
        <p className="mt-2 text-sm text-slate-400">
          Access your alert history, price threshold notifications, and corporate disclosure alerts.
        </p>
        <Link
          href="/login?redirect=/notifications"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/25 hover:opacity-90 transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const notifications = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-bold text-sky-400 border border-sky-500/30">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time delivery from verified market quotes, financial metrics, and corporate filings.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5"
          >
            <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{markAllRead.isPending ? 'Marking...' : 'Mark all as read'}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(false)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              !unreadOnly
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              unreadOnly
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {[
            { key: 'all', label: 'All Categories' },
            { key: 'price_alert', label: 'Prices' },
            { key: 'percentage_alert', label: 'Movements' },
            { key: 'announcement_alert', label: 'Filings' },
            { key: 'financial_alert', label: 'Financials' },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key as NotificationCategory | 'all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                categoryFilter === cat.key
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">No Notifications</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
              You are all caught up! New notifications will appear here when your alert conditions trigger.
            </p>
            <Link
              href="/alerts"
              className="mt-4 inline-block rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-400 transition"
            >
              Manage Alert Rules
            </Link>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotificationItem key={notif.id} notification={notif} />
          ))
        )}
      </div>
    </div>
  );
}
