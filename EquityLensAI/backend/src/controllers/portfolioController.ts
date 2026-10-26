import type { Request, Response } from 'express';
import { portfolioService } from '../portfolio/services/portfolioService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';
import type { PortfolioPerformanceRange } from '@equitylensai/shared';

export async function listPortfolios(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolios = await portfolioService.listPortfolios(req.user.id);
  sendSuccess(res, portfolios);
}

export async function createPortfolio(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const created = await portfolioService.createPortfolio(req.user.id, req.body);
  sendSuccess(res, created, 201);
}

export async function getPortfolio(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const portfolio = await portfolioService.getPortfolio(req.user.id, portfolioId);
  sendSuccess(res, portfolio);
}

export async function updatePortfolio(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const updated = await portfolioService.updatePortfolio(req.user.id, portfolioId, req.body);
  sendSuccess(res, updated);
}

export async function deletePortfolio(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  await portfolioService.deletePortfolio(req.user.id, portfolioId);
  sendSuccess(res, { message: 'Portfolio deleted successfully' });
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function listTransactions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const symbol = req.query.symbol as string | undefined;
  const type = req.query.type as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

  const result = await portfolioService.listTransactions(req.user.id, portfolioId, {
    symbol,
    type,
    limit,
    offset,
  });
  sendSuccess(res, result);
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const tx = await portfolioService.addTransaction(req.user.id, portfolioId, req.body);
  sendSuccess(res, tx, 201);
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const transactionId = req.params.transactionId!;
  const tx = await portfolioService.getTransaction(req.user.id, portfolioId, transactionId);
  sendSuccess(res, tx);
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const transactionId = req.params.transactionId!;
  const updated = await portfolioService.updateTransaction(
    req.user.id,
    portfolioId,
    transactionId,
    req.body,
  );
  sendSuccess(res, updated);
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const transactionId = req.params.transactionId!;
  await portfolioService.deleteTransaction(req.user.id, portfolioId, transactionId);
  sendSuccess(res, { message: 'Transaction deleted successfully' });
}

// ─── Holdings & Summary ──────────────────────────────────────────────────────

export async function getHoldings(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const result = await portfolioService.getHoldings(req.user.id, portfolioId);
  sendSuccess(res, result);
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const summary = await portfolioService.getSummary(req.user.id, portfolioId);
  sendSuccess(res, summary);
}

// ─── Allocation & Performance ────────────────────────────────────────────────

export async function getAllocation(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const allocation = await portfolioService.getAllocation(req.user.id, portfolioId);
  sendSuccess(res, allocation);
}

export async function getPerformance(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const range = (req.query.range as PortfolioPerformanceRange) || '1M';
  const performance = await portfolioService.getPerformance(req.user.id, portfolioId, range);
  sendSuccess(res, performance);
}

// ─── Import & Export ─────────────────────────────────────────────────────────

export async function exportTransactions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const csv = await portfolioService.exportTransactionsCsv(req.user.id, portfolioId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="portfolio_${portfolioId}_transactions.csv"`,
  );
  res.status(200).send(csv);
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const preview = await portfolioService.previewImportCsv(
    req.user.id,
    portfolioId,
    req.body.csvContent,
  );
  sendSuccess(res, preview);
}

export async function confirmImport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const portfolioId = req.params.portfolioId!;
  const txs = await portfolioService.confirmImport(
    req.user.id,
    portfolioId,
    req.body.rows,
    req.body.batchId,
  );
  sendSuccess(res, { count: txs.length, transactions: txs }, 201);
}
