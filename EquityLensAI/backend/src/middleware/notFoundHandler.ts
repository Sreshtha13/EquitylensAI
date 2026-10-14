import type { Request, Response } from 'express';
import { AppError } from '../utils/appError.js';

export function notFoundHandler(req: Request, _res: Response): void {
  throw new AppError('NOT_FOUND', `Route ${req.method} ${req.path} was not found`, 404);
}
