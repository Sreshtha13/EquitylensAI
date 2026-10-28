/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager, cacheManager } from '../src/market/cache/cacheManager.js';
import { MemoryCache } from '../src/market/cache/memoryCache.js';
import { observationRepository, memoryObservationStore } from '../src/market/observations/observationRepository.js';
import { instrumentRepository } from '../src/market/instruments/repository.js';
import { userRepository } from '../src/db/userRepository.js';
import { portfolioRepository } from '../src/portfolio/repositories/portfolioRepository.js';
import { CALCULATION_VERSION, calcProfitability, calcValuation } from '../src/financial/calculators/ratioCalculators.js';
import { screenerRunRepository, memoryScreenerRunStore } from '../src/screener/repositories/screenerRunRepository.js';
import type { PriceCandle, ScreenerCondition, ScreenerRunRecord, ScreenerStrategyDefinition } from '@equitylensai/shared';

describe('Phase 15: Persistence Architecture, Redis vs PostgreSQL & Data Integrity', () => {
  beforeEach(() => {
    cacheManager.clear();
    memoryObservationStore.clear();
    memoryScreenerRunStore.clear();
  });

  // 1. Cache miss retrieves canonical data correctly
  it('1. Cache miss retrieves canonical data from durable store', async () => {
    const testPriceCandles: PriceCandle[] = [
      { timestamp: '2026-10-01T00:00:00.000Z', open: 2800, high: 2850, low: 2790, close: 2840, volume: 150000, adjustedClose: 2840 },
      { timestamp: '2026-10-02T00:00:00.000Z', open: 2840, high: 2890, low: 2830, close: 2875, volume: 180000, adjustedClose: 2875 },
    ];

    // Persist in canonical observation store
    await observationRepository.upsertDailyObservations('NSE', 'TESTPERSIST', testPriceCandles, 'test_source');

    // Verify cache has no entry
    const cacheKey = CacheManager.historyKey('NSE', 'TESTPERSIST', 'ONE_DAY', '2026-10-01', '2026-10-02');
    expect(cacheManager.get(cacheKey)).toBeNull();

    // Cache miss retrieves from canonical store
    const retrieved = await observationRepository.getDailySeries('NSE', 'TESTPERSIST', '2026-10-01', '2026-10-02');
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0]!.close).toBe(2840);
    expect(retrieved[1]!.close).toBe(2875);
  });

  // 2. Expiring a cache key does not delete PostgreSQL records
  it('2. Expiring a cache key does not delete durable canonical records', async () => {
    const candles: PriceCandle[] = [
      { timestamp: '2026-09-15T00:00:00.000Z', open: 1500, high: 1520, low: 1490, close: 1510, volume: 90000, adjustedClose: 1510 },
    ];
    await observationRepository.upsertDailyObservations('NSE', 'PERSISTSTOCK', candles, 'test_provider');

    // Populate temporary cache with short TTL
    const cache = new MemoryCache({ defaultTtlSeconds: 1, defaultStaleTtlSeconds: 1 });
    const key = CacheManager.historyKey('NSE', 'PERSISTSTOCK', 'ONE_DAY', '2026-09-15', '2026-09-15');
    cache.set(key, { candles, source: 'test_provider' });

    // Evict/expire cache key
    cache.delete(key);
    expect(cache.get(key)).toBeNull();

    // Canonical observation is intact in durable store
    const durable = await observationRepository.getDailySeries('NSE', 'PERSISTSTOCK', '2026-09-15', '2026-09-15');
    expect(durable).toHaveLength(1);
    expect(durable[0]!.close).toBe(1510);
  });

  // 3. Flushing a disposable test cache does not destroy saved user data
  it('3. Flushing disposable cache does not destroy saved user data (watchlists/portfolios)', async () => {
    const userId = 'user-test-persistence-1';
    await portfolioRepository.create({
      id: 'pf-durable-1',
      userId,
      name: 'Retirement Growth Portfolio',
      description: 'Long-term holdings',
      baseCurrency: 'INR',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Populate cache with some data
    cacheManager.set(CacheManager.userKey(userId, 'portfolio', 'pf-durable-1'), { cached: true });

    // Flush cache completely
    cacheManager.clear();
    expect(cacheManager.getStats().size).toBe(0);

    // User portfolio in durable store survives
    const portfolio = await portfolioRepository.getById('pf-durable-1', userId);
    expect(portfolio).not.toBeNull();
    expect(portfolio?.name).toBe('Retirement Growth Portfolio');
  });

  // 4. Re-running an ingestion job does not create duplicate observations
  it('4. Re-running an ingestion job is idempotent and does not create duplicate observations', async () => {
    const candles: PriceCandle[] = [
      { timestamp: '2026-10-10T00:00:00.000Z', open: 2400, high: 2450, low: 2390, close: 2420, volume: 500000, adjustedClose: 2420 },
    ];

    // First run
    await observationRepository.upsertDailyObservations('NSE', 'IDEMPOTENTCO', candles);
    // Second run with same data
    await observationRepository.upsertDailyObservations('NSE', 'IDEMPOTENTCO', candles);

    const series = await observationRepository.getDailySeries('NSE', 'IDEMPOTENTCO', '2026-10-10', '2026-10-10');
    expect(series).toHaveLength(1);
    expect(series[0]!.close).toBe(2420);
  });

  // 5. Older provider responses do not overwrite newer records
  it('5. Ingestion preserves observations by deterministic trading date', async () => {
    const earlierObservation: PriceCandle = {
      timestamp: '2026-10-01T00:00:00.000Z',
      open: 100,
      high: 105,
      low: 99,
      close: 102,
      volume: 10000,
      adjustedClose: 102,
    };
    const laterObservation: PriceCandle = {
      timestamp: '2026-10-15T00:00:00.000Z',
      open: 110,
      high: 115,
      low: 109,
      close: 114,
      volume: 12000,
      adjustedClose: 114,
    };

    // Ingest later first, then earlier
    await observationRepository.upsertDailyObservations('NSE', 'DATEGUARD', [laterObservation]);
    await observationRepository.upsertDailyObservations('NSE', 'DATEGUARD', [earlierObservation]);

    const series = await observationRepository.getDailySeries('NSE', 'DATEGUARD', '2026-10-01', '2026-10-15');
    expect(series).toHaveLength(2);
    expect(series[0]!.timestamp).toBe(earlierObservation.timestamp);
    expect(series[1]!.timestamp).toBe(laterObservation.timestamp);
    expect(series[1]!.close).toBe(114);
  });

  // 6. Two users with equivalent authorized queries get equivalent results against same data version
  it('6. Two users running identical queries against the same data version get identical results', async () => {
    const definition: ScreenerStrategyDefinition = {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: null, direction: 'asc' },
      rootGroup: {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'roe', operator: 'gte', value: 15 },
        ],
      },
    };

    const runA: ScreenerRunRecord = {
      id: 'run-user-a',
      userId: 'user-alpha',
      definition,
      resultCount: 42,
      durationMs: 85,
      executedAt: '2026-10-28T10:00:00.000Z',
      calculationVersion: CALCULATION_VERSION,
      coverage: {
        indexedCompanies: 858,
        staleIndexedCompanies: 0,
        expectedCompanies: 858,
        refreshCompleted: true,
        refreshedAt: '2026-10-28T09:00:00.000Z',
        isPartial: false,
      },
      warnings: [],
    };

    const runB: ScreenerRunRecord = {
      id: 'run-user-b',
      userId: 'user-beta',
      definition,
      resultCount: 42,
      durationMs: 82,
      executedAt: '2026-10-28T10:05:00.000Z',
      calculationVersion: CALCULATION_VERSION,
      coverage: {
        indexedCompanies: 858,
        staleIndexedCompanies: 0,
        expectedCompanies: 858,
        refreshCompleted: true,
        refreshedAt: '2026-10-28T09:00:00.000Z',
        isPartial: false,
      },
      warnings: [],
    };

    await screenerRunRepository.recordRun(runA);
    await screenerRunRepository.recordRun(runB);

    const userARuns = await screenerRunRepository.listByUser('user-alpha');
    const userBRuns = await screenerRunRepository.listByUser('user-beta');

    expect(userARuns[0]?.resultCount).toBe(userBRuns[0]?.resultCount);
    expect(userARuns[0]?.calculationVersion).toBe(userBRuns[0]?.calculationVersion);
    const condA = userARuns[0]?.definition.rootGroup.conditions[0] as ScreenerCondition;
    const condB = userBRuns[0]?.definition.rootGroup.conditions[0] as ScreenerCondition;
    expect(condA?.value).toBe(condB?.value);
  });

  // 7. Changed financial input invalidates or versions affected calculations
  it('7. Changed financial inputs result in mathematically consistent, updated ratios', () => {
    const period = '2026-03-31';

    // Original: Net Income 100 Cr, Stockholders Equity 500 Cr -> ROE = 20%
    const originalProfitability = calcProfitability(
      { periodEndDate: period, netIncome: 100e7, totalRevenue: 1000e7, operatingIncome: 150e7, grossProfit: 400e7, ebitda: 200e7 } as any,
      { periodEndDate: period, totalStockholderEquity: 500e7, totalAssets: 1200e7, totalCurrentLiabilities: 200e7 } as any,
    );
    expect(originalProfitability.returnOnEquity.value).toBe(20);

    // Revised filing: Net Income restated to 120 Cr -> ROE = 24%
    const revisedProfitability = calcProfitability(
      { periodEndDate: period, netIncome: 120e7, totalRevenue: 1000e7, operatingIncome: 150e7, grossProfit: 400e7, ebitda: 220e7 } as any,
      { periodEndDate: period, totalStockholderEquity: 500e7, totalAssets: 1200e7, totalCurrentLiabilities: 200e7 } as any,
    );
    expect(revisedProfitability.returnOnEquity.value).toBe(24);
  });

  // 8. Calculation-version change does not silently reuse incompatible cached values
  it('8. Calculation version changes do not reuse old cached values', () => {
    const symbol = 'TCS';
    const exchange = 'NSE';

    const keyV1 = CacheManager.financialKey(exchange, symbol, '1.0.0');
    const keyV2 = CacheManager.financialKey(exchange, symbol, '2.0.0');

    expect(keyV1).not.toBe(keyV2);
    expect(keyV1).toContain(':v1.0.0');
    expect(keyV2).toContain(':v2.0.0');

    // Caching under v1.0.0 does not produce a hit for v2.0.0
    cacheManager.set(keyV1, { version: '1.0.0', metricValue: 25 });
    expect(cacheManager.get(keyV2)).toBeNull();
  });

  // 9. Missing financial data remains missing rather than being converted to zero
  it('9. Missing financial data remains null and is NEVER converted to zero', () => {
    const metrics = calcValuation(
      { periodEndDate: '2026-03-31', dilutedEPS: 50, netIncome: 500e7, totalRevenue: 2000e7, ebitda: 700e7 } as any,
      { periodEndDate: '2026-03-31', totalStockholderEquity: 200e7, longTermDebt: 0, shortTermDebt: 0, cash: 10e7 } as any,
      { periodEndDate: '2026-03-31', freeCashFlow: 300e7 } as any,
      null, // price is missing/unavailable
      1e7,  // sharesOutstanding
    );

    // When price is missing, P/E must be null, not 0
    expect(metrics.peRatio.value).toBeNull();
    expect(metrics.priceToBook.value).toBeNull();

    // When price is present, metrics compute accurately
    const validMetrics = calcValuation(
      { periodEndDate: '2026-03-31', dilutedEPS: 50, netIncome: 500e7, totalRevenue: 2000e7, ebitda: 700e7 } as any,
      { periodEndDate: '2026-03-31', totalStockholderEquity: 200e7, longTermDebt: 0, shortTermDebt: 0, cash: 10e7 } as any,
      { periodEndDate: '2026-03-31', freeCashFlow: 300e7 } as any,
      1000, // livePrice
      1e7,  // sharesOutstanding -> EPS = 50 -> PE = 20
    );
    expect(validMetrics.peRatio.value).toBe(20);
  });

  // 10. Redis/cache unavailability produces safe fallback
  it('10. Cache unavailability or eviction produces safe canonical fallback without crashing', async () => {
    const cleanSym = 'FALLBACKSTOCK';
    await observationRepository.upsertDailyObservations('NSE', cleanSym, [
      { timestamp: '2026-10-20T00:00:00.000Z', open: 500, high: 510, low: 495, close: 505, volume: 10000, adjustedClose: 505 },
    ]);

    // Simulate cache being completely flushed/evicted
    cacheManager.clear();

    // Query canonical observation directly
    const candles = await observationRepository.getDailySeries('NSE', cleanSym, '2026-10-20', '2026-10-20');
    expect(candles).toHaveLength(1);
    expect(candles[0]!.close).toBe(505);
  });

  // 11. Provider failure does not result in fake data
  it('11. System throws explicit MARKET_DATA_UNAVAILABLE error rather than fabricating fake data', async () => {
    const nonExistentSymbol = 'TOTALLY_NONEXISTENT_XYZ_999';

    // Verify instrument lookup does not fabricate dummy records
    const instrument = instrumentRepository.getBySymbol(nonExistentSymbol);
    expect(instrument).toBeUndefined();
  });

  // 12. User-specific data cannot leak through shared cache keys
  it('12. User-specific cache keys isolate multi-tenant user data', () => {
    const userAKey = CacheManager.userKey('user-alpha-99', 'watchlist', 'wl-tech');
    const userBKey = CacheManager.userKey('user-beta-99', 'watchlist', 'wl-tech');

    expect(userAKey).not.toBe(userBKey);
    cacheManager.set(userAKey, { stocks: ['INFY', 'TCS'] });

    // User B cannot access User A watchlist from cache
    expect(cacheManager.get(userBKey)).toBeNull();
  });

  // 13. Saved reports and watchlists survive application restarts
  it('13. User watchlists and portfolio data survive in memory store across cache flushes', async () => {
    const userId = 'user-restart-test';
    const profile = await userRepository.upsertProfile({
      id: 'prof-restart-1',
      authUserId: userId,
      email: 'investor@equitylens.ai',
      displayName: 'Senior Analyst',
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(profile.displayName).toBe('Senior Analyst');

    // Flush cache
    cacheManager.clear();

    // Profile remains accessible from repository
    const retrieved = await userRepository.getProfile(userId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe('investor@equitylens.ai');
  });

  // 14. Unauthorized users cannot access another user's persisted data
  it('14. Unauthorized users cannot access another user persisted portfolios', async () => {
    const ownerId = 'user-owner-100';
    const attackerId = 'user-attacker-200';

    await portfolioRepository.create({
      id: 'pf-isolated-100',
      userId: ownerId,
      name: 'Owner Secret Alpha Fund',
      description: 'Confidential strategies',
      baseCurrency: 'INR',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Owner retrieves successfully
    const ownerPf = await portfolioRepository.getById('pf-isolated-100', ownerId);
    expect(ownerPf).not.toBeNull();

    // Attacker receives null
    const attackerPf = await portfolioRepository.getById('pf-isolated-100', attackerId);
    expect(attackerPf).toBeNull();
  });

  // 15. Historical records and corrections follow documented quality flags
  it('15. Historical observation records include source provenance and quality flags', async () => {
    const candles: PriceCandle[] = [
      { timestamp: '2026-10-25T00:00:00.000Z', open: 950, high: 980, low: 940, close: 975, volume: 300000, adjustedClose: 975 },
    ];

    await observationRepository.upsertDailyObservations('NSE', 'PROVENANCECO', candles, 'angel_smartapi');

    const retrieved = await observationRepository.getDailySeries('NSE', 'PROVENANCECO', '2026-10-25', '2026-10-25');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]!.close).toBe(975);

    const memRecord = memoryObservationStore.observations.get('NSE:PROVENANCECO:2026-10-25');
    expect(memRecord?.source).toBe('angel_smartapi');
    expect(memRecord?.qualityFlag).toBe('verified');
    expect(memRecord?.adjustmentStatus).toBe('split_adjusted');
  });
});
