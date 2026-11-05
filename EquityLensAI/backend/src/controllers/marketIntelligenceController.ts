import type { Request, Response, NextFunction } from 'express';
import { marketIntelligenceService } from '../market/intelligence/marketIntelligenceService.js';
import { sendSuccess } from '../utils/response.js';
import type { SecurityClassification } from '../market/types.js';

export async function getMarketIndices(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const indices = await marketIntelligenceService.getMarketIndices();
    sendSuccess(res, { indices, total: indices.length });
  } catch (err) {
    next(err);
  }
}

export async function getMarketBreadth(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const breadth = await marketIntelligenceService.getMarketBreadth();
    sendSuccess(res, breadth);
  } catch (err) {
    next(err);
  }
}

export async function getTopGainers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const exchange = (req.query.exchange as string) || 'ALL';
    const classification = req.query.classification as SecurityClassification | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const gainers = await marketIntelligenceService.getTopMovers('gainers', {
      exchange,
      classification,
      limit,
    });
    sendSuccess(res, { items: gainers, total: gainers.length, type: 'gainers' });
  } catch (err) {
    next(err);
  }
}

export async function getTopLosers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const exchange = (req.query.exchange as string) || 'ALL';
    const classification = req.query.classification as SecurityClassification | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const losers = await marketIntelligenceService.getTopMovers('losers', {
      exchange,
      classification,
      limit,
    });
    sendSuccess(res, { items: losers, total: losers.length, type: 'losers' });
  } catch (err) {
    next(err);
  }
}

export async function getVolumeShockers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const days = req.query.days ? (parseInt(req.query.days as string, 10) as 5 | 10 | 20) : 10;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const exchange = req.query.exchange as string | undefined;

    const shockers = await marketIntelligenceService.getVolumeShockers({
      days,
      limit,
      exchange,
    });
    sendSuccess(res, { items: shockers, total: shockers.length, days });
  } catch (err) {
    next(err);
  }
}

export async function getMostActive(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const by = ((req.query.by as string) || 'volume') as 'volume' | 'turnover';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const exchange = req.query.exchange as string | undefined;

    const items = await marketIntelligenceService.getMostActive(by, {
      limit,
      exchange,
    });
    sendSuccess(res, { items, total: items.length, by });
  } catch (err) {
    next(err);
  }
}

export async function getMostWatched(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const windowDays = req.query.windowDays ? parseInt(req.query.windowDays as string, 10) : 7;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const items = await marketIntelligenceService.getMostWatched({
      windowDays,
      limit,
    });
    sendSuccess(res, { items, total: items.length, windowDays });
  } catch (err) {
    next(err);
  }
}

export async function getTrendingStocks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const exchange = req.query.exchange as string | undefined;

    const items = await marketIntelligenceService.getTrendingStocks({
      limit,
      exchange,
    });
    sendSuccess(res, { items, total: items.length });
  } catch (err) {
    next(err);
  }
}

export async function getSectorPerformance(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectors = await marketIntelligenceService.getSectorPerformance();
    sendSuccess(res, { sectors, total: sectors.length });
  } catch (err) {
    next(err);
  }
}

export async function getHighsLows(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = req.query.type as 'highs' | 'lows' | 'all' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const result = await marketIntelligenceService.getHighsAndLows({ type, limit });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getCircuits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = req.query.type as 'UPPER' | 'LOWER' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const items = await marketIntelligenceService.getCircuitStocks({ type, limit });
    sendSuccess(res, { items, total: items.length, type });
  } catch (err) {
    next(err);
  }
}

export async function getNewListings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const items = await marketIntelligenceService.getNewListings({ limit });
    sendSuccess(res, { items, total: items.length });
  } catch (err) {
    next(err);
  }
}
