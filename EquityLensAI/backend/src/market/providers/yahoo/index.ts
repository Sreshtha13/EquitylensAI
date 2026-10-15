import type {
  CandleInterval,
  HistoricalPrices,
  HistoricalRequest,
  IndexSnapshot,
  MarketProvider,
  NormalizedQuote,
  QuoteRequest,
} from '../../types.js';
import { yf } from './client.js';
import { normalizeYahooChart, normalizeYahooQuote } from './normalizer.js';
import { instrumentRepository } from '../../instruments/repository.js';
import { AppError } from '../../../utils/appError.js';
import { logger } from '../../../utils/logger.js';

type YahooChartInterval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';

const YAHOO_INTERVAL_MAP: Record<CandleInterval, YahooChartInterval> = {
  ONE_MINUTE: '1m',
  THREE_MINUTE: '5m', // Yahoo doesn't support 3m, approximate to 5m
  FIVE_MINUTE: '5m',
  TEN_MINUTE: '15m',  // Yahoo doesn't support 10m
  FIFTEEN_MINUTE: '15m',
  THIRTY_MINUTE: '30m',
  ONE_HOUR: '1h',
  ONE_DAY: '1d',
};

export class YahooProvider implements MarketProvider {
  readonly id = 'yahoo';
  readonly name = 'Yahoo Finance';

  isConfigured(): boolean {
    return true; // Public, unauthenticated
  }

  private resolveYahooSymbol(symbol: string, exchange?: string): string {
    const clean = symbol.trim().toUpperCase();

    // If already has suffix or is an index
    if (clean.endsWith('.NS') || clean.endsWith('.BO') || clean.startsWith('^')) {
      return clean;
    }

    const instrument = instrumentRepository.getBySymbol(clean, exchange);
    if (instrument) {
      if (instrument.exchange === 'NSE' || instrument.market === 'nse') {
        return `${instrument.symbol}.NS`;
      }
      if (instrument.exchange === 'BSE' || instrument.market === 'bse') {
        return `${instrument.symbol}.BO`;
      }
      return instrument.symbol;
    }

    if (exchange?.toUpperCase() === 'NSE') {
      return `${clean}.NS`;
    }
    if (exchange?.toUpperCase() === 'BSE') {
      return `${clean}.BO`;
    }

    // Default: for Indian tickers without exchange specified, try NSE
    return `${clean}.NS`;
  }

  async getQuote(request: QuoteRequest): Promise<NormalizedQuote> {
    const ySymbol = this.resolveYahooSymbol(request.symbol, request.exchange);

    try {
      const raw = await yf.quote(ySymbol);
      if (!raw || (!raw.regularMarketPrice && raw.regularMarketPrice !== 0)) {
        throw new AppError('QUOTE_NOT_FOUND', `No quote available from Yahoo for ${ySymbol}`, 404);
      }

      const cleanSym = request.symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
      const instrument = instrumentRepository.getBySymbol(cleanSym, request.exchange);

      const quoteObj = raw as Record<string, unknown>;
      return normalizeYahooQuote(
        {
          symbol: (quoteObj['symbol'] as string) || ySymbol,
          shortName: quoteObj['shortName'] as string | undefined,
          longName: quoteObj['longName'] as string | undefined,
          currency: quoteObj['currency'] as string | undefined,
          exchange: quoteObj['exchange'] as string | undefined,
          regularMarketPrice: typeof quoteObj['regularMarketPrice'] === 'number' ? quoteObj['regularMarketPrice'] : null,
          regularMarketChange: typeof quoteObj['regularMarketChange'] === 'number' ? quoteObj['regularMarketChange'] : null,
          regularMarketChangePercent: typeof quoteObj['regularMarketChangePercent'] === 'number' ? quoteObj['regularMarketChangePercent'] : null,
          regularMarketOpen: typeof quoteObj['regularMarketOpen'] === 'number' ? quoteObj['regularMarketOpen'] : null,
          regularMarketDayHigh: typeof quoteObj['regularMarketDayHigh'] === 'number' ? quoteObj['regularMarketDayHigh'] : null,
          regularMarketDayLow: typeof quoteObj['regularMarketDayLow'] === 'number' ? quoteObj['regularMarketDayLow'] : null,
          regularMarketPreviousClose: typeof quoteObj['regularMarketPreviousClose'] === 'number' ? quoteObj['regularMarketPreviousClose'] : null,
          regularMarketVolume: typeof quoteObj['regularMarketVolume'] === 'number' ? quoteObj['regularMarketVolume'] : null,
          regularMarketTime: quoteObj['regularMarketTime'] as Date | string | number | null,
        },
        {
          symbol: cleanSym,
          name: instrument?.name || (quoteObj['shortName'] as string) || (quoteObj['longName'] as string) || cleanSym,
          exchange: request.exchange || (ySymbol.endsWith('.NS') ? 'NSE' : 'US'),
        }
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn({ err, symbol: ySymbol }, 'Yahoo quote error');
      throw new AppError(
        'YAHOO_QUOTE_FAILED',
        `Failed to retrieve quote for ${request.symbol} from Yahoo Finance`,
        502
      );
    }
  }

  async getHistoricalPrices(request: HistoricalRequest): Promise<HistoricalPrices> {
    const ySymbol = this.resolveYahooSymbol(request.symbol, request.exchange);
    const interval = YAHOO_INTERVAL_MAP[request.interval] || '1d';

    try {
      const chartResult = await yf.chart(ySymbol, {
        period1: request.from,
        period2: request.to,
        interval,
      });

      const quotes = chartResult.quotes || [];
      const cleanSym = request.symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

      return normalizeYahooChart(
        cleanSym,
        request.exchange || (ySymbol.endsWith('.NS') ? 'NSE' : 'US'),
        request.interval,
        request.from,
        request.to,
        quotes
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn({ err, symbol: ySymbol }, 'Yahoo chart error');
      throw new AppError(
        'YAHOO_HISTORICAL_FAILED',
        `Failed to retrieve historical data for ${request.symbol} from Yahoo Finance`,
        502
      );
    }
  }

  async getIndices(symbols?: string[]): Promise<IndexSnapshot[]> {
    const targetIndices = [
      { yahooSymbol: '^NSEI', displaySymbol: 'NIFTY', name: 'NIFTY 50' },
      { yahooSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY', name: 'NIFTY Bank' },
      { yahooSymbol: '^BSESN', displaySymbol: 'SENSEX', name: 'BSE SENSEX' },
      { yahooSymbol: '^GSPC', displaySymbol: 'SP500', name: 'S&P 500' },
    ];

    const indicesToFetch = symbols
      ? targetIndices.filter((i) => symbols.includes(i.displaySymbol))
      : targetIndices;

    const results: IndexSnapshot[] = [];

    for (const item of indicesToFetch) {
      try {
        const q = await yf.quote(item.yahooSymbol);
        if (q && typeof q.regularMarketPrice === 'number') {
          results.push({
            name: item.name,
            symbol: item.displaySymbol,
            value: q.regularMarketPrice,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            source: 'yahoo',
            observedAt: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : new Date().toISOString(),
          });
        }
      } catch {
        // Continue to other indices
      }
    }

    return results;
  }
}

export const yahooProvider = new YahooProvider();
