'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function SecuritySettingsPage() {
  const { user, isAuthenticated, isLoading, deleteAccount } = useAuth();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
          <p className="mt-2 text-xs text-slate-400">Please sign in to manage account security.</p>
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

  const handleDelete = async () => {
    if (confirmInput !== 'DELETE_ACCOUNT') {
      setDeleteError("Please type 'DELETE_ACCOUNT' exactly to confirm.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount();
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete account. Please try again.',
      );
      setIsDeleting(false);
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
        <Link
          href="/settings/preferences"
          className="pb-3 text-slate-400 hover:text-white transition"
        >
          Preferences
        </Link>
        <Link href="/settings/security" className="border-b-2 border-sky-400 pb-3 text-sky-400">
          Security
        </Link>
      </div>

      <div className="space-y-8">
        {/* Session & Password Information Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl">
          <h2 className="text-base font-bold text-white">Authentication & Sessions</h2>
          <p className="mt-1 text-xs text-slate-400">
            Your login identity is verified by Supabase Auth with server-validated tokens.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div>
                <p className="text-xs font-semibold text-white">Signed in as</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{user?.email}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                Verified Session
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div>
                <p className="text-xs font-semibold text-white">Password Recovery</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Need to change or recover your password?
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                Send Reset Link
              </Link>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-6 sm:p-8 backdrop-blur-xl">
          <h2 className="text-base font-bold text-rose-300">Danger Zone</h2>
          <p className="mt-1 text-xs text-slate-400">
            Deleting your account will permanently delete your user profile, all custom watchlists,
            and your starred favorites. Shared company financial data and market quotes remain
            intact.
          </p>

          <div className="mt-6 flex items-center justify-between border-t border-rose-500/10 pt-4">
            <div>
              <p className="text-xs font-semibold text-white">Delete Account and Data</p>
              <p className="text-[11px] text-slate-400">
                This action is irreversible. Explicit confirmation is required.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmInput('');
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-white">
              Permanently Delete Account?
            </h2>
            <p className="mt-2 text-center text-xs text-slate-300 leading-relaxed">
              This will immediately delete your account credentials, all your custom watchlists, and
              all your starred favorites.
            </p>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 text-center">
                {deleteError}
              </div>
            )}

            <div className="mt-5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="confirmText">
                To confirm, type{' '}
                <span className="font-mono font-bold text-rose-400">DELETE_ACCOUNT</span> below:
              </label>
              <input
                id="confirmText"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE_ACCOUNT"
                className="mt-1.5 block w-full rounded-lg border border-rose-500/30 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || confirmInput !== 'DELETE_ACCOUNT'}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition"
              >
                {isDeleting ? 'Deleting Account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
