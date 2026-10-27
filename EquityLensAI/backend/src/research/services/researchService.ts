import crypto from 'node:crypto';
import type {
  ResearchProject,
  ResearchReport,
  ResearchNote,
  ResearchReportVersion,
  RefreshReportDiff,
  ReportSectionType,
} from '@equitylensai/shared';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import {
  researchProjectRepository,
  researchReportRepository,
  researchNoteRepository,
} from '../repositories/index.js';
import { reportTemplateService } from './reportTemplateService.js';
import { reportAssemblyService } from './reportAssemblyService.js';
import { reportAiService } from './reportAiService.js';
import { exportService } from './exportService.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateReportInput,
  UpdateReportInput,
  CreateNoteInput,
  UpdateNoteInput,
} from '../types.js';

export class ResearchService {
  // ─── Research Projects ───────────────────────────────────────────────────────

  async listProjects(userId: string, includeArchived = false): Promise<ResearchProject[]> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const projects = await researchProjectRepository.listByUser(userId, includeArchived);

    // Enrich with counts
    for (const project of projects) {
      const reports = await researchReportRepository.listByProject(project.id, userId);
      const notes = await researchNoteRepository.listByProject(project.id, userId);
      project.reportsCount = reports.length;
      project.notesCount = notes.length;
    }

    return projects;
  }

  async getProject(userId: string, projectId: string): Promise<ResearchProject> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const project = await researchProjectRepository.getById(projectId, userId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', `Research project ${projectId} not found`, 404);
    }

    const reports = await researchReportRepository.listByProject(project.id, userId);
    const notes = await researchNoteRepository.listByProject(project.id, userId);
    project.reportsCount = reports.length;
    project.notesCount = notes.length;

    return project;
  }

  async createProject(userId: string, input: CreateProjectInput): Promise<{ project: ResearchProject; report?: ResearchReport }> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const trimmedSymbol = input.symbol.trim().toUpperCase();
    const exchange = input.exchange?.trim().toUpperCase() || 'NSE';

    // Verify instrument from repository
    const matched = instrumentRepository.getBySymbol(trimmedSymbol, exchange) ||
      instrumentRepository.search(trimmedSymbol, { limit: 1 })[0];
    const companyName = input.companyName || matched?.name || trimmedSymbol;

    const now = new Date().toISOString();
    const project: ResearchProject = {
      id: crypto.randomUUID(),
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      symbol: trimmedSymbol,
      exchange,
      companyName,
      status: input.status || 'draft',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    const createdProject = await researchProjectRepository.create(project);

    // If templateId specified, automatically bootstrap initial research report
    let initialReport: ResearchReport | undefined;
    if (input.templateId) {
      try {
        initialReport = await this.createReport(userId, createdProject.id, {
          title: `${companyName} Research Report`,
          templateId: input.templateId,
        });
      } catch (err) {
        logger.warn({ err, projectId: createdProject.id }, 'Initial report creation failed; project created');
      }
    }

    return {
      project: createdProject,
      ...(initialReport ? { report: initialReport } : {}),
    };
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<ResearchProject> {
    await this.getProject(userId, projectId);
    const updated = await researchProjectRepository.update(projectId, userId, input);
    if (!updated) {
      throw new AppError('PROJECT_NOT_FOUND', `Research project ${projectId} not found`, 404);
    }
    return updated;
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    await this.getProject(userId, projectId);
    await researchProjectRepository.delete(projectId, userId);
  }

  // ─── Research Reports ────────────────────────────────────────────────────────

  async listReports(userId: string, projectId: string): Promise<ResearchReport[]> {
    await this.getProject(userId, projectId);
    return researchReportRepository.listByProject(projectId, userId);
  }

  async getReport(userId: string, projectId: string, reportId: string): Promise<ResearchReport> {
    await this.getProject(userId, projectId);
    const report = await researchReportRepository.getById(reportId, userId);
    if (!report || report.researchProjectId !== projectId) {
      throw new AppError('REPORT_NOT_FOUND', `Research report ${reportId} not found`, 404);
    }
    return report;
  }

  async createReport(userId: string, projectId: string, input: CreateReportInput): Promise<ResearchReport> {
    const project = await this.getProject(userId, projectId);
    const template = reportTemplateService.getTemplate(input.templateId);

    // Assemble report using verified data
    const assembled = await reportAssemblyService.assembleReport({
      symbol: project.symbol,
      exchange: project.exchange,
      template,
      periods: input.periods ?? 4,
      includePeers: input.includePeers ?? true,
      includeNews: input.includeNews ?? true,
      ...(input.researchQuestion ? { researchQuestion: input.researchQuestion } : {}),
    });

    const now = new Date().toISOString();
    const report: ResearchReport = {
      id: crypto.randomUUID(),
      researchProjectId: project.id,
      userId,
      title: input.title.trim(),
      templateId: template.id,
      status: 'draft',
      schemaVersion: 1,
      version: 1,
      sections: assembled.sections,
      evidence: assembled.evidence,
      notes: [],
      createdAt: now,
      updatedAt: now,
      generatedAt: now,
      lastRefreshedAt: now,
    };

    return researchReportRepository.create(report);
  }

  async updateReport(
    userId: string,
    projectId: string,
    reportId: string,
    input: UpdateReportInput,
  ): Promise<ResearchReport> {
    const current = await this.getReport(userId, projectId, reportId);

    // Optimistic locking check if version was provided
    if (input.version !== undefined && input.version !== current.version) {
      throw new AppError(
        'CONCURRENT_MODIFICATION',
        `Report has been modified by another session (current v${current.version}, expected v${input.version})`,
        409,
      );
    }

    const nextVersion = current.version + 1;

    // Create version snapshot if requested or if moving to finalized
    if (input.createSnapshot || (input.status === 'finalized' && current.status !== 'finalized')) {
      const snapshot: ResearchReportVersion = {
        id: crypto.randomUUID(),
        reportId: current.id,
        versionNumber: current.version,
        contentSnapshot: {
          title: current.title,
          templateId: current.templateId,
          sections: current.sections,
          evidence: current.evidence,
          notes: current.notes,
        },
        summaryNotes: input.snapshotNotes || `Snapshot of v${current.version}`,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };
      await researchReportRepository.createVersion(snapshot);
    }

    const updatePayload: Parameters<typeof researchReportRepository.update>[2] = {
      version: nextVersion,
    };
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.sections !== undefined) updatePayload.sections = input.sections;

    const updated = await researchReportRepository.update(reportId, userId, updatePayload);

    if (!updated) {
      throw new AppError('REPORT_NOT_FOUND', `Research report ${reportId} not found`, 404);
    }

    return updated;
  }

  async generateSection(
    userId: string,
    projectId: string,
    reportId: string,
    input: { sectionId?: string; sectionType: ReportSectionType; researchQuestion?: string },
  ): Promise<ResearchReport> {
    const project = await this.getProject(userId, projectId);
    const report = await this.getReport(userId, projectId, reportId);

    // Find target section
    const targetSection = report.sections.find((s) => s.id === input.sectionId || s.sectionType === input.sectionType);
    const sectionTitle = targetSection?.title || input.sectionType.replace(/_/g, ' ');

    const newSection = await reportAiService.generateReportSection({
      symbol: project.symbol,
      companyName: project.companyName,
      sectionType: input.sectionType,
      sectionTitle,
      evidence: report.evidence,
      ...(input.researchQuestion ? { researchQuestion: input.researchQuestion } : {}),
    });

    let updatedSections: typeof report.sections;
    if (targetSection) {
      updatedSections = report.sections.map((s) =>
        s.id === targetSection.id
          ? {
              ...s,
              content: newSection.content,
              evidenceIds: newSection.evidenceIds,
              generatedBy: 'ai' as const,
              status: 'draft' as const,
              updatedAt: new Date().toISOString(),
            }
          : s,
      );
    } else {
      updatedSections = [
        ...report.sections,
        {
          ...newSection,
          position: report.sections.length,
        },
      ];
    }

    const updated = await researchReportRepository.update(reportId, userId, {
      sections: updatedSections,
      version: report.version + 1,
    });

    if (!updated) {
      throw new AppError('REPORT_NOT_FOUND', `Research report ${reportId} not found`, 404);
    }

    return updated;
  }

  async refreshReport(
    userId: string,
    projectId: string,
    reportId: string,
    input?: { saveNewVersion?: boolean; versionNotes?: string },
  ): Promise<{ report: ResearchReport; diff: RefreshReportDiff }> {
    const project = await this.getProject(userId, projectId);
    const report = await this.getReport(userId, projectId, reportId);
    const template = reportTemplateService.getTemplate(report.templateId);

    // Assemble fresh live observations
    const assembled = await reportAssemblyService.assembleReport({
      symbol: project.symbol,
      exchange: project.exchange,
      template,
    });

    // Compute material diff
    const oldPriceEv = report.evidence.find((e) => e.evidenceType === 'quote');
    const newPriceEv = assembled.evidence.find((e) => e.evidenceType === 'quote');
    const oldPrice = typeof oldPriceEv?.value === 'number' ? oldPriceEv.value : null;
    const newPrice = typeof newPriceEv?.value === 'number' ? newPriceEv.value : null;
    const priceChanged = oldPrice !== null && newPrice !== null && oldPrice !== newPrice;
    const priceChangePct = oldPrice && newPrice ? ((newPrice - oldPrice) / oldPrice) * 100 : null;

    const diff: RefreshReportDiff = {
      reportId: report.id,
      generatedAt: report.generatedAt || report.createdAt,
      refreshedAt: new Date().toISOString(),
      hasChanges: priceChanged || assembled.evidence.length !== report.evidence.length,
      changesSummary: {
        priceChanged,
        oldPrice,
        newPrice,
        priceChangePct,
        newFinancialsAvailable: assembled.evidence.some((e) => e.evidenceType === 'financial_statement'),
        latestPeriod: assembled.financials?.latestAnnual?.income?.periodEndDate ?? null,
        newAnnouncementsCount: assembled.announcements.length,
        newNewsCount: assembled.news.length,
      },
      affectedSections: ['market_overview', 'financial_analysis', 'news_and_developments'],
      disclaimer: 'Report refreshed against verified live and audited observations. User-authored notes are preserved.',
    };

    // If report is finalized or saveNewVersion requested, preserve previous version snapshot
    if (input?.saveNewVersion || report.status === 'finalized') {
      const snapshot: ResearchReportVersion = {
        id: crypto.randomUUID(),
        reportId: report.id,
        versionNumber: report.version,
        contentSnapshot: {
          title: report.title,
          templateId: report.templateId,
          sections: report.sections,
          evidence: report.evidence,
          notes: report.notes,
        },
        summaryNotes: input?.versionNotes || `Preserved snapshot before refreshing with latest verified market data`,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };
      await researchReportRepository.createVersion(snapshot);
    }

    // Merge sections: update system data sections, preserve user-authored sections and notes!
    const updatedSections = report.sections.map((sec) => {
      if (sec.generatedBy === 'user') {
        return sec; // Preserve user-written sections completely
      }
      const freshSec = assembled.sections.find((s) => s.sectionType === sec.sectionType);
      if (freshSec && sec.generatedBy === 'system') {
        return {
          ...sec,
          content: freshSec.content,
          structuredData: freshSec.structuredData,
          evidenceIds: freshSec.evidenceIds,
          updatedAt: new Date().toISOString(),
        };
      }
      return sec;
    });

    const nextVersion = report.version + 1;
    const now = new Date().toISOString();

    const updated = await researchReportRepository.update(reportId, userId, {
      sections: updatedSections,
      evidence: assembled.evidence,
      version: nextVersion,
      lastRefreshedAt: now,
    });

    if (!updated) {
      throw new AppError('REPORT_NOT_FOUND', `Research report ${reportId} not found`, 404);
    }

    return { report: updated, diff };
  }

  async deleteReport(userId: string, projectId: string, reportId: string): Promise<void> {
    await this.getReport(userId, projectId, reportId);
    await researchReportRepository.delete(reportId, userId);
  }

  async listReportVersions(userId: string, projectId: string, reportId: string): Promise<ResearchReportVersion[]> {
    await this.getReport(userId, projectId, reportId);
    return researchReportRepository.listVersions(reportId);
  }

  // ─── Research Notes ──────────────────────────────────────────────────────────

  async listNotes(userId: string, projectId: string): Promise<ResearchNote[]> {
    await this.getProject(userId, projectId);
    return researchNoteRepository.listByProject(projectId, userId);
  }

  async createNote(userId: string, projectId: string, input: CreateNoteInput): Promise<ResearchNote> {
    await this.getProject(userId, projectId);
    const now = new Date().toISOString();

    const note: ResearchNote = {
      id: crypto.randomUUID(),
      researchProjectId: projectId,
      reportId: input.reportId || null,
      sectionId: input.sectionId || null,
      userId,
      tag: input.tag || 'observation',
      content: input.content.trim(),
      createdAt: now,
      updatedAt: now,
    };

    return researchNoteRepository.create(note);
  }

  async updateNote(
    userId: string,
    projectId: string,
    noteId: string,
    input: UpdateNoteInput,
  ): Promise<ResearchNote> {
    await this.getProject(userId, projectId);
    const updated = await researchNoteRepository.update(noteId, userId, input);
    if (!updated) {
      throw new AppError('NOTE_NOT_FOUND', `Research note ${noteId} not found`, 404);
    }
    return updated;
  }

  async deleteNote(userId: string, projectId: string, noteId: string): Promise<void> {
    await this.getProject(userId, projectId);
    await researchNoteRepository.delete(noteId, userId);
  }

  // ─── Exports ─────────────────────────────────────────────────────────────────

  async exportPdf(userId: string, projectId: string, reportId: string): Promise<Buffer> {
    const project = await this.getProject(userId, projectId);
    const report = await this.getReport(userId, projectId, reportId);
    return exportService.generatePdf(project, report);
  }

  async exportCsv(userId: string, projectId: string, reportId: string): Promise<string> {
    const project = await this.getProject(userId, projectId);
    const report = await this.getReport(userId, projectId, reportId);
    const projectNotes = await researchNoteRepository.listByProject(projectId, userId);
    return exportService.generateCsv(project, report, projectNotes);
  }
}

export const researchService = new ResearchService();
