import type { Request, Response } from 'express';
import { watchlistsService } from '../services/watchlistsService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';
import type { SupportedExchange } from '@equitylensai/shared';

export async function listWatchlists(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlists = await watchlistsService.listWatchlists(req.user.id);
  sendSuccess(res, watchlists);
}

export async function createWatchlist(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const created = await watchlistsService.createWatchlist(req.user.id, req.body);
  sendSuccess(res, created, 201);
}

export async function getWatchlistDetail(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  const detail = await watchlistsService.getWatchlistDetail(req.user.id, watchlistId);
  sendSuccess(res, detail);
}

export async function updateWatchlist(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  const updated = await watchlistsService.updateWatchlist(req.user.id, watchlistId, req.body);
  sendSuccess(res, updated);
}

export async function deleteWatchlist(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  await watchlistsService.deleteWatchlist(req.user.id, watchlistId);
  sendSuccess(res, { message: 'Watchlist deleted successfully' });
}

export async function addWatchlistItem(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  const item = await watchlistsService.addItem(req.user.id, watchlistId, req.body);
  sendSuccess(res, item, 201);
}

export async function removeWatchlistItem(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  const symbol = req.params.symbol!;
  const exchange = req.query.exchange as SupportedExchange | undefined;
  await watchlistsService.removeItem(req.user.id, watchlistId, symbol, exchange);
  sendSuccess(res, { message: 'Stock removed from watchlist' });
}

export async function reorderWatchlistItems(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const watchlistId = req.params.watchlistId!;
  const symbols = req.body.symbols as string[];
  if (!Array.isArray(symbols)) {
    throw new AppError('INVALID_INPUT', 'Symbols array is required for reordering', 400);
  }
  await watchlistsService.reorderItems(req.user.id, watchlistId, symbols);
  sendSuccess(res, { message: 'Watchlist items reordered successfully' });
}
