'use client';

import { useState } from 'react';
import type {
  ComparisonCompanyTarget,
  AiComparisonAnalysis,
  SupportedPeriod,
} from '@equitylensai/shared';
import { getAiComparisonAnalysis } from '@/services/api/compare';

type AiComparisonPanelProps = {
  selectedSymbols: ComparisonCompanyTarget[];
  period?: SupportedPeriod;
};

export function AiComparisonPanel({ selectedSymbols, period = 'annual' }: AiComparisonPanelProps) {
  const [analysis, setAnalysis] = useState<AiComparisonAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSynthesis = async () => {
    if (selectedSymbols.length < 2) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await getAiComparisonAnalysis(selectedSymbols, period);
      setAnalysis(res);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not generate comparative synthesis at this time.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 text-xs font-bold text-white shadow-md">
            AI
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Evidence-Grounded AI Comparative Analysis
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic backend calculations translated into structured comparative insights.
            </p>
          </div>
        </div>

        <button
          onClick={generateSynthesis}
          disabled={isLoading || selectedSymbols.length < 2}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Analyzing Fundamentals...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{analysis ? 'Regenerate Analysis' : 'Generate AI Synthesis'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="py-8 text-center space-y-2">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <div className="text-xs text-slate-400">
            Grounding comparative facts and synthesizing cross-company fundamental differences...
          </div>
        </div>
      )}

      {!isLoading && !analysis && (
        <div className="py-6 text-center text-xs text-slate-400">
          Click &ldquo;Generate AI Synthesis&rdquo; to produce an evidence-backed comparative narrative for the selected companies.
        </div>
      )}

      {!isLoading && analysis && (
        <div className="space-y-4 pt-1">
          {/* Executive Summary */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 p-4">
            <div className="text-xs font-semibold text-sky-300 uppercase tracking-wider mb-1">
              Executive Synthesis
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Analytical Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.sections.map((sec, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/10 bg-slate-900/60 p-4 space-y-2"
              >
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {sec.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{sec.content}</p>

                {sec.evidenceIds && sec.evidenceIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {sec.evidenceIds.map((eid, eIdx) => (
                      <span
                        key={eIdx}
                        className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono text-sky-400"
                      >
                        ✓ {eid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Provenance & Disclaimer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[10px] text-slate-400">
            <div>{analysis.disclaimer}</div>
            <div className="font-mono">
              Model: {analysis.model} • {new Date(analysis.generatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
