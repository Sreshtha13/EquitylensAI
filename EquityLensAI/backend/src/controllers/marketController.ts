import type { Request, Response, NextFunction } from 'express';
import { marketService } from '../market/marketService.js';
import { sendSuccess } from '../utils/response.js';
import type { Market } from '../market/types.js';

export async function getMarketOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const market = (req.query.market as Market) || 'nse';
    const overview = await marketService.getMarketOverview(market);
    sendSuccess(res, overview);
  } catch (err) {
    next(err);
  }
}

export function listProviders(
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const providers = marketService.listProviders();
  sendSuccess(res, { providers });
}
