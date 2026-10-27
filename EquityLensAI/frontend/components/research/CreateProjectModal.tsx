'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { useCreateResearchProject, useResearchTemplates } from '@/hooks/useResearch';
import type { InstrumentSummary } from '@/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialExchange?: string;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  initialSymbol,
  initialExchange = 'NSE',
}: CreateProjectModalProps) {
  const router = useRouter();
  const { data: templatesData } = useResearchTemplates();
  const createProjectMutation = useCreateResearchProject();

  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    exchange: string;
    name?: string;
  } | null>(
    initialSymbol
      ? { symbol: initialSymbol, exchange: initialExchange, name: initialSymbol }
      : null,
  );

  const [title, setTitle] = useState(
    initialSymbol ? `${initialSymbol} Research Workspace` : '',
  );
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('comprehensive_research');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectInstrument = (item: InstrumentSummary) => {
    setSelectedStock({
      symbol: item.symbol,
      exchange: item.exchange || 'NSE',
      name: item.name,
    });
    if (!title || title.endsWith('Research Workspace')) {
      setTitle(`${item.symbol} Research Workspace`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) {
      setErrorMessage('Please select an NSE or BSE company to research.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter a research workspace title.');
      return;
    }

    setErrorMessage(null);

    try {
      const result = await createProjectMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        symbol: selectedStock.symbol,
        exchange: selectedStock.exchange,
        ...(selectedStock.name ? { companyName: selectedStock.name } : {}),
        templateId: selectedTemplateId,
      });

      onClose();
      // If a report was created automatically with the template, we can navigate directly into workspace
      router.push(`/research/${result.project.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create research workspace';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Create Research Workspace</h2>
            <p className="mt-1 text-xs text-slate-400">
              Gather verified market data, financial statements, peer benchmarks, and evidence-grounded reports.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* Company Search */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Company (NSE / BSE) *
            </label>
            <InstrumentSearch
              onSelect={handleSelectInstrument}
              {...(selectedStock?.symbol ? { selectedSymbol: selectedStock.symbol } : {})}
            />
            {selectedStock && (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <span className="font-bold">{selectedStock.symbol}</span>
                <span className="text-emerald-400/80">({selectedStock.exchange})</span>
                <span className="text-slate-300 truncate">{selectedStock.name}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Workspace Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reliance Fundamental Review 2026"
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Research Objective / Scope (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Document investment thesis, specific risks, or key drivers to evaluate..."
              rows={2}
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Initial Report Template */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Initial Report Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {templatesData?.templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} — {tpl.description}
                </option>
              ))}
            </select>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProjectMutation.isPending || !selectedStock}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {createProjectMutation.isPending ? (
                <span>Creating Workspace...</span>
              ) : (
                <>
                  <span>Create Workspace</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
