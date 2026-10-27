'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateResearchReport, useResearchTemplates } from '@/hooks/useResearch';

interface CreateReportModalProps {
  projectId: string;
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateReportModal({
  projectId,
  symbol,
  isOpen,
  onClose,
}: CreateReportModalProps) {
  const router = useRouter();
  const { data: templatesData } = useResearchTemplates();
  const createReportMutation = useCreateResearchReport(projectId);

  const [selectedTemplateId, setSelectedTemplateId] = useState('comprehensive_research');
  const [title, setTitle] = useState(`${symbol} Comprehensive Research Report`);
  const [researchQuestion, setResearchQuestion] = useState('');
  const [includePeers, setIncludePeers] = useState(true);
  const [includeNews, setIncludeNews] = useState(true);
  const [periods, setPeriods] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTemplate = templatesData?.templates.find((t) => t.id === selectedTemplateId);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templatesData?.templates.find((t) => t.id === templateId);
    if (tpl) {
      setTitle(`${symbol} ${tpl.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please enter a report title.');
      return;
    }

    setErrorMessage(null);

    try {
      const result = await createReportMutation.mutateAsync({
        title: title.trim(),
        templateId: selectedTemplateId,
        periods,
        includePeers,
        includeNews,
        ...(researchQuestion.trim() ? { researchQuestion: researchQuestion.trim() } : {}),
      });

      onClose();
      router.push(`/research/${projectId}/reports/${result.report.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create report';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Generate Structured Investment Report</h2>
            <p className="mt-1 text-xs text-slate-400">
              Compose an evidence-backed report for {symbol} using deterministic platform data and Gemini AI interpretation.
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
          {/* Template Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Institutional Template *
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {templatesData?.templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>

            {currentTemplate && (
              <div className="mt-3 rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-xs text-slate-300">
                <p className="font-semibold text-sky-400">{currentTemplate.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-slate-400 text-[11px] font-semibold mr-1">Sections:</span>
                  {currentTemplate.defaultSections.map((sec) => (
                    <span
                      key={sec.sectionType}
                      className="rounded-md border border-white/10 bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {sec.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Report Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              required
            />
          </div>

          {/* Research Question */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Targeted Research Question (Optional)
            </label>
            <input
              type="text"
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              placeholder="e.g. Evaluate sustainability of operating margins and leverage under high interest rates"
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 pt-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Financial Periods
              </label>
              <select
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs text-white"
              >
                <option value={3}>3 Annual Periods</option>
                <option value={4}>4 Annual Periods</option>
                <option value={5}>5 Annual Periods</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includePeers}
                  onChange={(e) => setIncludePeers(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-sky-500 focus:ring-0"
                />
                <span>Include Peer Benchmarks</span>
              </label>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeNews}
                  onChange={(e) => setIncludeNews(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-sky-500 focus:ring-0"
                />
                <span>Include Corporate Announcements</span>
              </label>
            </div>
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
              disabled={createReportMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {createReportMutation.isPending ? (
                <span>Assembling Report...</span>
              ) : (
                <>
                  <span>Generate Report</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
