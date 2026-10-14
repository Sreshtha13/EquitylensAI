import { parseEnv, type Env } from './env.js';

let cached: Env | undefined;

export function loadEnv(source?: NodeJS.ProcessEnv): Env {
  cached = parseEnv(source);
  return cached;
}

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv();
  }

  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
