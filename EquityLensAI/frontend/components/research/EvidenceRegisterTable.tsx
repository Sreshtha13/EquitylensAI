'use client';

import { useState } from 'react';
import type { ResearchEvidenceItem } from '@/services/api/research';

interface EvidenceRegisterTableProps {
  evidence: ResearchEvidenceItem[];
  title?: string;
}

export function EvidenceRegisterTable({
  evidence,
  title = 'Sources, Provenance & Evidence Register',
}: EvidenceRegisterTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = evidence.filter((item) => {
    if (typeFilter !== 'all' && item.evidenceType !== typeFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.id.toLowerCase().includes(term) ||
      item.title.toLowerCase().includes(term) ||
      item.sourceReference.toLowerCase().includes(term) ||
      (item.reportingPeriod && item.reportingPeriod.toLowerCase().includes(term))
    );
  });

  const getFreshnessBadge = (freshness?: string) => {
    switch (freshness) {
      case 'live':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'eod':
      case 'periodic':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'stale':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'unavailable':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Immutable provenance trail connecting all quantitative claims, financial filings, and market metrics to verified sources.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search metric, ID or source..."
            className="rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="financial_statement">Financial Statements</option>
            <option value="financial_ratio">Calculated Ratios</option>
            <option value="market_quote">Market Quotes</option>
            <option value="health_indicator">Health Indicators</option>
            <option value="peer_benchmark">Peer Benchmarks</option>
            <option value="corporate_announcement">Announcements</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">
          No matching evidence entries found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Evidence ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Metric / Item</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Source & Link</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Freshness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px] text-slate-300">
              {filtered.map((item) => {
                const freshness =
                  typeof item.metadata?.freshness === 'string'
                    ? item.metadata.freshness
                    : 'verified';

                return (
                  <tr key={item.id} className="hover:bg-slate-900/60 transition">
                    <td className="px-4 py-2.5 font-bold text-sky-400">{item.id}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                        {item.evidenceType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans font-medium text-white max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-emerald-300">
                      {typeof item.value === 'number'
                        ? item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : String(item.value ?? '—')}
                      {item.units ? ` ${item.units}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{item.reportingPeriod || '—'}</td>
                    <td className="px-4 py-2.5 font-sans">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 underline hover:text-sky-300"
                        >
                          {item.sourceReference}
                        </a>
                      ) : (
                        <span className="text-slate-400">{item.sourceReference}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {item.observedAt ? new Date(item.observedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-sans">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getFreshnessBadge(
                          freshness,
                        )}`}
                      >
                        {freshness}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
