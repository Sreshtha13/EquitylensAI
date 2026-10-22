'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listFavorites, removeFavorite } from '@/services/api/favorites';
import type { SupportedExchange } from '@equitylensai/shared';

export default function FavoritesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: favorites = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['favorites'],
    queryFn: listFavorites,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ symbol, exchange }: { symbol: string; exchange?: SupportedExchange }) =>
      removeFavorite(symbol, exchange),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Sign In to View Favorites</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Star your favorite companies from Markets, Screener, and Research to keep them at your fingertips.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-sky-400 hover:to-indigo-500 transition"
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
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Starred Stocks
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Favorite Equities
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Your personal watchlist of starred companies across all screens.
        </p>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
      ) : isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error instanceof Error ? error.message : 'Failed to load favorites.'}
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-semibold text-white">No Favorites Yet</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Click the star icon next to any stock on the Markets, Screener, or Research page to add it here.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/market"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 transition"
            >
              Explore Markets
            </Link>
            <Link
              href="/screener"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Open Screener
            </Link>
          </div>
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
                    Price
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Change
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    % Change
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {favorites.map((item) => {
                  const q = item.quote;
                  const isPositive = q?.change !== null && q?.change !== undefined && q.change > 0;
                  const isNegative = q?.change !== null && q?.change !== undefined && q.change < 0;

                  return (
                    <tr key={`${item.exchange}:${item.symbol}`} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              removeMutation.mutate({
                                symbol: item.symbol,
                                exchange: item.exchange as SupportedExchange,
                              })
                            }
                            className="text-amber-400 hover:text-slate-400 transition"
                            title="Remove from favorites"
                          >
                            <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                          <div>
                            <Link
                              href={`/stocks/${encodeURIComponent(item.exchange)}/${encodeURIComponent(item.symbol)}`}
                              className="font-bold text-white text-sm hover:text-sky-300 transition"
                            >
                              {item.symbol}
                            </Link>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.name}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {item.exchange}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right font-medium">
                        {q?.price !== null && q?.price !== undefined ? (
                          <span className="text-white font-mono text-sm">
                            ₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unavailable</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right font-mono">
                        {q?.change !== null && q?.change !== undefined ? (
                          <span className={isPositive ? 'text-emerald-400 font-semibold' : isNegative ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                            {isPositive ? '+' : ''}{q.change.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

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

                      <td className="px-5 py-4 text-right">
                        <Link
                          href="/market"
                          className="text-xs font-medium text-sky-400 hover:text-sky-300 transition"
                        >
                          View Chart →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
