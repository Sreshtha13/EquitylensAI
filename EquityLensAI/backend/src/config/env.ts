import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: path.join(backendRoot, '.env') });

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const booleanStringToBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '') {
      return false;
    }

    if (['true', '1', 'yes', 'on'].includes(trimmed)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(trimmed)) {
      return false;
    }
  }

  return value;
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GEMINI_MODEL: z.string().min(1).max(100).default('gemini-3.5-flash'),
    GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(30000),
    GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(4096).default(1024),
    GEMINI_MAX_RETRIES: z.coerce.number().int().nonnegative().max(5).default(2),
    AI_RESEARCH_ENABLED: z.preprocess(booleanStringToBoolean, z.boolean()).default(false),
    AI_RESEARCH_RATE_LIMIT: z.coerce.number().int().positive().max(100).default(5),
    ANGEL_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    ANGEL_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    ANGEL_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    ANGEL_TOTP_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .superRefine((env, context) => {
    if (env.AI_RESEARCH_ENABLED && !env.GEMINI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when AI_RESEARCH_ENABLED is true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const envSchemaForTests = envSchema;
