'use client';

import { useState } from 'react';
import { useReportVersions } from '@/hooks/useResearch';
import type { ResearchReportVersion } from '@/services/api/research';

interface VersionHistoryModalProps {
  projectId: string;
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VersionHistoryModal({
  projectId,
  reportId,
  isOpen,
  onClose,
}: VersionHistoryModalProps) {
  const { data: versionsData, isLoading } = useReportVersions(projectId, reportId);
  const [selectedVersion, setSelectedVersion] = useState<ResearchReportVersion | null>(null);

  if (!isOpen) return null;

  const versions = versionsData?.versions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Report Version History & Snapshots</h2>
            <p className="mt-1 text-xs text-slate-400">
              Immutable historical snapshots preserved during major reviews or data refreshes.
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

        <div className="mt-6 flex-1 flex flex-col md:flex-row gap-6 min-h-[350px]">
          {/* Versions Sidebar */}
          <div className="w-full md:w-1/3 flex flex-col gap-2 border-r border-white/5 pr-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Saved Snapshots ({versions.length})
            </span>

            {isLoading && (
              <div className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
            )}

            {!isLoading && versions.length === 0 && (
              <p className="py-6 text-xs text-slate-500">
                No past snapshots saved yet. Snapshots are created on refresh or manual save.
              </p>
            )}

            {versions.map((ver) => (
              <button
                key={ver.id}
                onClick={() => setSelectedVersion(ver)}
                className={`flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition ${
                  selectedVersion?.id === ver.id
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-white/5 bg-slate-950/40 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">
                    Version {ver.versionNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(ver.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {ver.summaryNotes && (
                  <p className="mt-1 text-xs text-slate-300 line-clamp-2">{ver.summaryNotes}</p>
                )}
              </button>
            ))}
          </div>

          {/* Snapshot Content Viewer */}
          <div className="w-full md:w-2/3 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
            {selectedVersion ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      Snapshot Version {selectedVersion.versionNumber} Content
                    </h3>
                    <span className="text-xs text-slate-400">
                      Saved {new Date(selectedVersion.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedVersion.summaryNotes && (
                    <p className="mt-2 text-xs italic text-slate-300 border-l-2 border-sky-500 pl-3">
                      {selectedVersion.summaryNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {selectedVersion.contentSnapshot?.sections?.map((sec, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-white/5 bg-slate-950/40 p-4"
                    >
                      <h4 className="text-xs font-bold text-sky-400">{sec.title}</h4>
                      <div className="mt-2 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {sec.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-500">
                Select a version snapshot on the left to inspect its saved sections.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
