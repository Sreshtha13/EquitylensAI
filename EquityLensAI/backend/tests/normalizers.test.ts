import { describe, expect, it } from 'vitest';
import {
  normalizeAngelQuote,
  normalizeAngelCandles,
  parseAngelTimestamp,
} from '../src/market/providers/angel/normalizer.js';
import {
  normalizeYahooQuote,
  normalizeYahooChart,
} from '../src/market/providers/yahoo/normalizer.js';

describe('Market Normalizers', () => {
  describe('Angel Normalizer', () => {
    it('normalizes Angel quote with explicit live provenance', () => {
      const raw = {
        exchange: 'NSE',
        tradingSymbol: 'RELIANCE-EQ',
        symbolToken: '2885',
        ltp: 1174.6,
        open: 1167,
        high: 1188,
        low: 1162.7,
        close: 1166.7,
        netChange: 7.9,
        percentChange: 0.68,
        tradeVolume: 10938195,
        exchFeedTime: '14-Oct-2026 16:08:11',
      };

      const normalized = normalizeAngelQuote(raw);
      expect(normalized.symbol).toBe('RELIANCE');
      expect(normalized.price).toBe(1174.6);
      expect(normalized.change).toBe(7.9);
      expect(normalized.changePercent).toBe(0.68);
      expect(normalized.open).toBe(1167);
      expect(normalized.high).toBe(1188);
      expect(normalized.low).toBe(1162.7);
      expect(normalized.previousClose).toBe(1166.7);
      expect(normalized.volume).toBe(10938195);
      expect(normalized.source).toBe('angel');
      expect(normalized.freshness).toBe('live');
      expect(normalized.isStale).toBe(false);
      expect(normalized.retrievedAt).toBeDefined();
    });

    it('does not convert unavailable data to zero', () => {
      const raw = {
        exchange: 'NSE',
        tradingSymbol: 'INDEX-EQ',
        symbolToken: '999',
        ltp: 100,
        open: 0, // 0 is unavailable open
        high: 0,
        low: 0,
        close: 0,
        netChange: 1.5,
        percentChange: 1.5,
      };

      const normalized = normalizeAngelQuote(raw);
      expect(normalized.open).toBeNull();
      expect(normalized.high).toBeNull();
      expect(normalized.low).toBeNull();
      expect(normalized.previousClose).toBeNull();
      expect(normalized.volume).toBeNull();
    });

    it('parses Angel timestamp string or falls back to valid ISO', () => {
      const parsed = parseAngelTimestamp('14-Oct-2026 16:08:11');
      expect(parsed).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('normalizes Angel candles into PriceCandle array', () => {
      const rawCandles: [string, number, number, number, number, number][] = [
        ['2026-10-05T00:00:00+05:30', 1171.2, 1193, 1171.2, 1186.4, 14254907],
      ];

      const res = normalizeAngelCandles(
        'RELIANCE',
        'NSE',
        'ONE_DAY',
        '2026-10-01',
        '2026-10-14',
        rawCandles,
      );
      expect(res.symbol).toBe('RELIANCE');
      expect(res.source).toBe('angel');
      expect(res.candles).toHaveLength(1);
      expect(res.candles[0]?.open).toBe(1171.2);
      expect(res.candles[0]?.volume).toBe(14254907);
    });
  });

  describe('Yahoo Normalizer', () => {
    it('normalizes Yahoo quote with explicit delayed provenance', () => {
      const raw = {
        symbol: 'RELIANCE.NS',
        shortName: 'RELIANCE IND',
        currency: 'INR',
        regularMarketPrice: 1174.6,
        regularMarketChange: 7.9,
        regularMarketChangePercent: 0.67,
        regularMarketOpen: 1167.0,
        regularMarketDayHigh: 1188.0,
        regularMarketDayLow: 1162.7,
        regularMarketPreviousClose: 1166.7,
        regularMarketVolume: 1000000,
        regularMarketTime: new Date('2026-10-14T10:00:00Z'),
      };

      const normalized = normalizeYahooQuote(raw);
      expect(normalized.symbol).toBe('RELIANCE');
      expect(normalized.source).toBe('yahoo');
      expect(normalized.freshness).toBe('delayed');
      expect(normalized.isStale).toBe(false);
      expect(normalized.price).toBe(1174.6);
      expect(normalized.exchange).toBe('NSE');
      expect(normalized.currency).toBe('INR');
    });

    it('normalizes Yahoo chart candles', () => {
      const rawQuotes = [
        {
          date: new Date('2026-10-01T00:00:00Z'),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          adjclose: 105,
          volume: 50000,
        },
      ];

      const chart = normalizeYahooChart(
        'AAPL',
        'NASDAQ',
        'ONE_DAY',
        '2026-10-01',
        '2026-10-02',
        rawQuotes,
      );
      expect(chart.symbol).toBe('AAPL');
      expect(chart.source).toBe('yahoo');
      expect(chart.candles).toHaveLength(1);
      expect(chart.candles[0]?.close).toBe(105);
      expect(chart.candles[0]?.adjustedClose).toBe(105);
    });
  });
});
