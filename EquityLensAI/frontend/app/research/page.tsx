'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  useResearchProjects,
  useDeleteResearchProject,
  useUpdateResearchProject,
} from '@/hooks/useResearch';
import { ResearchProjectCard } from '@/components/research/ResearchProjectCard';
import { CreateProjectModal } from '@/components/research/CreateProjectModal';

// Phase 4 Quick Fundamental Fallback Components
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { HealthScoreCard } from '@/components/financial/HealthScoreCard';
import { FinancialMetricsGrid } from '@/components/financial/FinancialMetricsGrid';
import { FinancialStatementsTable } from '@/components/financial/FinancialStatementsTable';
import { AiResearchPanel } from '@/components/research/AiResearchPanel';
import { useFinancialAnalysis } from '@/hooks/useFinancial';
import type { InstrumentSummary } from '@/types';

function ResearchContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const urlExchange = searchParams.get('exchange') || 'NSE';

  const { isAuthenticated, user } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'workbench' | 'quick_lookup'>(
    urlSymbol ? 'quick_lookup' : 'workbench',
  );

  // Projects Query
  const { data: projectsData, isLoading: isProjectsLoading } = useResearchProjects(includeArchived);
  const deleteProjectMutation = useDeleteResearchProject();
  const updateProjectMutation = useUpdateResearchProject();

  // Quick Analysis State (Phase 4 compatibility)
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    exchange: string | undefined;
    name: string | undefined;
  }>({
    symbol: urlSymbol || 'RELIANCE',
    exchange: urlExchange,
    name: urlSymbol === 'RELIANCE' || !urlSymbol ? 'Reliance Industries Limited' : urlSymbol,
  });

  useEffect(() => {
    if (urlSymbol) {
      setSelectedStock({
        symbol: urlSymbol,
        exchange: urlExchange,
        name: urlSymbol,
      });
      setActiveTab('quick_lookup');
    }
  }, [urlSymbol, urlExchange]);

  const {
    data: analysis,
    isLoading: isAnalysisLoading,
    error: analysisError,
    refetch: refetchAnalysis,
  } = useFinancialAnalysis(selectedStock.symbol, {
    exchange: selectedStock.exchange,
    periods: 4,
  });

  const projects = projectsData?.projects || [];
  const filteredProjects = projects.filter((p) => {
    if (!projectSearchTerm) return true;
    const term = projectSearchTerm.toLowerCase();
    return (
      p.symbol.toLowerCase().includes(term) ||
      p.title.toLowerCase().includes(term) ||
      (p.companyName && p.companyName.toLowerCase().includes(term))
    );
  });

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this research workspace?')) return;
    try {
      await deleteProjectMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'draft' | 'in_progress' | 'ready_for_review' | 'finalized' | 'archived') => {
    try {
      await updateProjectMutation.mutateAsync({
        projectId: id,
        data: { status },
      });
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Phase 13 Unified Research Workbench
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Equity Research Workbench
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Create, organize, update, and export structured company research reports grounded in verified Indian market data, audited financial statements, and deterministic ratios.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/research/templates"
            className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-sky-500/30 hover:bg-slate-800 hover:text-white"
          >
            Report Templates
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Research Project</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('workbench')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'workbench'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Research Projects ({projects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quick_lookup')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'quick_lookup'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Quick Fundamental Analyzer</span>
        </button>
      </div>

      {/* ─── TAB 1: WORKBENCH PROJECTS ────────────────────────────────────────── */}
      {activeTab === 'workbench' && (
        <div className="flex flex-col gap-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-950/60 p-4">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                value={projectSearchTerm}
                onChange={(e) => setProjectSearchTerm(e.target.value)}
                placeholder="Search research projects by symbol or title..."
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-sky-500 focus:ring-0"
                />
                <span>Include Archived Workspaces</span>
              </label>
            </div>
          </div>

          {/* Loading Grid */}
          {isProjectsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isProjectsLoading && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No research workspaces found</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md">
                {!isAuthenticated
                  ? 'Sign in to create persistent multi-period research workspaces with notes, versions, and exports.'
                  : 'Start your first structured research workspace for any NSE or BSE listed company.'}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20"
              >
                Create Workspace
              </button>
            </div>
          )}

          {/* Projects Grid */}
          {!isProjectsLoading && filteredProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ResearchProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDeleteProject}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: QUICK FUNDAMENTAL LOOKUP (Phase 4 compatibility) ─────────── */}
      {activeTab === 'quick_lookup' && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Search Security for Instant Fundamental Analysis
            </label>
            <InstrumentSearch
              onSelect={(item: InstrumentSummary) => {
                setSelectedStock({
                  symbol: item.symbol,
                  exchange: item.exchange,
                  name: item.name,
                });
              }}
              selectedSymbol={selectedStock.symbol}
            />
          </div>

          {/* Company Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 p-6 shadow-xl backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white sm:text-3xl">{selectedStock.symbol}</h2>
                <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400">
                  {selectedStock.exchange ?? 'NSE'}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-300">
                {analysis?.name || selectedStock.name || selectedStock.symbol}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsCreateModalOpen(true);
                }}
                className="rounded-xl border border-sky-500/30 bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400"
              >
                Create Workspace for {selectedStock.symbol}
              </button>
              <button
                onClick={() => refetchAnalysis()}
                disabled={isAnalysisLoading}
                className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                Refresh Data
              </button>
            </div>
          </div>

          <AiResearchPanel
            key={`${selectedStock.symbol}:${selectedStock.exchange ?? 'NSE'}`}
            symbol={selectedStock.symbol}
            exchange={selectedStock.exchange ?? 'NSE'}
          />

          {!isAnalysisLoading && analysis && (
            <div className="flex flex-col gap-8">
              <HealthScoreCard healthScore={analysis.healthScore} />
              <FinancialMetricsGrid analysis={analysis} />
              <FinancialStatementsTable analysis={analysis} />
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialSymbol={selectedStock.symbol}
        initialExchange={selectedStock.exchange ?? 'NSE'}
      />
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 animate-pulse">
          <div className="h-20 w-1/3 rounded-2xl bg-slate-900/60" />
          <div className="h-64 w-full rounded-3xl bg-slate-900/60" />
        </div>
      }
    >
      <ResearchContent />
    </Suspense>
  );
}
