'use client';

import { useAlertEvents } from '@/hooks/useAlerts';

type AlertEventsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  alertId: string;
  ruleName: string;
};

export function AlertEventsModal({
  isOpen,
  onClose,
  alertId,
  ruleName,
}: AlertEventsModalProps) {
  const { data, isLoading } = useAlertEvents(isOpen ? alertId : undefined);

  if (!isOpen) return null;

  const events = data?.events ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-2xl text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Trigger History</h2>
            <p className="text-xs text-slate-400 truncate max-w-sm">{ruleName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Loading trigger history...
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-300">No Triggers Recorded Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                This rule will automatically log events whenever qualifying market transitions occur.
              </p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-white/5 bg-slate-950/60 p-3.5 text-xs transition hover:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    {event.observedValue !== null
                      ? `Observed Value: ${event.observedValue}`
                      : 'Condition Met'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(event.triggerTimestamp).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Source: {event.source}</span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    {event.status}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[9px] text-slate-600 truncate">
                  Key: {event.deduplicationKey}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
