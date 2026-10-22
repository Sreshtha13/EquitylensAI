import type { Request, Response } from 'express';
import { favoritesService } from '../services/favoritesService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';
import type { SupportedExchange } from '@equitylensai/shared';

export async function listFavorites(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const favorites = await favoritesService.listFavorites(req.user.id);
  sendSuccess(res, favorites);
}

export async function addFavorite(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const item = await favoritesService.addFavorite(
    req.user.id,
    req.body.symbol,
    req.body.exchange || 'NSE',
  );
  sendSuccess(res, item, 201);
}

export async function removeFavorite(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const exchange = req.query.exchange as SupportedExchange | undefined;
  const symbol = req.params.symbol!;
  await favoritesService.removeFavorite(req.user.id, symbol, exchange);
  sendSuccess(res, { message: 'Stock removed from favorites' });
}
