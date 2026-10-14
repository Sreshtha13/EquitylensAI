import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Market & Stocks API Routes', () => {
  const app = createApp();

  describe('GET /api/v1/stocks/search', () => {
    it('returns 400 when search query q is missing', async () => {
      const res = await request(app).get('/api/v1/stocks/search');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns matched instruments for valid query', async () => {
      const res = await request(app).get('/api/v1/stocks/search?q=RELIANCE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].symbol).toBe('RELIANCE');
      expect(res.body.data.items[0].exchange).toBe('NSE');
    });

    it('filters by market', async () => {
      const res = await request(app).get('/api/v1/stocks/search?q=AAPL&market=us');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].market).toBe('us');
    });
  });

  describe('GET /api/v1/stocks/:symbol/quote', () => {
    it('returns 400 for invalid symbol format', async () => {
      const res = await request(app).get('/api/v1/stocks/bad$$symbol/quote');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns quote with valid provenance for RELIANCE', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/quote');
      // Could be 200 (if network/Angel/Yahoo succeeds)
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.symbol).toBe('RELIANCE');
        expect(res.body.data.source).toMatch(/angel|yahoo/);
        expect(res.body.data.freshness).toMatch(/live|delayed|stale/);
        expect(typeof res.body.data.isStale).toBe('boolean');
        expect(res.body.data.retrievedAt).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/stocks/ingest/status', () => {
    it('returns ingestion status and total instrument count', async () => {
      const res = await request(app).get('/api/v1/stocks/ingest/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.isIngesting).toBe('boolean');
      expect(res.body.data.totalInstruments).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/market/overview', () => {
    it('returns market overview for NSE', async () => {
      const res = await request(app).get('/api/v1/market/overview?market=nse');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.market).toBe('nse');
      expect(res.body.data.indices).toBeInstanceOf(Array);
      expect(res.body.data.source).toBeDefined();
      expect(res.body.data.freshness).toMatch(/live|delayed/);
    });
  });

  describe('GET /api/v1/market/providers', () => {
    it('returns list of configured providers and status', async () => {
      const res = await request(app).get('/api/v1/market/providers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providers).toBeInstanceOf(Array);
      expect(res.body.data.providers.length).toBe(2);

      const ids = res.body.data.providers.map((p: { id: string }) => p.id);
      expect(ids).toContain('angel');
      expect(ids).toContain('yahoo');
    });
  });
});
