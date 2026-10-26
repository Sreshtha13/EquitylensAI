'use client';

import { useState } from 'react';
import type { AlertRule } from '@equitylensai/shared';
import { useToggleAlert, useDeleteAlert } from '@/hooks/useAlerts';
import { AlertEventsModal } from './AlertEventsModal';

export function AlertRuleCard({ rule }: { rule: AlertRule }) {
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const toggleAlert = useToggleAlert();
  const deleteAlert = useDeleteAlert();

  const formatCondition = () => {
    const config = rule.ruleConfig;
    switch (config.type) {
      case 'price':
        return `${config.condition.replace(/_/g, ' ')} ${rule.exchange === 'US' ? '$' : '₹'}${config.targetPrice.toLocaleString()}`;
      case 'percentage_change':
        return `${config.direction === 'up' ? '+' : config.direction === 'down' ? '-' : '±'}${config.targetPercent}% (${config.period} baseline)`;
      case 'volume':
        return `Volume exceeds ${config.targetVolume.toLocaleString()}`;
      case 'financial_metric':
        return `${config.metric} ${config.operator === 'gt' ? '>' : config.operator === 'gte' ? '>=' : config.operator === 'lt' ? '<' : '<='} ${config.thresholdValue}`;
      case 'announcement':
        return config.categories && config.categories.length > 0
          ? `Disclosures: ${config.categories.map((c) => c.replace(/_/g, ' ')).join(', ')}`
          : 'All official disclosures';
      case 'news':
        return 'Verified market news';
      default:
        return 'Custom rule condition';
    }
  };

  const handleToggle = () => {
    toggleAlert.mutate({ alertId: rule.id, enabled: !rule.enabled });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete alert "${rule.name}"?`)) {
      deleteAlert.mutate(rule.id);
    }
  };

  return (
    <>
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-xl transition hover:border-white/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 border border-sky-500/20">
                {rule.alertType.replace(/_/g, ' ')}
              </span>
              {rule.symbol && (
                <span className="text-xs font-bold text-white tracking-wide">
                  {rule.symbol} <span className="text-slate-500 font-mono text-[10px]">({rule.exchange})</span>
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-base font-bold text-white">{rule.name}</h3>
            <p className="mt-1 text-xs font-mono text-slate-300 bg-slate-950/40 inline-block px-2.5 py-1 rounded-lg border border-white/5">
              {formatCondition()}
            </p>
          </div>

          {/* Enable / Disable Toggle Switch */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggleAlert.isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                rule.enabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
              title={rule.enabled ? 'Click to disable' : 'Click to enable'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  rule.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Telemetry and metadata footer */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">Last Evaluated: </span>
              {rule.lastEvaluatedAt ? new Date(rule.lastEvaluatedAt).toLocaleTimeString() : 'Pending'}
            </div>
            {rule.lastTriggeredAt && (
              <div>
                <span className="text-emerald-500 font-medium">Triggered: </span>
                {new Date(rule.lastTriggeredAt).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEventsModalOpen(true)}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              History
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteAlert.isPending}
              className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-rose-400 hover:bg-rose-500/20 transition"
              title="Delete alert"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <AlertEventsModal
        isOpen={eventsModalOpen}
        onClose={() => setEventsModalOpen(false)}
        alertId={rule.id}
        ruleName={rule.name}
      />
    </>
  );
}
