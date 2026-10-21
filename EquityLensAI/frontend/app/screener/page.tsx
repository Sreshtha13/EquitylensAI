'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiClientError } from '@/services/api/client';
import {
  executeScreener,
  getScreenerMetrics,
  interpretScreenerQuery,
  type ScreenerField,
  type ScreenerFilter,
  type ScreenerExecutionResponse,
  type ScreenerInterpretation,
  type ScreenerMetricDefinition,
  type ScreenerOperator,
  type ScreenerPeriod,
} from '@/services/api/screener';

type EditableFilter = {
  field: ScreenerField;
  operator: ScreenerOperator;
  value: string;
  upperValue: string;
};

const examples = [
  'Find NSE companies with ROE above 15%, revenue growth above 10%, and debt-to-equity below 0.5.',
  'Find companies with ROCE above 18% and net profit margins above 10%.',
  'Show profitable companies with debt-to-equity below 0.5.',
  'Show companies with low debt and high growth.',
];

const operators: Array<{ value: ScreenerOperator; label: string }> = [
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'at least' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'equal to' },
  { value: 'neq', label: 'not equal to' },
  { value: 'between', label: 'between' },
];

function toEditableFilter(filter: ScreenerFilter): EditableFilter {
  return {
    field: filter.field,
    operator: filter.operator,
    value: String(filter.value),
    upperValue:
      filter.upperValue === null || filter.upperValue === undefined
        ? ''
        : String(filter.upperValue),
  };
}

function describeApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 429)
      return 'The screener request limit was reached. Please wait and try again.';
    if (error.status === 0)
      return 'Unable to reach the EquityLensAI API. Check your connection and try again.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected screener error occurred.';
}

function formatThreshold(value: number, metric: ScreenerMetricDefinition): string {
  if (metric.unit === 'percent') return `${value}%`;
  if (metric.unit === 'score') return `${value}/100`;
  return String(value);
}

export default function ScreenerPage() {
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState<'' | 'NSE' | 'BSE'>('');
  const [period, setPeriod] = useState<ScreenerPeriod>('annual');
  const [metrics, setMetrics] = useState<ScreenerMetricDefinition[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [interpretation, setInterpretation] = useState<ScreenerInterpretation | null>(null);
  const [filters, setFilters] = useState<EditableFilter[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execution, setExecution] = useState<ScreenerExecutionResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getScreenerMetrics(controller.signal)
      .then(setMetrics)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setCatalogError(describeApiError(cause));
      });
    return () => controller.abort();
  }, []);

  const selectedMetrics = useMemo(
    () => new Map(metrics.map((metric) => [metric.id, metric])),
    [metrics],
  );

  async function handleInterpret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setError('Enter a natural-language screening query.');
      return;
    }

    setError('');
    setExecution(null);
    setIsLoading(true);
    try {
      const result = await interpretScreenerQuery({
        query: query.trim(),
        ...(exchange ? { exchange } : {}),
        period,
      });
      setInterpretation(result);
      setFilters(result.filters.map(toEditableFilter));
    } catch (cause) {
      setError(describeApiError(cause));
      setInterpretation(null);
      setFilters([]);
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilter(index: number, changes: Partial<EditableFilter>) {
    setExecution(null);
    setFilters((current) =>
      current.map((filter, position) => (position === index ? { ...filter, ...changes } : filter)),
    );
  }

  function addFilter() {
    const first = metrics[0];
    if (!first) return;
    setExecution(null);
    setFilters((current) => [
      ...current,
      { field: first.id, operator: 'gt', value: '0', upperValue: '' },
    ]);
  }

  async function handleExecute(offset = 0) {
    if (!interpretation || interpretation.clarificationNeeded || filters.length === 0) {
      setError(
        'Resolve the interpretation and add at least one valid filter before running a screen.',
      );
      return;
    }

    const parsedFilters: ScreenerFilter[] = [];
    for (const filter of filters) {
      const value = Number(filter.value);
      const upperValue = filter.operator === 'between' ? Number(filter.upperValue) : undefined;
      if (
        !Number.isFinite(value) ||
        (upperValue !== undefined && (!filter.upperValue.trim() || !Number.isFinite(upperValue)))
      ) {
        setError('Every filter needs a valid numeric value. A between filter needs both bounds.');
        return;
      }
      parsedFilters.push({
        field: filter.field,
        operator: filter.operator,
        value,
        ...(upperValue === undefined ? {} : { upperValue }),
      });
    }

    setError('');
    setIsExecuting(true);
    setExecution(null);
    try {
      const result = await executeScreener({
        query,
        ...(interpretation.exchange ? { exchange: interpretation.exchange } : {}),
        assetType: 'equity',
        period: interpretation.period,
        filters: parsedFilters,
        logic: interpretation.logic,
        sort: interpretation.sort,
        limit: interpretation.limit,
        offset,
      });
      setExecution(result);
    } catch (cause) {
      setError(describeApiError(cause));
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
          AI research tools
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Natural-language stock screener
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Turn a request into reviewable financial filters. Interpretation is AI-assisted; filters
          and financial values are not screening results.
        </p>
      </header>

      <section
        className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6"
        aria-live="polite"
      >
        <h2 className="font-semibold text-amber-200">Financial index readiness</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/75">
          Screening runs against persisted Yahoo Finance statements after the database migration and
          financial ingestion have completed. Coverage and stale-data warnings are included with
          results; if the database is not configured, the API reports an error rather than inventing
          matches.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl sm:p-7">
        <form className="flex flex-col gap-5" onSubmit={handleInterpret}>
          <div>
            <label htmlFor="screener-query" className="text-sm font-semibold text-slate-200">
              Describe the companies you want to find
            </label>
            <textarea
              id="screener-query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setInterpretation(null);
                setFilters([]);
                setExecution(null);
              }}
              maxLength={500}
              rows={4}
              placeholder="e.g. Find NSE companies with ROE above 15% and debt-to-equity below 0.5"
              className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
            />
            <p className="mt-1 text-right text-xs text-slate-500">{query.length}/500</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-xs font-semibold text-slate-400">
              Exchange
              <select
                value={exchange}
                onChange={(event) => {
                  setExchange(event.target.value as '' | 'NSE' | 'BSE');
                  setInterpretation(null);
                  setFilters([]);
                  setExecution(null);
                }}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="">Use query / not specified</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-slate-400">
              Reporting period
              <select
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as ScreenerPeriod);
                  setInterpretation(null);
                  setFilters([]);
                  setExecution(null);
                }}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="annual">Annual</option>
                <option value="ttm">Trailing twelve months</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 text-xs font-semibold text-slate-400">
              Asset type
              <div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-300">
                Listed equity
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Statement scope is not selectable: the current financial provider does not identify
            consolidated versus standalone statements.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60 sm:w-fit"
          >
            {isLoading ? 'Interpreting filters…' : 'Interpret query'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Try an example
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-sky-400/40 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {catalogError && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          Could not load supported metric definitions: {catalogError}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {interpretation && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Review parsed filters</h2>
              <p className="mt-1 text-sm text-slate-400">{interpretation.querySummary}</p>
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
              {interpretation.logic} logic · {interpretation.period}
            </span>
          </div>

          {interpretation.clarificationNeeded && (
            <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100">
              Please clarify the request. No uncertain filters have been activated.
            </p>
          )}
          {interpretation.warnings.length > 0 && (
            <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-200/80">
              {interpretation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {interpretation.filters.length > 0 ? (
            <div className="mt-5 flex flex-col gap-3">
              {filters.map((filter, index) => {
                const metric = selectedMetrics.get(filter.field);
                return (
                  <div
                    key={`${filter.field}-${index}`}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]"
                  >
                    <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                      Metric
                      <select
                        value={filter.field}
                        onChange={(event) =>
                          updateFilter(index, {
                            field: event.target.value as ScreenerField,
                            value: '0',
                            upperValue: '',
                          })
                        }
                        className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-sm text-white"
                      >
                        {metrics
                          .filter((option) => option.periods.includes(period))
                          .map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                      Operator
                      <select
                        value={filter.operator}
                        onChange={(event) =>
                          updateFilter(index, {
                            operator: event.target.value as ScreenerOperator,
                            upperValue: '',
                          })
                        }
                        className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-sm text-white"
                      >
                        {operators.map((operator) => (
                          <option key={operator.value} value={operator.value}>
                            {operator.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                      {filter.operator === 'between' ? 'Minimum' : 'Value'}
                      {metric ? ` (${metric.unit})` : ''}
                      <input
                        type="number"
                        value={filter.value}
                        onChange={(event) => updateFilter(index, { value: event.target.value })}
                        className="min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-sm text-white"
                      />
                    </label>
                    {filter.operator === 'between' && (
                      <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                        Maximum
                        <input
                          type="number"
                          value={filter.upperValue}
                          onChange={(event) =>
                            updateFilter(index, { upperValue: event.target.value })
                          }
                          className="min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-sm text-white"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setExecution(null);
                        setFilters((current) =>
                          current.filter((_, position) => position !== index),
                        );
                      }}
                      aria-label={`Remove ${metric?.label ?? filter.field} filter`}
                      className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-rose-400/30 hover:text-rose-200"
                    >
                      Remove
                    </button>
                    {metric && (
                      <p className="text-xs text-slate-500 sm:col-span-full">
                        Values use{' '}
                        {metric.unit === 'percent'
                          ? 'percentage points (15 means 15%)'
                          : metric.unit === 'ratio'
                            ? 'decimal ratios (0.5 means 0.5)'
                            : 'the 0–100 score scale'}
                        .
                      </p>
                    )}
                  </div>
                );
              })}
              {filters.length < 5 && (
                <button
                  type="button"
                  onClick={addFilter}
                  disabled={metrics.length === 0}
                  className="self-start rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-sky-400/30 hover:text-white disabled:opacity-50"
                >
                  Add filter
                </button>
              )}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">
              No active filters were produced. Unsupported or ambiguous conditions are not treated
              as filters.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              {filters
                .map((filter) => {
                  const metric = selectedMetrics.get(filter.field);
                  const threshold = Number(filter.value);
                  return metric && Number.isFinite(threshold)
                    ? `${metric.label}: ${formatThreshold(threshold, metric)}`
                    : filter.field;
                })
                .join(' · ')}
            </p>
            <button
              type="button"
              onClick={() => handleExecute()}
              disabled={isExecuting || interpretation.clarificationNeeded || filters.length === 0}
              className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExecuting ? 'Submitting…' : 'Run screen'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Missing metric values never count as zero. Results include source, reporting period,
            data freshness, and index coverage.
          </p>
        </section>
      )}

      {execution && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Screen results</h2>
              <p className="mt-1 text-sm text-slate-400">
                {execution.totalMatches.toLocaleString()} matches ·{' '}
                {execution.coverage.indexedCompanies.toLocaleString()} of{' '}
                {execution.coverage.expectedCompanies.toLocaleString()} companies indexed
              </p>
            </div>
            {execution.coverage.isPartial && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Partial coverage
              </span>
            )}
          </div>
          {execution.warnings.length > 0 && (
            <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-200/80">
              {execution.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {execution.results.length === 0 ? (
            <p className="mt-5 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">
              No indexed companies match these criteria. Missing metric values are excluded, not
              treated as zero.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-400">
                    <th className="px-3 py-3 font-semibold">Company</th>
                    <th className="px-3 py-3 font-semibold">Exchange</th>
                    <th className="px-3 py-3 font-semibold">Reporting period</th>
                    {filters.map((filter, index) => (
                      <th className="px-3 py-3 font-semibold" key={`${filter.field}-${index}`}>
                        {selectedMetrics.get(filter.field)?.label ?? filter.field}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-semibold">Data status</th>
                  </tr>
                </thead>
                <tbody>
                  {execution.results.map((result) => (
                    <tr
                      key={`${result.exchange}:${result.symbol}`}
                      className="border-b border-white/5 text-slate-200"
                    >
                      <td className="px-3 py-3">
                        <span className="font-semibold text-white">{result.companyName}</span>
                        <span className="ml-2 text-xs text-slate-500">{result.symbol}</span>
                      </td>
                      <td className="px-3 py-3">{result.exchange}</td>
                      <td className="px-3 py-3">
                        {result.period} · {result.periodType.toUpperCase()}
                      </td>
                      {filters.map((filter, index) => {
                        const metric = result.metrics[filter.field];
                        const value =
                          metric?.value === null || metric?.value === undefined
                            ? '—'
                            : metric.unit === 'percent'
                              ? `${metric.value.toFixed(2)}%`
                              : metric.unit === 'score'
                                ? `${metric.value}/100`
                                : metric.value.toFixed(2);
                        return (
                          <td
                            className="px-3 py-3 tabular-nums"
                            key={`${filter.field}-${index}`}
                            title={metric?.formula}
                          >
                            {value}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        <span className={result.isStale ? 'text-amber-200' : 'text-emerald-300'}>
                          {result.isStale ? 'Stale' : 'Current'}
                        </span>
                        <span className="ml-1 block text-xs text-slate-500">
                          {result.source} · {new Date(result.retrievedAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-400">
            <span>
              Showing {execution.results.length ? execution.pagination.offset + 1 : 0}–
              {execution.pagination.offset + execution.results.length} of {execution.totalMatches}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  handleExecute(
                    Math.max(0, execution.pagination.offset - execution.pagination.limit),
                  )
                }
                disabled={isExecuting || execution.pagination.offset === 0}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecute(execution.pagination.offset + execution.pagination.limit)
                }
                disabled={
                  isExecuting ||
                  execution.pagination.offset + execution.results.length >= execution.totalMatches
                }
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
        <Link href="/research" className="transition hover:text-white">
          Open fundamental research
        </Link>
        <Link href="/market" className="transition hover:text-white">
          Browse market instruments
        </Link>
      </div>
    </main>
  );
}
