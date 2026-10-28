import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string | undefined;
  message?: string | undefined;
  statusCode?: number | undefined;
  skip?: ((req: Request) => boolean) | undefined;
};

export class MemoryRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly keyPrefix: string;
  private readonly message: string;
  private readonly statusCode: number;
  private readonly skip?: ((req: Request) => boolean) | undefined;
  private readonly maxStoreSize = 20_000;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.keyPrefix = options.keyPrefix ?? 'rl';
    this.message = options.message ?? 'Too many requests. Please retry later.';
    this.statusCode = options.statusCode ?? 429;
    if (options.skip) {
      this.skip = options.skip;
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (this.skip && this.skip(req)) {
        return next();
      }

      const now = Date.now();
      const identifier = req.user?.id ? `usr:${req.user.id}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
      const key = `${this.keyPrefix}:${identifier}`;

      let entry = this.store.get(key);

      if (!entry || now >= entry.resetAt) {
        entry = {
          count: 0,
          resetAt: now + this.windowMs,
        };
        this.store.set(key, entry);
      }

      entry.count += 1;
      const remaining = Math.max(0, this.max - entry.count);
      const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

      res.setHeader('RateLimit-Limit', String(this.max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetSeconds));

      if (entry.count > this.max) {
        res.setHeader('Retry-After', String(resetSeconds));
        return next(
          new AppError('RATE_LIMIT_EXCEEDED', this.message, this.statusCode, {
            retryable: true,
            details: {
              limit: this.max,
              windowSeconds: Math.ceil(this.windowMs / 1000),
              retryAfterSeconds: resetSeconds,
            },
          }),
        );
      }

      // Maintain store size bounds to prevent memory exhaustion
      if (this.store.size > this.maxStoreSize) {
        this.cleanup(now);
      }

      next();
    };
  }

  reset(): void {
    this.store.clear();
  }

  private cleanup(now: number): void {
    for (const [k, v] of this.store.entries()) {
      if (now >= v.resetAt) {
        this.store.delete(k);
      }
    }
  }
}

// ─── Standard Application Rate Limiters ───

/** General API rate limiter: 300 requests per minute per IP / authenticated user */
export const generalApiLimiter = new MemoryRateLimiter({
  windowMs: 60_000,
  max: 300,
  keyPrefix: 'gen',
  skip: (req) => {
    const path = req.path || '';
    return (
      path === '/health' ||
      path.startsWith('/health') ||
      path === '/metrics' ||
      path === '/docs' ||
      path.startsWith('/docs') ||
      path.includes('openapi.json')
    );
  },
});

/** Auth endpoint throttling: 30 requests per minute for login/register/password-reset */
export const authEndpointLimiter = new MemoryRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again after 1 minute.',
});
