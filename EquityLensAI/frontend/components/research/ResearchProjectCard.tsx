'use client';

import Link from 'next/link';
import type { ResearchProject } from '@/services/api/research';

interface ResearchProjectCardProps {
  project: ResearchProject;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: ResearchProject['status']) => void;
}

export function ResearchProjectCard({
  project,
  onDelete,
  onUpdateStatus,
}: ResearchProjectCardProps) {
  const getStatusBadge = (status: ResearchProject['status']) => {
    switch (status) {
      case 'finalized':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'ready_for_review':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'archived':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'draft':
      default:
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl backdrop-blur-xl transition duration-300 hover:border-sky-500/30 hover:bg-slate-900/90">
      <div>
        {/* Top Header: Symbol, Exchange & Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white group-hover:text-sky-300 transition">
              {project.symbol}
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
              {project.exchange}
            </span>
          </div>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${getStatusBadge(
              project.status,
            )}`}
          >
            {formatStatus(project.status)}
          </span>
        </div>

        {/* Project Title & Company Name */}
        <h3 className="mt-3 text-base font-bold text-white line-clamp-1">{project.title}</h3>
        <p className="mt-1 text-xs text-slate-400 line-clamp-1">
          {project.companyName || `${project.symbol} (${project.exchange})`}
        </p>

        {project.description && (
          <p className="mt-2 text-xs text-slate-400/90 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Stats Badges */}
        <div className="mt-5 flex items-center gap-4 border-t border-white/5 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>
              <strong className="text-slate-200">{project.reportsCount ?? 0}</strong> Reports
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span>
              <strong className="text-slate-200">{project.notesCount ?? 0}</strong> Notes
            </span>
          </div>

          <span className="ml-auto text-[11px] text-slate-500">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2">
          {onUpdateStatus && project.status !== 'archived' && (
            <button
              onClick={() => onUpdateStatus(project.id, 'archived')}
              className="text-xs text-slate-500 transition hover:text-slate-300"
              title="Archive Project"
            >
              Archive
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(project.id)}
              className="text-xs text-rose-500/70 transition hover:text-rose-400"
              title="Delete Project"
            >
              Delete
            </button>
          )}
        </div>

        <Link
          href={`/research/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-300 transition hover:border-sky-500/50 hover:bg-sky-500/20"
        >
          <span>Open Workspace</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
