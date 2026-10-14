type CacheEntry<T> = {
  value: T;
  storedAt: number;
  ttlMs: number;
  staleTtlMs: number;
};

export type CacheResult<T> = {
  value: T;
  isStale: boolean;
  ageMs: number;
};

export type CacheStats = {
  size: number;
  hits: number;
  misses: number;
  staleHits: number;
};

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly defaultStaleTtlMs: number;
  private hits = 0;
  private misses = 0;
  private staleHits = 0;

  constructor(options?: { defaultTtlSeconds?: number; defaultStaleTtlSeconds?: number }) {
    this.defaultTtlMs = (options?.defaultTtlSeconds ?? 15) * 1000;
    this.defaultStaleTtlMs = (options?.defaultStaleTtlSeconds ?? 60) * 1000;
  }

  get<T>(key: string): CacheResult<T> | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses += 1;
      return null;
    }

    const ageMs = Date.now() - entry.storedAt;

    if (ageMs > entry.staleTtlMs) {
      // Completely expired beyond stale window
      this.store.delete(key);
      this.misses += 1;
      return null;
    }

    if (ageMs > entry.ttlMs) {
      // Stale hit (served as stale data with provenance flagged)
      this.staleHits += 1;
      return {
        value: entry.value,
        isStale: true,
        ageMs,
      };
    }

    // Fresh hit
    this.hits += 1;
    return {
      value: entry.value,
      isStale: false,
      ageMs,
    };
  }

  set<T>(
    key: string,
    value: T,
    options?: { ttlSeconds?: number; staleTtlSeconds?: number }
  ): void {
    const ttlMs = options?.ttlSeconds !== undefined ? options.ttlSeconds * 1000 : this.defaultTtlMs;
    const staleTtlMs =
      options?.staleTtlSeconds !== undefined
        ? options.staleTtlSeconds * 1000
        : Math.max(ttlMs, this.defaultStaleTtlMs);

    this.store.set(key, {
      value,
      storedAt: Date.now(),
      ttlMs,
      staleTtlMs,
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.staleHits = 0;
  }

  getStats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
    };
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.storedAt > entry.staleTtlMs) {
        this.store.delete(key);
        removed += 1;
      }
    }

    return removed;
  }
}

export const marketCache = new MemoryCache({
  defaultTtlSeconds: 15,
  defaultStaleTtlSeconds: 90,
});
