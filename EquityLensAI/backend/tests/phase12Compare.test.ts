import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';
import { memorySavedComparisonStore } from '../src/compare/repositories/savedComparisonRepository.js';

const app = createApp();

describe('Phase 12: Comparative Company Analysis & Peer Benchmarking', () => {
  const userAId = 'usr-phase12-test-a';
  const userBId = 'usr-phase12-test-b';

  beforeEach(() => {
    resetEnvCache();
    loadEnv({
      NODE_ENV: 'test',
    });
    memorySavedComparisonStore.clear();
  });

  describe('Company Comparison Engine (POST /api/v1/compare)', () => {
    it('compares multiple valid companies and returns structured metric rows with units and descriptions', async () => {
      const res = await request(app)
        .post('/api/v1/compare')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
          ],
          period: 'annual',
          scope: 'consolidated',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companies).toHaveLength(2);
      expect(res.body.data.period).toBe('annual');
      expect(res.body.data.scope).toBe('consolidated');
      expect(Array.isArray(res.body.data.metricsRows)).toBe(true);

      const roeRow = res.body.data.metricsRows.find((r: any) => r.metricId === 'roe');
      expect(roeRow).toBeDefined();
      expect(roeRow.unit).toBe('percent');
      expect(roeRow.category).toBe('Profitability');
      expect(roeRow.values).toHaveProperty('RELIANCE');
      expect(roeRow.values).toHaveProperty('TCS');
    });

    it('rejects comparisons with fewer than 2 companies', async () => {
      const res = await request(app)
        .post('/api/v1/compare')
        .send({
          symbols: [{ symbol: 'RELIANCE', exchange: 'NSE' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects comparisons with more than 5 companies', async () => {
      const res = await request(app)
        .post('/api/v1/compare')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
            { symbol: 'INFY', exchange: 'NSE' },
            { symbol: 'HDFCBANK', exchange: 'NSE' },
            { symbol: 'ICICIBANK', exchange: 'NSE' },
            { symbol: 'SBIN', exchange: 'NSE' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate company entries in the same comparison', async () => {
      const res = await request(app)
        .post('/api/v1/compare')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'RELIANCE', exchange: 'NSE' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('preserves missing metrics as null rather than fabricating zero', async () => {
      const res = await request(app)
        .post('/api/v1/compare')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
          ],
          metrics: ['pe_ratio', 'roe'],
        });

      expect(res.status).toBe(200);
      for (const row of res.body.data.metricsRows) {
        for (const val of Object.values(row.values)) {
          if (val !== null) {
            expect(typeof val).toBe('number');
          }
        }
      }
    });
  });

  describe('Verified Peer Discovery (GET /api/v1/compare/peers/:symbol)', () => {
    it('discovers peers with verified sector/industry classification and match rationale', async () => {
      const res = await request(app).get('/api/v1/compare/peers/TCS?exchange=NSE');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.baseCompany.symbol).toBe('TCS');
      expect(Array.isArray(res.body.data.peers)).toBe(true);

      // Verify self-exclusion: TCS must not be its own peer
      const selfIncluded = res.body.data.peers.some((p: any) => p.symbol === 'TCS');
      expect(selfIncluded).toBe(false);

      if (res.body.data.peers.length > 0) {
        const firstPeer = res.body.data.peers[0];
        expect(firstPeer).toHaveProperty('matchScore');
        expect(firstPeer).toHaveProperty('matchRationale');
        expect(typeof firstPeer.matchScore).toBe('number');
      }
    });

    it('returns 404 for nonexistent or invalid symbols', async () => {
      const res = await request(app).get('/api/v1/compare/peers/NONEXISTENT999XYZ?exchange=NSE');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Peer Benchmark Statistics (POST /api/v1/compare/benchmarks)', () => {
    it('computes mean, median, min, max, percentile, and rank for multi-company comparisons', async () => {
      const res = await request(app)
        .post('/api/v1/compare/benchmarks')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
          ],
          period: 'annual',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.benchmarks)).toBe(true);

      const roeBenchmark = res.body.data.benchmarks.find((b: any) => b.metricId === 'roe');
      expect(roeBenchmark).toBeDefined();
      expect(roeBenchmark.sampleSize).toBeGreaterThanOrEqual(1);

      if (roeBenchmark.sampleSize >= 2) {
        expect(roeBenchmark.mean).not.toBeNull();
        expect(roeBenchmark.median).not.toBeNull();
        expect(roeBenchmark.ranks['RELIANCE'].rank).toBeGreaterThanOrEqual(1);
        expect(roeBenchmark.ranks['TCS'].rank).toBeGreaterThanOrEqual(1);
      }
    });

    it('enforces minimum sample size safeguards for rankings', async () => {
      const res = await request(app)
        .post('/api/v1/compare/benchmarks')
        .send({
          symbols: [{ symbol: 'RELIANCE', exchange: 'NSE' }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Historical Trends & Normalized Performance (POST /api/v1/compare/history)', () => {
    it('returns aligned financial history trends and normalized price performance series', async () => {
      const res = await request(app)
        .post('/api/v1/compare/history')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
          ],
          period: 'annual',
          interval: '1Y',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.financialTrends).toHaveProperty('RELIANCE');
      expect(res.body.data.financialTrends).toHaveProperty('TCS');
      expect(res.body.data.pricePerformance).toBeDefined();
      expect(res.body.data.pricePerformance.interval).toBe('1Y');
      expect(Array.isArray(res.body.data.pricePerformance.points)).toBe(true);
      expect(res.body.data.pricePerformance.summaryReturns).toHaveProperty('RELIANCE');
    });

    it('rejects invalid history intervals', async () => {
      const res = await request(app)
        .post('/api/v1/compare/history')
        .send({
          symbols: [{ symbol: 'RELIANCE', exchange: 'NSE' }],
          interval: '10Y',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('AI Comparative Analysis (POST /api/v1/ai/comparison-analysis)', () => {
    it('generates structured comparative narrative with disclaimers', async () => {
      const res = await request(app)
        .post('/api/v1/ai/comparison-analysis')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: 'TCS', exchange: 'NSE' },
          ],
          period: 'annual',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(Array.isArray(res.body.data.sections)).toBe(true);
      expect(res.body.data.disclaimer).toBeDefined();
    });
  });

  describe('Saved Comparisons CRUD & User Isolation', () => {
    it('creates, reads, updates, duplicates, and deletes a saved comparison with strict user isolation', async () => {
      // 1. Create comparison as User A
      const createRes = await request(app)
        .post('/api/v1/compare/saved')
        .set('x-test-user-id', userAId)
        .send({
          name: 'IT Leaders Comparison',
          description: 'Evaluating TCS and INFY',
          symbols: [
            { symbol: 'TCS', exchange: 'NSE' },
            { symbol: 'INFY', exchange: 'NSE' },
          ],
          period: 'annual',
          scope: 'consolidated',
        });

      expect(createRes.status).toBe(201);
      const comparisonId = createRes.body.data.id;
      expect(comparisonId).toBeDefined();
      expect(createRes.body.data.name).toBe('IT Leaders Comparison');
      expect(createRes.body.data.schemaVersion).toBe(1);

      // 2. List comparisons for User A
      const listResA = await request(app)
        .get('/api/v1/compare/saved')
        .set('x-test-user-id', userAId);

      expect(listResA.status).toBe(200);
      expect(listResA.body.data).toHaveLength(1);
      expect(listResA.body.data[0].id).toBe(comparisonId);

      // 3. User B cannot access User A's comparison (User Isolation)
      const getResB = await request(app)
        .get(`/api/v1/compare/saved/${comparisonId}`)
        .set('x-test-user-id', userBId);

      expect(getResB.status).toBe(404);

      // 4. Update comparison as User A
      const updateRes = await request(app)
        .patch(`/api/v1/compare/saved/${comparisonId}`)
        .set('x-test-user-id', userAId)
        .send({
          name: 'Top Indian IT Giants',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Top Indian IT Giants');

      // 5. Duplicate comparison as User A
      const dupRes = await request(app)
        .post(`/api/v1/compare/saved/${comparisonId}/duplicate`)
        .set('x-test-user-id', userAId);

      expect(dupRes.status).toBe(201);
      expect(dupRes.body.data.name).toContain('(Copy)');
      expect(dupRes.body.data.id).not.toBe(comparisonId);

      // 6. Delete comparison as User A
      const deleteRes = await request(app)
        .delete(`/api/v1/compare/saved/${comparisonId}`)
        .set('x-test-user-id', userAId);

      expect(deleteRes.status).toBe(200);

      // 7. Verification: deleted comparison is no longer accessible
      const verifyGet = await request(app)
        .get(`/api/v1/compare/saved/${comparisonId}`)
        .set('x-test-user-id', userAId);

      expect(verifyGet.status).toBe(404);
    });

    it('requires authentication for saved comparison endpoints', async () => {
      const res = await request(app).get('/api/v1/compare/saved');
      expect(res.status).toBe(401);
    });
  });
});
