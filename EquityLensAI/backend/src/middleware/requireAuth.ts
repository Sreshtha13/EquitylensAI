import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.js';

/**
 * Placeholder for future Supabase Auth session verification.
 * Not attached to any Phase 1 route.
 */
export function requireAuth(_req: Request, _res: Response, _next: NextFunction): void {
  throw new AppError('NOT_IMPLEMENTED', 'Authentication will be implemented in a later phase', 501);
}
