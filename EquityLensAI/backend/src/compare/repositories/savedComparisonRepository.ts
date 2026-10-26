import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { SavedComparison, SupportedPeriod } from '@equitylensai/shared';
import type { SavedComparisonRow } from '../types.js';

class MemorySavedComparisonStore {
  comparisons = new Map<string, SavedComparison>();

  clear(): void {
    this.comparisons.clear();
  }
}

export const memorySavedComparisonStore = new MemorySavedComparisonStore();

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

function mapRowToDomain(row: SavedComparisonRow): SavedComparison {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    symbols: row.symbols,
    metrics: row.metrics ?? undefined,
    period: row.period as SupportedPeriod,
    scope: row.scope as 'consolidated' | 'standalone',
    schemaVersion: 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SavedComparisonRepository {
  async listByUser(userId: string): Promise<SavedComparison[]> {
    const res = await supabaseRest<SavedComparisonRow[]>(
      `saved_comparisons?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memorySavedComparisonStore.comparisons.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(id: string, userId: string): Promise<SavedComparison | null> {
    const res = await supabaseRest<SavedComparisonRow[]>(
      `saved_comparisons?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memorySavedComparisonStore.comparisons.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }

  async create(comparison: SavedComparison): Promise<SavedComparison> {
    const res = await supabaseRest<SavedComparisonRow[]>('saved_comparisons', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: comparison.id,
        user_id: comparison.userId,
        name: comparison.name,
        description: comparison.description,
        symbols: comparison.symbols,
        metrics: comparison.metrics ?? null,
        period: comparison.period,
        scope: comparison.scope,
        schema_version: 1,
        created_at: comparison.createdAt,
        updated_at: comparison.updatedAt,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memorySavedComparisonStore.comparisons.set(created.id, created);
      return created;
    }

    memorySavedComparisonStore.comparisons.set(comparison.id, comparison);
    return comparison;
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<SavedComparison, 'name' | 'description' | 'symbols' | 'metrics' | 'period' | 'scope'>>,
  ): Promise<SavedComparison | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload['name'] = updates.name;
    if (updates.description !== undefined) payload['description'] = updates.description;
    if (updates.symbols !== undefined) payload['symbols'] = updates.symbols;
    if (updates.metrics !== undefined) payload['metrics'] = updates.metrics;
    if (updates.period !== undefined) payload['period'] = updates.period;
    if (updates.scope !== undefined) payload['scope'] = updates.scope;

    const res = await supabaseRest<SavedComparisonRow[]>(
      `saved_comparisons?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok && res.data && res.data[0]) {
      const updated = mapRowToDomain(res.data[0]);
      memorySavedComparisonStore.comparisons.set(updated.id, updated);
      return updated;
    }

    const local = memorySavedComparisonStore.comparisons.get(id);
    if (!local || local.userId !== userId) {
      return null;
    }

    const updatedLocal: SavedComparison = {
      ...local,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memorySavedComparisonStore.comparisons.set(id, updatedLocal);
    return updatedLocal;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await supabaseRest(
      `saved_comparisons?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      memorySavedComparisonStore.comparisons.delete(id);
      return true;
    }

    const local = memorySavedComparisonStore.comparisons.get(id);
    if (local && local.userId === userId) {
      memorySavedComparisonStore.comparisons.delete(id);
      return true;
    }

    return false;
  }
}

export const savedComparisonRepository = new SavedComparisonRepository();
