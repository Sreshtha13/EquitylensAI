import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('POST /api/v1/screener/run Integration Tests', () => {
  const app = createApp();

  it('handles empty filters gracefully (open universe browsing)', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        exchange: 'NSE',
        filters: [],
        limit: 10,
        offset: 0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toBeInstanceOf(Array);
    expect(res.body.data.totalMatches).toBeGreaterThan(0);
    expect(res.body.data.results.length).toBeLessThanOrEqual(10);
    expect(res.body.data.pagination).toEqual({
      offset: 0,
      limit: 10,
      total: expect.any(Number),
    });
  });

  it('supports exchange selection: NSE, BSE, BOTH, and null', async () => {
    const resNSE = await request(app)
      .post('/api/v1/screener/run')
      .send({ exchange: 'NSE', limit: 5 });
    expect(resNSE.status).toBe(200);
    expect(resNSE.body.data.exchange).toBe('NSE');
    for (const r of resNSE.body.data.results) {
      expect(r.exchange).toBe('NSE');
    }

    const resBSE = await request(app)
      .post('/api/v1/screener/run')
      .send({ exchange: 'BSE', limit: 5 });
    expect(resBSE.status).toBe(200);
    expect(resBSE.body.data.exchange).toBe('BSE');
    for (const r of resBSE.body.data.results) {
      expect(r.exchange).toBe('BSE');
    }

    const resBoth = await request(app)
      .post('/api/v1/screener/run')
      .send({ exchange: 'BOTH', limit: 5 });
    expect(resBoth.status).toBe(200);
    expect(resBoth.body.data.exchange).toBeNull();
  });

  it('executes a single numeric filter (e.g. stock_price gt 100)', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'stock_price', operator: 'gt', value: 100 }],
        limit: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toBeInstanceOf(Array);
  });

  it('executes multiple filters with AND and OR logic', async () => {
    const andRes = await request(app)
      .post('/api/v1/screener/run')
      .send({
        logic: 'AND',
        filters: [
          { field: 'stock_price', operator: 'gt', value: 50 },
          { field: 'pe_ratio', operator: 'lt', value: 100 },
        ],
        limit: 10,
      });
    expect(andRes.status).toBe(200);

    const orRes = await request(app)
      .post('/api/v1/screener/run')
      .send({
        logic: 'OR',
        filters: [
          { field: 'stock_price', operator: 'gt', value: 2000 },
          { field: 'volume', operator: 'gt', value: 10000 },
        ],
        limit: 10,
      });
    expect(orRes.status).toBe(200);
  });

  it('supports between comparison operator', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'pe_ratio', operator: 'between', value: 10, upperValue: 50 }],
        limit: 5,
      });
    expect(res.status).toBe(200);
  });

  it('supports security classification, sector, and industry filtering', async () => {
    const sectorRes = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'sector', operator: 'contains', value: 'Technology' }],
        limit: 5,
      });
    expect(sectorRes.status).toBe(200);

    const classRes = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'classification', operator: 'eq', value: 'MAIN' }],
        limit: 5,
      });
    expect(classRes.status).toBe(200);
  });

  it('supports frontend contract payload containing schemaVersion and selectedColumns', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        schemaVersion: 1,
        exchange: 'NSE',
        period: 'annual',
        rootGroup: {
          logic: 'AND',
          conditions: [{ field: 'roe', operator: 'gt', value: 10 }],
        },
        selectedColumns: ['symbol', 'companyName', 'roe', 'market_cap'],
        sort: { field: 'symbol', direction: 'asc' },
        limit: 15,
        offset: 0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toBeInstanceOf(Array);
  });

  it('returns structured validation error on invalid metric', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'non_existent_fake_metric', operator: 'gt', value: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid screener request');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.some((d: { field: string }) => d.field.includes('filters'))).toBe(true);
  });

  it('returns structured validation error on invalid operator', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'roe', operator: 'invalid_op', value: 15 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid screener request');
    expect(res.body.error.details).toBeInstanceOf(Array);
  });

  it('returns structured validation error on invalid data type', async () => {
    const res = await request(app)
      .post('/api/v1/screener/run')
      .send({
        filters: [{ field: 'roe', operator: 'gt', value: 'not-a-number' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
  });

  it('supports deterministic pagination and sorting', async () => {
    const page1 = await request(app)
      .post('/api/v1/screener/run')
      .send({
        exchange: 'NSE',
        sort: { field: 'symbol', direction: 'asc' },
        limit: 5,
        offset: 0,
      });

    const page2 = await request(app)
      .post('/api/v1/screener/run')
      .send({
        exchange: 'NSE',
        sort: { field: 'symbol', direction: 'asc' },
        limit: 5,
        offset: 5,
      });

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.data.results.length).toBe(5);
    expect(page2.body.data.results.length).toBe(5);

    const symbolsPage1 = page1.body.data.results.map((r: { symbol: string }) => r.symbol);
    const symbolsPage2 = page2.body.data.results.map((r: { symbol: string }) => r.symbol);

    // No overlap between consecutive pages
    for (const s of symbolsPage1) {
      expect(symbolsPage2).not.toContain(s);
    }
  });
});
