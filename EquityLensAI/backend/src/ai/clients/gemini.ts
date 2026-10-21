import { GoogleGenAI } from '@google/genai';
import { getEnv } from '../../config/index.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import type { AiClient, AiGenerateInput, AiGenerateOutput } from '../common/types.js';

let clientInstance: GoogleGenAI | undefined;
let clientApiKey: string | undefined;

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!clientInstance || clientApiKey !== apiKey) {
    clientInstance = new GoogleGenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return clientInstance;
}

function getProviderStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidates: unknown[] = [
    'status' in error ? error.status : undefined,
    'statusCode' in error ? error.statusCode : undefined,
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response
      ? error.response.status
      : undefined,
  ];

  for (const status of candidates) {
    if (typeof status === 'number' && Number.isInteger(status)) {
      return status;
    }
    if (typeof status === 'string' && /^\d+$/.test(status)) {
      return Number(status);
    }
  }

  return undefined;
}

function getSafeErrorName(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 80) : 'UnknownError';
}

function isRetryable(error: unknown): boolean {
  const status = getProviderStatus(error);
  return status === undefined || status >= 500;
}

function pause(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export class GeminiClient implements AiClient {
  readonly id = 'gemini';

  async generate(input: AiGenerateInput): Promise<AiGenerateOutput> {
    const env = getEnv();

    if (!env.GEMINI_API_KEY || !env.AI_RESEARCH_ENABLED) {
      throw new AppError(
        'AI_NOT_CONFIGURED',
        'AI research is disabled. Configure GEMINI_API_KEY and set AI_RESEARCH_ENABLED=true.',
        503,
      );
    }

    const client = getGeminiClient(env.GEMINI_API_KEY);
    const startedAt = Date.now();
    const attempts = env.GEMINI_MAX_RETRIES + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await client.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: input.prompt,
          config: {
            systemInstruction: input.systemInstruction,
            maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseJsonSchema: input.responseJsonSchema,
            abortSignal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
            httpOptions: {
              timeout: env.GEMINI_TIMEOUT_MS,
              retryOptions: { attempts: 1 },
            },
          },
        });

        const text = response.text;
        if (!text?.trim()) {
          throw new AppError('AI_INVALID_RESPONSE', 'Gemini returned an empty response.', 502);
        }

        logger.info(
          {
            requestId: input.requestId,
            instrument: input.instrument,
            intent: input.intent,
            model: env.GEMINI_MODEL,
            durationMs: Date.now() - startedAt,
            attempts: attempt,
            inputTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount,
          },
          'ai_provider_request_completed',
        );

        return {
          text,
          model: env.GEMINI_MODEL,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
        };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        const status = getProviderStatus(error);
        const errorName = getSafeErrorName(error);

        if (status === 429) {
          throw new AppError(
            'AI_RATE_LIMITED',
            'The AI provider is temporarily rate limited.',
            429,
          );
        }

        if (status === 401 || status === 403) {
          throw new AppError(
            'AI_NOT_CONFIGURED',
            'The configured AI provider credentials were rejected.',
            503,
          );
        }

        if (status === 404) {
          throw new AppError(
            'AI_MODEL_UNAVAILABLE',
            `Gemini model "${env.GEMINI_MODEL}" is unavailable to this API key. Configure a model enabled for your Gemini API project.`,
            503,
          );
        }

        if (status === 400) {
          logger.error(
            {
              requestId: input.requestId,
              instrument: input.instrument,
              intent: input.intent,
              model: env.GEMINI_MODEL,
              durationMs: Date.now() - startedAt,
              attempts: attempt,
              errorName,
              status,
            },
            'ai_provider_request_rejected',
          );
          throw new AppError(
            'AI_REQUEST_INVALID',
            'Gemini rejected the model request. Check the configured model and structured-output schema.',
            502,
          );
        }

        if (errorName === 'TimeoutError' || errorName === 'AbortError') {
          logger.error(
            {
              requestId: input.requestId,
              instrument: input.instrument,
              intent: input.intent,
              model: env.GEMINI_MODEL,
              durationMs: Date.now() - startedAt,
              attempts: attempt,
              errorName,
              status,
            },
            'ai_provider_request_timed_out',
          );
          throw new AppError('AI_TIMEOUT', 'The AI provider request timed out.', 504);
        }

        if (attempt < attempts && isRetryable(error)) {
          logger.warn(
            {
              requestId: input.requestId,
              instrument: input.instrument,
              intent: input.intent,
              model: env.GEMINI_MODEL,
              attempt,
              errorName,
              status,
            },
            'ai_provider_retry',
          );
          await pause(Math.min(250 * 2 ** (attempt - 1), 2000));
          continue;
        }

        logger.error(
          {
            requestId: input.requestId,
            instrument: input.instrument,
            intent: input.intent,
            model: env.GEMINI_MODEL,
            durationMs: Date.now() - startedAt,
            attempts: attempt,
            errorName,
            status,
          },
          'ai_provider_request_failed',
        );

        if (status !== undefined && status >= 500) {
          throw new AppError(
            'AI_PROVIDER_UNAVAILABLE',
            `Gemini is temporarily unavailable (HTTP ${status}) after retries. Please try again shortly.`,
            503,
          );
        }

        throw new AppError(
          'AI_PROVIDER_UNAVAILABLE',
          'The AI provider could not complete the research request.',
          502,
        );
      }
    }

    throw new AppError(
      'AI_PROVIDER_UNAVAILABLE',
      'The AI provider could not complete the research request.',
      502,
    );
  }
}
