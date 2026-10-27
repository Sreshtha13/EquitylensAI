import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { ResearchProject, ResearchProjectStatus } from '@equitylensai/shared';
import type { ResearchProjectRow } from '../types.js';

class MemoryResearchProjectStore {
  projects = new Map<string, ResearchProject>();

  clear(): void {
    this.projects.clear();
  }
}

export const memoryResearchProjectStore = new MemoryResearchProjectStore();

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

function mapRowToDomain(row: ResearchProjectRow): ResearchProject {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? null,
    symbol: row.symbol,
    exchange: row.exchange,
    companyName: row.company_name,
    status: row.status as ResearchProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
  };
}

export class ResearchProjectRepository {
  async listByUser(userId: string, includeArchived = false): Promise<ResearchProject[]> {
    let query = `research_projects?user_id=eq.${encodeURIComponent(userId)}`;
    if (!includeArchived) {
      query += '&status=neq.archived';
    }
    query += '&order=updated_at.desc';

    const res = await supabaseRest<ResearchProjectRow[]>(query);
    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memoryResearchProjectStore.projects.values())
      .filter((p) => p.userId === userId && (includeArchived || p.status !== 'archived'))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(id: string, userId: string): Promise<ResearchProject | null> {
    const res = await supabaseRest<ResearchProjectRow[]>(
      `research_projects?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memoryResearchProjectStore.projects.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }

  async create(project: ResearchProject): Promise<ResearchProject> {
    const res = await supabaseRest<ResearchProjectRow[]>('research_projects', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: project.id,
        user_id: project.userId,
        title: project.title,
        description: project.description,
        symbol: project.symbol,
        exchange: project.exchange,
        company_name: project.companyName,
        status: project.status,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        archived_at: project.archivedAt ?? null,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memoryResearchProjectStore.projects.set(created.id, created);
      return created;
    }

    memoryResearchProjectStore.projects.set(project.id, project);
    return project;
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<ResearchProject, 'title' | 'description' | 'status' | 'archivedAt'>>,
  ): Promise<ResearchProject | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) payload['title'] = updates.title;
    if (updates.description !== undefined) payload['description'] = updates.description;
    if (updates.status !== undefined) {
      payload['status'] = updates.status;
      if (updates.status === 'archived') {
        payload['archived_at'] = updates.archivedAt ?? new Date().toISOString();
      } else if (updates.archivedAt === null) {
        payload['archived_at'] = null;
      }
    }
    if (updates.archivedAt !== undefined) payload['archived_at'] = updates.archivedAt;

    const res = await supabaseRest<ResearchProjectRow[]>(
      `research_projects?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok && res.data && res.data[0]) {
      const updated = mapRowToDomain(res.data[0]);
      memoryResearchProjectStore.projects.set(updated.id, updated);
      return updated;
    }

    const local = memoryResearchProjectStore.projects.get(id);
    if (!local || local.userId !== userId) {
      return null;
    }

    const updatedLocal: ResearchProject = {
      ...local,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryResearchProjectStore.projects.set(id, updatedLocal);
    return updatedLocal;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await supabaseRest(
      `research_projects?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      memoryResearchProjectStore.projects.delete(id);
      return true;
    }

    const local = memoryResearchProjectStore.projects.get(id);
    if (local && local.userId === userId) {
      memoryResearchProjectStore.projects.delete(id);
      return true;
    }

    return false;
  }
}

export const researchProjectRepository = new ResearchProjectRepository();
