import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../config/index.js';
import { AppError } from '../utils/appError.js';

type RateRecord = {
  startedAt: number;
  count: number;
};

const WINDOW_MS = 60_000;
const MAX_CLIENTS = 10_000;
const clients = new Map<string, RateRecord>();

export function resetAiRateLimitForTests(): void {
  clients.clear();
}

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const limit = getEnv().AI_RESEARCH_RATE_LIMIT;
  let record = clients.get(key);

  if (!record || now - record.startedAt >= WINDOW_MS) {
    record = { startedAt: now, count: 0 };
    clients.set(key, record);
  }

  if (record.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - record.startedAt)) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    next(
      new AppError(
        'AI_RATE_LIMITED',
        'AI research request limit reached. Please retry later.',
        429,
      ),
    );
    return;
  }

  record.count += 1;
  clients.set(key, record);

  if (clients.size > MAX_CLIENTS) {
    for (const [clientKey, clientRecord] of clients) {
      if (now - clientRecord.startedAt >= WINDOW_MS) {
        clients.delete(clientKey);
      }
    }
    if (clients.size > MAX_CLIENTS) {
      const oldestKey = clients.keys().next().value;
      if (oldestKey) {
        clients.delete(oldestKey);
      }
    }
  }

  next();
}
