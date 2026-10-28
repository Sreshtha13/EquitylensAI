import type { Request, Response } from 'express';
import {
  getHealthStatus,
  getReadinessStatus,
  getDependenciesStatus,
} from '../services/healthService.js';
import { metricsService } from '../services/metricsService.js';
import { sendSuccess } from '../utils/response.js';

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, getHealthStatus());
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const readiness = await getReadinessStatus();
  const statusCode = readiness.ready ? 200 : 503;
  res.status(statusCode).json({
    success: readiness.ready,
    data: readiness,
  });
}

export async function getDependencies(_req: Request, res: Response): Promise<void> {
  const dependencies = await getDependenciesStatus();
  sendSuccess(res, dependencies);
}

export function getMetrics(_req: Request, res: Response): void {
  sendSuccess(res, metricsService.getMetricsSnapshot());
}
