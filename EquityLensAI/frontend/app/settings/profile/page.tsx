'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileSettingsPage() {
  const { user, profile, isAuthenticated, isLoading, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile]);

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
          <p className="mt-2 text-xs text-slate-400">Please sign in to view and edit your profile.</p>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await updateProfile({
        displayName: displayName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      setSavedSuccess(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile');
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
        <Link
          href="/settings/profile"
          className="border-b-2 border-sky-400 pb-3 text-sky-400"
        >
          Profile
        </Link>
        <Link
          href="/settings/preferences"
          className="pb-3 text-slate-400 hover:text-white transition"
        >
          Preferences
        </Link>
        <Link
          href="/settings/security"
          className="pb-3 text-slate-400 hover:text-white transition"
        >
          Security
        </Link>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-sky-500/25">
            {(displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{displayName || 'Unnamed User'}</h2>
            <p className="text-xs text-slate-400">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active Account
              </span>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            ✓ Profile updated successfully.
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              disabled
              value={user?.email || ''}
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Email address is managed by your identity provider.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="name">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sreshtha Saxena"
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="avatar">
              Avatar Image URL
            </label>
            <input
              id="avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 transition"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
