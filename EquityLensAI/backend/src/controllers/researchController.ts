import type { Request, Response } from 'express';
import { researchService } from '../research/services/researchService.js';
import { reportTemplateService } from '../research/services/reportTemplateService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(_req: Request, res: Response): Promise<void> {
  const templates = reportTemplateService.listTemplates();
  sendSuccess(res, { templates });
}

// ─── Research Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const includeArchived = req.query.includeArchived === 'true';
  const projects = await researchService.listProjects(req.user.id, includeArchived);
  sendSuccess(res, { projects });
}

export async function getProject(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const project = await researchService.getProject(req.user.id, req.params.researchId!);
  sendSuccess(res, { project });
}

export async function createProject(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const result = await researchService.createProject(req.user.id, req.body);
  sendSuccess(res, result, 201);
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const project = await researchService.updateProject(req.user.id, req.params.researchId!, req.body);
  sendSuccess(res, { project });
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  await researchService.deleteProject(req.user.id, req.params.researchId!);
  sendSuccess(res, { deleted: true });
}

// ─── Research Reports ────────────────────────────────────────────────────────

export async function listReports(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const reports = await researchService.listReports(req.user.id, req.params.researchId!);
  sendSuccess(res, { reports });
}

export async function getReport(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const report = await researchService.getReport(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
  );
  sendSuccess(res, { report });
}

export async function createReport(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const report = await researchService.createReport(
    req.user.id,
    req.params.researchId!,
    req.body,
  );
  sendSuccess(res, { report }, 201);
}

export async function updateReport(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const report = await researchService.updateReport(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
    req.body,
  );
  sendSuccess(res, { report });
}

export async function deleteReport(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  await researchService.deleteReport(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
  );
  sendSuccess(res, { deleted: true });
}

export async function generateSection(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const report = await researchService.generateSection(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
    req.body,
  );
  sendSuccess(res, { report });
}

export async function refreshReport(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const result = await researchService.refreshReport(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
    req.body,
  );
  sendSuccess(res, result);
}

export async function listReportVersions(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const versions = await researchService.listReportVersions(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
  );
  sendSuccess(res, { versions });
}

// ─── Research Notes ──────────────────────────────────────────────────────────

export async function listNotes(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const notes = await researchService.listNotes(req.user.id, req.params.researchId!);
  sendSuccess(res, { notes });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const note = await researchService.createNote(
    req.user.id,
    req.params.researchId!,
    req.body,
  );
  sendSuccess(res, { note }, 201);
}

export async function updateNote(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const note = await researchService.updateNote(
    req.user.id,
    req.params.researchId!,
    req.params.noteId!,
    req.body,
  );
  sendSuccess(res, { note });
}

export async function deleteNote(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  await researchService.deleteNote(
    req.user.id,
    req.params.researchId!,
    req.params.noteId!,
  );
  sendSuccess(res, { deleted: true });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export async function exportPdf(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const pdfBuffer = await researchService.exportPdf(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="EquityLensAI_Report_${req.params.researchId}_${req.params.reportId}.pdf"`,
  );
  res.status(200).send(pdfBuffer);
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const csv = await researchService.exportCsv(
    req.user.id,
    req.params.researchId!,
    req.params.reportId!,
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="EquityLensAI_Report_${req.params.researchId}_${req.params.reportId}.csv"`,
  );
  res.status(200).send(csv);
}
