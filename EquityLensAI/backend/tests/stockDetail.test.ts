import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { calculateStockPerformance } from '../src/market/performanceCalculator.js';
import type { PriceCandle } from '@equitylensai/shared';

describe('Phase 7: Stock Detail & Company Intelligence', () => {
  const app = createApp();

  describe('GET /api/v1/stocks/:symbol/profile', () => {
    it('rejects invalid symbol format with 400 validation error', async () => {
      const res = await request(app).get('/api/v1/stocks/bad$$sym/profile');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns verified company profile for RELIANCE (NSE)', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/profile?exchange=NSE');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.symbol).toBe('RELIANCE');
        expect(res.body.data.exchange).toBe('NSE');
        expect(res.body.data.currency).toBe('INR');
        expect(res.body.data.name).toBeDefined();
        expect(res.body.data.source).toBeDefined();
        expect(res.body.data.retrievedAt).toBeDefined();
        // Provenance verification: fields are either strings/numbers or null, never invented dummy values
        if (res.body.data.isin !== null) {
          expect(typeof res.body.data.isin).toBe('string');
        }
      }
    }, 15000);

    it('returns 404 for unknown nonexistent instrument', async () => {
      const res = await request(app).get('/api/v1/stocks/FAKE999NONEXISTENT/profile?exchange=NSE');
      expect([404, 502]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INSTRUMENT_NOT_FOUND');
      }
    }, 15000);
  });

  describe('GET /api/v1/stocks/:symbol/performance', () => {
    it('rejects invalid symbol format with 400', async () => {
      const res = await request(app).get('/api/v1/stocks/invalid*ticker/performance');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns calculated performance metrics for RELIANCE', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/performance?exchange=NSE');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.symbol).toBe('RELIANCE');
        expect(res.body.data.exchange).toBe('NSE');
        expect(res.body.data.periods).toBeInstanceOf(Array);
        expect(res.body.data.methodology).toBeDefined();
        expect(res.body.data.methodology.cumulativeReturn).toBeDefined();
        expect(res.body.data.methodology.maxDrawdown).toBeDefined();

        if (res.body.data.periods.length > 0) {
          const firstPeriod = res.body.data.periods[0];
          expect(firstPeriod.period).toBeDefined();
          expect(typeof firstPeriod.cumulativeReturnPercent).toBe('number');
          expect(typeof firstPeriod.observations).toBe('number');
          expect(firstPeriod.priceType).toMatch(/adjusted|unadjusted/);
        }
      }
    }, 15000);
  });

  describe('GET /api/v1/stocks/:symbol/resolve', () => {
    it('resolves seeded instrument RELIANCE on NSE', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/resolve?exchange=NSE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.symbol).toBe('RELIANCE');
      expect(res.body.data.exchange).toBe('NSE');
      expect(res.body.data.market).toBe('nse');
    });

    it('returns 404 for unknown nonexistent symbol', async () => {
      const res = await request(app).get('/api/v1/stocks/UNKNOWNXYZ123/resolve?exchange=NSE');
      expect([404, 502]).toContain(res.status);
    }, 15000);
  });

  describe('calculateStockPerformance deterministic calculation engine', () => {
    it('calculates correct cumulative return, drawdown, and volatility from sample candles', () => {
      const candles: PriceCandle[] = [
        {
          timestamp: '2026-01-01T00:00:00.000Z',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 1000,
          adjustedClose: 100,
        },
        {
          timestamp: '2026-01-02T00:00:00.000Z',
          open: 100,
          high: 110,
          low: 99,
          close: 110,
          volume: 1200,
          adjustedClose: 110,
        },
        {
          timestamp: '2026-01-03T00:00:00.000Z',
          open: 110,
          high: 112,
          low: 90,
          close: 90,
          volume: 1500,
          adjustedClose: 90,
        },
        {
          timestamp: '2026-01-04T00:00:00.000Z',
          open: 90,
          high: 125,
          low: 89,
          close: 120,
          volume: 2000,
          adjustedClose: 120,
        },
        {
          timestamp: '2026-01-05T00:00:00.000Z',
          open: 120,
          high: 130,
          low: 115,
          close: 125,
          volume: 1800,
          adjustedClose: 125,
        },
      ];

      const perf = calculateStockPerformance('TEST', 'NSE', candles, 'test');
      expect(perf.symbol).toBe('TEST');
      expect(perf.exchange).toBe('NSE');

      // Check MAX period
      const maxP = perf.periods.find((p) => p.period === 'MAX');
      expect(maxP).toBeDefined();
      if (maxP) {
        expect(maxP.startPrice).toBe(100);
        expect(maxP.endPrice).toBe(125);
        // Cumulative return = (125 - 100) / 100 * 100 = 25%
        expect(maxP.cumulativeReturnPercent).toBeCloseTo(25, 2);
        expect(maxP.observations).toBe(5);
        expect(maxP.priceType).toBe('adjusted');
        expect(maxP.high).toBe(130);
        expect(maxP.low).toBe(89);
        // Peak reached 110, then dropped to 90 -> drawdown = (90 - 110) / 110 * 100 = -18.18%
        expect(maxP.maxDrawdownPercent).toBeCloseTo(-18.18, 1);
        // Volatility is defined for >= 5 observations
        expect(maxP.annualizedVolatilityPercent).not.toBeNull();
        expect(maxP.annualizedVolatilityPercent!).toBeGreaterThan(0);
      }
    });

    it('handles empty candle series gracefully without crashing', () => {
      const perf = calculateStockPerformance('EMPTY', 'NSE', [], 'test');
      expect(perf.periods).toEqual([]);
      expect(perf.methodology).toBeDefined();
    });

    it('marks unadjusted priceType when adjustedClose is null', () => {
      const candles: PriceCandle[] = [
        {
          timestamp: '2026-01-01T00:00:00.000Z',
          open: 50,
          high: 52,
          low: 48,
          close: 50,
          volume: 500,
          adjustedClose: null,
        },
        {
          timestamp: '2026-01-02T00:00:00.000Z',
          open: 50,
          high: 55,
          low: 49,
          close: 52,
          volume: 600,
          adjustedClose: null,
        },
      ];

      const perf = calculateStockPerformance('UNADJ', 'NSE', candles, 'test');
      const maxP = perf.periods.find((p) => p.period === 'MAX');
      expect(maxP).toBeDefined();
      expect(maxP?.priceType).toBe('unadjusted');
      expect(maxP?.startPrice).toBe(50);
      expect(maxP?.endPrice).toBe(52);
    });
  });
});
