import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv, resetEnvCache } from '../src/config/index.js';
import { upsertScreenerMetrics } from '../src/ai/screener/screenerRepository.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvCache();
});

describe('financial screener persistence', () => {
  it.each([201, 204])(
    'maps indexed rows to database columns and accepts an empty HTTP %i upsert response',
    async (status) => {
      loadEnv({
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://screener-test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-not-a-credential',
      });
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status }));

      await upsertScreenerMetrics([
        {
          symbol: 'TEST',
          companyName: 'Test Company',
          exchange: 'NSE',
          assetType: 'equity',
          currency: 'INR',
          periodType: 'annual',
          periodEndDate: '2025-03-31',
          source: 'yahoo-financial',
          retrievedAt: '2025-04-01T00:00:00.000Z',
          isStale: false,
          metrics: {
            roe: { value: 15, unit: 'percent', periodEndDate: '2025-03-31' },
          },
        },
      ]);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://screener-test.supabase.co/rest/v1/financial_screener_metrics?on_conflict=symbol%2Cexchange%2Cperiod_type',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Headers),
          body: JSON.stringify([
            {
              symbol: 'TEST',
              company_name: 'Test Company',
              exchange: 'NSE',
              asset_type: 'equity',
              currency: 'INR',
              period_type: 'annual',
              period_end_date: '2025-03-31',
              source: 'yahoo-financial',
              retrieved_at: '2025-04-01T00:00:00.000Z',
              is_stale: false,
              metrics: {
                roe: { value: 15, unit: 'percent', periodEndDate: '2025-03-31' },
              },
            },
          ]),
        }),
      );
    },
  );

  it('does not call the provider when there are no index rows to persist', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await upsertScreenerMetrics([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
