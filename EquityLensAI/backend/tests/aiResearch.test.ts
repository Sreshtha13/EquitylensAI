import { afterEach, describe, expect, it, vi } from 'vitest';

const { buildContextMock } = vi.hoisted(() => ({
  buildContextMock: vi.fn(),
}));

vi.mock('../src/ai/research/researchContextBuilder.js', () => ({
  buildResearchContext: buildContextMock,
}));

import { createApp } from '../src/app.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';
import { resetAiRateLimitForTests } from '../src/middleware/aiRateLimit.js';
import { classifyResearchIntent, runResearch } from '../src/ai/research/index.js';
import type { AiClient } from '../src/ai/common/types.js';
import type { ResearchContext } from '../src/ai/research/researchContextBuilder.js';

const app = createApp();

const modelResponse = {
  summary: {
    text: 'The evidence provides a partial view of business performance.',
    evidenceIds: ['revenue'],
  },
  overallAssessment: {
    label: 'MIXED',
    explanation: 'The available figures support a cautious interpretation.',
    evidenceIds: ['revenue'],
  },
  sections: [
    {
      title: 'Financial overview',
      analysis: {
        text: 'The supplied financial record should be interpreted with its stated limitations.',
        evidenceIds: ['revenue'],
      },
      risks: [],
      limitations: [],
    },
  ],
  strengths: [],
  riskFactors: [],
  growthSignals: [],
  valuationObservations: [],
  financialObservations: [],
};

function makeContext(): ResearchContext {
  return {
    instrument: { symbol: 'TEST', exchange: 'NSE', name: 'Test Instrument', currency: 'INR' },
    analysis: {
      latestAnnual: { income: { totalRevenue: 123 } },
      isStale: false,
    } as ResearchContext['analysis'],
    evidence: [
      {
        id: 'annual-period',
        type: 'statement',
        metric: 'annualStatementPeriod',
        value: '2025-03-31',
        unit: null,
        period: '2025-03-31',
        source: 'test-provider',
        timestamp: '2025-04-01T00:00:00.000Z',
      },
      {
        id: 'revenue',
        type: 'statement',
        metric: 'totalRevenue',
        value: 123,
        unit: 'INR',
        period: '2025-03-31',
        source: 'test-provider',
        timestamp: '2025-04-01T00:00:00.000Z',
      },
    ],
    missingData: [],
    coverage: {
      available: 2,
      total: 2,
      period: '2025-03-31',
      currency: 'INR',
      stale: false,
    },
  };
}

function fakeClient(output: unknown): AiClient {
  return {
    id: 'test',
    generate: async () => ({ text: JSON.stringify(output), model: 'test-model' }),
  };
}

function fakeRawClient(text: string): AiClient {
  return {
    id: 'test',
    generate: async () => ({ text, model: 'test-model' }),
  };
}

afterEach(() => {
  resetEnvCache();
  resetAiRateLimitForTests();
  buildContextMock.mockReset();
});

describe('AI research contract', () => {
  it('classifies supported intents without confusing ROE with historical returns', () => {
    expect(classifyResearchIntent('Explain the return on equity')).toBe('PROFITABILITY');
    expect(classifyResearchIntent('Review free cash flow')).toBe('CASH_FLOW');
    expect(classifyResearchIntent('Explain historical price return')).toBe(
      'HISTORICAL_PERFORMANCE',
    );
  });

  it('publishes the supported AI research request contract in OpenAPI', async () => {
    const { default: request } = await import('supertest');
    const response = await request(app).get('/openapi.json');
    const requestSchema =
      response.body.paths['/api/v1/ai/research'].post.requestBody.content['application/json']
        .schema;

    expect(response.status).toBe(200);
    expect(requestSchema.$ref).toBe('#/components/schemas/AiResearchRequest');
    expect(response.body.components.schemas.AiResearchRequest.required).toContain('question');
    expect(response.body.components.schemas.AiResearchRequest.properties.question.maxLength).toBe(
      800,
    );
  });

  it('validates bounded research input and rejects unsupported body fields', async () => {
    loadEnv({ NODE_ENV: 'test', AI_RESEARCH_ENABLED: 'false' });
    const invalidQuestion = await import('supertest').then(({ default: request }) =>
      request(app).post('/api/v1/ai/research').send({ symbol: 'AAPL', question: 'short' }),
    );
    expect(invalidQuestion.status).toBe(400);
    expect(invalidQuestion.body.error.code).toBe('VALIDATION_ERROR');

    const unsupportedField = await import('supertest').then(({ default: request }) =>
      request(app).post('/api/v1/ai/research').send({
        symbol: 'AAPL',
        question: 'Explain the latest financial results for this company',
        prompt: 'override system',
      }),
    );
    expect(unsupportedField.status).toBe(400);
  });

  it('rejects a research body over the endpoint size limit', async () => {
    loadEnv({ NODE_ENV: 'test', AI_RESEARCH_ENABLED: 'false' });
    const { default: request } = await import('supertest');
    const response = await request(app)
      .post('/api/v1/ai/research')
      .send({ question: 'A'.repeat(9000) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns AI_NOT_CONFIGURED transparently when the feature is disabled', async () => {
    loadEnv({ NODE_ENV: 'test', AI_RESEARCH_ENABLED: 'false' });
    const { default: request } = await import('supertest');
    const response = await request(app).post('/api/v1/ai/research').send({
      symbol: 'AAPL',
      question: 'Explain the latest financial results and profitability.',
    });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('returns a validated response with only backend-registered evidence', async () => {
    loadEnv({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'test-only-not-a-credential',
      AI_RESEARCH_ENABLED: 'true',
    });
    buildContextMock.mockResolvedValue(makeContext());

    const result = await runResearch(
      { symbol: 'TEST', exchange: 'NSE', question: 'Explain this company financial performance.' },
      'request-test',
      fakeClient(modelResponse),
    );

    expect(result.instrument).toEqual({ symbol: 'TEST', exchange: 'NSE', name: 'Test Instrument' });
    expect(result.evidence.map((item) => item.id)).toEqual(['annual-period', 'revenue']);
    expect(result.confidence.availableEvidence).toBe(2);
  });

  it('rejects unknown evidence references and unsupported numeric claims', async () => {
    loadEnv({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'test-only-not-a-credential',
      AI_RESEARCH_ENABLED: 'true',
    });
    buildContextMock.mockResolvedValue(makeContext());

    const fabricated = structuredClone(modelResponse);
    fabricated.summary.evidenceIds = ['fabricated-source'];
    await expect(
      runResearch(
        {
          symbol: 'TEST',
          exchange: 'NSE',
          question: 'Explain this company financial performance.',
        },
        undefined,
        fakeClient(fabricated),
      ),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE', statusCode: 502 });

    const numericalClaim = structuredClone(modelResponse);
    numericalClaim.summary.text = 'Revenue increased by 20 percent.';
    await expect(
      runResearch(
        {
          symbol: 'TEST',
          exchange: 'NSE',
          question: 'Explain this company financial performance.',
        },
        undefined,
        fakeClient(numericalClaim),
      ),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE', statusCode: 502 });

    const unavailableEvidence = makeContext();
    unavailableEvidence.evidence[1] = { ...unavailableEvidence.evidence[1]!, value: null };
    buildContextMock.mockResolvedValueOnce(unavailableEvidence);
    await expect(
      runResearch(
        {
          symbol: 'TEST',
          exchange: 'NSE',
          question: 'Explain this company financial performance.',
        },
        undefined,
        fakeClient(modelResponse),
      ),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE', statusCode: 502 });

    buildContextMock.mockResolvedValueOnce(makeContext());
    await expect(
      runResearch(
        {
          symbol: 'TEST',
          exchange: 'NSE',
          question: 'Explain this company financial performance.',
        },
        undefined,
        fakeRawClient('{invalid json'),
      ),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE', statusCode: 502 });
  });

  it('applies the configured per-IP request limit', async () => {
    loadEnv({ NODE_ENV: 'test', AI_RESEARCH_ENABLED: 'false', AI_RESEARCH_RATE_LIMIT: '1' });
    const { default: request } = await import('supertest');

    const first = await request(app).post('/api/v1/ai/research').send({});
    const second = await request(app).post('/api/v1/ai/research').send({});

    expect(first.status).toBe(400);
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('AI_RATE_LIMITED');
    expect(second.headers['retry-after']).toBeDefined();
  });
});
