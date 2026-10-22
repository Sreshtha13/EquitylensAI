import type {
  NormalizedQuote,
  PriceCandle,
  HistoricalPrices,
  CandleInterval,
} from '../../types.js';
import type { AngelQuoteItem } from './client.js';

/**
 * Parses Angel One format date string e.g. "14-Oct-2026 16:08:11" into ISO 8601 string.
 */
export function parseAngelTimestamp(timestampStr?: string): string {
  if (!timestampStr) return new Date().toISOString();
  try {
    const parsed = new Date(timestampStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // fallback
  }
  return new Date().toISOString();
}

export function normalizeAngelQuote(
  item: AngelQuoteItem,
  metadata?: { symbol?: string; name?: string },
): NormalizedQuote {
  const cleanSymbol = (metadata?.symbol || item.tradingSymbol).replace(/-EQ$/, '');
  const now = new Date().toISOString();
  const observedAt = parseAngelTimestamp(item.exchFeedTime);

  return {
    symbol: cleanSymbol,
    name: metadata?.name || cleanSymbol,
    exchange: item.exchange,
    market: 'nse',
    assetType: 'equity',
    currency: 'INR',
    price: typeof item.ltp === 'number' ? item.ltp : null,
    change: typeof item.netChange === 'number' ? item.netChange : null,
    changePercent: typeof item.percentChange === 'number' ? item.percentChange : null,
    open: typeof item.open === 'number' && item.open > 0 ? item.open : null,
    high: typeof item.high === 'number' && item.high > 0 ? item.high : null,
    low: typeof item.low === 'number' && item.low > 0 ? item.low : null,
    previousClose: typeof item.close === 'number' && item.close > 0 ? item.close : null,
    volume: typeof item.tradeVolume === 'number' ? item.tradeVolume : null,
    source: 'angel',
    observedAt,
    retrievedAt: now,
    freshness: 'live',
    isStale: false,
  };
}

export function normalizeAngelCandles(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  fromDate: string,
  toDate: string,
  rawCandles: [string, number, number, number, number, number][],
): HistoricalPrices {
  const now = new Date().toISOString();

  const candles: PriceCandle[] = rawCandles.map((c) => ({
    timestamp: typeof c[0] === 'string' ? new Date(c[0]).toISOString() : now,
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: typeof c[5] === 'number' ? c[5] : null,
    adjustedClose: null,
  }));

  return {
    symbol,
    exchange,
    interval,
    fromDate,
    toDate,
    candles,
    source: 'angel',
    retrievedAt: now,
  };
}
