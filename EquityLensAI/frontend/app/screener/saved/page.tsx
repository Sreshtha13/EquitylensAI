'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  listSavedScreens,
  deleteSavedScreen,
  duplicateSavedScreen,
  updateSavedScreen,
  type SavedScreen,
  type ScreenerCondition,
} from '@/services/api/screener';

export default function SavedScreensPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Rename modal state
  const [editingScreen, setEditingScreen] = useState<SavedScreen | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete modal state
  const [deletingScreenId, setDeletingScreenId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    listSavedScreens()
      .then((data) => {
        if (isMounted) {
          setSavedScreens(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load saved screens.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  async function handleDelete(screenId: string) {
    try {
      await deleteSavedScreen(screenId);
      setSavedScreens((prev) => prev.filter((s) => s.id !== screenId));
      setDeletingScreenId(null);
      setActionSuccess('Screening strategy deleted successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete saved screen.');
    }
  }

  async function handleDuplicate(screenId: string) {
    try {
      const duplicated = await duplicateSavedScreen(screenId);
      setSavedScreens((prev) => [duplicated, ...prev]);
      setActionSuccess(`Duplicated as "${duplicated.name}".`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate saved screen.');
    }
  }

  async function handleUpdateDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editingScreen) return;

    setIsSavingEdit(true);
    try {
      const updated = await updateSavedScreen(editingScreen.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      setSavedScreens((prev) =>
        prev.map((s) => (s.id === editingScreen.id ? updated : s)),
      );
      setEditingScreen(null);
      setActionSuccess('Strategy details updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update strategy.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center p-6 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in to access Saved Strategies</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-md">
          Saved screening strategies persist your multi-condition filters, allowing you to rerun them against live financial data anytime.
        </p>
        <Link
          href="/login?redirect=/screener/saved"
          className="mt-6 rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <Link href="/screener" className="hover:text-white transition">
              ← Screener
            </Link>
            <span>/</span>
            <span>Saved Strategies</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-white">Saved Screening Strategies</h1>
          <p className="mt-1 text-sm text-slate-400">
            Reusable, user-isolated screening presets. Each strategy recalculates against current database records when rerun.
          </p>
        </div>

        <Link
          href="/screener"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400 shadow-md shadow-sky-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Screen</span>
        </Link>
      </div>

      {/* Success Toast */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Strategy List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm">Loading your strategies…</p>
        </div>
      ) : savedScreens.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-950/40 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">No saved strategies yet</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            Create custom multi-condition filters in the visual builder, then click &quot;Save Strategy&quot; to reopen and rerun anytime.
          </p>
          <Link
            href="/screener"
            className="mt-6 rounded-xl border border-white/10 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:border-sky-400/40 hover:text-white transition"
          >
            Go to Screener
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {savedScreens.map((screen) => {
            const def = screen.definition;
            const conditionsOnly = def.rootGroup.conditions.filter(
              (c): c is ScreenerCondition => !('logic' in c),
            );
            const conditionCount = conditionsOnly.length;
            const subGroupCount = def.rootGroup.conditions.length - conditionCount;

            return (
              <div
                key={screen.id}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl transition hover:border-sky-400/40 hover:bg-slate-950"
              >
                <div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      {def.exchange ? def.exchange : 'All Exchanges'}
                    </span>
                    <span className="rounded-md border border-white/10 bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                      {def.period.toUpperCase()}
                    </span>
                    <span className="rounded-md border border-white/5 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-400">
                      Schema v{def.schemaVersion}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-white">{screen.name}</h3>
                  {screen.description ? (
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {screen.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-slate-600">No description provided</p>
                  )}

                  {/* Filter Preview */}
                  <div className="mt-4 rounded-2xl border border-white/5 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      <span>Logic: {def.rootGroup.logic}</span>
                      <span>
                        {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
                        {subGroupCount > 0 ? ` · ${subGroupCount} group` : ''}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {def.rootGroup.conditions.slice(0, 3).map((item, idx) => {
                        if ('logic' in item) {
                          return (
                            <li key={idx} className="text-xs text-indigo-300 font-mono truncate">
                              Sub-group ({item.logic}) with {item.conditions.length} conditions
                            </li>
                          );
                        }
                        return (
                          <li key={idx} className="text-xs text-slate-300 flex items-center gap-1.5 font-mono truncate">
                            <span className="text-sky-400 font-sans">{item.field}</span>
                            <span className="text-amber-400 font-bold">{item.operator}</span>
                            <span>{item.value}</span>
                          </li>
                        );
                      })}
                      {conditionCount > 3 && (
                        <li className="text-[10px] text-slate-500 italic">
                          +{conditionCount - 3} more conditions…
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Metadata */}
                  <p className="mt-3 text-[10px] text-slate-500">
                    Updated: {new Date(screen.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScreen(screen);
                        setEditName(screen.name);
                        setEditDescription(screen.description ?? '');
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition"
                      title="Rename / Edit info"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(screen.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-sky-300 transition"
                      title="Duplicate strategy"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingScreenId(screen.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-rose-400 transition"
                      title="Delete strategy"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/screener?savedId=${screen.id}`}
                      className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/20 hover:text-white transition"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/screener?savedId=${screen.id}&autoRun=true`}
                      className="rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 transition shadow-sm shadow-sky-500/20"
                    >
                      Run Now
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename / Details Modal */}
      {editingScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Edit Strategy Info</h2>
            <form onSubmit={handleUpdateDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingScreen(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingScreenId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Delete Strategy?</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this saved screening strategy? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingScreenId(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingScreenId)}
                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400"
              >
                Delete Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
