import type { Request, Response, NextFunction } from 'express';
import { comparisonService } from '../compare/services/comparisonService.js';
import { peerDiscoveryService } from '../compare/services/peerDiscoveryService.js';
import { benchmarkService } from '../compare/services/benchmarkService.js';
import { historicalCompareService } from '../compare/services/historicalCompareService.js';
import { aiComparisonService } from '../compare/services/aiComparisonService.js';
import { savedComparisonService } from '../compare/services/savedComparisonService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';

export async function compareCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await comparisonService.compareCompanies(req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function discoverPeers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = (req.query.exchange as string) || 'NSE';
    const result = await peerDiscoveryService.discoverPeers(symbol, exchange);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function calculateBenchmarks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { symbols, period, metrics } = req.body;
    const result = await benchmarkService.calculateBenchmarks(symbols, period, metrics);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function compareHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { symbols, period, interval, includeIndex } = req.body;
    const result = await historicalCompareService.compareHistory(symbols, {
      period,
      interval,
      includeIndex,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function analyzeComparisonAi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { symbols, period } = req.body;
    const result = await aiComparisonService.analyzeComparison(symbols, period);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listSavedComparisons(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const items = await savedComparisonService.listComparisons(userId);
    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
}

export async function getSavedComparison(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const id = req.params.id as string;
    const item = await savedComparisonService.getComparison(id, userId);
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
}

export async function createSavedComparison(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const created = await savedComparisonService.createComparison(userId, req.body);
    sendSuccess(res, created, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateSavedComparison(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const id = req.params.id as string;
    const updated = await savedComparisonService.updateComparison(id, userId, req.body);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function duplicateSavedComparison(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const id = req.params.id as string;
    const duplicated = await savedComparisonService.duplicateComparison(id, userId);
    sendSuccess(res, duplicated, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteSavedComparison(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const id = req.params.id as string;
    await savedComparisonService.deleteComparison(id, userId);
    sendSuccess(res, { message: 'Comparison configuration deleted successfully' });
  } catch (err) {
    next(err);
  }
}
