'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listWatchlists, createWatchlist, addWatchlistItem } from '@/services/api/watchlists';
import type { SupportedExchange, WatchlistSummary } from '@equitylensai/shared';

type AddToWatchlistModalProps = {
  symbol: string;
  exchange: string;
  isOpen: boolean;
  onClose: () => void;
};

export function AddToWatchlistModal({
  symbol,
  exchange,
  isOpen,
  onClose,
}: AddToWatchlistModalProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: watchlists = [], isLoading: isLoadingWatchlists } = useQuery({
    queryKey: ['watchlists'],
    queryFn: listWatchlists,
    enabled: isOpen && isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createWatchlist({ name }),
    onSuccess: async (newList) => {
      // Automatically add item to new watchlist
      await addWatchlistItem(newList.id, {
        symbol,
        exchange: (exchange || 'NSE') as SupportedExchange,
      });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setNewWatchlistName('');
      setIsCreating(false);
      setSuccessMsg(`Created "${newList.name}" and added ${symbol}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Failed to create watchlist');
    },
  });

  const addMutation = useMutation({
    mutationFn: (watchlistId: string) =>
      addWatchlistItem(watchlistId, {
        symbol,
        exchange: (exchange || 'NSE') as SupportedExchange,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setSuccessMsg(`Added ${symbol} to watchlist`);
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Failed to add to watchlist');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Add to Watchlist</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a watchlist for <span className="font-semibold text-sky-400">{symbol}</span> (
              {exchange})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {successMsg}
          </div>
        )}

        {!isAuthenticated ? (
          <div className="mt-6 text-center py-4">
            <p className="text-sm text-slate-300">
              Sign in to manage and customize your watchlists.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition"
            >
              Sign In to Continue
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {isLoadingWatchlists ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Loading your watchlists...
              </div>
            ) : watchlists.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-center">
                <p className="text-xs text-slate-400">You don&apos;t have any watchlists yet.</p>
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {watchlists.map((wl: WatchlistSummary) => (
                  <button
                    key={wl.id}
                    onClick={() => {
                      setErrorMsg(null);
                      addMutation.mutate(wl.id);
                    }}
                    disabled={addMutation.isPending}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-slate-950/50 p-3 text-left transition hover:border-sky-500/30 hover:bg-slate-800/50"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{wl.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {wl.itemCount} {wl.itemCount === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                      + Add
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Create New Watchlist inline */}
            <div className="border-t border-white/5 pt-4">
              {!isCreating ? (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-3 text-xs font-semibold text-slate-300 hover:border-sky-500/40 hover:text-white transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>Create New Watchlist</span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newWatchlistName.trim()) {
                      setErrorMsg(null);
                      createMutation.mutate(newWatchlistName.trim());
                    }
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    value={newWatchlistName}
                    onChange={(e) => setNewWatchlistName(e.target.value)}
                    placeholder="Watchlist name (e.g. Energy Leaders)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createMutation.isPending || !newWatchlistName.trim()}
                      className="flex-1 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50 transition"
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create & Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewWatchlistName('');
                      }}
                      className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
