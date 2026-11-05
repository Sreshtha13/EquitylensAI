'use client';

import { useState } from 'react';
import type { AlertRule } from '@equitylensai/shared';
import { useToggleAlert, useDeleteAlert } from '@/hooks/useAlerts';
import { AlertEventsModal } from './AlertEventsModal';
import { EditAlertModal } from './EditAlertModal';

export function AlertRuleCard({ rule }: { rule: AlertRule }) {
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const toggleAlert = useToggleAlert();
  const deleteAlert = useDeleteAlert();

  const getStatus = (): 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'EXPIRED' | 'RESOLVED' => {
    if (rule.status) return rule.status;
    if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) return 'EXPIRED';
    return rule.enabled ? 'ACTIVE' : 'PAUSED';
  };

  const status = getStatus();

  const getStatusBadge = () => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'PAUSED':
        return (
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-white/10">
            Paused
          </span>
        );
      case 'TRIGGERED':
        return (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            Triggered
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            Expired
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
            Resolved
          </span>
        );
    }
  };

  const formatCondition = () => {
    const config = rule.ruleConfig as any;
    if (!config) return 'Custom rule condition';

    switch (config.type) {
      case 'price':
        return `${config.condition?.replace(/_/g, ' ')} ${rule.exchange === 'US' ? '$' : '₹'}${config.targetPrice?.toLocaleString()}`;
      case 'percentage_change':
        return `${config.direction === 'up' ? '+' : config.direction === 'down' ? '-' : '±'}${config.targetPercent}% (${config.period || '1d'} baseline)`;
      case 'volume':
        return `Volume exceeds ${config.targetVolume?.toLocaleString()}`;
      case 'unusual_volume':
        return `Volume >= ${config.multiplier || 2}x (${config.baselineDays || 20}d avg)`;
      case 'rsi':
        return `RSI (14) ${config.condition?.replace(/_/g, ' ')} ${config.threshold}`;
      case 'macd':
        return `MACD ${config.condition?.replace(/_/g, ' ')} (12, 26, 9)`;
      case 'moving_average':
        return config.crossType?.replace(/_/g, ' ') || 'MA Crossover';
      case '52w_high_low':
        return config.condition?.replace(/_/g, ' ');
      case 'circuit':
        return config.condition?.replace(/_/g, ' ');
      case 'financial_metric':
        return `${config.metric} ${config.operator === 'gt' ? '>' : config.operator === 'gte' ? '>=' : config.operator === 'lt' ? '<' : '<='} ${config.thresholdValue}`;
      case 'announcement':
        return config.categories && config.categories.length > 0
          ? `Disclosures: ${config.categories.map((c: string) => c.replace(/_/g, ' ')).join(', ')}`
          : 'All official disclosures';
      case 'corporate_action':
        return config.actionType ? `Corporate Action: ${config.actionType.replace(/_/g, ' ')}` : 'All Corporate Actions';
      case 'financial_results':
        return 'Quarterly Financial Results Announcement';
      case 'index_movement':
        return `${config.indexName || 'NIFTY 50'} ${config.targetPercent ? `${config.targetPercent}% movement` : 'threshold'}`;
      case 'watchlist_event':
        return `Watchlist stock ${config.eventType?.replace(/_/g, ' ') || 'event'}`;
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
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-xl transition hover:border-white/20 flex flex-col justify-between">
        <div>
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
              <h3 className="mt-1.5 text-base font-bold text-white line-clamp-1">{rule.name}</h3>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggleAlert.isPending || status === 'EXPIRED'}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                  rule.enabled ? 'bg-sky-500' : 'bg-slate-700'
                }`}
                title={rule.enabled ? 'Pause alert' : 'Resume alert'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    rule.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs font-mono text-slate-300 bg-slate-950/40 inline-block px-2.5 py-1 rounded-lg border border-white/5 break-words max-w-full">
            {formatCondition()}
          </p>

          {/* Trigger type & Channels info */}
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="capitalize">
              {rule.triggerType === 'one_time' ? '⚡ One-Time' : '🔄 Recurring'}
            </span>
            <span>•</span>
            <span className="text-slate-500">
              {rule.deliveryChannels?.includes('email') ? 'In-App + Email' : 'In-App Only'}
            </span>
            {rule.expiresAt && (
              <>
                <span>•</span>
                <span className={new Date(rule.expiresAt) < new Date() ? 'text-rose-400' : 'text-slate-500'}>
                  Exp: {new Date(rule.expiresAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Telemetry and metadata footer */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex flex-col gap-0.5">
            <div>
              <span className="text-slate-500">Evaluated: </span>
              {rule.lastEvaluatedAt ? new Date(rule.lastEvaluatedAt).toLocaleTimeString() : 'Pending'}
            </div>
            {rule.lastTriggeredAt && (
              <div>
                <span className="text-emerald-500 font-medium">Triggered: </span>
                {new Date(rule.lastTriggeredAt).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditModalOpen(true)}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Edit alert settings"
            >
              Edit
            </button>
            <button
              onClick={() => setEventsModalOpen(true)}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="View trigger events history"
            >
              History
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteAlert.isPending}
              className="rounded-lg bg-rose-500/10 px-2 py-1 text-rose-400 hover:bg-rose-500/20 transition"
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

      <EditAlertModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        rule={rule}
      />
    </>
  );
}
