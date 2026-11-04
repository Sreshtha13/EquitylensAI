'use client';

import { useState } from 'react';
import type { AlertRule, DeliveryChannel } from '@equitylensai/shared';
import { useUpdateAlert } from '@/hooks/useAlerts';

type EditAlertModalProps = {
  isOpen: boolean;
  onClose: () => void;
  rule: AlertRule;
};

export function EditAlertModal({ isOpen, onClose, rule }: EditAlertModalProps) {
  const [name, setName] = useState(rule.name);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [cooldownMinutes, setCooldownMinutes] = useState(rule.cooldownMinutes ?? 60);
  const [triggerType, setTriggerType] = useState<'one_time' | 'recurring'>(
    rule.triggerType || 'recurring',
  );
  const [channels, setChannels] = useState<DeliveryChannel[]>(
    rule.deliveryChannels || ['in_app'],
  );
  const [expiryOption, setExpiryOption] = useState<'keep' | 'never' | '7d' | '30d' | '90d'>('keep');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateAlertMutation = useUpdateAlert();

  if (!isOpen) return null;

  const toggleChannel = (ch: DeliveryChannel) => {
    if (channels.includes(ch)) {
      if (channels.length === 1 && ch === 'in_app') return; // in_app is mandatory
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter an alert name.');
      return;
    }

    let expiresAt: string | null | undefined = undefined;
    if (expiryOption === 'never') {
      expiresAt = null;
    } else if (expiryOption === '7d') {
      expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    } else if (expiryOption === '30d') {
      expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    } else if (expiryOption === '90d') {
      expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    }

    try {
      await updateAlertMutation.mutateAsync({
        alertId: rule.id,
        input: {
          name: name.trim(),
          enabled,
          cooldownMinutes,
          triggerType,
          deliveryChannels: channels,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        },
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Alert Configuration</h2>
            <p className="text-xs text-slate-400">
              {rule.symbol ? `${rule.symbol} (${rule.exchange}) • ` : ''}
              {rule.alertType.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alert Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <select
                value={enabled ? 'active' : 'paused'}
                onChange={(e) => setEnabled(e.target.value === 'active')}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="active">Active (Monitoring)</option>
                <option value="paused">Paused (Muted)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Trigger Mode
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as 'one_time' | 'recurring')}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="recurring">Recurring (Crossing Detection)</option>
                <option value="one_time">One-Time (Auto-Disarm)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cooldown (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="43200"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Expiry Schedule
              </label>
              <select
                value={expiryOption}
                onChange={(e) => setExpiryOption(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="keep">
                  {rule.expiresAt ? `Keep (${new Date(rule.expiresAt).toLocaleDateString()})` : 'Keep (Never)'}
                </option>
                <option value="never">No Expiry (Indefinite)</option>
                <option value="7d">Expire in 7 days</option>
                <option value="30d">Expire in 30 days</option>
                <option value="90d">Expire in 90 days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Notification Delivery Channels
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('in_app')}
                  disabled
                  className="rounded border-white/20 bg-slate-800 text-sky-500"
                />
                In-App Notification
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('email')}
                  onChange={() => toggleChannel('email')}
                  className="rounded border-white/20 bg-slate-800 text-sky-500"
                />
                Email Delivery
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateAlertMutation.isPending}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/25 hover:opacity-90 disabled:opacity-50 transition"
            >
              {updateAlertMutation.isPending ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
