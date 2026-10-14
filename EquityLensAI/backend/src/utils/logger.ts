import pino from 'pino';
import { getEnv } from '../config/index.js';

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|service[_-]?role|jwt|credential)/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item !== null && typeof item === 'object'
        ? redactObject(item as Record<string, unknown>)
        : item,
    );
  }

  if (value !== null && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = redactValue(key, value);
  }

  return output;
}

function createLogger() {
  const env = getEnv();
  const pretty = env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test';

  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: { service: 'equitylensai-api' },
    redact: {
      paths: [
        'password',
        'secret',
        'token',
        '*.password',
        '*.secret',
        '*.token',
        '*.apiKey',
        '*.api_key',
        'ANGEL_PASSWORD',
        'ANGEL_TOTP_SECRET',
        'ANGEL_API_KEY',
        'GEMINI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ],
      censor: '[REDACTED]',
    },
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }
      : {}),
  });
}

export const logger = createLogger();

export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  metadata: Record<string, unknown> = {},
): void {
  logger[level](redactObject(metadata), message);
}
