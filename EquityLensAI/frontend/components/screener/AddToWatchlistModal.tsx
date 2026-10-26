'use client';

import { useEffect, useState } from 'react';
import type { SupportedExchange, WatchlistSummary } from '@equitylensai/shared';
import { listWatchlists, addWatchlistItem, createWatchlist } from '@/services/api/watchlists';
import { useAuth } from '@/hooks/useAuth';

interface AddToWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: {
    symbol: string;
    exchange: string;
    companyName?: string;
  } | null;
  onSuccess?: (watchlistName: string) => void;
}

export function AddToWatchlistModal({
  isOpen,
  onClose,
  stock,
  onSuccess,
}: AddToWatchlistModalProps) {
  const { isAuthenticated } = useAuth();
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('');
  const [newWatchlistName, setNewWatchlistName] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    listWatchlists()
      .then((data) => {
        if (isMounted) {
          setWatchlists(data);
          if (data.length > 0 && data[0]) {
            setSelectedWatchlistId(data[0].id);
          } else {
            setIsCreatingNew(true);
          }
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load watchlists');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, isAuthenticated]);

  if (!isOpen || !stock) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!stock) return;

    setError(null);
    setIsSubmitting(true);

    try {
      let targetWatchlistId = selectedWatchlistId;
      let targetName = watchlists.find((w) => w.id === targetWatchlistId)?.name ?? 'Watchlist';

      if (isCreatingNew) {
        if (!newWatchlistName.trim()) {
          setError('Please provide a name for the new watchlist.');
          setIsSubmitting(false);
          return;
        }
        const created = await createWatchlist({ name: newWatchlistName.trim() });
        targetWatchlistId = created.id;
        targetName = created.name;
      }

      await addWatchlistItem(targetWatchlistId, {
        symbol: stock.symbol,
        exchange: stock.exchange as SupportedExchange,
      });

      if (onSuccess) {
        onSuccess(targetName);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add stock to watchlist');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-watchlist-modal-title"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </span>
            <h2 id="add-watchlist-modal-title" className="text-lg font-bold text-white">
              Add to Watchlist
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/60 p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{stock.companyName || stock.symbol}</p>
            <p className="text-xs text-slate-400">{stock.symbol} · {stock.exchange}</p>
          </div>
          <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-300 uppercase">
            {stock.exchange}
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="mt-5 space-y-4">
          {!isCreatingNew && watchlists.length > 0 ? (
            <div>
              <label htmlFor="select-watchlist" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Watchlist
              </label>
              <select
                id="select-watchlist"
                value={selectedWatchlistId}
                onChange={(e) => setSelectedWatchlistId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
              >
                {watchlists.map((wl) => (
                  <option key={wl.id} value={wl.id}>
                    {wl.name} ({wl.itemCount ?? 0} stocks)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="mt-2 text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                + Create a new watchlist
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="new-watchlist-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Watchlist Name
              </label>
              <input
                id="new-watchlist-name"
                type="text"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="e.g. High ROCE Compounders"
                maxLength={60}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none placeholder:text-slate-500"
              />
              {watchlists.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="mt-2 text-xs text-slate-400 hover:text-white"
                >
                  ← Select from existing watchlists
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding…' : 'Add to Watchlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
