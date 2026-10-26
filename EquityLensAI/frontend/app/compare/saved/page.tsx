'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SavedComparison } from '@equitylensai/shared';
import {
  listSavedComparisons,
  deleteSavedComparison,
  duplicateSavedComparison,
} from '@/services/api/compare';

export default function SavedComparisonsPage() {
  const router = useRouter();
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadSaved = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listSavedComparisons();
      setComparisons(data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not load your saved comparisons.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete comparison "${name}"?`)) return;
    try {
      await deleteSavedComparison(id);
      setComparisons((prev) => prev.filter((c) => c.id !== id));
      setActionMsg(`Comparison "${name}" deleted.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comparison.');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateSavedComparison(id);
      setComparisons((prev) => [dup, ...prev]);
      setActionMsg(`Created duplicate "${dup.name}".`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate comparison.');
    }
  };

  const handleOpen = (comp: SavedComparison) => {
    const symsParam = comp.symbols.map((s) => `${s.symbol}:${s.exchange}`).join(',');
    router.push(`/compare?symbols=${encodeURIComponent(symsParam)}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Saved Comparisons</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
              {comparisons.length} Sets
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Revisit your custom peer comparison configurations and evaluate against current data.
          </p>
        </div>

        <Link
          href="/compare"
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 transition"
        >
          <span>← Back to Workbench</span>
        </Link>
      </div>

      {actionMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-400 flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 rounded-xl border border-white/10 bg-slate-900/40 flex items-center justify-center text-xs text-slate-400 animate-pulse">
          Loading saved peer comparison configurations...
        </div>
      ) : comparisons.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center space-y-3">
          <div className="text-3xl">📁</div>
          <div className="text-sm font-semibold text-white">No saved comparisons found</div>
          <div className="text-xs text-slate-400 max-w-md mx-auto">
            You haven&apos;t saved any peer sets yet. Go to the comparison workbench, select companies, and click &ldquo;Save Set&rdquo; to store configurations for quick access.
          </div>
          <div className="pt-2">
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-400 hover:bg-sky-500/20 transition"
            >
              Open Comparison Workbench
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comparisons.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-3 backdrop-blur-sm transition hover:border-white/20 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-white leading-tight">{c.name}</h3>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 uppercase font-mono">
                    {c.period} • {c.scope}
                  </span>
                </div>

                {c.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">{c.description}</p>
                )}

                {/* Company Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {c.symbols.map((s) => (
                    <span
                      key={s.symbol}
                      className="rounded-md border border-white/10 bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-sky-400 font-mono"
                    >
                      {s.symbol}
                      <span className="text-[9px] text-slate-500 ml-1 font-normal">{s.exchange}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs">
                <div className="text-[10px] text-slate-500">
                  Updated {new Date(c.updatedAt).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(c.id)}
                    className="text-slate-400 hover:text-white transition text-xs"
                    title="Duplicate configuration"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="text-slate-400 hover:text-rose-400 transition text-xs"
                    title="Delete configuration"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleOpen(c)}
                    className="rounded-lg bg-sky-500/20 border border-sky-500/30 px-3 py-1 font-medium text-sky-300 hover:bg-sky-500/30 transition text-xs"
                  >
                    Open Set →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
