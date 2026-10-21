'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  getWatchlistDetail,
  addWatchlistItem,
  removeWatchlistItem,
  deleteWatchlist,
  updateWatchlist,
} from '@/services/api/watchlists';
import { addFavorite, removeFavorite, listFavorites } from '@/services/api/favorites';
import { searchStocks } from '@/services/api/market';
import type { SupportedExchange, InstrumentSummary } from '@equitylensai/shared';

export default function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ watchlistId: string }>;
}) {
  const { watchlistId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addItemError, setAddItemError] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Load Watchlist Details with Quotes
  const {
    data: watchlist,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['watchlist', watchlistId],
    queryFn: () => getWatchlistDetail(watchlistId),
    enabled: isAuthenticated && Boolean(watchlistId),
    refetchInterval: 30_000, // Refresh quotes every 30s
  });

  // Load Favorites to know favorite state
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: listFavorites,
    enabled: isAuthenticated,
  });

  // Stock search query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['stocks-search', searchQuery],
    queryFn: () => searchStocks(searchQuery),
    enabled: searchQuery.trim().length >= 1,
  });

  const searchResults: InstrumentSummary[] = searchData?.items ?? [];

  // Add Item Mutation
  const addMutation = useMutation({
    mutationFn: (item: { symbol: string; exchange: SupportedExchange }) =>
      addWatchlistItem(watchlistId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', watchlistId] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setAddModalOpen(false);
      setSearchQuery('');
      setAddItemError(null);
    },
    onError: (err: unknown) => {
      setAddItemError(err instanceof Error ? err.message : 'Failed to add stock to watchlist');
    },
  });

  // Remove Item Mutation
  const removeMutation = useMutation({
    mutationFn: ({ symbol, exchange }: { symbol: string; exchange?: SupportedExchange }) =>
      removeWatchlistItem(watchlistId, symbol, exchange),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', watchlistId] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });

  // Toggle Favorite
  const toggleFavorite = async (symbol: string, exchange: SupportedExchange) => {
    const isFav = favorites.some((f) => f.symbol === symbol && f.exchange === exchange);
    if (isFav) {
      await removeFavorite(symbol, exchange);
    } else {
      await addFavorite(symbol, exchange);
    }
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
  };

  // Edit Watchlist Mutation
  const updateMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      updateWatchlist(watchlistId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', watchlistId] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setEditModalOpen(false);
    },
  });

  // Delete Watchlist Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteWatchlist(watchlistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      router.push('/watchlists');
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="h-6 w-32 animate-pulse rounded bg-white/5" />
        <div className="h-10 w-64 animate-pulse rounded bg-white/5" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (isError || !watchlist) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-20 text-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-xl">
          <h1 className="text-lg font-bold text-white">Watchlist Not Found</h1>
          <p className="mt-2 text-xs text-slate-400">
            {error instanceof Error ? error.message : "This watchlist does not exist or you don't have permission to view it."}
          </p>
          <div className="mt-6">
            <Link
              href="/watchlists"
              className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
            >
              ← Back to Watchlists
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/watchlists" className="hover:text-white transition">
          Watchlists
        </Link>
        <span>/</span>
        <span className="text-white font-medium truncate">{watchlist.name}</span>
      </nav>

      {/* Watchlist Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {watchlist.name}
            </h1>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-300">
              {watchlist.items.length} {watchlist.items.length === 1 ? 'stock' : 'stocks'}
            </span>
          </div>
          {watchlist.description && (
            <p className="mt-2 text-xs text-slate-400 max-w-2xl leading-relaxed">
              {watchlist.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAddItemError(null);
              setSearchQuery('');
              setAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Stock
          </button>

          <button
            type="button"
            onClick={() => {
              setEditName(watchlist.name);
              setEditDesc(watchlist.description || '');
              setEditModalOpen(true);
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            Edit Info
          </button>

          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stock Table */}
      {watchlist.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-semibold text-white">No Stocks in Watchlist</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Search for genuinely supported NSE or BSE equities and add them to this watchlist.
          </p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 transition"
          >
            + Add First Stock
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Symbol & Company
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Exchange
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Current Price
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Change
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    % Change
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Data Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {watchlist.items.map((item) => {
                  const q = item.quote;
                  const isPositive = q?.change !== null && q?.change !== undefined && q.change > 0;
                  const isNegative = q?.change !== null && q?.change !== undefined && q.change < 0;
                  const isFav = favorites.some((f) => f.symbol === item.symbol && f.exchange === item.exchange);

                  return (
                    <tr key={`${item.exchange}:${item.symbol}`} className="hover:bg-white/[0.02] transition">
                      {/* Symbol & Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => void toggleFavorite(item.symbol, item.exchange as SupportedExchange)}
                            className="text-slate-400 hover:text-amber-400 transition"
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <svg
                              className={`h-4 w-4 ${isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`}
                              viewBox="0 0 20 20"
                              fill={isFav ? 'currentColor' : 'none'}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                          <div>
                            <span className="font-bold text-white text-sm">
                              {item.symbol}
                            </span>
                            <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                              {item.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Exchange */}
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {item.exchange}
                        </span>
                      </td>

                      {/* Current Price */}
                      <td className="px-4 py-4 text-right font-medium">
                        {q?.price !== null && q?.price !== undefined ? (
                          <span className="text-white font-mono text-sm">
                            ₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unavailable</span>
                        )}
                      </td>

                      {/* Absolute Change */}
                      <td className="px-4 py-4 text-right font-mono">
                        {q?.change !== null && q?.change !== undefined ? (
                          <span className={isPositive ? 'text-emerald-400 font-semibold' : isNegative ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                            {isPositive ? '+' : ''}{q.change.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Percent Change */}
                      <td className="px-4 py-4 text-right font-mono">
                        {q?.changePercent !== null && q?.changePercent !== undefined ? (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isNegative
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-white/5 text-slate-400'
                          }`}>
                            {isPositive ? '+' : ''}{q.changePercent.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Data Freshness */}
                      <td className="px-4 py-4 text-center">
                        {q ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            q.freshness === 'live'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : q.isStale
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-sky-500/10 text-sky-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              q.freshness === 'live' ? 'bg-emerald-400 animate-pulse' : q.isStale ? 'bg-amber-400' : 'bg-sky-400'
                            }`} />
                            {q.freshness}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No feed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/market`}
                            className="text-xs text-sky-400 hover:text-sky-300 font-medium transition"
                          >
                            Chart
                          </Link>
                          <span className="text-white/20">•</span>
                          <button
                            type="button"
                            onClick={() =>
                              removeMutation.mutate({
                                symbol: item.symbol,
                                exchange: item.exchange as SupportedExchange,
                              })
                            }
                            disabled={removeMutation.isPending}
                            className="text-xs text-rose-400 hover:text-rose-300 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Stock to Watchlist</h2>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Search the verified NSE / BSE tradable universe. Only genuine registered stocks can be added.
            </p>

            {addItemError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {addItemError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Search Stock (Symbol or Company Name)
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. RELIANCE, TCS, INFY, HDFCBANK"
                    className="block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    autoFocus
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-2.5">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results Dropdown */}
              <div className="max-h-60 overflow-y-auto divide-y divide-white/5 rounded-xl border border-white/10 bg-slate-950/80">
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 10).map((item) => (
                    <div
                      key={`${item.exchange}:${item.symbol}`}
                      className="flex items-center justify-between p-3 hover:bg-white/5 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{item.symbol}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {item.exchange}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          addMutation.mutate({
                            symbol: item.symbol,
                            exchange: (item.exchange || 'NSE') as SupportedExchange,
                          })
                        }
                        disabled={addMutation.isPending}
                        className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 transition disabled:opacity-50"
                      >
                        + Add
                      </button>
                    </div>
                  ))
                ) : searchQuery.trim().length >= 1 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching instruments found for &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Type a symbol like RELIANCE, TCS, or INFY to search...
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Watchlist Info Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Edit Watchlist Info</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({ name: editName, description: editDesc });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="editWlNameDetail">
                  Name *
                </label>
                <input
                  id="editWlNameDetail"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="editWlDescDetail">
                  Description
                </label>
                <textarea
                  id="editWlDescDetail"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !editName.trim()}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl text-center">
            <h2 className="text-base font-bold text-white">Delete &quot;{watchlist.name}&quot;?</h2>
            <p className="mt-2 text-xs text-slate-400">
              This will permanently delete this watchlist and all its tracked stocks.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
