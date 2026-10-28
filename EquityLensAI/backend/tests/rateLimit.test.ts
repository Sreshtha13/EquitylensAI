import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestId } from '../src/middleware/requestId.js';

describe('MemoryRateLimiter', () => {
  it('allows requests within limit and attaches rate limit headers', async () => {
    const limiter = new MemoryRateLimiter({
      windowMs: 10_000,
      max: 3,
      keyPrefix: 'test-limiter',
    });

    const app = express();
    app.use(requestId);
    app.use(limiter.middleware());
    app.get('/test', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const r1 = await request(app).get('/test');
    expect(r1.status).toBe(200);
    expect(r1.headers['ratelimit-limit']).toBe('3');
    expect(r1.headers['ratelimit-remaining']).toBe('2');

    const r2 = await request(app).get('/test');
    expect(r2.status).toBe(200);
    expect(r2.headers['ratelimit-remaining']).toBe('1');

    const r3 = await request(app).get('/test');
    expect(r3.status).toBe(200);
    expect(r3.headers['ratelimit-remaining']).toBe('0');

    // 4th request exceeds max
    const r4 = await request(app).get('/test');
    expect(r4.status).toBe(429);
    expect(r4.headers['retry-after']).toBeDefined();
    expect(r4.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r4.body.error.retryable).toBe(true);
  });

  it('skips designated health routes', async () => {
    const limiter = new MemoryRateLimiter({
      windowMs: 10_000,
      max: 1,
      keyPrefix: 'skip-limiter',
      skip: (req) => req.path === '/health',
    });

    const app = express();
    app.use(limiter.middleware());
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    const r1 = await request(app).get('/health');
    const r2 = await request(app).get('/health');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
