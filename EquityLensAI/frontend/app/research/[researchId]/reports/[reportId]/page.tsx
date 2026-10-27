'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  useResearchReport,
  useUpdateResearchReport,
  useGenerateReportSection,
  useRefreshReport,
} from '@/hooks/useResearch';
import { RefreshDiffModal } from '@/components/research/RefreshDiffModal';
import { VersionHistoryModal } from '@/components/research/VersionHistoryModal';
import { EvidenceRegisterTable } from '@/components/research/EvidenceRegisterTable';
import { ResearchNotesPanel } from '@/components/research/ResearchNotesPanel';
import {
  downloadPdfReport,
  downloadCsvReport,
  type ResearchReportSection,
  type RefreshReportDiff,
  type ResearchReportStatus,
} from '@/services/api/research';

export default function ReportEditorPage({
  params,
}: {
  params: Promise<{ researchId: string; reportId: string }>;
}) {
  const resolvedParams = use(params);
  const { researchId, reportId } = resolvedParams;

  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useResearchReport(researchId, reportId);

  const updateReportMutation = useUpdateResearchReport(researchId, reportId);
  const generateSectionMutation = useGenerateReportSection(researchId, reportId);
  const refreshReportMutation = useRefreshReport(researchId, reportId);

  const report = reportData?.report;

  // Local state for editing
  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionContent, setEditSectionContent] = useState('');
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');

  // Modals
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffData, setDiffData] = useState<RefreshReportDiff | null>(null);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  useEffect(() => {
    if (report) {
      setTitle(report.title);
    }
  }, [report]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 animate-pulse">
        <div className="h-10 w-48 rounded-2xl bg-slate-900/60" />
        <div className="h-32 w-full rounded-3xl bg-slate-900/60" />
        <div className="h-96 w-full rounded-3xl bg-slate-900/60" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <h2 className="text-xl font-bold text-white">Report Not Found</h2>
        <p className="mt-2 text-xs text-slate-400">
          The requested investment research report could not be found.
        </p>
        <Link
          href={`/research/${researchId}`}
          className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
        >
          Back to Workspace
        </Link>
      </div>
    );
  }

  const handleSaveTitle = async () => {
    if (!title.trim() || title === report.title) {
      setIsEditingTitle(false);
      return;
    }
    setSaveStatus('saving');
    try {
      await updateReportMutation.mutateAsync({
        title: title.trim(),
        version: report.version,
      });
      setIsEditingTitle(false);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to update title', err);
      setSaveStatus('error');
    }
  };

  const handleUpdateStatus = async (status: ResearchReportStatus) => {
    setSaveStatus('saving');
    try {
      await updateReportMutation.mutateAsync({
        status,
        version: report.version,
        ...(status === 'finalized'
          ? { createSnapshot: true, snapshotNotes: 'Finalized report snapshot' }
          : {}),
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to update status', err);
      setSaveStatus('error');
    }
  };

  const handleStartEditSection = (sec: ResearchReportSection) => {
    setEditingSectionId(sec.id);
    setEditSectionContent(sec.content || '');
  };

  const handleSaveSectionEdit = async (sectionId: string) => {
    if (!report.sections) return;
    setSaveStatus('saving');

    const updatedSections = report.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        status: 'reviewed' as const,
        content: editSectionContent,
      };
    });

    try {
      await updateReportMutation.mutateAsync({
        sections: updatedSections,
        version: report.version,
      });
      setEditingSectionId(null);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save section edit', err);
      setSaveStatus('error');
    }
  };

  const handleRegenerateSection = async (sec: ResearchReportSection) => {
    setRegeneratingSectionId(sec.id);
    try {
      await generateSectionMutation.mutateAsync({
        sectionId: sec.id,
        sectionType: sec.sectionType,
        ...(regenPrompt.trim() ? { researchQuestion: regenPrompt.trim() } : {}),
        preserveUserNotes: true,
      });
      setRegeneratingSectionId(null);
      setRegenPrompt('');
    } catch (err) {
      console.error('Failed to regenerate section', err);
      alert('Section regeneration failed. Check API logs.');
      setRegeneratingSectionId(null);
    }
  };

  const handleInitiateRefresh = async () => {
    try {
      const res = await refreshReportMutation.mutateAsync({
        saveNewVersion: false,
      });
      setDiffData(res.diff);
      setIsDiffModalOpen(true);
    } catch (err) {
      console.error('Failed to check refresh diff', err);
      alert('Failed to refresh market data.');
    }
  };

  const handleConfirmRefresh = async (saveNewVersion: boolean, versionNotes: string) => {
    try {
      await refreshReportMutation.mutateAsync({
        saveNewVersion,
        versionNotes,
      });
      await refetch();
    } catch (err) {
      console.error('Refresh confirmation failed', err);
    }
  };

  const handleExportPdf = async () => {
    setIsDownloading('pdf');
    try {
      await downloadPdfReport(
        researchId,
        reportId,
        `${report.title.replace(/\s+/g, '_')}_v${report.version || 1}.pdf`,
      );
    } catch (err) {
      console.error('Export PDF failed', err);
      alert('PDF generation failed.');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleExportCsv = async () => {
    setIsDownloading('csv');
    try {
      await downloadCsvReport(
        researchId,
        reportId,
        `${report.title.replace(/\s+/g, '_')}_v${report.version || 1}.csv`,
      );
    } catch (err) {
      console.error('Export CSV failed', err);
      alert('CSV generation failed.');
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* Breadcrumb & Auto-save Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Link href="/research" className="hover:text-white transition">
            Research
          </Link>
          <span>/</span>
          <Link href={`/research/${researchId}`} className="hover:text-white transition">
            Workspace
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-200 truncate max-w-xs">{report.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
              Saving changes...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-slate-500">
              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All changes saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-rose-400">Failed to save (conflict or network error)</span>
          )}
        </div>
      </div>

      {/* Report Header Card */}
      <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400 uppercase tracking-wider">
              {report.templateId.replace(/_/g, ' ')}
            </span>
            <span className="rounded-lg border border-white/10 bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
              Version {report.version || 1}
            </span>
            <select
              value={report.status}
              onChange={(e) => handleUpdateStatus(e.target.value as ResearchReportStatus)}
              className="rounded-xl border border-white/10 bg-slate-800/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-200 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="finalized">Finalized</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Quick Actions: Refresh, Snapshots, Export */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleInitiateRefresh}
              disabled={refreshReportMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
              title="Refresh with current market quotes"
            >
              <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Data</span>
            </button>

            <button
              onClick={() => setIsVersionsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <svg className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Snapshots</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isDownloading === 'pdf'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>{isDownloading === 'pdf' ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={isDownloading === 'csv'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isDownloading === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Editable Title */}
        <div>
          {isEditingTitle ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-sky-500 bg-slate-800 px-4 py-2 text-xl font-black text-white focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                className="rounded-xl border border-sky-500 bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTitle(report.title);
                  setIsEditingTitle(false);
                }}
                className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {report.title}
              </h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-sky-300"
                title="Edit Title"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>
              Generated:{' '}
              <strong className="text-slate-200">
                {report.generatedAt
                  ? new Date(report.generatedAt).toLocaleString()
                  : new Date(report.createdAt).toLocaleString()}
              </strong>
            </span>
            <span>•</span>
            <span>
              Last Refreshed:{' '}
              <strong className="text-slate-200">
                {report.lastRefreshedAt
                  ? new Date(report.lastRefreshedAt).toLocaleString()
                  : 'Current'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Evidence Grounding:{' '}
              <strong className="text-emerald-400">
                {report.evidence?.length || 0} Verified Data Points
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Report Sections List */}
      <div className="flex flex-col gap-6">
        {report.sections?.map((sec, idx) => {
          const isEditing = editingSectionId === sec.id;
          const isRegenerating = regeneratingSectionId === sec.id;

          const contentSummary = sec.content || '';

          const contentTable =
            sec.structuredData && typeof sec.structuredData === 'object' && 'table' in sec.structuredData
              ? (sec.structuredData.table as { columns: string[]; rows: (string | number)[][] })
              : null;

          return (
            <div
              key={sec.id || idx}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl"
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-xs font-bold text-sky-400 border border-sky-500/20">
                    {idx + 1}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-white">{sec.title}</h2>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      {sec.sectionType.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      sec.status === 'reviewed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {sec.status === 'reviewed' ? 'Reviewed' : 'Pending Review'}
                  </span>

                  {!isEditing && (
                    <button
                      onClick={() => handleStartEditSection(sec)}
                      className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    onClick={() => handleRegenerateSection(sec)}
                    disabled={isRegenerating}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
                  >
                    <svg className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                  </button>
                </div>
              </div>

              {/* Section Body */}
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={editSectionContent}
                    onChange={(e) => setEditSectionContent(e.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-sky-500 bg-slate-950 p-4 text-xs text-white focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingSectionId(null)}
                      className="rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveSectionEdit(sec.id)}
                      className="rounded-xl border border-sky-500 bg-sky-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    >
                      Save Section
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 text-xs text-slate-300 leading-relaxed">
                  {contentSummary && (
                    <div className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                      {contentSummary}
                    </div>
                  )}

                  {/* Financial/Comparison Tables */}
                  {contentTable && contentTable.columns && contentTable.rows && (
                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/60 p-2">
                      <table className="w-full text-left font-mono text-[11px]">
                        <thead className="border-b border-white/10 text-slate-400">
                          <tr>
                            {contentTable.columns.map((c, cIdx) => (
                              <th key={cIdx} className="px-3 py-2 font-sans font-bold">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {contentTable.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-900/50">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2">
                                  {typeof cell === 'number'
                                    ? cell.toLocaleString()
                                    : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Cited Evidence IDs footer */}
              {sec.evidenceIds && sec.evidenceIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Citations:
                  </span>
                  {sec.evidenceIds.map((eId) => (
                    <span
                      key={eId}
                      className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400 border border-sky-500/20"
                    >
                      {eId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analyst Notes Scoped to Report */}
      <ResearchNotesPanel
        projectId={researchId}
        reportId={reportId}
      />

      {/* Evidence Register for Report */}
      {report.evidence && report.evidence.length > 0 && (
        <EvidenceRegisterTable
          evidence={report.evidence}
          title={`Evidence Register for ${report.title}`}
        />
      )}

      {/* Non-Negotiable Compliance Disclaimer */}
      <div className="rounded-3xl border border-white/5 bg-slate-950/80 p-6 text-xs text-slate-400 leading-relaxed">
        <h3 className="font-bold uppercase tracking-wider text-slate-300">
          Methodology & Statutory Disclaimers
        </h3>
        <p className="mt-2">
          This report is synthesized using deterministic financial metrics and official filings from NSE/BSE and verified providers. Qualitative interpretations are generated via Gemini AI grounded strictly in cited evidence identifiers. EquityLensAI provides institutional research tooling and does not issue automated BUY, SELL, or return-guaranteed investment advice. Users must independently evaluate assumptions and risks.
        </p>
      </div>

      {/* Modals */}
      <RefreshDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        diff={diffData}
        onConfirmRefresh={handleConfirmRefresh}
        isRefreshing={refreshReportMutation.isPending}
      />

      <VersionHistoryModal
        projectId={researchId}
        reportId={reportId}
        isOpen={isVersionsModalOpen}
        onClose={() => setIsVersionsModalOpen(false)}
      />
    </div>
  );
}
