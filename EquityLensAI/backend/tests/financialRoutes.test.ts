import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Financial Intelligence API Routes', () => {
  const app = createApp();

  describe('GET /api/v1/financial/cache-stats', () => {
    it('returns cache statistics with hits, misses, and size', async () => {
      const res = await request(app).get('/api/v1/financial/cache-stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('hits');
      expect(res.body.data).toHaveProperty('misses');
      expect(res.body.data).toHaveProperty('size');
    });
  });

  describe('GET /api/v1/financial/:symbol/analysis', () => {
    it('returns 400 for invalid symbol parameter', async () => {
      const res = await request(app).get('/api/v1/financial/invalid$$symbol/analysis');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 or 502 with structured financial analysis for AAPL', async () => {
      const res = await request(app).get('/api/v1/financial/AAPL/analysis');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.symbol).toBe('AAPL');
        expect(res.body.data).toHaveProperty('profitability');
        expect(res.body.data).toHaveProperty('liquidity');
        expect(res.body.data).toHaveProperty('leverage');
        expect(res.body.data).toHaveProperty('cashFlow');
        expect(res.body.data).toHaveProperty('growth');
        expect(res.body.data).toHaveProperty('valuation');
        expect(res.body.data).toHaveProperty('healthScore');
        expect(res.body.data.healthScore).toHaveProperty('overallScore');
        expect(res.body.data.healthScore).toHaveProperty('grade');
        expect(res.body.data.annualHistory).toBeInstanceOf(Array);
        expect(res.body.data.quarterlyHistory).toBeInstanceOf(Array);
        expect(
          res.body.data.quarterlyHistory.every(
            (period: { periodType: string }) => period.periodType === 'quarterly',
          ),
        ).toBe(true);
      }
    });
  });

  describe('GET /api/v1/financial/:symbol/statements', () => {
    it('returns 400 for invalid symbol', async () => {
      const res = await request(app).get('/api/v1/financial/bad*sym/statements');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns statements for AAPL', async () => {
      const res = await request(app).get('/api/v1/financial/AAPL/statements');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('incomeStatements');
        expect(res.body.data).toHaveProperty('balanceSheets');
        expect(res.body.data).toHaveProperty('cashFlowStatements');
        expect(res.body.data.quarterlyIncomeStatements).toBeInstanceOf(Array);
        expect(res.body.data.quarterlyBalanceSheets).toBeInstanceOf(Array);
        expect(res.body.data.quarterlyCashFlowStatements).toBeInstanceOf(Array);
      }
    });
  });

  describe('GET /api/v1/financial/:symbol/health-score', () => {
    it('returns 400 for invalid symbol', async () => {
      const res = await request(app).get('/api/v1/financial/bad$$symbol/health-score');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns health score for AAPL', async () => {
      const res = await request(app).get('/api/v1/financial/AAPL/health-score');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('overallScore');
        expect(res.body.data).toHaveProperty('grade');
        expect(res.body.data).toHaveProperty('dimensions');
      }
    });
  });
});
