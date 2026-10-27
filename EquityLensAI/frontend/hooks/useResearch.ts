'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  requestResearch,
  fetchTemplates,
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  fetchReports,
  fetchReport,
  createReport,
  updateReport,
  deleteReport,
  generateSection,
  refreshReport,
  fetchReportVersions,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  type ResearchRequest,
  type ResearchProjectStatus,
  type ResearchReportStatus,
  type ResearchReportSection,
  type ReportSectionType,
  type NoteTag,
} from '@/services/api/research';

// ─── Legacy Phase 4 Hook ─────────────────────────────────────────────────────

export function useResearch() {
  return useMutation({
    mutationFn: (request: ResearchRequest) => requestResearch(request),
  });
}

// ─── Phase 13 Templates ──────────────────────────────────────────────────────

export function useResearchTemplates() {
  return useQuery({
    queryKey: ['research', 'templates'],
    queryFn: () => fetchTemplates(),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Projects ────────────────────────────────────────────────────────────────

export function useResearchProjects(includeArchived = false) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'projects', { includeArchived }],
    queryFn: () => fetchProjects(includeArchived),
    enabled: isAuthenticated,
  });
}

export function useResearchProject(projectId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: isAuthenticated && Boolean(projectId),
  });
}

export function useCreateResearchProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string | null;
      symbol: string;
      exchange?: string;
      companyName?: string;
      templateId?: string;
    }) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'projects'] });
    },
  });
}

export function useUpdateResearchProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        title?: string;
        description?: string | null;
        status?: ResearchProjectStatus;
      };
    }) => updateProject(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['research', 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['research', 'project', variables.projectId] });
    },
  });
}

export function useDeleteResearchProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'projects'] });
    },
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function useResearchReports(projectId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'reports', projectId],
    queryFn: () => fetchReports(projectId!),
    enabled: isAuthenticated && Boolean(projectId),
  });
}

export function useResearchReport(projectId?: string, reportId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'report', projectId, reportId],
    queryFn: () => fetchReport(projectId!, reportId!),
    enabled: isAuthenticated && Boolean(projectId) && Boolean(reportId),
  });
}

export function useCreateResearchReport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      templateId: string;
      periods?: number;
      includePeers?: boolean;
      includeNews?: boolean;
      researchQuestion?: string;
    }) => createReport(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'reports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['research', 'project', projectId] });
    },
  });
}

export function useUpdateResearchReport(projectId: string, reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      status?: ResearchReportStatus;
      sections?: ResearchReportSection[];
      version?: number;
      createSnapshot?: boolean;
      snapshotNotes?: string;
    }) => updateReport(projectId, reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'report', projectId, reportId] });
      queryClient.invalidateQueries({ queryKey: ['research', 'reports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['research', 'versions', projectId, reportId] });
    },
  });
}

export function useDeleteResearchReport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => deleteReport(projectId, reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'reports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['research', 'project', projectId] });
    },
  });
}

export function useGenerateReportSection(projectId: string, reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sectionId?: string;
      sectionType: ReportSectionType;
      researchQuestion?: string;
      preserveUserNotes?: boolean;
    }) => generateSection(projectId, reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'report', projectId, reportId] });
    },
  });
}

export function useRefreshReport(projectId: string, reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { saveNewVersion?: boolean; versionNotes?: string }) =>
      refreshReport(projectId, reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'report', projectId, reportId] });
      queryClient.invalidateQueries({ queryKey: ['research', 'versions', projectId, reportId] });
    },
  });
}

export function useReportVersions(projectId?: string, reportId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'versions', projectId, reportId],
    queryFn: () => fetchReportVersions(projectId!, reportId!),
    enabled: isAuthenticated && Boolean(projectId) && Boolean(reportId),
  });
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function useResearchNotes(projectId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['research', 'notes', projectId],
    queryFn: () => fetchNotes(projectId!),
    enabled: isAuthenticated && Boolean(projectId),
  });
}

export function useCreateResearchNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      reportId?: string | null;
      sectionId?: string | null;
      tag?: NoteTag;
      content: string;
    }) => createNote(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'notes', projectId] });
    },
  });
}

export function useUpdateResearchNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: { tag?: NoteTag; content?: string };
    }) => updateNote(projectId, noteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'notes', projectId] });
    },
  });
}

export function useDeleteResearchNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => deleteNote(projectId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'notes', projectId] });
    },
  });
}
