const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function sanitizePlainObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePlainObject(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        continue;
      }

      result[key] = sanitizePlainObject(nested);
    }

    return result;
  }

  return value;
}
