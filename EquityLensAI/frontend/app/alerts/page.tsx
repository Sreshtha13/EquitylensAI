'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts, useAlertStats, useTriggerAlertEvaluation } from '@/hooks/useAlerts';
import { AlertRuleCard } from '@/components/alerts/AlertRuleCard';
import { CreateAlertModal } from '@/components/alerts/CreateAlertModal';
import type { AlertType, AlertStatus } from '@equitylensai/shared';

export default function AlertsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedType, setSelectedType] = useState<AlertType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: statsData } = useAlertStats();
  const { data, isLoading, refetch } = useAlerts(
    selectedType === 'all' ? {} : { alertType: selectedType },
  );

  const triggerEval = useTriggerAlertEvaluation();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In to Monitor Alerts</h1>
        <p className="mt-2 text-sm text-slate-400">
          Create customized price threshold, movement, volume, and company disclosure alerts on verified market data.
        </p>
        <Link
          href="/login?redirect=/alerts"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/25 hover:opacity-90 transition"
        >
          Sign In / Register
        </Link>
      </div>
    );
  }

  const rules = data?.rules ?? [];

  // Client-side filtering by status and search query
  const filteredRules = rules.filter((r) => {
    // Status check
    const rStatus = r.status || (r.expiresAt && new Date(r.expiresAt) < new Date() ? 'EXPIRED' : r.enabled ? 'ACTIVE' : 'PAUSED');
    if (selectedStatus !== 'all' && rStatus !== selectedStatus) {
      return false;
    }
    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchSymbol = r.symbol?.toLowerCase().includes(q);
      const matchType = r.alertType.toLowerCase().includes(q);
      if (!matchName && !matchSymbol && !matchType) return false;
    }
    return true;
  });

  const stats = statsData || {
    total: rules.length,
    active: rules.filter((r) => r.enabled && (!r.expiresAt || new Date(r.expiresAt) >= new Date())).length,
    paused: rules.filter((r) => !r.enabled && (!r.expiresAt || new Date(r.expiresAt) >= new Date())).length,
    triggeredToday: 0,
    expired: rules.filter((r) => r.expiresAt && new Date(r.expiresAt) < new Date()).length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-black tracking-tight text-white">Alerts &amp; Monitors</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400 border border-sky-500/20">
              Live Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time threshold evaluation across verified quotes, technical crossovers, disclosures & fundamental ratios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => triggerEval.mutate()}
            disabled={triggerEval.isPending}
            className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition flex items-center gap-1.5"
            title="Trigger background evaluation cycle"
          >
            <svg
              className={`h-4 w-4 ${triggerEval.isPending ? 'animate-spin text-sky-400' : 'text-slate-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{triggerEval.isPending ? 'Evaluating...' : 'Run Evaluation'}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/25 hover:opacity-90 transition flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Alert</span>
          </button>
        </div>
      </div>

      {/* Part 1 Dashboard Overview: 5 KPI Cards */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Alerts</p>
          <p className="mt-1 text-2xl font-black text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Paused</p>
          <p className="mt-1 text-2xl font-black text-slate-400">{stats.paused}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Triggered Today</p>
          <p className="mt-1 text-2xl font-black text-amber-400">{stats.triggeredToday}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Expired</p>
          <p className="mt-1 text-2xl font-black text-rose-400">{stats.expired}</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search alerts by symbol or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'PAUSED', label: 'Paused' },
              { key: 'TRIGGERED', label: 'Triggered' },
              { key: 'EXPIRED', label: 'Expired' },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedStatus(s.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                selectedStatus === s.key
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-4 overflow-x-auto">
        {[
          { key: 'all', label: 'All Categories' },
          { key: 'price', label: 'Price' },
          { key: 'percentage_change', label: '% Movement' },
          { key: 'volume', label: 'Volume' },
          { key: 'unusual_volume', label: 'Unusual Vol' },
          { key: 'rsi', label: 'RSI' },
          { key: 'macd', label: 'MACD' },
          { key: 'moving_average', label: 'Moving Avg' },
          { key: '52w_high_low', label: '52W High/Low' },
          { key: 'circuit', label: 'Circuits' },
          { key: 'announcement', label: 'Disclosures' },
          { key: 'corporate_action', label: 'Dividends/Splits' },
          { key: 'financial_results', label: 'Quarterly Results' },
          { key: 'financial_metric', label: 'Fundamentals' },
          { key: 'index_movement', label: 'Indices' },
          { key: 'watchlist_event', label: 'Watchlist' },
          { key: 'news', label: 'News' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedType(tab.key as AlertType | 'all')}
            className={`rounded-xl px-3 py-1 text-xs font-medium transition whitespace-nowrap ${
              selectedType === tab.key
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-semibold'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts Grid or Empty State */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">No Matching Alert Rules</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery || selectedStatus !== 'all' || selectedType !== 'all'
                ? 'No alerts match the chosen filters or search query.'
                : 'You do not have any active alert rules. Create one to receive deterministic notifications on threshold events.'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-5 rounded-xl bg-sky-500 px-5 py-2 text-xs font-bold text-white shadow hover:bg-sky-400 transition"
            >
              Create Rule Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule) => (
              <AlertRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      <CreateAlertModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
