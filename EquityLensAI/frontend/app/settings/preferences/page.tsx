'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAlertPreferences, useUpdateAlertPreferences } from '@/hooks/useNotifications';
import { subscribePush, getPushPublicKey } from '@/services/api/notifications';
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
  const { data: alertPrefs, isLoading: alertPrefsLoading } = useAlertPreferences();
  const updateAlertPrefsMutation = useUpdateAlertPreferences();

  // Application Defaults State
  const [defaultExchange, setDefaultExchange] = useState<SupportedExchange>('NSE');
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>('INR');
  const [preferredPeriod, setPreferredPeriod] = useState<SupportedPeriod>('annual');
  const [defaultLandingPage, setDefaultLandingPage] = useState<SupportedLandingPage>('/watchlists');
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [tableDensity, setTableDensity] = useState<TableDensityOption>('comfortable');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Alert & Notification Preferences State
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [digestMode, setDigestMode] = useState<'immediate' | 'daily' | 'weekly' | 'off'>('immediate');

  // Notification Category Toggles
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [percentageAlerts, setPercentageAlerts] = useState(true);
  const [volumeAlerts, setVolumeAlerts] = useState(true);
  const [technicalAlerts, setTechnicalAlerts] = useState(true);
  const [announcementAlerts, setAnnouncementAlerts] = useState(true);
  const [financialAlerts, setFinancialAlerts] = useState(true);
  const [researchUpdates, setResearchUpdates] = useState(true);
  const [marketSummaries, setMarketSummaries] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);

  // Quiet Hours
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');

  const [notifSavedSuccess, setNotifSavedSuccess] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);

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

  useEffect(() => {
    if (alertPrefs) {
      setInAppEnabled(alertPrefs.inAppEnabled ?? true);
      setEmailEnabled(alertPrefs.emailEnabled ?? false);
      setPushEnabled(alertPrefs.pushEnabled ?? false);
      setDigestMode(alertPrefs.digestMode || (alertPrefs.digestFrequency === 'realtime' ? 'immediate' : (alertPrefs.digestFrequency as any)) || 'immediate');

      setPriceAlerts(alertPrefs.priceAlerts ?? true);
      setPercentageAlerts(alertPrefs.percentageAlerts ?? true);
      setVolumeAlerts(alertPrefs.volumeAlerts ?? true);
      setTechnicalAlerts(alertPrefs.technicalAlerts ?? true);
      setAnnouncementAlerts(alertPrefs.announcementAlerts ?? true);
      setFinancialAlerts(alertPrefs.financialAlerts ?? true);
      setResearchUpdates(alertPrefs.researchUpdates ?? true);
      setMarketSummaries(alertPrefs.marketSummaries ?? false);
      setSystemAlerts(alertPrefs.systemAlerts ?? true);

      setQuietHoursEnabled(alertPrefs.quietHoursEnabled ?? false);
      setQuietHoursStart(alertPrefs.quietHoursStart || '22:00');
      setQuietHoursEnd(alertPrefs.quietHoursEnd || '08:00');
      setTimeZone(alertPrefs.timeZone || 'Asia/Kolkata');
    }
  }, [alertPrefs]);

  if (isLoading || alertPrefsLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
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

  const handleSaveDefaults = async (e: React.FormEvent) => {
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

  const handleTogglePush = async (checked: boolean) => {
    setPushStatusMsg(null);
    setPushEnabled(checked);

    if (checked) {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        setPushStatusMsg('Push notifications are not supported in this browser.');
        setPushEnabled(false);
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushStatusMsg('Browser permission was denied. Please allow notifications in browser settings.');
          setPushEnabled(false);
          return;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { publicKey } = await getPushPublicKey();

        // Subscribe to push manager
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey,
          });
        }

        const rawJson = subscription.toJSON();
        if (rawJson.endpoint && rawJson.keys) {
          await subscribePush({
            endpoint: rawJson.endpoint,
            p256dh: rawJson.keys.p256dh || '',
            auth: rawJson.keys.auth || '',
            userAgent: navigator.userAgent,
          });
          setPushStatusMsg('Browser push notifications enabled successfully.');
        }
      } catch (err) {
        setPushStatusMsg(err instanceof Error ? err.message : 'Push registration failed');
        setPushEnabled(false);
      }
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSavedSuccess(false);

    await updateAlertPrefsMutation.mutateAsync({
      inAppEnabled,
      emailEnabled,
      pushEnabled,
      emailAddress: emailAddress.trim() || null,
      digestFrequency: (digestMode === 'immediate' ? 'realtime' : digestMode) as any,
      digestMode,
      priceAlerts,
      percentageAlerts,
      volumeAlerts,
      technicalAlerts,
      announcementAlerts,
      financialAlerts,
      researchUpdates,
      marketSummaries,
      systemAlerts,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timeZone,
    });

    setNotifSavedSuccess(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Manage your personal details, preferences, and notification channels.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-medium">
        <Link href="/settings/profile" className="pb-3 text-slate-400 hover:text-white transition">
          Profile
        </Link>
        <Link href="/settings/preferences" className="border-b-2 border-sky-400 pb-3 text-sky-400 font-semibold">
          Preferences &amp; Notifications
        </Link>
        <Link href="/settings/security" className="pb-3 text-slate-400 hover:text-white transition">
          Security
        </Link>
      </div>

      {/* Section 1: Application Defaults */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
        <h2 className="text-base font-bold text-white">Application Defaults</h2>
        <p className="mt-1 text-xs text-slate-400">
          Configure default choices across market search, financial tables, and display density.
        </p>

        {savedSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            ✓ Application defaults saved successfully.
          </div>
        )}

        <form onSubmit={handleSaveDefaults} className="mt-6 space-y-6">
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
                Default Statement Period
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
                <option value="/alerts">Alerts Dashboard</option>
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
              {isSaving ? 'Saving...' : 'Save App Defaults'}
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Complete Notification & Alert Preferences (Part 6) */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
        <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">Alert Delivery &amp; Notifications (Part 6)</h2>
            <p className="mt-1 text-xs text-slate-400">
              Configure in-app, email, and push channels, subscription categories, digest schedules & quiet hours.
            </p>
          </div>
          <Link
            href="/alerts"
            className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
          >
            <span>Alerts Dashboard</span>
            <span>→</span>
          </Link>
        </div>

        {notifSavedSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            ✓ Notification preferences updated successfully.
          </div>
        )}

        {pushStatusMsg && (
          <div className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-300">
            ℹ {pushStatusMsg}
          </div>
        )}

        <form onSubmit={handleSaveNotifications} className="mt-6 space-y-6">
          {/* 1. Delivery Channels */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Delivery Channels
            </h3>
            <div className="space-y-3">
              {/* In-App */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-950/40">
                <div>
                  <p className="text-xs font-semibold text-white">In-App Notification Center</p>
                  <p className="text-[11px] text-slate-400">
                    Real-time bell dropdown and full notification history.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={(e) => setInAppEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                </label>
              </div>

              {/* Email Delivery */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Email Alert Delivery</p>
                    <p className="text-[11px] text-slate-400">
                      Deliver instant alert triggers and summaries directly to your inbox.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                  </label>
                </div>
                {emailEnabled && (
                  <div className="pt-2 border-t border-white/5">
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. investor@example.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Browser Push */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-950/40">
                <div>
                  <p className="text-xs font-semibold text-white">Browser Push Notifications</p>
                  <p className="text-[11px] text-slate-400">
                    Receive desktop push messages even when the EquityLensAI tab is in background.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => void handleTogglePush(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                </label>
              </div>
            </div>
          </div>

          {/* 2. Notification Categories */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Monitored Notification Categories
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Stock Price Crossings', state: priceAlerts, setter: setPriceAlerts, desc: 'Limit & threshold price crosses' },
                { label: 'Percentage Movements', state: percentageAlerts, setter: setPercentageAlerts, desc: 'Intraday and weekly % shifts' },
                { label: 'Trading Volume Alerts', state: volumeAlerts, setter: setVolumeAlerts, desc: 'Volume spikes & unusual multiples' },
                { label: 'Technical Indicators', state: technicalAlerts, setter: setTechnicalAlerts, desc: 'RSI, MACD & DMA crossovers' },
                { label: 'Corporate Disclosures', state: announcementAlerts, setter: setAnnouncementAlerts, desc: 'Exchange filings & board meetings' },
                { label: 'Financial Results', state: financialAlerts, setter: setFinancialAlerts, desc: 'Quarterly & annual earnings' },
                { label: 'Research Report Completion', state: researchUpdates, setter: setResearchUpdates, desc: 'Completed AI & valuation reports' },
                { label: 'Market Summaries', state: marketSummaries, setter: setMarketSummaries, desc: 'Daily market briefing & index reviews' },
                { label: 'System & Security', state: systemAlerts, setter: setSystemAlerts, desc: 'Account security & platform updates' },
              ].map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-slate-950/40 cursor-pointer hover:border-white/15 transition"
                >
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.setter(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Delivery Frequency / Digest Mode */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Delivery Schedule
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'immediate', label: 'Immediate', desc: 'Real-time per trigger' },
                { key: 'daily', label: 'Daily Digest', desc: 'Once per day bundle' },
                { key: 'weekly', label: 'Weekly Digest', desc: 'Weekend summary' },
                { key: 'off', label: 'Mute Email', desc: 'In-app history only' },
              ].map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setDigestMode(mode.key as any)}
                  className={`p-3 rounded-xl border text-left transition ${
                    digestMode === mode.key
                      ? 'border-sky-500 bg-sky-500/15 text-white ring-1 ring-sky-500'
                      : 'border-white/5 bg-slate-950/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{mode.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Quiet Hours & Timezone */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quiet Hours (Email &amp; Push Suppression)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Suppress non-critical external notifications during sleeping or offline hours.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
              </label>
            </div>

            {quietHoursEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-white/5 bg-slate-950/40">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Time Zone
                  </label>
                  <select
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT +8)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={updateAlertPrefsMutation.isPending}
              className="rounded-lg bg-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 transition"
            >
              {updateAlertPrefsMutation.isPending ? 'Saving...' : 'Save Notification Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
