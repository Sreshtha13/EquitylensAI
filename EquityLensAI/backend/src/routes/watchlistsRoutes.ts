import { Router } from 'express';
import { AppError } from '../utils/appError.js';

export const watchlistsRouter = Router();

watchlistsRouter.all('*', (_req, _res, next) => {
  next(new AppError('NOT_IMPLEMENTED', 'User Watchlists endpoint is scheduled for Phase 5 (Supabase Auth integration)', 501));
});
