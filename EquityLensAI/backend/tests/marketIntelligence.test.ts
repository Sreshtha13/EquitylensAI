import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Market Intelligence Dashboard API Endpoints', () => {
  const app = createApp();

  describe('GET /api/v1/markets/indices', () => {
    it('returns market indices including NIFTY 50 and SENSEX with market status', async () => {
      const res = await request(app).get('/api/v1/markets/indices');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.indices).toBeInstanceOf(Array);
      expect(res.body.data.indices.length).toBeGreaterThan(0);

      const nifty = res.body.data.indices.find(
        (idx: { symbol: string; name: string }) => idx.symbol === 'NIFTY' || idx.name === 'NIFTY 50',
      );
      expect(nifty).toBeDefined();
      expect(nifty.exchange).toBe('NSE');
      expect(typeof (nifty.currentValue ?? nifty.value)).toBe('number');
      expect(typeof nifty.change).toBe('number');
      expect(typeof (nifty.changePercent ?? nifty.percentChange)).toBe('number');
      expect(['OPEN', 'CLOSED', 'PRE_MARKET', 'POST_MARKET']).toContain(nifty.marketStatus);
    });

    it('works under /api/v1/market/indices alias', async () => {
      const res = await request(app).get('/api/v1/market/indices');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.indices.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/markets/breadth', () => {
    it('returns advance/decline ratio, circuit counts, and coverage disclaimer', async () => {
      const res = await request(app).get('/api/v1/markets/breadth');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(typeof data.advances).toBe('number');
      expect(typeof data.declines).toBe('number');
      expect(typeof data.unchanged).toBe('number');
      expect(typeof data.new52WeekHighs).toBe('number');
      expect(typeof data.new52WeekLows).toBe('number');
      expect(typeof data.upperCircuits).toBe('number');
      expect(typeof data.lowerCircuits).toBe('number');
      expect(typeof data.coverageDisclaimed).toBe('boolean');
      expect(typeof data.coveragePercent).toBe('number');
      expect(data.coverageSummary).toBeDefined();
    });
  });

  describe('GET /api/v1/markets/movers/gainers and losers', () => {
    it('returns top gainers ordered descending by percentChange', async () => {
      const res = await request(app).get('/api/v1/markets/movers/gainers?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
      expect(res.body.data.type).toBe('gainers');

      if (res.body.data.items.length > 1) {
        const first = res.body.data.items[0];
        const second = res.body.data.items[1];
        expect(first.percentChange).toBeGreaterThanOrEqual(second.percentChange);
      }
    });

    it('returns top losers ordered ascending by percentChange', async () => {
      const res = await request(app).get('/api/v1/markets/movers/losers?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
      expect(res.body.data.type).toBe('losers');

      if (res.body.data.items.length > 1) {
        const first = res.body.data.items[0];
        const second = res.body.data.items[1];
        expect(first.percentChange).toBeLessThanOrEqual(second.percentChange);
      }
    });

    it('supports exchange filtering for BSE or NSE', async () => {
      const res = await request(app).get('/api/v1/markets/movers/gainers?exchange=NSE&limit=10');
      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.exchange).toBe('NSE');
      }
    });
  });

  describe('GET /api/v1/markets/movers/volume-shockers', () => {
    it('calculates volume ratio comparing current volume to historical average', async () => {
      const res = await request(app).get('/api/v1/markets/movers/volume-shockers?days=10&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.days).toBe(10);

      for (const item of res.body.data.items) {
        expect(item.currentVolume).toBeGreaterThan(0);
        expect(item.historicalAvgVolume).toBeGreaterThan(0);
        expect(item.volumeRatio).toBeGreaterThan(0);
        expect(typeof item.turnover).toBe('number');
      }
    });
  });

  describe('GET /api/v1/markets/most-active', () => {
    it('returns most active stocks by volume', async () => {
      const res = await request(app).get('/api/v1/markets/most-active?by=volume&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.by).toBe('volume');
      expect(res.body.data.items).toBeInstanceOf(Array);

      if (res.body.data.items.length > 1) {
        expect(res.body.data.items[0].volume).toBeGreaterThanOrEqual(res.body.data.items[1].volume);
      }
    });

    it('returns most active stocks by turnover', async () => {
      const res = await request(app).get('/api/v1/markets/most-active?by=turnover&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.by).toBe('turnover');
      expect(res.body.data.items).toBeInstanceOf(Array);

      if (res.body.data.items.length > 1) {
        expect(res.body.data.items[0].turnover).toBeGreaterThanOrEqual(res.body.data.items[1].turnover);
      }
    });
  });

  describe('GET /api/v1/markets/most-watched', () => {
    it('returns most watched stocks with transparent windowDays', async () => {
      const res = await request(app).get('/api/v1/markets/most-watched?windowDays=7&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.windowDays).toBe(7);

      for (const item of res.body.data.items) {
        expect(typeof item.uniqueWatchersCount).toBe('number');
        expect(item.uniqueWatchersCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /api/v1/markets/trending', () => {
    it('returns trending stocks with transparent score and reasoning', async () => {
      const res = await request(app).get('/api/v1/markets/trending?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);

      for (const item of res.body.data.items) {
        expect(typeof item.trendingScore).toBe('number');
        expect(Array.isArray(item.reasons)).toBe(true);
        expect(item.reasons.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GET /api/v1/markets/sectors', () => {
    it('returns sector performance aggregations with advance/decline metrics', async () => {
      const res = await request(app).get('/api/v1/markets/sectors');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sectors).toBeInstanceOf(Array);
      expect(res.body.data.sectors.length).toBeGreaterThan(0);

      const banking = res.body.data.sectors.find((s: { sector: string }) => s.sector === 'Banking');
      expect(banking).toBeDefined();
      expect(typeof banking.averageChangePercent).toBe('number');
      expect(typeof banking.advances).toBe('number');
      expect(typeof banking.declines).toBe('number');
    });
  });

  describe('GET /api/v1/markets/highs-lows, circuits, new-listings', () => {
    it('returns 52w highs and lows', async () => {
      const res = await request(app).get('/api/v1/markets/highs-lows?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.highs).toBeInstanceOf(Array);
      expect(res.body.data.lows).toBeInstanceOf(Array);
    });

    it('returns circuit limit stocks', async () => {
      const res = await request(app).get('/api/v1/markets/circuits?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('returns newly listed stocks', async () => {
      const res = await request(app).get('/api/v1/markets/new-listings?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });
  });
});
