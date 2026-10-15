import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/index.js';

describe('Scalar API Documentation & OpenAPI Endpoints', () => {
  beforeAll(() => {
    loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'info',
    });
  });

  it('serves interactive Scalar documentation HTML at /docs', async () => {
    const app = createApp();
    const response = await request(app).get('/docs');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('Scalar API Reference');
    expect(response.text).toContain('createApiReference');
    expect(response.text).toContain('deepSpace');
  });

  it('serves interactive Scalar documentation at /api/v1/docs and /reference', async () => {
    const app = createApp();
    const v1Response = await request(app).get('/api/v1/docs');
    const referenceResponse = await request(app).get('/reference');

    expect(v1Response.status).toBe(200);
    expect(v1Response.headers['content-type']).toMatch(/text\/html/);
    expect(referenceResponse.status).toBe(200);
    expect(referenceResponse.headers['content-type']).toMatch(/text\/html/);
  });

  it('serves OpenAPI 3.1 JSON specification at /openapi.json and /api/v1/openapi.json', async () => {
    const app = createApp();
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.info.title).toBe('EquityLensAI API');
    expect(response.body.paths).toHaveProperty('/api/v1/health');
    expect(response.body.paths).toHaveProperty('/api/v1/stocks/search');
    expect(response.body.paths).toHaveProperty('/api/v1/stocks/{ticker}');
    expect(response.body.paths).toHaveProperty('/api/v1/ai/research');
    expect(response.body.paths).toHaveProperty('/api/v1/market');
    expect(response.body.paths).toHaveProperty('/api/v1/watchlists');
    expect(response.body.components.schemas).toHaveProperty('AssetType');
    expect(response.body.components.schemas).toHaveProperty('Market');
    expect(response.body.components.schemas).toHaveProperty('HealthResponse');

    const v1Response = await request(app).get('/api/v1/openapi.json');
    expect(v1Response.status).toBe(200);
    expect(v1Response.body.openapi).toBe('3.1.0');
  });

  it('includes documentation and openapi links in root discovery /', async () => {
    const app = createApp();
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'equitylensai-api',
        health: '/api/v1/health',
        docs: '/docs',
        openapi: '/openapi.json',
      },
    });
  });

  it('includes documentation and openapi links in /api/v1 index', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'equitylensai-api',
        endpoints: {
          health: '/api/v1/health',
          docs: '/docs',
          openapi: '/api/v1/openapi.json',
        },
      },
    });
  });
});
