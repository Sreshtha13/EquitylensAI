import { describe, expect, it } from 'vitest';
import { InstrumentRepository } from '../src/market/instruments/repository.js';

describe('InstrumentRepository', () => {
  it('initializes with seed instruments', () => {
    const repo = new InstrumentRepository();
    expect(repo.count()).toBeGreaterThan(5);

    const reliance = repo.getBySymbol('RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance?.symbol).toBe('RELIANCE');
    expect(reliance?.exchange).toBe('NSE');
    expect(reliance?.providerToken).toBe('2885');
  });

  it('resolves symbols with various formats (.NS, -EQ, case-insensitive)', () => {
    const repo = new InstrumentRepository();

    expect(repo.getBySymbol('reliance')?.symbol).toBe('RELIANCE');
    expect(repo.getBySymbol('RELIANCE.NS')?.symbol).toBe('RELIANCE');
    expect(repo.getBySymbol('RELIANCE-EQ')?.symbol).toBe('RELIANCE');
    expect(repo.getBySymbol('tcs.ns')?.symbol).toBe('TCS');
  });

  it('ranks search results by relevance', () => {
    const repo = new InstrumentRepository();

    // Searching 'REL' should find RELIANCE
    const results = repo.search('REL');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.symbol).toBe('RELIANCE');
  });

  it('filters search results by market and assetType', () => {
    const repo = new InstrumentRepository();

    const nseEquities = repo.search('A', { market: 'nse', assetType: 'equity' });
    for (const item of nseEquities) {
      expect(item.market).toBe('nse');
      expect(item.assetType).toBe('equity');
    }

    const usEquities = repo.search('AAPL', { market: 'us' });
    expect(usEquities.length).toBe(1);
    expect(usEquities[0]?.symbol).toBe('AAPL');
    expect(usEquities[0]?.currency).toBe('USD');
  });
});
