'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type {
  SupportedExchange,
  SupportedCurrency,
  SupportedPeriod,
  SupportedLandingPage,
  ThemeOption,
  TableDensityOption,
} from '@equitylensai/shared';

export default function PreferencesPage() {
  const { preferences, isAuthenticated, isLoading, updatePreferences } = useAuth();

  const [defaultExchange, setDefaultExchange] = useState<SupportedExchange>('NSE');
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>('INR');
  const [preferredPeriod, setPreferredPeriod] = useState<SupportedPeriod>('annual');
  const [defaultLandingPage, setDefaultLandingPage] = useState<SupportedLandingPage>('/watchlists');
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [tableDensity, setTableDensity] = useState<TableDensityOption>('comfortable');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (preferences) {
      setDefaultExchange(preferences.defaultExchange);
      setPreferredCurrency(preferences.preferredCurrency);
      setPreferredPeriod(preferences.preferredPeriod);
      setDefaultLandingPage(preferences.defaultLandingPage);
      setTheme(preferences.theme);
      setTableDensity(preferences.tableDensity);
    }
  }, [preferences]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-20 text-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8">
          <h1 className="text-lg font-bold text-white">Sign In Required</h1>
          <p className="mt-2 text-xs text-slate-400">
            Please sign in to view and edit your application preferences.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await updatePreferences({
        defaultExchange,
        preferredCurrency,
        preferredPeriod,
        defaultLandingPage,
        theme,
        tableDensity,
      });
      setSavedSuccess(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Manage your personal details, preferences, and account security.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-medium">
        <Link href="/settings/profile" className="pb-3 text-slate-400 hover:text-white transition">
          Profile
        </Link>
        <Link href="/settings/preferences" className="border-b-2 border-sky-400 pb-3 text-sky-400">
          Preferences
        </Link>
        <Link href="/settings/security" className="pb-3 text-slate-400 hover:text-white transition">
          Security
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
        <h2 className="text-base font-bold text-white">Application Defaults</h2>
        <p className="mt-1 text-xs text-slate-400">
          Configure default choices across market search, financial tables, and display density.
        </p>

        {savedSuccess && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            ✓ Preferences saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Default Exchange</label>
              <select
                value={defaultExchange}
                onChange={(e) => setDefaultExchange(e.target.value as SupportedExchange)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="NSE">NSE (National Stock Exchange of India)</option>
                <option value="BSE">BSE (Bombay Stock Exchange)</option>
                <option value="US">US Markets (NYSE/NASDAQ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Preferred Currency</label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value as SupportedCurrency)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="INR">INR (₹ Indian Rupee)</option>
                <option value="USD">USD ($ US Dollar)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Default Financial Statement Period
              </label>
              <select
                value={preferredPeriod}
                onChange={(e) => setPreferredPeriod(e.target.value as SupportedPeriod)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="annual">Annual Statements (Fiscal Year End)</option>
                <option value="ttm">Trailing Twelve Months (TTM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Default Landing Page
              </label>
              <select
                value={defaultLandingPage}
                onChange={(e) => setDefaultLandingPage(e.target.value as SupportedLandingPage)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="/watchlists">Watchlists Overview</option>
                <option value="/market">Markets Dashboard</option>
                <option value="/screener">AI Stock Screener</option>
                <option value="/research">Fundamental Research</option>
                <option value="/favorites">Favorites</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Table Display Density
              </label>
              <select
                value={tableDensity}
                onChange={(e) => setTableDensity(e.target.value as TableDensityOption)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="comfortable">Comfortable (Standard spacing)</option>
                <option value="compact">Compact (Higher data density)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Color Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeOption)}
                className="mt-1.5 block w-full rounded-lg border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="dark">Dark Theme (Tailored HSL)</option>
                <option value="light">Light Theme</option>
                <option value="system">System Default</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 transition"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>

        {/* Phase 9: Notification & Alert Preferences Section */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Alert Delivery &amp; Notifications</h2>
            <p className="mt-1 text-xs text-slate-400">
              Configure in-app notification channels and manage alert category subscriptions.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-950/40">
              <div>
                <p className="text-xs font-semibold text-white">In-App Notification Center</p>
                <p className="text-[11px] text-slate-400">Receive in-app alerts and unread badge counters.</p>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                Enabled
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-950/40">
              <div>
                <p className="text-xs font-semibold text-white">Email Digest / Alerts</p>
                <p className="text-[11px] text-slate-400">
                  External delivery via verified SMTP/SES provider. Requires configured email transport.
                </p>
              </div>
              <span className="rounded-md bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400 border border-white/10">
                Config Dependent (Disabled)
              </span>
            </div>

            <div className="pt-2">
              <Link
                href="/alerts"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:underline"
              >
                <span>Manage your active stock alert rules in Alerts Dashboard</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
