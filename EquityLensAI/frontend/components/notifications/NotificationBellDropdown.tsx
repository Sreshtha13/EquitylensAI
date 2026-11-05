'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import type { AppNotification } from '@equitylensai/shared';

export function NotificationBellDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadNotificationsCount();
  const unreadCount = unreadData?.unreadCount ?? 0;

  const { data: notificationsData, isLoading } = useNotifications({
    limit: 6,
    archived: false,
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.read) {
      markRead.mutate(item.id);
    }
    setIsOpen(false);

    if (item.link) {
      router.push(item.link);
    } else if (item.symbol) {
      router.push(`/stocks/${item.exchange || 'NSE'}/${item.symbol}`);
    } else {
      router.push('/notifications');
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'price_alert':
        return <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">Price</span>;
      case 'percentage_alert':
        return <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">Movement</span>;
      case 'technical_alert':
        return <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300">Technical</span>;
      case 'volume_alert':
        return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Volume</span>;
      case 'announcement_alert':
      case 'corporate_action_alert':
        return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Announcement</span>;
      case 'financial_alert':
        return <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">Financial</span>;
      case 'research_report':
        return <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">Research</span>;
      default:
        return <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">Alert</span>;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-full border p-2 transition focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
          isOpen
            ? 'border-sky-500/40 bg-sky-500/10 text-white'
            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white'
        }`}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-[11px] font-semibold text-slate-400 hover:text-sky-400 transition"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <div className="mx-auto mb-2 h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                Loading notifications...
              </div>
            ) : !notificationsData?.items || notificationsData.items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-slate-300">You&apos;re all caught up</p>
                <p className="text-[11px] text-slate-500 mt-0.5">No new notifications right now</p>
              </div>
            ) : (
              notificationsData.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group flex items-start gap-3 p-3.5 text-left transition cursor-pointer hover:bg-white/5 ${
                    !item.read ? 'bg-sky-500/[0.03]' : ''
                  }`}
                >
                  {/* Indicator Dot */}
                  <div className="pt-1 flex-shrink-0">
                    <span
                      className={`block h-2 w-2 rounded-full ${
                        !item.read ? 'bg-sky-400 ring-2 ring-sky-400/20' : 'bg-transparent'
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {getCategoryBadge(item.category)}
                        {item.symbol && (
                          <span className="font-mono text-[10px] font-bold text-white/90">
                            {item.symbol}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>

                    <h4
                      className={`text-xs font-semibold leading-snug line-clamp-1 ${
                        !item.read ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Inline Mark Read */}
                  {!item.read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-sky-400 transition"
                      title="Mark as read"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-2.5 bg-slate-950/60 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition py-1 px-3 rounded-lg hover:bg-sky-500/10 w-full"
            >
              <span>View all notifications</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
