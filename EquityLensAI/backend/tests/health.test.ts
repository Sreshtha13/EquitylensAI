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
});
