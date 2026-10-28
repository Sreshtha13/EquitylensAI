'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  useResearchProject,
  useResearchReports,
  useUpdateResearchProject,
  useDeleteResearchReport,
} from '@/hooks/useResearch';
import { useFinancialAnalysis } from '@/hooks/useFinancial';
import { useStockQuote } from '@/hooks/useMarket';
import { useCompanyProfile } from '@/hooks/useStocks';
import { CreateReportModal } from '@/components/research/CreateReportModal';
import { ResearchNotesPanel } from '@/components/research/ResearchNotesPanel';
import { EvidenceRegisterTable } from '@/components/research/EvidenceRegisterTable';
import { HealthScoreCard } from '@/components/financial/HealthScoreCard';
import { FinancialMetricsGrid } from '@/components/financial/FinancialMetricsGrid';
import { FinancialStatementsTable } from '@/components/financial/FinancialStatementsTable';
import { AiResearchPanel } from '@/components/research/AiResearchPanel';
import { downloadPdfReport, downloadCsvReport, type ResearchReport } from '@/services/api/research';

type WorkspaceTab =
  | 'reports'
  | 'fundamentals'
  | 'peers'
  | 'news'
  | 'ai_assistant'
  | 'notes'
  | 'evidence';

export default function ResearchWorkspacePage({
  params,
}: {
  params: Promise<{ researchId: string }>;
}) {
  const resolvedParams = use(params);
  const researchId = resolvedParams.researchId;

  const { data: projectData, isLoading: isProjectLoading, error: projectError } = useResearchProject(researchId);
  const { data: reportsData, isLoading: isReportsLoading } = useResearchReports(researchId);
  const updateProjectMutation = useUpdateResearchProject();
  const deleteReportMutation = useDeleteResearchReport(researchId);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('reports');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const project = projectData?.project;
  const symbol = project?.symbol || '';
  const exchange = project?.exchange || 'NSE';

  // Live Fundamentals
  const {
    data: analysis,
    isLoading: isAnalysisLoading,
  } = useFinancialAnalysis(symbol, {
    exchange,
    periods: 4,
  });

  // Quote
  const { data: quote } = useStockQuote(symbol, exchange);

  // Profile
  const { data: profile } = useCompanyProfile(symbol, exchange);

  const reports: ResearchReport[] = reportsData?.reports || [];

  const handleUpdateStatus = async (status: 'draft' | 'in_progress' | 'ready_for_review' | 'finalized' | 'archived') => {
    if (!project) return;
    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        data: { status },
      });
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Delete this research report?')) return;
    try {
      await deleteReportMutation.mutateAsync(reportId);
    } catch (err) {
      console.error('Failed to delete report', err);
    }
  };

  const handleDownloadPdf = async (report: ResearchReport) => {
    try {
      setDownloadingId(`pdf-${report.id}`);
      await downloadPdfReport(
        researchId,
        report.id,
        `${project?.symbol || 'Report'}_${report.templateId}_v${report.version || 1}.pdf`,
      );
    } catch (err) {
      console.error('PDF download failed', err);
      alert('Failed to download PDF report. Ensure server has generated the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCsv = async (report: ResearchReport) => {
    try {
      setDownloadingId(`csv-${report.id}`);
      await downloadCsvReport(
        researchId,
        report.id,
        `${project?.symbol || 'Report'}_${report.templateId}_v${report.version || 1}.csv`,
      );
    } catch (err) {
      console.error('CSV download failed', err);
      alert('Failed to download CSV report.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isProjectLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 animate-pulse">
        <div className="h-10 w-48 rounded-2xl bg-slate-900/60" />
        <div className="h-40 w-full rounded-3xl bg-slate-900/60" />
        <div className="h-96 w-full rounded-3xl bg-slate-900/60" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">Research Workspace Not Found</h2>
        <p className="mt-2 text-xs text-slate-400 max-w-md">
          This workspace does not exist or you do not have permission to access it.
        </p>
        <Link
          href="/research"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
        >
          Return to Workbench
        </Link>
      </div>
    );
  }

  // Aggregate evidence across reports
  const allEvidence = reports.flatMap((r: ResearchReport) => r.evidence || []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/research" className="hover:text-white transition">
          Research Workbench
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-200">{project.symbol} Workspace</span>
      </div>

      {/* Workspace Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 p-8 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {project.symbol}
            </h1>
            <span className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-400">
              {project.exchange}
            </span>
            <select
              value={project.status}
              onChange={(e) => handleUpdateStatus(e.target.value as 'draft' | 'in_progress' | 'ready_for_review' | 'finalized' | 'archived')}
              className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 focus:outline-none"
            >
              <option value="draft">DRAFT</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="ready_for_review">READY FOR REVIEW</option>
              <option value="finalized">FINALIZED</option>
              <option value="archived">ARCHIVED</option>
            </select>
          </div>

          <h2 className="mt-2 text-base font-medium text-slate-200">
            {project.title}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {project.companyName || profile?.name || `${project.symbol} (${project.exchange})`}
            {profile?.sector ? ` • ${profile.sector}` : ''}
          </p>

          {/* Freshness & Metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>
              Updated: <strong className="text-slate-200">{new Date(project.updatedAt).toLocaleDateString()}</strong>
            </span>
            <span>•</span>
            <span>
              Quote:{' '}
              <strong className="font-mono text-emerald-400">
                {quote?.price ? `₹${quote.price.toLocaleString()}` : 'Live'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Statements:{' '}
              <strong className="text-slate-200">
                {analysis?.annualHistory?.length ? `${analysis.annualHistory.length} Periods` : 'Verified'}
              </strong>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Investment Report</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'reports'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Reports & Drafts ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fundamentals')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'fundamentals'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Financials & Ratios</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_assistant')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'ai_assistant'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>AI Research Intelligence</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'notes'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Analyst Notes ({project.notesCount ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'evidence'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Evidence Register</span>
        </button>
      </div>

      {/* ─── TAB: REPORTS ────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="flex flex-col gap-6">
          {isReportsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No reports generated yet</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                Generate your first institutional investment report for {symbol} using any of our 8 structured templates.
              </p>
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20"
              >
                Generate Report
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reports.map((report: ResearchReport) => (
                <div
                  key={report.id}
                  className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl transition hover:border-sky-500/30 hover:bg-slate-900/90"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-400">
                        {report.templateId.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {report.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-white">{report.title}</h3>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>
                        Version: <strong className="text-slate-200">v{report.version || 1}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Sections: <strong className="text-slate-200">{report.sections?.length || 0}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Refreshed:{' '}
                        <strong className="text-slate-200">
                          {report.lastRefreshedAt
                            ? new Date(report.lastRefreshedAt).toLocaleDateString()
                            : new Date(report.updatedAt).toLocaleDateString()}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf(report)}
                        disabled={downloadingId === `pdf-${report.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                        title="Export PDF"
                      >
                        <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>PDF</span>
                      </button>

                      <button
                        onClick={() => handleDownloadCsv(report)}
                        disabled={downloadingId === `csv-${report.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                        title="Export CSV"
                      >
                        <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>CSV</span>
                      </button>

                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        title="Delete Report"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <Link
                      href={`/research/${researchId}/reports/${report.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300 transition hover:border-sky-500/50 hover:bg-sky-500/20"
                    >
                      <span>Open Editor</span>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: FUNDAMENTALS & STATEMENTS ──────────────────────────────────── */}
      {activeTab === 'fundamentals' && (
        <div className="flex flex-col gap-8">
          {isAnalysisLoading ? (
            <div className="h-96 animate-pulse rounded-3xl bg-slate-900/60" />
          ) : analysis ? (
            <>
              <HealthScoreCard healthScore={analysis.healthScore} />
              <FinancialMetricsGrid analysis={analysis} />
              <FinancialStatementsTable analysis={analysis} />
            </>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
              Audited annual statements for {symbol} could not be retrieved from provider.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: AI RESEARCH ────────────────────────────────────────────────── */}
      {activeTab === 'ai_assistant' && (
        <AiResearchPanel
          key={`${symbol}:${exchange}`}
          symbol={symbol}
          exchange={exchange}
        />
      )}

      {/* ─── TAB: NOTES ──────────────────────────────────────────────────────── */}
      {activeTab === 'notes' && (
        <ResearchNotesPanel projectId={researchId} />
      )}

      {/* ─── TAB: EVIDENCE REGISTER ─────────────────────────────────────────── */}
      {activeTab === 'evidence' && (
        <EvidenceRegisterTable
          evidence={allEvidence}
          title={`Evidence Register for ${symbol} Research`}
        />
      )}

      {/* Report Modal */}
      <CreateReportModal
        projectId={researchId}
        symbol={symbol}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
