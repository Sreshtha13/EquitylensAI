'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  listWatchlists,
  createWatchlist,
  deleteWatchlist,
  updateWatchlist,
} from '@/services/api/watchlists';
import { WatchlistNewsSection } from '@/components/watchlists/WatchlistNewsSection';
import type { WatchlistSummary } from '@equitylensai/shared';

export default function WatchlistsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [newWatchlistDesc, setNewWatchlistDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingWatchlist, setEditingWatchlist] = useState<WatchlistSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: watchlists = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['watchlists'],
    queryFn: listWatchlists,
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      createWatchlist({ name: data.name, description: data.description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setCreateModalOpen(false);
      setNewWatchlistName('');
      setNewWatchlistDesc('');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create watchlist');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string }) =>
      updateWatchlist(id, { name, description: description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setEditingWatchlist(null);
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update watchlist');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWatchlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setDeletingId(null);
    },
  });

  if (authLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-20 text-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Sign In to View Watchlists</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Create custom stock watchlists, monitor genuine market prices, and track your favorites
            across devices.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Phase 6 Watchlists
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            My Stock Watchlists
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Create named watchlists with real-time price tracking and data provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Watchlist
        </button>
      </div>

      {/* Watchlist Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-white/5 bg-white/5"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error instanceof Error
            ? error.message
            : 'Failed to load watchlists. Please try refreshing.'}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-semibold text-white">No Watchlists Yet</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Organize your investments into custom watchlists like &quot;High Growth&quot;,
            &quot;Dividend Aristocrats&quot;, or &quot;Nifty 50 Core&quot;.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 transition"
          >
            Create Your First Watchlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {watchlists.map((wl) => (
            <div
              key={wl.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-sm transition hover:border-sky-500/30 hover:bg-slate-900/90"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/watchlists/${wl.id}`}
                    className="text-base font-bold text-white hover:text-sky-400 transition"
                  >
                    {wl.name}
                  </Link>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {wl.itemCount} {wl.itemCount === 1 ? 'stock' : 'stocks'}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                  {wl.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-500">
                <span>Created {new Date(wl.createdAt).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWatchlist(wl);
                      setEditName(wl.name);
                      setEditDesc(wl.description || '');
                    }}
                    className="text-slate-400 hover:text-white transition"
                    title="Rename / Edit"
                  >
                    Edit
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={() => setDeletingId(wl.id)}
                    className="text-rose-400 hover:text-rose-300 transition"
                    title="Delete Watchlist"
                  >
                    Delete
                  </button>
                  <span className="text-white/20">•</span>
                  <Link
                    href={`/watchlists/${wl.id}`}
                    className="font-semibold text-sky-400 hover:text-sky-300 transition"
                  >
                    View →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Watchlist News & Intelligence */}
      <div className="mt-4 pt-6 border-t border-white/10">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-sky-400">
              Event & News Intelligence
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            News for Your Tracked Stocks
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Real-time verified reporting deduplicated across all companies in your watchlists and
            favorites.
          </p>
        </div>

        <WatchlistNewsSection />
      </div>

      {/* Create Watchlist Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Create New Watchlist</h2>
            <p className="mt-1 text-xs text-slate-400">
              Give your watchlist a unique, descriptive name.
            </p>

            {errorMsg && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ name: newWatchlistName, description: newWatchlistDesc });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="wlName">
                  Watchlist Name *
                </label>
                <input
                  id="wlName"
                  type="text"
                  required
                  maxLength={100}
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g. Dividend Yielders, Top Tech"
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="wlDesc">
                  Description (Optional)
                </label>
                <textarea
                  id="wlDesc"
                  rows={3}
                  maxLength={500}
                  value={newWatchlistDesc}
                  onChange={(e) => setNewWatchlistDesc(e.target.value)}
                  placeholder="Brief notes about your investment strategy for this list..."
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newWatchlistName.trim()}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Watchlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Watchlist Modal */}
      {editingWatchlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Edit Watchlist</h2>

            {errorMsg && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: editingWatchlist.id,
                  name: editName,
                  description: editDesc,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="editWlName">
                  Watchlist Name *
                </label>
                <input
                  id="editWlName"
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="editWlDesc">
                  Description
                </label>
                <textarea
                  id="editWlDesc"
                  rows={3}
                  maxLength={500}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingWatchlist(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !editName.trim()}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-bold text-white">Delete Watchlist?</h2>
            <p className="mt-1 text-xs text-slate-400">
              Are you sure you want to delete this watchlist? All tracked stocks inside it will be
              removed. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
