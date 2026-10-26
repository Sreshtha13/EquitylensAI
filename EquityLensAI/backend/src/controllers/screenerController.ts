import type { Request, Response } from 'express';
import { getScreenerMetricCatalog, runScreener } from '../ai/screener/index.js';
import { screenerTemplateService } from '../screener/services/screenerTemplateService.js';
import { savedScreenService } from '../screener/services/savedScreenService.js';
import { screenerRunRepository } from '../screener/repositories/screenerRunRepository.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';

export async function getMetrics(_req: Request, res: Response): Promise<void> {
  const catalog = getScreenerMetricCatalog();
  sendSuccess(res, catalog);
}

export async function getTemplates(_req: Request, res: Response): Promise<void> {
  const templates = screenerTemplateService.listTemplates();
  sendSuccess(res, templates);
}

export async function runStructuredScreen(req: Request, res: Response): Promise<void> {
  const result = await runScreener(req.body);
  sendSuccess(res, result);
}

export async function listSavedScreens(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screens = await savedScreenService.listSavedScreens(req.user.id);
  sendSuccess(res, screens);
}

export async function createSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const created = await savedScreenService.createSavedScreen(req.user.id, req.body);
  sendSuccess(res, created, 201);
}

export async function getSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screenId = req.params.screenId!;
  const screen = await savedScreenService.getSavedScreen(req.user.id, screenId);
  sendSuccess(res, screen);
}

export async function updateSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screenId = req.params.screenId!;
  const updated = await savedScreenService.updateSavedScreen(req.user.id, screenId, req.body);
  sendSuccess(res, updated);
}

export async function deleteSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screenId = req.params.screenId!;
  await savedScreenService.deleteSavedScreen(req.user.id, screenId);
  sendSuccess(res, { message: 'Saved screen deleted successfully.' });
}

export async function duplicateSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screenId = req.params.screenId!;
  const duplicated = await savedScreenService.duplicateSavedScreen(req.user.id, screenId);
  sendSuccess(res, duplicated, 201);
}

export async function runSavedScreen(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const screenId = req.params.screenId!;
  const result = await savedScreenService.runSavedScreen(req.user.id, screenId, {
    limit: req.body?.limit,
    offset: req.body?.offset,
  });
  sendSuccess(res, result);
}

export async function listScreenerRuns(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const runs = await screenerRunRepository.listByUser(req.user.id, limit);
  sendSuccess(res, runs);
}

export async function getScreenerRun(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  }
  const runId = req.params.runId!;
  const run = await screenerRunRepository.getById(runId, req.user.id);
  if (!run) {
    throw new AppError('SCREENER_RUN_NOT_FOUND', 'Screening run record not found.', 404);
  }
  sendSuccess(res, run);
}
