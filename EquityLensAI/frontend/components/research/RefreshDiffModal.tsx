'use client';

import { useState } from 'react';
import type { RefreshReportDiff } from '@/services/api/research';

interface RefreshDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diff: RefreshReportDiff | null;
  onConfirmRefresh: (saveNewVersion: boolean, versionNotes: string) => Promise<void>;
  isRefreshing?: boolean;
}

export function RefreshDiffModal({
  isOpen,
  onClose,
  diff,
  onConfirmRefresh,
  isRefreshing = false,
}: RefreshDiffModalProps) {
  const [saveNewVersion, setSaveNewVersion] = useState(true);
  const [versionNotes, setVersionNotes] = useState('Refreshed against latest market quotes & statements');

  if (!isOpen || !diff) return null;

  const handleConfirm = async () => {
    await onConfirmRefresh(saveNewVersion, versionNotes);
    onClose();
  };

  const { changesSummary, affectedSections, hasChanges } = diff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Market & Financial Data Refresh</h2>
            <p className="mt-1 text-xs text-slate-400">
              Review real-time data changes before updating the report. User-authored notes are safely preserved.
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

        <div className="mt-6 flex flex-col gap-6">
          {/* Summary Stat Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-center">
              <span className="text-xl font-black text-sky-400">
                {changesSummary.priceChanged ? 'Price Shift' : 'Stable'}
              </span>
              <p className="text-[11px] font-semibold text-sky-300">Quote Status</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
              <span className="text-xl font-black text-emerald-400">
                {changesSummary.newAnnouncementsCount}
              </span>
              <p className="text-[11px] font-semibold text-emerald-300">New Filings</p>
            </div>
            <div className="rounded-2xl border border-slate-500/20 bg-slate-800/40 p-3 text-center">
              <span className="text-xl font-black text-slate-300">
                {affectedSections.length}
              </span>
              <p className="text-[11px] font-semibold text-slate-400">Affected Sections</p>
            </div>
          </div>

          {/* Details */}
          {hasChanges ? (
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Detected Observations
              </h4>
              <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-xs space-y-2">
                {changesSummary.priceChanged && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Market Quote:</span>
                    <span className="font-mono text-white">
                      ₹{changesSummary.oldPrice?.toLocaleString() ?? '—'} →{' '}
                      <strong className="text-emerald-400">
                        ₹{changesSummary.newPrice?.toLocaleString() ?? '—'}
                      </strong>{' '}
                      ({changesSummary.priceChangePct?.toFixed(2) ?? '0.00'}%)
                    </span>
                  </div>
                )}
                {changesSummary.newFinancialsAvailable && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Audited Filings:</span>
                    <span className="font-semibold text-emerald-300">
                      New period available: {changesSummary.latestPeriod || 'Latest'}
                    </span>
                  </div>
                )}
                {changesSummary.newAnnouncementsCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Corporate Filings:</span>
                    <span className="font-semibold text-sky-300">
                      {changesSummary.newAnnouncementsCount} new official announcement(s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300">
              No material changes detected. Your report is currently up to date with the latest market data and filings.
            </div>
          )}

          {/* Affected Sections list */}
          {affectedSections.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Sections to be updated:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {affectedSections.map((sec) => (
                  <span
                    key={sec}
                    className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {sec.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Snapshot Versioning Option */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
              <input
                type="checkbox"
                checked={saveNewVersion}
                onChange={(e) => setSaveNewVersion(e.target.checked)}
                className="rounded border-white/20 bg-slate-800 text-sky-500 focus:ring-0"
              />
              <span>Preserve previous report state as an immutable snapshot (recommended)</span>
            </label>

            {saveNewVersion && (
              <input
                type="text"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="Version notes / rationale..."
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {isRefreshing ? 'Applying Refresh...' : 'Apply Refresh to Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
