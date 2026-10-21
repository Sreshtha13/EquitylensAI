import { describe, expect, it } from 'vitest';
import { normalizeAngelScrips } from '../src/market/instruments/ingestion.js';

describe('instrument master normalization', () => {
  it('includes BSE equities without treating derivatives or indices as equities', () => {
    const records = normalizeAngelScrips([
      {
        token: '500325',
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        exch_seg: 'BSE',
        instrumenttype: 'EQ',
      },
      {
        token: '2885',
        symbol: 'RELIANCE-EQ',
        name: 'Reliance Industries',
        exch_seg: 'NSE',
        instrumenttype: 'EQ',
      },
      {
        token: 'derivative',
        symbol: 'RELIANCE',
        name: 'Reliance Industries Future',
        exch_seg: 'BSE',
        instrumenttype: 'FUTSTK',
      },
      {
        token: 'index',
        symbol: 'SENSEX',
        name: 'SENSEX',
        exch_seg: 'BSE',
        instrumenttype: 'AMXIDX',
      },
    ]);

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'RELIANCE',
          exchange: 'BSE',
          market: 'bse',
          assetType: 'equity',
        }),
        expect.objectContaining({
          symbol: 'RELIANCE',
          exchange: 'NSE',
          market: 'nse',
          assetType: 'equity',
        }),
      ]),
    );
    expect(records.some((record) => record.providerToken === 'derivative')).toBe(false);
    expect(records.some((record) => record.providerToken === 'index')).toBe(false);
  });
});
