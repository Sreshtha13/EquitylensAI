'use client';

import { useEffect, useState } from 'react';
import {
  getScreenerTemplates,
  type ScreenerTemplate,
} from '@/services/api/screener';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: ScreenerTemplate) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  value: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  growth: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  profitability: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  financial_strength: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  financial_health: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  momentum: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

export function TemplatesModal({ isOpen, onClose, onApplyTemplate }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<ScreenerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getScreenerTemplates()
      .then((data) => {
        if (isMounted) {
          setTemplates(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load strategy templates');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = ['all', ...Array.from(new Set(templates.map((t) => t.category)))];

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <h2 id="templates-modal-title" className="text-xl font-bold text-white">
                Screener Strategy Templates
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Verified deterministic presets based on fundamental and quantitative criteria. These are not investment recommendations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-slate-400 hover:border-white/20 hover:text-white transition"
            aria-label="Close templates modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-6 py-3 bg-slate-950/40">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'border border-white/10 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
              <p className="text-sm">Loading strategy templates…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-center py-12 text-sm text-slate-400">No templates found in this category.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredTemplates.map((template) => {
                const colorCls = CATEGORY_COLORS[template.category] || 'border-slate-500/30 bg-slate-500/10 text-slate-300';
                return (
                  <div
                    key={template.id}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-5 transition hover:border-sky-400/40 hover:bg-slate-950/90"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorCls}`}>
                          {template.category.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {template.definition.period.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{template.name}</h3>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{template.description}</p>

                      {/* Highlights */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {template.highlights.map((h) => (
                          <span
                            key={h}
                            className="rounded-md border border-white/5 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* Conditions Summary */}
                      <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/60 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Filter Logic ({template.definition.rootGroup.logic})
                        </p>
                        <ul className="space-y-1">
                          {template.definition.rootGroup.conditions.map((item, i) => {
                            if ('logic' in item) {
                              return (
                                <li key={i} className="text-xs text-indigo-300 font-mono">
                                  Group ({item.logic}) with {item.conditions.length} conditions
                                </li>
                              );
                            }
                            return (
                              <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                                <span className="text-sky-400 font-sans">{item.field}</span>
                                <span className="text-amber-400 font-semibold">{item.operator}</span>
                                <span>{item.value}{item.upperValue !== undefined && item.upperValue !== null ? ` – ${item.upperValue}` : ''}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Assumptions */}
                      <p className="mt-3 text-[11px] text-slate-500 italic leading-snug">
                        Note: {template.assumptions}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyTemplate(template);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400 shadow-md shadow-sky-500/20"
                      >
                        <span>Apply Template</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-slate-950/60 text-xs text-slate-500">
          <span>Templates populate the visual filter builder and can be customized before running.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
