import { describe, expect, it } from 'vitest';
import { normalizeYahooChart, normalizeYahooQuote } from '../src/market/providers/yahoo/normalizer.js';

describe('Data Quality & Provenance Validation', () => {
  it('rejects invalid or non-positive candles and avoids fabricating zero-price candles', () => {
    const rawQuotes = [
      { date: '2026-10-20T09:15:00Z', open: 100, high: 105, low: 98, close: 102, volume: 5000 },
      { date: '2026-10-21T09:15:00Z', open: 0, high: 0, low: 0, close: 0, volume: 0 }, // Invalid zero close
      { date: '2026-10-22T09:15:00Z', open: null, high: null, low: null, close: null, volume: null }, // Null candle
      { date: '2026-10-23T09:15:00Z', open: -50, high: -10, low: -60, close: -20, volume: 100 }, // Negative price
      { date: '2026-10-24T09:15:00Z', open: null, high: null, low: null, close: 110, volume: 2000 }, // Missing OH, should bound to close
      { date: 'invalid-date', open: 100, high: 105, low: 98, close: 102, volume: 5000 }, // Invalid timestamp
    ];

    const result = normalizeYahooChart('TCS', 'NSE', 'ONE_DAY', '2026-10-20', '2026-10-24', rawQuotes);

    // Only 2 valid candles should be preserved
    expect(result.candles.length).toBe(2);

    expect(result.candles[0]).toMatchObject({
      timestamp: '2026-10-20T09:15:00.000Z',
      open: 100,
      high: 105,
      low: 98,
      close: 102,
      volume: 5000,
    });

    // The second candle had null open/high/low; must bound to close=110, never zero
    expect(result.candles[1]).toMatchObject({
      timestamp: '2026-10-24T09:15:00.000Z',
      open: 110,
      high: 110,
      low: 110,
      close: 110,
      volume: 2000,
    });
    expect(result.candles[1]?.open).toBeGreaterThan(0);
  });

  it('preserves provenance metadata and flags delayed freshness for Yahoo free quotes', () => {
    const rawQuote = {
      symbol: 'RELIANCE.NS',
      shortName: 'Reliance Industries',
      regularMarketPrice: 2450.5,
      regularMarketChange: 15.2,
      regularMarketChangePercent: 0.62,
      regularMarketTime: '2026-10-28T10:00:00Z',
    };

    const quote = normalizeYahooQuote(rawQuote, {
      symbol: 'RELIANCE',
      exchange: 'NSE',
      market: 'nse',
    });

    expect(quote.symbol).toBe('RELIANCE');
    expect(quote.exchange).toBe('NSE');
    expect(quote.source).toBe('yahoo');
    expect(quote.freshness).toBe('delayed');
    expect(quote.isStale).toBe(false);
    expect(quote.price).toBe(2450.5);
    expect(quote.currency).toBe('INR');
  });
});
