import { apiClient, getAuthToken } from './client';
import { getFrontendEnv } from '@/lib/env';
import type {
  ResearchProject,
  ResearchProjectStatus,
  ResearchReport,
  ResearchReportStatus,
  ResearchReportSection,
  ResearchEvidenceItem,
  ResearchNote,
  ResearchReportVersion,
  ReportTemplateDefinition,
  RefreshReportDiff,
  ReportSectionType,
  NoteTag,
} from '@equitylensai/shared';

export type {
  ResearchProject,
  ResearchProjectStatus,
  ResearchReport,
  ResearchReportStatus,
  ResearchReportSection,
  ResearchEvidenceItem,
  ResearchNote,
  ResearchReportVersion,
  ReportTemplateDefinition,
  RefreshReportDiff,
  ReportSectionType,
  NoteTag,
};

// ─── Phase 4 Legacy Types (Preserved for compatibility) ──────────────────────

export type ResearchClaim = {
  text: string;
  evidenceIds: string[];
};

export type ResearchEvidence = {
  id: string;
  type: 'statement' | 'metric' | 'health_score' | 'market_quote' | 'market_history';
  metric: string;
  value: number | string | null;
  unit: string | null;
  period: string | null;
  periodType?: 'annual' | 'quarterly' | 'ttm';
  source: string;
  timestamp: string | null;
  freshness?: 'live' | 'delayed' | 'eod' | 'historical' | 'stale' | 'periodic' | 'unavailable';
  stale?: boolean;
};

export type ResearchResponse = {
  schemaVersion: '1.0';
  instrument: { symbol: string; exchange: string; name: string | null };
  comparisonInstrument: { symbol: string; exchange: string; name: string | null } | null;
  question: string;
  intent:
    | 'GENERAL'
    | 'PROFITABILITY'
    | 'GROWTH'
    | 'VALUATION'
    | 'LIQUIDITY'
    | 'CASH_FLOW'
    | 'DEBT'
    | 'RISK'
    | 'HISTORICAL_PERFORMANCE'
    | 'COMPARISON';
  summary: ResearchClaim;
  overallAssessment: {
    label: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'INSUFFICIENT_DATA';
    explanation: string;
    evidenceIds: string[];
  };
  sections: Array<{
    title: string;
    analysis: ResearchClaim;
    risks: ResearchClaim[];
    limitations: string[];
  }>;
  strengths: ResearchClaim[];
  riskFactors: ResearchClaim[];
  growthSignals: ResearchClaim[];
  valuationObservations: ResearchClaim[];
  financialObservations: ResearchClaim[];
  missingData: string[];
  evidence: ResearchEvidence[];
  confidence: {
    level: 'HIGH' | 'MEDIUM' | 'LIMITED' | 'LOW';
    explanation: string;
    availableEvidence: number;
    totalEvidence: number;
  };
  disclaimer: string;
};

export type ResearchRequest = {
  symbol: string;
  exchange?: string;
  question: string;
  comparisonInstrument?: { symbol: string; exchange?: string };
};

export function requestResearch(body: ResearchRequest): Promise<ResearchResponse> {
  return apiClient.post<ResearchResponse>('/api/v1/ai/research', body);
}

// ─── Phase 13: Research Workbench & Reports API ──────────────────────────────

export function fetchTemplates(): Promise<{ templates: ReportTemplateDefinition[] }> {
  return apiClient.get<{ templates: ReportTemplateDefinition[] }>('/api/v1/research/templates');
}

export function fetchProjects(
  includeArchived = false,
): Promise<{ projects: ResearchProject[] }> {
  return apiClient.get<{ projects: ResearchProject[] }>(
    `/api/v1/research${includeArchived ? '?includeArchived=true' : ''}`,
  );
}

export function fetchProject(projectId: string): Promise<{ project: ResearchProject }> {
  return apiClient.get<{ project: ResearchProject }>(`/api/v1/research/${projectId}`);
}

export function createProject(data: {
  title: string;
  description?: string | null;
  symbol: string;
  exchange?: string;
  companyName?: string;
  templateId?: string;
}): Promise<{ project: ResearchProject; report?: ResearchReport }> {
  return apiClient.post<{ project: ResearchProject; report?: ResearchReport }>(
    '/api/v1/research',
    data,
  );
}

export function updateProject(
  projectId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: ResearchProjectStatus;
  },
): Promise<{ project: ResearchProject }> {
  return apiClient.patch<{ project: ResearchProject }>(`/api/v1/research/${projectId}`, data);
}

export function deleteProject(projectId: string): Promise<{ deleted: boolean }> {
  return apiClient.delete<{ deleted: boolean }>(`/api/v1/research/${projectId}`);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function fetchReports(projectId: string): Promise<{ reports: ResearchReport[] }> {
  return apiClient.get<{ reports: ResearchReport[] }>(`/api/v1/research/${projectId}/reports`);
}

export function fetchReport(
  projectId: string,
  reportId: string,
): Promise<{ report: ResearchReport }> {
  return apiClient.get<{ report: ResearchReport }>(
    `/api/v1/research/${projectId}/reports/${reportId}`,
  );
}

export function createReport(
  projectId: string,
  data: {
    title: string;
    templateId: string;
    periods?: number;
    includePeers?: boolean;
    includeNews?: boolean;
    researchQuestion?: string;
  },
): Promise<{ report: ResearchReport }> {
  return apiClient.post<{ report: ResearchReport }>(
    `/api/v1/research/${projectId}/reports`,
    data,
  );
}

export function updateReport(
  projectId: string,
  reportId: string,
  data: {
    title?: string;
    status?: ResearchReportStatus;
    sections?: ResearchReportSection[];
    version?: number;
    createSnapshot?: boolean;
    snapshotNotes?: string;
  },
): Promise<{ report: ResearchReport }> {
  return apiClient.patch<{ report: ResearchReport }>(
    `/api/v1/research/${projectId}/reports/${reportId}`,
    data,
  );
}

export function deleteReport(
  projectId: string,
  reportId: string,
): Promise<{ deleted: boolean }> {
  return apiClient.delete<{ deleted: boolean }>(
    `/api/v1/research/${projectId}/reports/${reportId}`,
  );
}

export function generateSection(
  projectId: string,
  reportId: string,
  data: {
    sectionId?: string;
    sectionType: ReportSectionType;
    researchQuestion?: string;
    preserveUserNotes?: boolean;
  },
): Promise<{ report: ResearchReport }> {
  return apiClient.post<{ report: ResearchReport }>(
    `/api/v1/research/${projectId}/reports/${reportId}/generate-section`,
    data,
  );
}

export function refreshReport(
  projectId: string,
  reportId: string,
  data?: { saveNewVersion?: boolean; versionNotes?: string },
): Promise<{ report: ResearchReport; diff: RefreshReportDiff }> {
  return apiClient.post<{ report: ResearchReport; diff: RefreshReportDiff }>(
    `/api/v1/research/${projectId}/reports/${reportId}/refresh`,
    data || {},
  );
}

export function fetchReportVersions(
  projectId: string,
  reportId: string,
): Promise<{ versions: ResearchReportVersion[] }> {
  return apiClient.get<{ versions: ResearchReportVersion[] }>(
    `/api/v1/research/${projectId}/reports/${reportId}/versions`,
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function fetchNotes(projectId: string): Promise<{ notes: ResearchNote[] }> {
  return apiClient.get<{ notes: ResearchNote[] }>(`/api/v1/research/${projectId}/notes`);
}

export function createNote(
  projectId: string,
  data: {
    reportId?: string | null;
    sectionId?: string | null;
    tag?: NoteTag;
    content: string;
  },
): Promise<{ note: ResearchNote }> {
  return apiClient.post<{ note: ResearchNote }>(`/api/v1/research/${projectId}/notes`, data);
}

export function updateNote(
  projectId: string,
  noteId: string,
  data: { tag?: NoteTag; content?: string },
): Promise<{ note: ResearchNote }> {
  return apiClient.patch<{ note: ResearchNote }>(
    `/api/v1/research/${projectId}/notes/${noteId}`,
    data,
  );
}

export function deleteNote(projectId: string, noteId: string): Promise<{ deleted: boolean }> {
  return apiClient.delete<{ deleted: boolean }>(`/api/v1/research/${projectId}/notes/${noteId}`);
}

// ─── Export Downloads ────────────────────────────────────────────────────────

export async function downloadPdfReport(
  projectId: string,
  reportId: string,
  filename = 'EquityLensAI_Report.pdf',
): Promise<void> {
  const { NEXT_PUBLIC_API_URL } = getFrontendEnv();
  const token = getAuthToken();
  const url = `${NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/research/${projectId}/reports/${reportId}/export/pdf`;

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error(`Failed to download PDF (${res.status})`);
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function downloadCsvReport(
  projectId: string,
  reportId: string,
  filename = 'EquityLensAI_Report.csv',
): Promise<void> {
  const { NEXT_PUBLIC_API_URL } = getFrontendEnv();
  const token = getAuthToken();
  const url = `${NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/research/${projectId}/reports/${reportId}/export/csv`;

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error(`Failed to download CSV (${res.status})`);
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
