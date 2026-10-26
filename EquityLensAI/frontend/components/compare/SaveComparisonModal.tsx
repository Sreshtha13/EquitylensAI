'use client';

import { useState } from 'react';
import type {
  ComparisonCompanyTarget,
  SavedComparison,
  SupportedPeriod,
} from '@equitylensai/shared';
import { createSavedComparison } from '@/services/api/compare';

type SaveComparisonModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbols: ComparisonCompanyTarget[];
  period: SupportedPeriod;
  scope: 'consolidated' | 'standalone';
  onSaved?: (saved: SavedComparison) => void;
};

export function SaveComparisonModal({
  isOpen,
  onClose,
  selectedSymbols,
  period,
  scope,
  onSaved,
}: SaveComparisonModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this comparison.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: {
        name: string;
        symbols: ComparisonCompanyTarget[];
        period: SupportedPeriod;
        scope: 'consolidated' | 'standalone';
        description?: string;
      } = {
        name: name.trim(),
        symbols: selectedSymbols,
        period,
        scope,
      };
      if (description.trim()) {
        payload.description = description.trim();
      }

      const saved = await createSavedComparison(payload);

      if (onSaved) {
        onSaved(saved);
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save comparison configuration.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-base font-bold text-white">Save Comparison</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-2.5 text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Comparison Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Bluechips (TCS vs INFY)"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add personal notes or rationale for this peer comparison set..."
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none resize-none"
            />
          </div>

          <div className="rounded-lg bg-slate-950/60 p-3 space-y-1 text-slate-400">
            <div className="font-semibold text-slate-300">Configuration Details</div>
            <div>Companies: {selectedSymbols.map((s) => s.symbol).join(', ')}</div>
            <div>Period: <span className="uppercase">{period}</span> • Scope: {scope}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/5 px-4 py-2 font-medium text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-sky-400 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
