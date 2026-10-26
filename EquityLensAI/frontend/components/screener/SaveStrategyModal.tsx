'use client';

import React, { useState } from 'react';
import { createSavedScreen } from '@/services/api/screener';
import type {
  ScreenerStrategyDefinition,
  ScreenerMetricDefinition,
} from '@/services/api/screener';
import { formatFilterGroupSummary } from './FilterGroupBuilder';

type SaveStrategyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  definition: ScreenerStrategyDefinition;
  metrics: ScreenerMetricDefinition[];
  onSuccess?: (savedId: string) => void;
};

export function SaveStrategyModal({
  isOpen,
  onClose,
  definition,
  metrics,
  onSuccess,
}: SaveStrategyModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const summary = formatFilterGroupSummary(definition.rootGroup, metrics);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Strategy name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createSavedScreen({
        name: cleanName,
        description: description.trim() || null,
        definition,
      });

      onSuccess?.(created.id);
      setName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save strategy.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Save Screening Strategy</h2>
            <p className="text-xs text-slate-400">
              Save your custom multi-condition screen to run or modify later
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label htmlFor="strategy-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Strategy Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="strategy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quality Growth & Low Debt"
              maxLength={120}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="strategy-description" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              id="strategy-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes on methodology, targeted market cap, or screening thesis..."
              maxLength={500}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none resize-none"
            />
          </div>

          {/* Strategy Summary Card */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Strategy Rules
            </p>
            <p className="mt-1 text-xs font-mono text-sky-300 break-words leading-relaxed">
              {summary}
            </p>
            <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400">
              <span>
                Period:{' '}
                <strong className="text-slate-200 uppercase">{definition.period}</strong>
              </span>
              <span>•</span>
              <span>
                Exchange:{' '}
                <strong className="text-slate-200">{definition.exchange || 'ALL'}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Strategy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
