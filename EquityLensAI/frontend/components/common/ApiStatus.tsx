'use client';

import { useHealth } from '@/hooks/useHealth';

export function ApiStatus() {
  const health = useHealth();

  if (health.isPending) {
    return <StatusCard label="Checking API connectivity" detail="Calling GET /api/v1/health" />;
  }

  if (health.isError) {
    return (
      <StatusCard
        label="API unreachable"
        detail="Start the backend on port 4000, then refresh this page."
      />
    );
  }

  return (
    <StatusCard
      label="API reachable"
      detail={`${health.data.service} reported ${health.data.status} at ${health.data.timestamp}`}
    />
  );
}

function StatusCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}
