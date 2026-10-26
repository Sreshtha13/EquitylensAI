'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts, useTriggerAlertEvaluation } from '@/hooks/useAlerts';
import { AlertRuleCard } from '@/components/alerts/AlertRuleCard';
import { CreateAlertModal } from '@/components/alerts/CreateAlertModal';
import type { AlertType } from '@equitylensai/shared';

export default function AlertsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedType, setSelectedType] = useState<AlertType | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, refetch } = useAlerts(
    selectedType === 'all' ? {} : { alertType: selectedType },
  );

  const triggerEval = useTriggerAlertEvaluation();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />
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
  const totalCount = data?.total ?? rules.length;
  const activeCount = rules.filter((r) => r.enabled).length;
  const disabledCount = rules.filter((r) => !r.enabled).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-black tracking-tight text-white">Alerts &amp; Monitors</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400 border border-sky-500/20">
              Live Evaluation
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Automated threshold evaluation on live quotes, financial metrics, and corporate filings.
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

      {/* Summary KPI Cards */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-xs font-medium text-slate-400">Total Alert Rules</p>
          <p className="mt-1 text-2xl font-black text-white">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-xs font-medium text-slate-400">Active / Monitoring</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-xs font-medium text-slate-400">Paused / Disabled</p>
          <p className="mt-1 text-2xl font-black text-slate-400">{disabledCount}</p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        {[
          { key: 'all', label: 'All Rules' },
          { key: 'price', label: 'Price Thresholds' },
          { key: 'percentage_change', label: '% Movement' },
          { key: 'volume', label: 'Volume' },
          { key: 'financial_metric', label: 'Financial Ratios' },
          { key: 'announcement', label: 'Exchange Filings' },
          { key: 'news', label: 'News Alerts' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedType(tab.key as AlertType | 'all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedType === tab.key
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
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
        ) : rules.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">No Alert Rules Configured</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              You do not have any active alert rules in this category. Create one to receive deterministic notifications on threshold events.
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
            {rules.map((rule) => (
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
