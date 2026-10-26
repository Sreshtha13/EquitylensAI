import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { ScreenerRunRecord } from '@equitylensai/shared';
import type { ScreenerRunDbRow } from '../types.js';

class MemoryScreenerRunStore {
  runs = new Map<string, ScreenerRunRecord>();

  clear(): void {
    this.runs.clear();
  }
}

export const memoryScreenerRunStore = new MemoryScreenerRunStore();

async function supabaseRest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number; ok: boolean }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, status: 503, ok: false };
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${resource}`;
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { data: null, status: res.status, ok: false };
    }

    const text = await res.text();
    const data = text.trim().length > 0 ? (JSON.parse(text) as T) : null;
    return { data, status: res.status, ok: true };
  } catch (error) {
    logger.debug({ error, resource }, 'Supabase PostgREST request failed, using memory store');
    return { data: null, status: 500, ok: false };
  }
}

function mapRowToDomain(row: ScreenerRunDbRow): ScreenerRunRecord {
  return {
    id: row.id,
    userId: row.user_id,
    savedScreenId: row.saved_screen_id ?? null,
    definition: row.definition,
    resultCount: row.result_count,
    durationMs: row.duration_ms,
    coverage: row.coverage,
    warnings: row.warnings ?? [],
    executedAt: row.executed_at,
  };
}

export class ScreenerRunRepository {
  async recordRun(run: ScreenerRunRecord): Promise<ScreenerRunRecord> {
    const res = await supabaseRest<ScreenerRunDbRow[]>('screener_runs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: run.id,
        user_id: run.userId,
        saved_screen_id: run.savedScreenId,
        definition: run.definition,
        result_count: run.resultCount,
        duration_ms: run.durationMs,
        coverage: run.coverage,
        warnings: run.warnings,
        executed_at: run.executedAt,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memoryScreenerRunStore.runs.set(created.id, created);
      return created;
    }

    memoryScreenerRunStore.runs.set(run.id, run);
    return run;
  }

  async listByUser(userId: string, limit = 50): Promise<ScreenerRunRecord[]> {
    const res = await supabaseRest<ScreenerRunDbRow[]>(
      `screener_runs?user_id=eq.${encodeURIComponent(userId)}&order=executed_at.desc&limit=${Math.min(limit, 100)}`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memoryScreenerRunStore.runs.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit);
  }

  async getById(id: string, userId: string): Promise<ScreenerRunRecord | null> {
    const res = await supabaseRest<ScreenerRunDbRow[]>(
      `screener_runs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memoryScreenerRunStore.runs.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }
}

export const screenerRunRepository = new ScreenerRunRepository();
