import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type {
  ResearchReport,
  ResearchReportStatus,
  ResearchReportVersion,
} from '@equitylensai/shared';
import type { ResearchReportRow, ResearchReportVersionRow } from '../types.js';

class MemoryResearchReportStore {
  reports = new Map<string, ResearchReport>();
  versions = new Map<string, ResearchReportVersion[]>();

  clear(): void {
    this.reports.clear();
    this.versions.clear();
  }
}

export const memoryResearchReportStore = new MemoryResearchReportStore();

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

function mapRowToDomain(row: ResearchReportRow): ResearchReport {
  return {
    id: row.id,
    researchProjectId: row.research_project_id,
    userId: row.user_id,
    title: row.title,
    templateId: row.template_id,
    status: row.status as ResearchReportStatus,
    schemaVersion: row.schema_version,
    version: row.version ?? 1,
    sections: row.sections ?? [],
    evidence: row.evidence ?? [],
    notes: row.notes ?? [],
    generatedAt: row.generated_at ?? null,
    lastRefreshedAt: row.last_refreshed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRowToDomain(row: ResearchReportVersionRow): ResearchReportVersion {
  return {
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    contentSnapshot: row.content_snapshot,
    summaryNotes: row.summary_notes ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export class ResearchReportRepository {
  async listByProject(projectId: string, userId: string): Promise<ResearchReport[]> {
    const res = await supabaseRest<ResearchReportRow[]>(
      `research_reports?research_project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapRowToDomain);
    }

    return Array.from(memoryResearchReportStore.reports.values())
      .filter((r) => r.researchProjectId === projectId && r.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(id: string, userId: string): Promise<ResearchReport | null> {
    const res = await supabaseRest<ResearchReportRow[]>(
      `research_reports?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );

    if (res.ok && res.data && res.data[0]) {
      return mapRowToDomain(res.data[0]);
    }

    const item = memoryResearchReportStore.reports.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  }

  async create(report: ResearchReport): Promise<ResearchReport> {
    const res = await supabaseRest<ResearchReportRow[]>('research_reports', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: report.id,
        research_project_id: report.researchProjectId,
        user_id: report.userId,
        title: report.title,
        template_id: report.templateId,
        status: report.status,
        schema_version: report.schemaVersion,
        version: report.version,
        sections: report.sections,
        evidence: report.evidence,
        notes: report.notes,
        generated_at: report.generatedAt ?? null,
        last_refreshed_at: report.lastRefreshedAt ?? null,
        created_at: report.createdAt,
        updated_at: report.updatedAt,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapRowToDomain(res.data[0]);
      memoryResearchReportStore.reports.set(created.id, created);
      return created;
    }

    memoryResearchReportStore.reports.set(report.id, report);
    return report;
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<ResearchReport, 'title' | 'status' | 'sections' | 'evidence' | 'notes' | 'version' | 'generatedAt' | 'lastRefreshedAt'>>,
  ): Promise<ResearchReport | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) payload['title'] = updates.title;
    if (updates.status !== undefined) payload['status'] = updates.status;
    if (updates.sections !== undefined) payload['sections'] = updates.sections;
    if (updates.evidence !== undefined) payload['evidence'] = updates.evidence;
    if (updates.notes !== undefined) payload['notes'] = updates.notes;
    if (updates.version !== undefined) payload['version'] = updates.version;
    if (updates.generatedAt !== undefined) payload['generated_at'] = updates.generatedAt;
    if (updates.lastRefreshedAt !== undefined) payload['last_refreshed_at'] = updates.lastRefreshedAt;

    const res = await supabaseRest<ResearchReportRow[]>(
      `research_reports?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok && res.data && res.data[0]) {
      const updated = mapRowToDomain(res.data[0]);
      memoryResearchReportStore.reports.set(updated.id, updated);
      return updated;
    }

    const local = memoryResearchReportStore.reports.get(id);
    if (!local || local.userId !== userId) {
      return null;
    }

    const updatedLocal: ResearchReport = {
      ...local,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryResearchReportStore.reports.set(id, updatedLocal);
    return updatedLocal;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await supabaseRest(
      `research_reports?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    if (res.ok) {
      memoryResearchReportStore.reports.delete(id);
      memoryResearchReportStore.versions.delete(id);
      return true;
    }

    const local = memoryResearchReportStore.reports.get(id);
    if (local && local.userId === userId) {
      memoryResearchReportStore.reports.delete(id);
      memoryResearchReportStore.versions.delete(id);
      return true;
    }

    return false;
  }

  async createVersion(version: ResearchReportVersion): Promise<ResearchReportVersion> {
    const res = await supabaseRest<ResearchReportVersionRow[]>('research_report_versions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: version.id,
        report_id: version.reportId,
        version_number: version.versionNumber,
        content_snapshot: version.contentSnapshot,
        summary_notes: version.summaryNotes,
        created_at: version.createdAt,
        created_by: version.createdBy,
      }),
    });

    if (res.ok && res.data && res.data[0]) {
      const created = mapVersionRowToDomain(res.data[0]);
      const list = memoryResearchReportStore.versions.get(version.reportId) ?? [];
      list.push(created);
      memoryResearchReportStore.versions.set(version.reportId, list);
      return created;
    }

    const list = memoryResearchReportStore.versions.get(version.reportId) ?? [];
    list.push(version);
    memoryResearchReportStore.versions.set(version.reportId, list);
    return version;
  }

  async listVersions(reportId: string): Promise<ResearchReportVersion[]> {
    const res = await supabaseRest<ResearchReportVersionRow[]>(
      `research_report_versions?report_id=eq.${encodeURIComponent(reportId)}&order=version_number.desc`,
    );

    if (res.ok && res.data) {
      return res.data.map(mapVersionRowToDomain);
    }

    const list = memoryResearchReportStore.versions.get(reportId) ?? [];
    return [...list].sort((a, b) => b.versionNumber - a.versionNumber);
  }
}

export const researchReportRepository = new ResearchReportRepository();
