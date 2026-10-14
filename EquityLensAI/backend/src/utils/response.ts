import type { ApiSuccess } from '@equitylensai/shared';
import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiSuccess<T> = { success: true, data };
  return res.status(statusCode).json(body);
}
