import type { Request, Response, NextFunction } from 'express';
import { marketService } from '../market/marketService.js';
import { ingestInstruments, getIngestionStatus } from '../market/instruments/ingestion.js';
import { sendSuccess } from '../utils/response.js';
import type { Market, AssetType, CandleInterval } from '../market/types.js';

export async function searchStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = (req.query.q as string) || '';
    const market = req.query.market as Market | undefined;
    const assetType = req.query.assetType as AssetType | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const items = marketService.searchInstruments({
      query: q,
      market,
      assetType,
      limit,
    });

    sendSuccess(res, {
      query: q,
      total: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStockQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = req.query.exchange as string | undefined;

    const quote = await marketService.getQuote({
      symbol,
      exchange,
    });

    sendSuccess(res, quote);
  } catch (err) {
    next(err);
  }
}

export async function getStockHistorical(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = req.query.exchange as string | undefined;
    const interval = (req.query.interval as CandleInterval) || 'ONE_DAY';
    const from = req.query.from as string;
    const to = req.query.to as string;

    const history = await marketService.getHistoricalPrices({
      symbol,
      exchange,
      interval,
      from,
      to,
    });

    sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
}

export async function triggerIngestion(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await ingestInstruments();
    sendSuccess(res, {
      message: 'Instrument master ingestion completed successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export function getIngestStatus(_req: Request, res: Response, _next: NextFunction): void {
  const status = getIngestionStatus();
  sendSuccess(res, status);
}

export async function getStockProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = req.query.exchange as string | undefined;

    const profile = await marketService.getCompanyProfile({
      symbol,
      exchange,
    });

    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function getStockPerformance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = req.query.exchange as string | undefined;

    const performance = await marketService.getStockPerformance({
      symbol,
      exchange,
    });

    sendSuccess(res, performance);
  } catch (err) {
    next(err);
  }
}

export async function resolveStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const symbol = req.params.symbol as string;
    const exchange = req.query.exchange as string | undefined;

    const instrument = await marketService.resolveInstrument({
      symbol,
      exchange,
    });

    sendSuccess(res, instrument);
  } catch (err) {
    next(err);
  }
}
