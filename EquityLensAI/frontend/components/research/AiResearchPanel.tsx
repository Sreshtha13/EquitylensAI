'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useResearch } from '@/hooks/useResearch';
import type { ResearchClaim, ResearchEvidence, ResearchRequest } from '@/services/api/research';

type AiResearchPanelProps = {
  symbol: string;
  exchange: string;
};

function EvidenceRefs({
  evidenceIds,
  evidence,
}: {
  evidenceIds: string[];
  evidence: ResearchEvidence[];
}) {
  const references = evidence.filter((item) => evidenceIds.includes(item.id));
  if (references.length === 0) {
    return (
      <p className="mt-2 text-xs text-amber-300">
        No supplied evidence reference for this interpretation.
      </p>
    );
  }

  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Evidence references">
      {references.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300"
        >
          <span className="font-semibold text-sky-300">{item.metric}</span>
          <span className="mx-1">·</span>
          <span>{item.value === null ? 'Unavailable' : String(item.value)}</span>
          {item.unit && <span className="ml-1">{item.unit}</span>}
          {item.period && (
            <span className="ml-2 text-slate-500">
              Period{item.periodType ? ` (${item.periodType})` : ''}/as-of: {item.period}
            </span>
          )}
          <span className="ml-2 text-slate-500">Source: {item.source}</span>
          {item.freshness && (
            <span className="ml-2 text-slate-500">Freshness: {item.freshness}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ClaimList({
  title,
  claims,
  evidence,
}: {
  title: string;
  claims: ResearchClaim[];
  evidence: ResearchEvidence[];
}) {
  if (claims.length === 0) return null;
  return (
    <section aria-label={title}>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <ul className="mt-2 space-y-3">
        {claims.map((claim, index) => (
          <li
            key={`${title}-${index}`}
            className="rounded-xl bg-slate-950/50 p-4 text-sm text-slate-300"
          >
            <p>{claim.text}</p>
            <EvidenceRefs evidenceIds={claim.evidenceIds} evidence={evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiResearchPanel({ symbol, exchange }: AiResearchPanelProps) {
  const [question, setQuestion] = useState('');
  const [compareSymbol, setCompareSymbol] = useState('');
  const [compareExchange, setCompareExchange] = useState('');
  const [lastRequest, setLastRequest] = useState<ResearchRequest | null>(null);
  const research = useResearch();
  const result = research.data;
  const error =
    research.error instanceof Error ? research.error.message : 'Research request failed.';

  function submitRequest() {
    const cleanedQuestion = question.trim();
    if (cleanedQuestion.length < 10 || cleanedQuestion.length > 800 || research.isPending) return;

    const request: ResearchRequest = {
      symbol,
      exchange,
      question: cleanedQuestion,
      ...(compareSymbol.trim()
        ? {
            comparisonInstrument: {
              symbol: compareSymbol.trim(),
              ...(compareExchange.trim() ? { exchange: compareExchange.trim() } : {}),
            },
          }
        : {}),
    };
    setLastRequest(request);
    research.reset();
    research.mutate(request);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitRequest();
  }

  return (
    <section className="rounded-3xl border border-violet-400/20 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-violet-300">
          Evidence-grounded AI
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-white">
          Ask a financial research question
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Gemini interprets available platform data. Verified figures and sources are shown
          separately; missing data is not treated as zero.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="ai-research-question"
            className="mb-2 block text-sm font-semibold text-slate-200"
          >
            Research question for {symbol} ({exchange})
          </label>
          <textarea
            id="ai-research-question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              research.reset();
            }}
            minLength={10}
            maxLength={800}
            required
            rows={4}
            disabled={research.isPending}
            placeholder="Analyze profitability, growth, and financial risks using the available evidence."
            className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400"
            aria-describedby="ai-research-question-help"
          />
          <p id="ai-research-question-help" className="mt-1 text-xs text-slate-500">
            10–800 characters. No trade recommendations; company events and news are not covered.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="ai-compare-symbol"
              className="mb-2 block text-sm font-semibold text-slate-200"
            >
              Optional comparison symbol
            </label>
            <input
              id="ai-compare-symbol"
              value={compareSymbol}
              onChange={(event) => {
                setCompareSymbol(event.target.value);
                research.reset();
              }}
              maxLength={30}
              disabled={research.isPending}
              placeholder="e.g. another supported ticker"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label
              htmlFor="ai-compare-exchange"
              className="mb-2 block text-sm font-semibold text-slate-200"
            >
              Comparison exchange (if ambiguous)
            </label>
            <input
              id="ai-compare-exchange"
              value={compareExchange}
              onChange={(event) => {
                setCompareExchange(event.target.value);
                research.reset();
              }}
              maxLength={10}
              disabled={research.isPending}
              placeholder="Exchange code"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={research.isPending || question.trim().length < 10}
            className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {research.isPending ? 'Researching…' : 'Generate research'}
          </button>
          {research.isPending && (
            <p role="status" className="text-sm text-slate-400">
              Gathering evidence and generating an interpretation…
            </p>
          )}
        </div>
      </form>

      {research.isError && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => lastRequest && research.mutate(lastRequest)}
            disabled={!lastRequest || research.isPending}
            className="mt-3 rounded-lg border border-rose-300/30 px-3 py-1.5 font-semibold hover:bg-rose-300/10"
          >
            Retry
          </button>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6 border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {result.intent.replaceAll('_', ' ')} · {result.instrument.symbol} (
                {result.instrument.exchange})
              </p>
              <p className="mt-1 text-sm text-slate-400">Question: {result.question}</p>
              {result.comparisonInstrument && (
                <p className="mt-1 text-sm text-slate-400">
                  Compared with {result.comparisonInstrument.symbol} (
                  {result.comparisonInstrument.exchange})
                </p>
              )}
              <h3 className="mt-2 text-lg font-bold text-white">{result.summary.text}</h3>
              <EvidenceRefs evidenceIds={result.summary.evidenceIds} evidence={result.evidence} />
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">
              {result.confidence.level} evidence coverage
            </span>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h4 className="text-sm font-bold text-white">
              Overall assessment: {result.overallAssessment.label.replaceAll('_', ' ')}
            </h4>
            <p className="mt-2 text-sm text-slate-300">{result.overallAssessment.explanation}</p>
            <EvidenceRefs
              evidenceIds={result.overallAssessment.evidenceIds}
              evidence={result.evidence}
            />
          </div>

          {result.sections.map((section, index) => (
            <section
              key={`${section.title}-${index}`}
              className="rounded-xl border border-white/10 bg-slate-950/30 p-4"
            >
              <h4 className="font-bold text-white">{section.title}</h4>
              <p className="mt-2 text-sm text-slate-300">{section.analysis.text}</p>
              <EvidenceRefs evidenceIds={section.analysis.evidenceIds} evidence={result.evidence} />
              <ClaimList title="Risks" claims={section.risks} evidence={result.evidence} />
              {section.limitations.length > 0 && (
                <ul className="mt-3 list-inside list-disc text-xs text-amber-200">
                  {section.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="grid gap-5 md:grid-cols-2">
            <ClaimList title="Strengths" claims={result.strengths} evidence={result.evidence} />
            <ClaimList
              title="Risk factors"
              claims={result.riskFactors}
              evidence={result.evidence}
            />
            <ClaimList
              title="Growth signals"
              claims={result.growthSignals}
              evidence={result.evidence}
            />
            <ClaimList
              title="Valuation observations"
              claims={result.valuationObservations}
              evidence={result.evidence}
            />
            <ClaimList
              title="Financial observations"
              claims={result.financialObservations}
              evidence={result.evidence}
            />
          </div>

          {result.missingData.length > 0 && (
            <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <h4 className="font-bold text-amber-200">Missing data and limitations</h4>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-100/80">
                {result.missingData.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <details className="rounded-xl border border-white/10 p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-200">
              Verified evidence registry
            </summary>
            <ul className="mt-3 space-y-2">
              {result.evidence.map((item) => (
                <li key={item.id} className="text-xs text-slate-400">
                  <strong className="text-slate-200">{item.metric}:</strong>{' '}
                  {item.value === null ? 'Unavailable' : String(item.value)}
                  {item.unit ? ` ${item.unit}` : ''}
                  {item.period ? ` · ${item.period}` : ''}
                  {item.periodType ? ` · ${item.periodType}` : ''}
                  {` · ${item.source}`}
                  {item.freshness ? ` · Freshness: ${item.freshness}` : ''}
                  {item.timestamp ? ` · Retrieved ${item.timestamp}` : ''}
                </li>
              ))}
            </ul>
          </details>

          <p className="text-xs leading-relaxed text-slate-500">
            Evidence coverage: {result.confidence.explanation} {result.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
