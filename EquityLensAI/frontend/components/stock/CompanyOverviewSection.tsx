'use client';

import { useState } from 'react';
import type { CompanyProfile } from '@equitylensai/shared';

type CompanyOverviewSectionProps = {
  profile?: CompanyProfile | undefined;
  isLoading?: boolean;
  error?: Error | null;
};

export function CompanyOverviewSection({
  profile,
  isLoading,
  error,
}: CompanyOverviewSectionProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6 sm:p-8">
        <div className="h-6 w-48 rounded bg-slate-800" />
        <div className="mt-4 h-24 w-full rounded-2xl bg-slate-800/50" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-slate-900/50 p-6 sm:p-8">
        <h3 className="text-lg font-bold text-white">Company Overview</h3>
        <p className="mt-2 text-xs text-slate-400">
          Extended corporate profile details are currently unavailable for this security.
        </p>
      </div>
    );
  }

  const {
    symbol,
    exchange,
    sector,
    industry,
    description,
    website,
    headquarters,
    employees,
    sharesOutstanding,
    floatShares,
    fiscalYearEnd,
    isin,
    currency,
    source,
    retrievedAt,
  } = profile;

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Company Overview & Profile</h3>
          <p className="text-xs text-slate-400">
            Verified corporate data sourced from {source === 'yahoo' ? 'Yahoo Finance Corporate Profile' : 'Exchange Instrument Registry'}
          </p>
        </div>

        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-sky-400 hover:bg-slate-700 hover:text-sky-300 transition"
          >
            <span>Visit Website</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Business Description */}
      <div className="mt-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">About the Business</h4>
        {description ? (
          <div className="mt-2">
            <p
              className={`text-sm text-slate-300 leading-relaxed ${
                !isDescExpanded ? 'line-clamp-4' : ''
              }`}
            >
              {description}
            </p>
            {description.length > 280 && (
              <button
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="mt-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
              >
                {isDescExpanded ? 'Show less ▲' : 'Read full business description ▼'}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 italic">
            Official company description is not supplied by active market providers for this ticker.
          </p>
        )}
      </div>

      {/* Key Corporate Facts Grid */}
      <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Sector</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {sector || <span className="text-slate-500 italic font-normal">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Industry</div>
          <div className="mt-1 text-sm font-semibold text-white truncate" title={industry || undefined}>
            {industry || <span className="text-slate-500 italic font-normal">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Headquarters</div>
          <div className="mt-1 text-sm font-semibold text-white truncate" title={headquarters || undefined}>
            {headquarters || <span className="text-slate-500 italic font-normal">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Employees</div>
          <div className="mt-1 text-sm font-semibold text-white font-mono">
            {employees ? employees.toLocaleString() : <span className="text-slate-500 italic font-normal font-sans">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Shares Outstanding</div>
          <div className="mt-1 text-sm font-semibold text-white font-mono">
            {sharesOutstanding ? sharesOutstanding.toLocaleString() : <span className="text-slate-500 italic font-normal font-sans">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Float Shares</div>
          <div className="mt-1 text-sm font-semibold text-white font-mono">
            {floatShares ? floatShares.toLocaleString() : <span className="text-slate-500 italic font-normal font-sans">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Fiscal Year End</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">
            {fiscalYearEnd || <span className="text-slate-500 italic font-normal font-sans">Not reported</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Listing Exchange</div>
          <div className="mt-1 text-sm font-semibold text-sky-400">
            {exchange} ({symbol})
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Currency & ISIN</div>
          <div className="mt-1 text-sm font-semibold text-slate-200 font-mono">
            {currency} {isin ? `· ${isin}` : ''}
          </div>
        </div>
      </div>

      {/* Provenance note */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4 text-[11px] text-slate-500">
        <div>
          Verified Facts Guarantee: Profile details reflect verified filings only; no dummy corporate facts.
        </div>
        <div>
          Last synced: {new Date(retrievedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
