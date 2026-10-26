import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { SavedScreen } from '@equitylensai/shared';
import type { SavedScreenDbRow } from '../types.js';

class MemorySavedScreenStore {
  screens = new Map<string, SavedScreen>();

  clear(): void {
    this.screens.clear();
  }
}

export const memorySavedScreenStore = new MemorySavedScreenStore();

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

function mapRowToDomain(row: SavedScreenDbRow): SavedScreen {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    definition: row.definition,
    lastRunAt: row.last_run_at ?? null,
    lastResultCount: row.last_result_count ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SavedScreenRepository {
  async listByUser(userId: string): Promise<SavedScreen[]> {
    const res = await supabaseRest<SavedScreenDbRow[]>(
      `saved_screens?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memorySavedScreenStore.screens.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(id: string, userId: string): Promise<SavedScreen | null> {
    const res = await supabaseRest<SavedScreenDbRow[]>(
      `saved_screens?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memorySavedScreenStore.screens.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }

  async create(screen: SavedScreen): Promise<SavedScreen> {
    const res = await supabaseRest<SavedScreenDbRow[]>('saved_screens', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: screen.id,
        user_id: screen.userId,
        name: screen.name,
        description: screen.description,
        definition: screen.definition,
        last_run_at: screen.lastRunAt,
        last_result_count: screen.lastResultCount,
        created_at: screen.createdAt,
        updated_at: screen.updatedAt,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memorySavedScreenStore.screens.set(created.id, created);
      return created;
    }

    memorySavedScreenStore.screens.set(screen.id, screen);
    return screen;
  }

  async update(
    id: string,
    userId: string,
    patch: Partial<SavedScreen>,
  ): Promise<SavedScreen | null> {
    const updateBody: Record<string, unknown> = {
      updated_at: patch.updatedAt ?? new Date().toISOString(),
    };
    if (patch.name !== undefined) updateBody.name = patch.name;
    if (patch.description !== undefined) updateBody.description = patch.description;
    if (patch.definition !== undefined) updateBody.definition = patch.definition;
    if (patch.lastRunAt !== undefined) updateBody.last_run_at = patch.lastRunAt;
    if (patch.lastResultCount !== undefined) updateBody.last_result_count = patch.lastResultCount;

    const res = await supabaseRest<SavedScreenDbRow[]>(
      `saved_screens?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(updateBody),
      },
    );

    if (res.ok && res.data && res.data[0]) {
      const updated = mapRowToDomain(res.data[0]);
      memorySavedScreenStore.screens.set(updated.id, updated);
      return updated;
    }

    const existing = memorySavedScreenStore.screens.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: SavedScreen = {
      ...existing,
      ...patch,
      updatedAt: updateBody.updated_at as string,
    };
    memorySavedScreenStore.screens.set(id, updated);
    return updated;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await supabaseRest<null>(
      `saved_screens?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      memorySavedScreenStore.screens.delete(id);
      return true;
    }

    const existing = memorySavedScreenStore.screens.get(id);
    if (existing && existing.userId === userId) {
      memorySavedScreenStore.screens.delete(id);
      return true;
    }

    return false;
  }
}

export const savedScreenRepository = new SavedScreenRepository();
