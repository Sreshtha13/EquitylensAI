import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    readonly models = { generateContent: generateContentMock };
  },
}));

import { GeminiClient } from '../src/ai/clients/gemini.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';

const input = {
  prompt: '{"task":"test"}',
  systemInstruction: 'Use supplied test context only.',
  responseJsonSchema: { type: 'OBJECT' },
};

beforeEach(() => {
  loadEnv({
    NODE_ENV: 'test',
    GEMINI_API_KEY: 'test-only-not-a-credential',
    GEMINI_MODEL: 'gemini-3.8-flash',
    GEMINI_MAX_RETRIES: '1',
    GEMINI_TIMEOUT_MS: '30000',
    AI_RESEARCH_ENABLED: 'true',
  });
  generateContentMock.mockReset();
});

afterEach(() => resetEnvCache());

describe('GeminiClient', () => {
  it('does not call the provider when AI is disabled', async () => {
    loadEnv({ NODE_ENV: 'test', AI_RESEARCH_ENABLED: 'false' });

    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
      statusCode: 503,
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('uses structured JSON generation and retries transient provider failures once', async () => {
    generateContentMock
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { status: 503 }))
      .mockResolvedValueOnce({
        text: '{"ok":true}',
        usageMetadata: { promptTokenCount: 24, candidatesTokenCount: 6 },
      });

    const result = await new GeminiClient().generate(input);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(generateContentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: 'gemini-3.8-flash',
        config: expect.objectContaining({
          responseMimeType: 'application/json',
          responseJsonSchema: input.responseJsonSchema,
        }),
      }),
    );
    expect(result).toMatchObject({
      text: '{"ok":true}',
      model: 'gemini-3.8-flash',
      inputTokens: 24,
      outputTokens: 6,
    });
  });

  it('does not retry authentication or rate-limit failures', async () => {
    generateContentMock.mockRejectedValue(
      Object.assign(new Error('provider failure'), { status: 429 }),
    );

    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
      statusCode: 429,
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);

    generateContentMock.mockRejectedValue(
      Object.assign(new Error('provider failure'), { status: 403 }),
    );
    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
      statusCode: 503,
    });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('reports unavailable models explicitly without retrying', async () => {
    generateContentMock.mockRejectedValue(
      Object.assign(new Error('model unavailable'), { status: 404 }),
    );

    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_MODEL_UNAVAILABLE',
      statusCode: 503,
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('maps provider timeouts and empty output without returning success-shaped data', async () => {
    generateContentMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
    );
    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
      statusCode: 504,
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);

    generateContentMock.mockResolvedValueOnce({ text: '   ' });
    await expect(new GeminiClient().generate(input)).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      statusCode: 502,
    });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
