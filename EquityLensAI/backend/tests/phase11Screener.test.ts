import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  getScreenerMetricCatalog,
  screenerFilterSchema,
  screenerFilterGroupSchema,
  screenerStrategyDefinitionSchema,
  type ScreenerFilterGroup,
} from '../src/ai/screener/index.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';
import { resetAiRateLimitForTests } from '../src/middleware/aiRateLimit.js';
import { memorySavedScreenStore } from '../src/screener/repositories/savedScreenRepository.js';
import { memoryScreenerRunStore } from '../src/screener/repositories/screenerRunRepository.js';

const app = createApp();

const userAId = '00000000-0000-0000-0000-000000000001';
const userBId = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  resetEnvCache();
  loadEnv({
    NODE_ENV: 'test',
  });
  memorySavedScreenStore.clear();
  memoryScreenerRunStore.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvCache();
  resetAiRateLimitForTests();
  memorySavedScreenStore.clear();
  memoryScreenerRunStore.clear();
});

describe('Phase 11: Central Metric Registry', () => {
  it('exposes all verified financial, profitability, leverage, liquidity, growth, and valuation metrics', () => {
    const catalog = getScreenerMetricCatalog();
    const ids = catalog.map((m) => m.id);

    // Existing metrics
    expect(ids).toContain('roe');
    expect(ids).toContain('roa');
    expect(ids).toContain('roce');
    expect(ids).toContain('net_margin');
    expect(ids).toContain('debt_to_equity');
    expect(ids).toContain('revenue_growth');
    expect(ids).toContain('net_income_growth');
    expect(ids).toContain('free_cash_flow_margin');
    expect(ids).toContain('current_ratio');
    expect(ids).toContain('pe_ratio');
    expect(ids).toContain('price_to_book');
    expect(ids).toContain('financial_health_score');

    // Phase 11 verified extensions
    expect(ids).toContain('gross_margin');
    expect(ids).toContain('operating_margin');
    expect(ids).toContain('quick_ratio');
    expect(ids).toContain('interest_coverage');
    expect(ids).toContain('eps_growth');

    for (const item of catalog) {
      expect(item.label).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.unit).toMatch(/^(percent|ratio|score)$/);
      expect(item.minimum).toBeLessThanOrEqual(item.maximum);
      expect(item.periods.length).toBeGreaterThan(0);
    }
  });

  it('GET /api/v1/screener/metrics returns the full metric catalog', async () => {
    const res = await request(app).get('/api/v1/screener/metrics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(17);
  });
});

describe('Phase 11: Advanced Filter Engine & Operators', () => {
  it.each([
    { field: 'gross_margin', operator: 'gt', value: 20 },
    { field: 'operating_margin', operator: 'gte', value: 15 },
    { field: 'quick_ratio', operator: 'lt', value: 2 },
    { field: 'interest_coverage', operator: 'gt', value: 5 },
    { field: 'eps_growth', operator: 'gte', value: 10 },
    { field: 'roe', operator: 'between', value: 10, upperValue: 30 },
  ] as const)('validates condition $field $operator $value', (condition) => {
    const result = screenerFilterSchema.safeParse(condition);
    expect(result.success).toBe(true);
  });

  it('rejects between operator when upperValue <= value or missing', () => {
    const invalidUpper = screenerFilterSchema.safeParse({
      field: 'roe',
      operator: 'between',
      value: 20,
      upperValue: 15,
    });
    expect(invalidUpper.success).toBe(false);

    const missingUpper = screenerFilterSchema.safeParse({
      field: 'roe',
      operator: 'between',
      value: 20,
    });
    expect(missingUpper.success).toBe(false);
  });

  it('rejects upperValue when operator is not between', () => {
    const invalid = screenerFilterSchema.safeParse({
      field: 'roe',
      operator: 'gt',
      value: 15,
      upperValue: 25,
    });
    expect(invalid.success).toBe(false);
  });

  it('validates nested AND/OR groups with depth <= 3', () => {
    const validNestedGroup: ScreenerFilterGroup = {
      logic: 'AND',
      conditions: [
        { field: 'roe', operator: 'gt', value: 15 },
        {
          logic: 'OR',
          conditions: [
            { field: 'operating_margin', operator: 'gt', value: 18 },
            { field: 'gross_margin', operator: 'gt', value: 40 },
          ],
        },
      ],
    };

    const parsed = screenerFilterGroupSchema.safeParse(validNestedGroup);
    expect(parsed.success).toBe(true);
  });

  it('rejects nested groups with depth exceeding 3', () => {
    const excessivelyDeepGroup: ScreenerFilterGroup = {
      logic: 'AND',
      conditions: [
        {
          logic: 'OR',
          conditions: [
            {
              logic: 'AND',
              conditions: [
                {
                  logic: 'OR',
                  conditions: [{ field: 'roe', operator: 'gt', value: 15 }],
                },
              ],
            },
          ],
        },
      ],
    };

    const parsed = screenerFilterGroupSchema.safeParse(excessivelyDeepGroup);
    expect(parsed.success).toBe(false);
  });

  it('rejects groups with more than 15 total conditions', () => {
    const conditions = Array.from({ length: 16 }, () => ({
      field: 'roe',
      operator: 'gt' as const,
      value: 10,
    }));

    const parsed = screenerFilterGroupSchema.safeParse({
      logic: 'AND',
      conditions,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('Phase 11: Strategy Templates', () => {
  it('GET /api/v1/screener/templates returns all supported curated templates', async () => {
    const res = await request(app).get('/api/v1/screener/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);

    for (const template of res.body.data) {
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.category).toBeDefined();
      expect(template.assumptions).toBeDefined();
      const defValid = screenerStrategyDefinitionSchema.safeParse(template.definition);
      expect(defValid.success).toBe(true);
    }
  });
});

describe('Phase 11: Saved Screening Strategies CRUD & Authorization', () => {
  const sampleStrategy = {
    name: 'Growth Champions',
    description: 'Companies with >15% ROE and >10% revenue growth',
    definition: {
      schemaVersion: 1 as const,
      period: 'annual' as const,
      sort: { field: 'roe', direction: 'desc' as const },
      rootGroup: {
        logic: 'AND' as const,
        conditions: [
          { field: 'roe' as const, operator: 'gt' as const, value: 15 },
          { field: 'revenue_growth' as const, operator: 'gt' as const, value: 10 },
        ],
      },
      selectedColumns: ['roe', 'revenue_growth', 'operating_margin'],
    },
  };

  it('rejects unauthenticated requests to saved screen endpoints with 401', async () => {
    const listRes = await request(app).get('/api/v1/screener/saved');
    expect(listRes.status).toBe(401);

    const createRes = await request(app).post('/api/v1/screener/saved').send(sampleStrategy);
    expect(createRes.status).toBe(401);
  });

  it('creates, reads, updates, duplicates, and deletes a saved screen for an authenticated user', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/v1/screener/saved')
      .set('x-test-user-id', userAId)
      .send(sampleStrategy);

    expect(createRes.status).toBe(201);
    const screenId = createRes.body.data.id;
    expect(screenId).toBeDefined();
    expect(createRes.body.data.name).toBe('Growth Champions');
    expect(createRes.body.data.userId).toBe(userAId);

    // 2. Read list
    const listRes = await request(app)
      .get('/api/v1/screener/saved')
      .set('x-test-user-id', userAId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(screenId);

    // 3. Read single
    const getRes = await request(app)
      .get(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userAId);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(screenId);

    // 4. Update
    const updateRes = await request(app)
      .patch(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userAId)
      .send({ name: 'Growth Champions Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Growth Champions Updated');

    // 5. Duplicate
    const dupRes = await request(app)
      .post(`/api/v1/screener/saved/${screenId}/duplicate`)
      .set('x-test-user-id', userAId);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.name).toBe('Growth Champions Updated (Copy)');
    expect(dupRes.body.data.id).not.toBe(screenId);

    // 6. Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userAId);
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await request(app)
      .get(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userAId);
    expect(getAfterDelete.status).toBe(404);
  });

  it('enforces strict user isolation: User B cannot access or modify User A saved screens', async () => {
    // User A creates a screen
    const createRes = await request(app)
      .post('/api/v1/screener/saved')
      .set('x-test-user-id', userAId)
      .send(sampleStrategy);
    const screenId = createRes.body.data.id;

    // User B tries to view
    const getRes = await request(app)
      .get(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userBId);
    expect(getRes.status).toBe(404);

    // User B tries to update
    const patchRes = await request(app)
      .patch(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userBId)
      .send({ name: 'Hacked Strategy' });
    expect(patchRes.status).toBe(404);

    // User B tries to duplicate
    const dupRes = await request(app)
      .post(`/api/v1/screener/saved/${screenId}/duplicate`)
      .set('x-test-user-id', userBId);
    expect(dupRes.status).toBe(404);

    // User B tries to delete
    const delRes = await request(app)
      .delete(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userBId);
    expect(delRes.status).toBe(404);

    // User B's list is empty
    const listRes = await request(app)
      .get('/api/v1/screener/saved')
      .set('x-test-user-id', userBId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(0);
  });

  it('rejects duplicate strategy names for the same user', async () => {
    await request(app)
      .post('/api/v1/screener/saved')
      .set('x-test-user-id', userAId)
      .send(sampleStrategy);

    const duplicateRes = await request(app)
      .post('/api/v1/screener/saved')
      .set('x-test-user-id', userAId)
      .send(sampleStrategy);

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('DUPLICATE_SAVED_SCREEN_NAME');
  });
});

describe('Phase 11: Saved Screen Execution & Run History', () => {
  it('executes saved screen, updates run metadata, and records run history', async () => {
    // 1. Create a screen in memory
    const createRes = await request(app)
      .post('/api/v1/screener/saved')
      .set('x-test-user-id', userAId)
      .send({
        name: 'IT Leaders',
        definition: {
          schemaVersion: 1,
          period: 'annual',
          sort: { field: 'roe', direction: 'desc' },
          rootGroup: {
            logic: 'AND',
            conditions: [
              { field: 'roe', operator: 'gt', value: 20 },
              { field: 'operating_margin', operator: 'gt', value: 15 },
            ],
          },
        },
      });

    expect(createRes.status).toBe(201);
    const screenId = createRes.body.data.id;

    // 2. Set up Supabase mock for screener database execution
    loadEnv({
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://screener-test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only-not-a-credential',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (info) => {
      const url = String(info);
      if (url.includes('screen_financial_companies')) {
        return new Response(
          JSON.stringify({
            totalMatches: 2,
            results: [
              {
                symbol: 'INFY',
                companyName: 'Infosys Limited',
                exchange: 'NSE',
                currency: 'INR',
                period: '2025-03-31',
                periodType: 'annual',
                source: 'yahoo-financial',
                retrievedAt: '2025-04-01T00:00:00.000Z',
                isStale: false,
                metrics: {
                  roe: { value: 29.5, unit: 'percent', periodEndDate: '2025-03-31' },
                  operating_margin: { value: 21.2, unit: 'percent', periodEndDate: '2025-03-31' },
                },
              },
            ],
            coverage: {
              indexedCompanies: 2,
              staleIndexedCompanies: 0,
              expectedCompanies: 2,
              refreshCompleted: true,
              refreshedAt: '2025-04-01T00:00:00.000Z',
              isPartial: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(null, { status: 503 });
    });

    // 3. Run the saved screen
    const runRes = await request(app)
      .post(`/api/v1/screener/saved/${screenId}/run`)
      .set('x-test-user-id', userAId)
      .send({ limit: 10 });

    expect(runRes.status).toBe(200);
    expect(runRes.body.data.totalMatches).toBe(2);
    expect(runRes.body.data.results[0].symbol).toBe('INFY');

    // 4. Verify lastRunAt and lastResultCount were updated on screen
    const screenGet = await request(app)
      .get(`/api/v1/screener/saved/${screenId}`)
      .set('x-test-user-id', userAId);
    expect(screenGet.body.data.lastRunAt).toBeDefined();
    expect(screenGet.body.data.lastResultCount).toBe(2);

    // 5. Verify run record was created in runs history
    const runsList = await request(app)
      .get('/api/v1/screener/runs')
      .set('x-test-user-id', userAId);
    expect(runsList.status).toBe(200);
    expect(runsList.body.data.length).toBe(1);
    expect(runsList.body.data[0].savedScreenId).toBe(screenId);
    expect(runsList.body.data[0].resultCount).toBe(2);

    // 6. Get run by ID
    const runId = runsList.body.data[0].id;
    const runDetail = await request(app)
      .get(`/api/v1/screener/runs/${runId}`)
      .set('x-test-user-id', userAId);
    expect(runDetail.status).toBe(200);
    expect(runDetail.body.data.id).toBe(runId);

    fetchMock.mockRestore();
  });
});

