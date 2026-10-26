'use client';

import React from 'react';
import type {
  ScreenerCondition,
  ScreenerFilterGroup,
  ScreenerMetricDefinition,
  ScreenerOperator,
} from '@/services/api/screener';

type FilterGroupBuilderProps = {
  group: ScreenerFilterGroup;
  onChange: (updated: ScreenerFilterGroup) => void;
  onDelete?: (() => void) | undefined;
  metrics: ScreenerMetricDefinition[];
  depth?: number;
  maxDepth?: number;
};

const OPERATORS: Array<{ value: ScreenerOperator; label: string; symbol: string }> = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'At least (≥)', symbol: '≥' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'At most (≤)', symbol: '≤' },
  { value: 'eq', label: 'Equal to', symbol: '=' },
  { value: 'neq', label: 'Not equal to', symbol: '≠' },
  { value: 'between', label: 'Between (range)', symbol: '↔' },
];

function isGroup(item: ScreenerCondition | ScreenerFilterGroup): item is ScreenerFilterGroup {
  return 'logic' in item && 'conditions' in item;
}

export function FilterGroupBuilder({
  group,
  onChange,
  onDelete,
  metrics,
  depth = 1,
  maxDepth = 3,
}: FilterGroupBuilderProps) {
  const metricMap = new Map(metrics.map((m) => [m.id, m]));

  const toggleLogic = () => {
    onChange({
      ...group,
      logic: group.logic === 'AND' ? 'OR' : 'AND',
    });
  };

  const updateCondition = (index: number, condition: ScreenerCondition) => {
    const nextConditions = [...group.conditions];
    nextConditions[index] = condition;
    onChange({ ...group, conditions: nextConditions });
  };

  const updateSubGroup = (index: number, subGroup: ScreenerFilterGroup) => {
    const nextConditions = [...group.conditions];
    nextConditions[index] = subGroup;
    onChange({ ...group, conditions: nextConditions });
  };

  const removeCondition = (index: number) => {
    const nextConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: nextConditions });
  };

  const addCondition = () => {
    const firstMetric = metrics[0];
    if (!firstMetric) return;
    const newCondition: ScreenerCondition = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      field: firstMetric.id,
      operator: 'gt',
      value: 15,
      upperValue: null,
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addSubGroup = () => {
    if (depth >= maxDepth) return;
    const firstMetric = metrics[0];
    if (!firstMetric) return;
    const newSubGroup: ScreenerFilterGroup = {
      id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      logic: group.logic === 'AND' ? 'OR' : 'AND',
      conditions: [
        {
          id: `cond_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          field: firstMetric.id,
          operator: 'gt',
          value: 10,
          upperValue: null,
        },
      ],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newSubGroup],
    });
  };

  // Group metrics by domain category for organized dropdown
  const categories = Array.from(new Set(metrics.map((m) => m.category || 'general')));

  return (
    <div
      className={`rounded-2xl border transition-all ${
        depth === 1
          ? 'border-white/10 bg-slate-900/70 p-4 sm:p-5 shadow-xl'
          : 'border-sky-500/20 bg-slate-950/50 p-3.5 sm:p-4 my-2'
      }`}
    >
      {/* Group Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Match</span>
          <button
            type="button"
            onClick={toggleLogic}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-sm ${
              group.logic === 'AND'
                ? 'bg-sky-500 text-white shadow-sky-500/20'
                : 'bg-amber-500 text-white shadow-amber-500/20'
            }`}
            title="Click to toggle between ALL (AND) and ANY (OR)"
          >
            <span>{group.logic === 'AND' ? 'ALL conditions (AND)' : 'ANY condition (OR)'}</span>
            <svg className="h-3 w-3 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>
          {depth > 1 && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              Depth {depth}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addCondition}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add condition</span>
          </button>

          {depth < maxDepth && (
            <button
              type="button"
              onClick={addSubGroup}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition"
              title="Add a nested AND/OR subgroup"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              <span>Add subgroup</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
              title="Delete group"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conditions and Sub-groups List */}
      <div className="mt-3 flex flex-col gap-2.5">
        {group.conditions.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500 italic">
            No conditions in this group. Click &quot;Add condition&quot; to define a filter.
          </p>
        ) : (
          group.conditions.map((item, index) => {
            if (isGroup(item)) {
              return (
                <FilterGroupBuilder
                  key={item.id ?? `grp_${index}`}
                  group={item}
                  onChange={(sub) => updateSubGroup(index, sub)}
                  onDelete={() => removeCondition(index)}
                  metrics={metrics}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              );
            }

            const activeDef = metricMap.get(item.field);
            const unitLabel =
              activeDef?.unit === 'percent'
                ? '%'
                : activeDef?.unit === 'score'
                  ? '/100'
                  : 'x';

            return (
              <div
                key={item.id ?? `cond_${index}`}
                className="group relative flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-950/60 p-2.5 transition hover:border-white/15"
              >
                {/* Metric Selector */}
                <div className="min-w-[190px] flex-1">
                  <select
                    value={item.field}
                    onChange={(e) =>
                      updateCondition(index, {
                        ...item,
                        field: e.target.value as ScreenerCondition['field'],
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-sky-500 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <optgroup
                        key={cat}
                        label={cat.toUpperCase().replace('_', ' ')}
                        className="bg-slate-950 text-slate-400 font-bold"
                      >
                        {metrics
                          .filter((m) => (m.category || 'general') === cat)
                          .map((m) => (
                            <option key={m.id} value={m.id} className="text-white font-normal">
                              {m.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Operator Selector */}
                <div className="w-[140px]">
                  <select
                    value={item.operator}
                    onChange={(e) =>
                      updateCondition(index, {
                        ...item,
                        operator: e.target.value as ScreenerOperator,
                        upperValue:
                          e.target.value === 'between'
                            ? (item.upperValue ?? item.value + 10)
                            : null,
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-sky-300 font-medium focus:border-sky-500 focus:outline-none"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div className="relative w-[110px]">
                  <input
                    type="number"
                    step="any"
                    value={Number.isFinite(item.value) ? item.value : ''}
                    onChange={(e) =>
                      updateCondition(index, {
                        ...item,
                        value: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 pr-8 text-xs font-mono font-medium text-white focus:border-sky-500 focus:outline-none"
                    placeholder="Value"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-slate-400">
                    {unitLabel}
                  </span>
                </div>

                {/* Upper Value Input (if between) */}
                {item.operator === 'between' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">and</span>
                    <div className="relative w-[110px]">
                      <input
                        type="number"
                        step="any"
                        value={
                          item.upperValue !== null && item.upperValue !== undefined && Number.isFinite(item.upperValue)
                            ? item.upperValue
                            : ''
                        }
                        onChange={(e) =>
                          updateCondition(index, {
                            ...item,
                            upperValue: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 pr-8 text-xs font-mono font-medium text-white focus:border-sky-500 focus:outline-none"
                        placeholder="Max"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-slate-400">
                        {unitLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* Remove Condition */}
                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Remove condition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* Metric Description Helper */}
                {activeDef?.description && (
                  <div className="w-full text-[11px] text-slate-400 pl-1 pt-0.5">
                    {activeDef.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function formatFilterGroupSummary(
  group: ScreenerFilterGroup,
  metrics: ScreenerMetricDefinition[],
): string {
  const metricMap = new Map(metrics.map((m) => [m.id, m]));

  const formatCondition = (c: ScreenerCondition): string => {
    const def = metricMap.get(c.field);
    const label = def?.label || c.field;
    const unit = def?.unit === 'percent' ? '%' : def?.unit === 'score' ? '/100' : '';
    if (c.operator === 'between') {
      return `${label} between ${c.value}${unit} and ${c.upperValue ?? '?'}${unit}`;
    }
    const opSymbols: Record<ScreenerOperator, string> = {
      eq: '=',
      neq: '≠',
      gt: '>',
      gte: '≥',
      lt: '<',
      lte: '≤',
      between: '↔',
    };
    return `${label} ${opSymbols[c.operator]} ${c.value}${unit}`;
  };

  const formatInner = (g: ScreenerFilterGroup): string => {
    if (g.conditions.length === 0) return 'Empty';
    const parts = g.conditions.map((item) =>
      isGroup(item) ? `(${formatInner(item)})` : formatCondition(item),
    );
    return parts.join(` ${g.logic} `);
  };

  return formatInner(group);
}
