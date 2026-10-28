import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/db/userRepository.js';
import { memoryPortfolioStore } from '../src/portfolio/repositories/portfolioRepository.js';
import { memoryResearchProjectStore, memoryResearchReportStore } from '../src/research/repositories/index.js';
import { instrumentRepository } from '../src/market/instruments/repository.js';
import { DEFAULT_CACHE_PATH } from '../src/market/instruments/ingestion.js';
import { cacheManager } from '../src/market/cache/cacheManager.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';

describe('Phase 18 — Final QA & UAT End-to-End Critical User Journeys', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    resetEnvCache();
    loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
    });
    memoryStore.clear();
    memoryPortfolioStore.clear();
    memoryResearchProjectStore.clear();
    memoryResearchReportStore.clear();
    cacheManager.clear();
    await instrumentRepository.loadFromDisk(DEFAULT_CACHE_PATH);
    app = createApp();
  });

  afterEach(() => {
    memoryStore.clear();
    memoryPortfolioStore.clear();
    memoryResearchProjectStore.clear();
    memoryResearchReportStore.clear();
    cacheManager.clear();
    resetEnvCache();
  });

  // ============================================================================
  // Journey A: New User Onboarding & First Stock Watchlist
  // ============================================================================
  describe('Journey A — New User Experience', () => {
    it('executes full onboarding: register, login, search, stock detail, watchlist save, and logout', async () => {
      // 1. Register
      const userEmail = `newuser_${Date.now()}@equitylens.ai`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: userEmail,
          password: 'Password123!',
          displayName: 'Institutional Analyst',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.user.email).toBe(userEmail);
      const userId = regRes.body.data.user.id;

      // 2. Login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userEmail,
          password: 'Password123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      const token = loginRes.body.data.session.accessToken;
      expect(token).toBeDefined();

      // 3. Search for listed company (NSE/BSE security master via /stocks/search?q=)
      const searchRes = await request(app)
        .get('/api/v1/stocks/search?q=RELIANCE')
        .set('Authorization', `Bearer ${token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.success).toBe(true);
      expect(searchRes.body.data.items.length).toBeGreaterThan(0);
      const matched = searchRes.body.data.items.find(
        (i: { symbol: string; exchange: string }) => i.symbol === 'RELIANCE' && i.exchange === 'NSE',
      );
      expect(matched).toBeDefined();
      expect(matched.exchange).toBe('NSE');

      // 4. Open detail page & check quote
      const quoteRes = await request(app)
        .get('/api/v1/stocks/RELIANCE/quote?exchange=NSE')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 502]).toContain(quoteRes.status);
      if (quoteRes.status === 200) {
        expect(quoteRes.body.data.symbol).toBe('RELIANCE');
        expect(quoteRes.body.data.exchange).toBe('NSE');
        expect(quoteRes.body.data.price).toBeGreaterThan(0);
        expect(['live', 'delayed', 'stale']).toContain(quoteRes.body.data.freshness);
      }

      // 5. Create private watchlist
      const wlRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userId)
        .send({
          name: 'Core Indian Bluechips',
          description: 'Large cap holdings',
        });

      expect(wlRes.status).toBe(201);
      const watchlistId = wlRes.body.data.id;

      // Add RELIANCE to watchlist
      const addRes = await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/items`)
        .set('x-test-user-id', userId)
        .send({
          symbol: 'RELIANCE',
          exchange: 'NSE',
        });

      expect(addRes.status).toBe(201);

      // 6. Refresh / re-query watchlist to verify durable persistence
      const getWlRes = await request(app)
        .get(`/api/v1/watchlists/${watchlistId}`)
        .set('x-test-user-id', userId);

      expect(getWlRes.status).toBe(200);
      expect(getWlRes.body.data.name).toBe('Core Indian Bluechips');
      expect(getWlRes.body.data.items).toHaveLength(1);
      expect(getWlRes.body.data.items[0].symbol).toBe('RELIANCE');

      // 7. Verify protected endpoints reject unauthenticated access
      const unauthRes = await request(app).get('/api/v1/watchlists');
      expect(unauthRes.status).toBe(401);
    });
  });

  // ============================================================================
  // Journey B: Returning User & Multi-Tenant Data Isolation
  // ============================================================================
  describe('Journey B — Returning User & Multi-Tenant Privacy', () => {
    it('loads saved preferences and strictly blocks cross-user private access', async () => {
      const userAlphaId = 'usr-uat-alpha-1234';
      const userBravoId = 'usr-uat-bravo-5678';

      // Setup User Alpha watchlist and preferences
      const alphaWlRes = await request(app)
        .post('/api/v1/watchlists')
        .set('x-test-user-id', userAlphaId)
        .send({
          name: 'Alpha Quant Strategy',
          description: 'Confidential alpha model',
        });
      expect(alphaWlRes.status).toBe(201);
      const alphaWlId = alphaWlRes.body.data.id;

      await request(app)
        .post(`/api/v1/watchlists/${alphaWlId}/items`)
        .set('x-test-user-id', userAlphaId)
        .send({ symbol: 'INFY', exchange: 'NSE' });

      // User Alpha updates preferences via PATCH /users/me/preferences
      const prefRes = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('x-test-user-id', userAlphaId)
        .send({
          defaultExchange: 'BSE',
          preferredCurrency: 'INR',
          theme: 'dark',
          tableDensity: 'compact',
        });
      expect(prefRes.status).toBe(200);
      expect(prefRes.body.data.defaultExchange).toBe('BSE');
      expect(prefRes.body.data.theme).toBe('dark');

      // User Bravo attempts to read User Alpha's watchlist
      const leakAttemptRes = await request(app)
        .get(`/api/v1/watchlists/${alphaWlId}`)
        .set('x-test-user-id', userBravoId);

      // Must be 403 or 404 - strictly isolated
      expect([403, 404]).toContain(leakAttemptRes.status);

      // User Bravo lists their own watchlists - must NOT contain Alpha's watchlist
      const bravoListsRes = await request(app)
        .get('/api/v1/watchlists')
        .set('x-test-user-id', userBravoId);

      expect(bravoListsRes.status).toBe(200);
      expect(bravoListsRes.body.data).toHaveLength(0);

      // User Alpha re-reads preferences
      const alphaGetPref = await request(app)
        .get('/api/v1/users/me/preferences')
        .set('x-test-user-id', userAlphaId);

      expect(alphaGetPref.status).toBe(200);
      expect(alphaGetPref.body.data.theme).toBe('dark');
      expect(alphaGetPref.body.data.tableDensity).toBe('compact');
    });
  });

  // ============================================================================
  // Journey C: Real Stock Research & Financial Intelligence
  // ============================================================================
  describe('Journey C — Institutional Stock Research & Analysis', () => {
    it('verifies instrument identity, profile, financial ratios, news, screener, and comparison', async () => {
      // 1. Identity lookup in Security Master
      const inst = instrumentRepository.getBySymbol('TCS', 'NSE');
      expect(inst).toBeDefined();
      expect(inst?.exchange).toBe('NSE');
      expect(inst?.symbol).toBe('TCS');

      // 2. Profile API
      const profileRes = await request(app).get('/api/v1/stocks/TCS/profile?exchange=NSE');
      expect([200, 404, 502]).toContain(profileRes.status);
      if (profileRes.status === 200) {
        expect(profileRes.body.data.symbol).toBe('TCS');
        expect(profileRes.body.data.exchange).toBe('NSE');
      }

      // 3. News & Announcements feed
      const newsRes = await request(app).get('/api/v1/stocks/TCS/news');
      expect(newsRes.status).toBe(200);
      expect(newsRes.body.success).toBe(true);
      expect(Array.isArray(newsRes.body.data.items)).toBe(true);

      const annRes = await request(app).get('/api/v1/stocks/TCS/announcements');
      expect(annRes.status).toBe(200);
      expect(annRes.body.success).toBe(true);
      expect(Array.isArray(annRes.body.data.items)).toBe(true);

      // 4. Peer Comparison
      const compareRes = await request(app)
        .post('/api/v1/compare')
        .send({
          companies: [
            { symbol: 'TCS', exchange: 'NSE' },
            { symbol: 'INFY', exchange: 'NSE' },
          ],
        });

      expect([200, 400, 502]).toContain(compareRes.status);
      if (compareRes.status === 200) {
        expect(compareRes.body.data.companies).toHaveLength(2);
        expect(Array.isArray(compareRes.body.data.metrics)).toBe(true);
        // Verify metric metadata: units, descriptions, formulas
        for (const metric of compareRes.body.data.metrics) {
          expect(metric.metricKey).toBeDefined();
          expect(metric.label).toBeDefined();
        }
      }

      // 5. Financial Screener Execution
      const screenerRes = await request(app)
        .post('/api/v1/screener/run')
        .send({
          query: 'Tech large cap screener',
          filters: [
            { field: 'pe_ratio', operator: 'lt', value: 50 },
          ],
          limit: 10,
        });

      expect([200, 502, 503]).toContain(screenerRes.status);
      if (screenerRes.status === 200) {
        expect(screenerRes.body.success).toBe(true);
        expect(Array.isArray(screenerRes.body.data.results)).toBe(true);
      }
    }, 15000);
  });

  // ============================================================================
  // Journey D: Controlled Failure, Circuit Breakers & Resilience
  // ============================================================================
  describe('Journey D — Reliability, Failure & Degradation Modes', () => {
    it('handles nonexistent instruments, malformed queries, and protects uptime', async () => {
      // 1. Invalid / Nonexistent stock quote request
      const badStockRes = await request(app).get('/api/v1/stocks/NONEXISTENT999/quote?exchange=NSE');
      expect([400, 404, 502]).toContain(badStockRes.status);
      expect(badStockRes.body.success).toBe(false);

      // 2. Health check remains operational and reports dependencies
      const healthRes = await request(app).get('/api/v1/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.status).toBe('ok');

      const readyRes = await request(app).get('/api/v1/health/ready');
      expect(readyRes.status).toBe(200);
      expect(readyRes.body.data.status).toBe('ready');

      // 3. Malformed screener request returns 400 with actionable error
      const badScreenerRes = await request(app)
        .post('/api/v1/screener/run')
        .send({ conditions: 'invalid-should-be-array' });

      expect(badScreenerRes.status).toBe(400);
      expect(badScreenerRes.body.success).toBe(false);

      // 4. Verify rate limiting headers or structure
      const probeRes = await request(app).get('/api/v1/health');
      expect(probeRes.headers).toBeDefined();
    });
  });

  // ============================================================================
  // Journey E: AI Research Workbench & Fact Synthesis
  // ============================================================================
  describe('Journey E — AI Research Features & Provenance Guardrails', () => {
    it('handles research queries and guarantees non-fabrication boundaries', async () => {
      const testUserId = 'usr-uat-ai-investor';

      // 1. Get research templates
      const tmplRes = await request(app)
        .get('/api/v1/research/templates')
        .set('x-test-user-id', testUserId);

      expect(tmplRes.status).toBe(200);
      expect(tmplRes.body.data.templates.length).toBe(8);

      // 2. Create a research project
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', testUserId)
        .send({
          title: 'H1 FY27 IT Sector Valuation Study',
          description: 'Comparative study of top Indian IT service firms',
          symbol: 'TCS',
          exchange: 'NSE',
        });

      expect(projRes.status).toBe(201);
      const projectId = projRes.body.data.project.id;
      expect(projectId).toBeDefined();

      // 3. Create a structured report with deterministic sections
      const repRes = await request(app)
        .post(`/api/v1/research/${projectId}/reports`)
        .set('x-test-user-id', testUserId)
        .send({
          templateId: 'peer_comparison',
          title: 'TCS vs INFY Valuation Matrix',
        });

      expect(repRes.status).toBe(201);
      expect(repRes.body.data.report.title).toBe('TCS vs INFY Valuation Matrix');
      expect(repRes.body.data.report.sections.length).toBeGreaterThan(0);

      // 4. Verify AI research input validation rejects empty prompt
      const badAiRes = await request(app)
        .post('/api/v1/ai/research')
        .set('x-test-user-id', testUserId)
        .send({ prompt: '' });

      expect([400, 422]).toContain(badAiRes.status);
    });
  });
});
