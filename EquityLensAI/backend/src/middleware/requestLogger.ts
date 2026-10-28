import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metricsService.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  metricsService.requestStarted();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    metricsService.requestCompleted(res.statusCode, durationMs);

    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      },
      'request_completed',
    );
  });

  next();
}
