import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/healthService.js';
import { sendSuccess } from '../utils/response.js';

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, getHealthStatus());
}
