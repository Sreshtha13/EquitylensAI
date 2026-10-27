import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { ResearchNote, NoteTag } from '@equitylensai/shared';
import type { ResearchNoteRow } from '../types.js';

class MemoryResearchNoteStore {
  notes = new Map<string, ResearchNote>();

  clear(): void {
    this.notes.clear();
  }
}

export const memoryResearchNoteStore = new MemoryResearchNoteStore();

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

function mapRowToDomain(row: ResearchNoteRow): ResearchNote {
  return {
    id: row.id,
    researchProjectId: row.research_project_id,
    reportId: row.report_id ?? null,
    sectionId: row.section_id ?? null,
    userId: row.user_id,
    tag: row.tag as NoteTag,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ResearchNoteRepository {
  async listByProject(projectId: string, userId: string): Promise<ResearchNote[]> {
    const res = await supabaseRest<ResearchNoteRow[]>(
      `research_notes?research_project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memoryResearchNoteStore.notes.values())
      .filter((n) => n.researchProjectId === projectId && n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getById(id: string, userId: string): Promise<ResearchNote | null> {
    const res = await supabaseRest<ResearchNoteRow[]>(
      `research_notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memoryResearchNoteStore.notes.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }

  async create(note: ResearchNote): Promise<ResearchNote> {
    const res = await supabaseRest<ResearchNoteRow[]>('research_notes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: note.id,
        research_project_id: note.researchProjectId,
        report_id: note.reportId ?? null,
        section_id: note.sectionId ?? null,
        user_id: note.userId,
        tag: note.tag,
        content: note.content,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memoryResearchNoteStore.notes.set(created.id, created);
      return created;
    }

    memoryResearchNoteStore.notes.set(note.id, note);
    return note;
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<ResearchNote, 'tag' | 'content'>>,
  ): Promise<ResearchNote | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.tag !== undefined) payload['tag'] = updates.tag;
    if (updates.content !== undefined) payload['content'] = updates.content;

    const res = await supabaseRest<ResearchNoteRow[]>(
      `research_notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok && res.data && res.data[0]) {
      const updated = mapRowToDomain(res.data[0]);
      memoryResearchNoteStore.notes.set(updated.id, updated);
      return updated;
    }

    const local = memoryResearchNoteStore.notes.get(id);
    if (!local || local.userId !== userId) {
      return null;
    }

    const updatedLocal: ResearchNote = {
      ...local,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryResearchNoteStore.notes.set(id, updatedLocal);
    return updatedLocal;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await supabaseRest(
      `research_notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      memoryResearchNoteStore.notes.delete(id);
      return true;
    }

    const local = memoryResearchNoteStore.notes.get(id);
    if (local && local.userId === userId) {
      memoryResearchNoteStore.notes.delete(id);
      return true;
    }

    return false;
  }
}

export const researchNoteRepository = new ResearchNoteRepository();
