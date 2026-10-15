import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/market/cache/memoryCache.js';

describe('MemoryCache', () => {
  it('stores and retrieves fresh cached values', () => {
    const cache = new MemoryCache({ defaultTtlSeconds: 10, defaultStaleTtlSeconds: 30 });
    cache.set('key1', { price: 100 });

    const result = cache.get<{ price: number }>('key1');
    expect(result).not.toBeNull();
    expect(result?.isStale).toBe(false);
    expect(result?.value.price).toBe(100);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);
  });

  it('detects stale entries within stale window', async () => {
    // 50ms TTL, 200ms stale TTL
    const cache = new MemoryCache();
    cache.set('staleKey', 'testValue', { ttlSeconds: 0.05, staleTtlSeconds: 0.2 });

    // Wait past fresh TTL
    await new Promise((r) => setTimeout(r, 70));

    const result = cache.get<string>('staleKey');
    expect(result).not.toBeNull();
    expect(result?.isStale).toBe(true);
    expect(result?.value).toBe('testValue');
  });

  it('evicts entries older than stale TTL', async () => {
    const cache = new MemoryCache();
    cache.set('expiredKey', 'expiredValue', { ttlSeconds: 0.02, staleTtlSeconds: 0.05 });

    // Wait past stale TTL
    await new Promise((r) => setTimeout(r, 70));

    const result = cache.get<string>('expiredKey');
    expect(result).toBeNull();

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
  });

  it('cleans up and deletes entries properly', () => {
    const cache = new MemoryCache();
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');

    expect(cache.getStats().size).toBe(2);
    cache.delete('k1');
    expect(cache.get('k1')).toBeNull();
    expect(cache.getStats().size).toBe(1);

    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });
});
