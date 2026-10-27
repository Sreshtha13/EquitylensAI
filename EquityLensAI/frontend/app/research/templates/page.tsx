'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useResearchTemplates } from '@/hooks/useResearch';
import { CreateProjectModal } from '@/components/research/CreateProjectModal';

export default function ResearchTemplatesPage() {
  const { data: templatesData, isLoading } = useResearchTemplates();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const templates = templatesData?.templates || [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Phase 13 Report Templates
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Institutional Report Templates
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Standardized financial research frameworks configured with deterministic metrics, verified filings, peer benchmarks, and Gemini AI narrative grounding.
          </p>
        </div>

        <Link
          href="/research"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-sky-500/30 hover:bg-slate-800 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Research Workbench</span>
        </Link>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl backdrop-blur-xl transition hover:border-sky-500/30 hover:bg-slate-900/90"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">{tpl.name}</h3>
                  <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                    {tpl.defaultSections.length} Sections
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {tpl.description}
                </p>

                <div className="mt-4 border-t border-white/5 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Default Sections
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.defaultSections.map((sec) => (
                      <span
                        key={sec.sectionType}
                        className="rounded-lg border border-white/10 bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300"
                      >
                        {sec.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-[11px] text-slate-500">
                  Version 1.0 • Grounded Provenance
                </span>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-300 transition hover:border-sky-500/50 hover:bg-sky-500/20"
                >
                  <span>Use Template</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
