import type {
  CandleInterval,
  HistoricalPrices,
  NormalizedQuote,
  PriceCandle,
} from '../../types.js';

export function normalizeYahooQuote(
  raw: {
    symbol: string;
    shortName?: string | undefined;
    longName?: string | undefined;
    currency?: string | undefined;
    exchange?: string | undefined;
    regularMarketPrice?: number | null | undefined;
    regularMarketChange?: number | null | undefined;
    regularMarketChangePercent?: number | null | undefined;
    regularMarketOpen?: number | null | undefined;
    regularMarketDayHigh?: number | null | undefined;
    regularMarketDayLow?: number | null | undefined;
    regularMarketPreviousClose?: number | null | undefined;
    regularMarketVolume?: number | null | undefined;
    regularMarketTime?: Date | string | number | null | undefined;
  },
  metadata?: {
    symbol?: string | undefined;
    name?: string | undefined;
    exchange?: string | undefined;
    market?: 'nse' | 'bse' | 'us' | undefined;
  },
): NormalizedQuote {
  const now = new Date().toISOString();
  let observedAt = now;

  if (raw.regularMarketTime) {
    try {
      observedAt = new Date(raw.regularMarketTime).toISOString();
    } catch {
      // fallback
    }
  }

  const cleanSym = (metadata?.symbol || raw.symbol).replace(/\.(NS|BO)$/i, '');
  const exchange =
    metadata?.exchange ||
    (raw.symbol.endsWith('.NS') ? 'NSE' : raw.symbol.endsWith('.BO') ? 'BSE' : 'US');
  const market =
    metadata?.market || (exchange === 'NSE' ? 'nse' : exchange === 'BSE' ? 'bse' : 'us');

  return {
    symbol: cleanSym,
    name: metadata?.name || raw.longName || raw.shortName || cleanSym,
    exchange,
    market,
    assetType: 'equity',
    currency: raw.currency || (market === 'nse' || market === 'bse' ? 'INR' : 'USD'),
    price: typeof raw.regularMarketPrice === 'number' ? raw.regularMarketPrice : null,
    change: typeof raw.regularMarketChange === 'number' ? raw.regularMarketChange : null,
    changePercent:
      typeof raw.regularMarketChangePercent === 'number' ? raw.regularMarketChangePercent : null,
    open: typeof raw.regularMarketOpen === 'number' ? raw.regularMarketOpen : null,
    high: typeof raw.regularMarketDayHigh === 'number' ? raw.regularMarketDayHigh : null,
    low: typeof raw.regularMarketDayLow === 'number' ? raw.regularMarketDayLow : null,
    previousClose:
      typeof raw.regularMarketPreviousClose === 'number' ? raw.regularMarketPreviousClose : null,
    volume: typeof raw.regularMarketVolume === 'number' ? raw.regularMarketVolume : null,
    source: 'yahoo',
    observedAt,
    retrievedAt: now,
    freshness: 'delayed', // Yahoo free endpoints are explicitly delayed
    isStale: false,
  };
}

export function normalizeYahooChart(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  fromDate: string,
  toDate: string,
  quotes: Array<{
    date: Date | string;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    close?: number | null;
    adjclose?: number | null;
    volume?: number | null;
  }>,
): HistoricalPrices {
  const now = new Date().toISOString();

  const candles: PriceCandle[] = quotes
    .filter((q) => {
      if (typeof q.close !== 'number' || !Number.isFinite(q.close) || q.close <= 0) {
        return false;
      }
      const time = new Date(q.date).getTime();
      return !Number.isNaN(time);
    })
    .map((q) => {
      const close = q.close as number;
      const open = typeof q.open === 'number' && Number.isFinite(q.open) && q.open > 0 ? q.open : close;
      const high = typeof q.high === 'number' && Number.isFinite(q.high) && q.high > 0 ? Math.max(q.high, open, close) : Math.max(open, close);
      const low = typeof q.low === 'number' && Number.isFinite(q.low) && q.low > 0 ? Math.min(q.low, open, close) : Math.min(open, close);

      return {
        timestamp: new Date(q.date).toISOString(),
        open,
        high,
        low,
        close,
        volume: typeof q.volume === 'number' && Number.isFinite(q.volume) && q.volume >= 0 ? Math.floor(q.volume) : null,
        adjustedClose: typeof q.adjclose === 'number' && Number.isFinite(q.adjclose) && q.adjclose > 0 ? q.adjclose : null,
      };
    });

  return {
    symbol,
    exchange,
    interval,
    fromDate,
    toDate,
    candles,
    source: 'yahoo',
    retrievedAt: now,
  };
}
