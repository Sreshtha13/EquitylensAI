import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/index.js';

describe('GET /api/v1/health', () => {
  beforeAll(() => {
    loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'info',
    });
  });

  it('returns a successful health payload and request id', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'equitylensai-api',
      },
    });
    expect(typeof response.body.data.timestamp).toBe('string');
  });

  it('echoes a caller-supplied request id', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', 'test-request-id');

    expect(response.headers['x-request-id']).toBe('test-request-id');
  });

  it('returns readiness status from GET /api/v1/health/ready', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/health/ready');

    expect([200, 503]).toContain(response.status);
    expect(response.body.data).toMatchObject({
      service: 'equitylensai-api',
      checks: expect.objectContaining({
        database: expect.any(Object),
        cache: expect.any(Object),
        memory: expect.any(Object),
      }),
    });
  });

  it('returns sanitized dependencies from GET /api/v1/health/dependencies', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/health/dependencies');

    expect(response.status).toBe(200);
    expect(response.body.data.dependencies).toMatchObject({
      database: expect.objectContaining({ type: expect.any(String) }),
      marketDataPrimary: expect.objectContaining({ type: expect.any(String) }),
      marketDataFallback: expect.objectContaining({ type: expect.any(String) }),
      geminiAi: expect.objectContaining({ type: expect.any(String) }),
    });
    // Ensure no secrets leaked
    const jsonStr = JSON.stringify(response.body);
    expect(jsonStr).not.toContain('eyJ');
    expect(jsonStr).not.toContain('secret');
  });

  it('returns operational telemetry from GET /api/v1/metrics', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/metrics');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      service: 'equitylensai-api',
      uptimeSeconds: expect.any(Number),
      http: expect.objectContaining({
        totalRequests: expect.any(Number),
        statusCodes: expect.any(Object),
      }),
      cache: expect.objectContaining({
        hits: expect.any(Number),
        misses: expect.any(Number),
      }),
    });
  });
});
