import { describe, expect, it } from 'vitest';
import { envSchemaForTests } from '../src/config/env.js';

describe('environment validation', () => {
  it('accepts Phase 1 required variables and ignores empty optional integrations', () => {
    const parsed = envSchemaForTests.parse({
      NODE_ENV: 'development',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'debug',
      SUPABASE_URL: '',
      GEMINI_API_KEY: '',
    });

    expect(parsed.PORT).toBe(4000);
    expect(parsed.SUPABASE_URL).toBeUndefined();
    expect(parsed.GEMINI_API_KEY).toBeUndefined();
  });

  it('rejects an invalid frontend origin', () => {
    const result = envSchemaForTests.safeParse({
      FRONTEND_URL: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });
});
