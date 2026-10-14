import type {
  CandleInterval,
  HistoricalPrices,
  HistoricalRequest,
  IndexSnapshot,
  MarketProvider,
  NormalizedQuote,
  QuoteRequest,
} from '../../types.js';
import { angelClient } from './client.js';
import { normalizeAngelCandles, normalizeAngelQuote } from './normalizer.js';
import { instrumentRepository } from '../../instruments/repository.js';
import { AppError } from '../../../utils/appError.js';

const ANGEL_INTERVAL_MAP: Record<CandleInterval, string> = {
  ONE_MINUTE: 'ONE_MINUTE',
  THREE_MINUTE: 'THREE_MINUTE',
  FIVE_MINUTE: 'FIVE_MINUTE',
  TEN_MINUTE: 'TEN_MINUTE',
  FIFTEEN_MINUTE: 'FIFTEEN_MINUTE',
  THIRTY_MINUTE: 'THIRTY_MINUTE',
  ONE_HOUR: 'ONE_HOUR',
  ONE_DAY: 'ONE_DAY',
};

export class AngelProvider implements MarketProvider {
  readonly id = 'angel';
  readonly name = 'Angel One SmartAPI';

  isConfigured(): boolean {
    return angelClient.isConfigured();
  }

  async getQuote(request: QuoteRequest): Promise<NormalizedQuote> {
    if (!this.isConfigured()) {
      throw new AppError(
        'PROVIDER_UNAVAILABLE',
        'Angel One SmartAPI credentials are not configured',
        503
      );
    }

    let token = request.token;
    let exchange = request.exchange || 'NSE';
    const cleanSym = request.symbol.replace(/-EQ$/, '').toUpperCase();

    if (!token) {
      const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
      if (instrument?.providerToken) {
        token = instrument.providerToken;
        exchange = instrument.exchange || exchange;
      }
    }

    if (!token) {
      throw new AppError(
        'INSTRUMENT_TOKEN_NOT_FOUND',
        `No Angel One token found for symbol ${request.symbol}. Ingest scrip master first.`,
        404
      );
    }

    const quotes = await angelClient.getQuotes(exchange, [token]);
    const quoteItem = quotes.find((q) => q.symbolToken === token) || quotes[0];

    if (!quoteItem) {
      throw new AppError(
        'QUOTE_NOT_FOUND',
        `No quote data returned from Angel One for token ${token}`,
        404
      );
    }

    const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
    return normalizeAngelQuote(quoteItem, {
      symbol: cleanSym,
      name: instrument?.name || cleanSym,
    });
  }

  async getHistoricalPrices(request: HistoricalRequest): Promise<HistoricalPrices> {
    if (!this.isConfigured()) {
      throw new AppError(
        'PROVIDER_UNAVAILABLE',
        'Angel One SmartAPI credentials are not configured',
        503
      );
    }

    let token = request.token;
    let exchange = request.exchange || 'NSE';
    const cleanSym = request.symbol.replace(/-EQ$/, '').toUpperCase();

    if (!token) {
      const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
      if (instrument?.providerToken) {
        token = instrument.providerToken;
        exchange = instrument.exchange || exchange;
      }
    }

    if (!token) {
      throw new AppError(
        'INSTRUMENT_TOKEN_NOT_FOUND',
        `No Angel One token found for symbol ${request.symbol}. Ingest scrip master first.`,
        404
      );
    }

    const intervalStr = ANGEL_INTERVAL_MAP[request.interval] || 'ONE_DAY';

    // Format dates to "YYYY-MM-DD HH:mm" if ISO string passed
    const formatAngelDate = (dStr: string, isEnd = false): string => {
      try {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const time = isEnd ? '15:30' : '09:15';
          return `${yr}-${mo}-${day} ${time}`;
        }
      } catch {
        // use as-is
      }
      return dStr;
    };

    const fromDate = formatAngelDate(request.from, false);
    const toDate = formatAngelDate(request.to, true);

    const rawCandles = await angelClient.getCandles({
      exchange,
      token,
      interval: intervalStr,
      fromDate,
      toDate,
    });

    return normalizeAngelCandles(cleanSym, exchange, request.interval, fromDate, toDate, rawCandles);
  }

  async getIndices(symbols?: string[]): Promise<IndexSnapshot[]> {
    if (!this.isConfigured()) return [];

    const indexTokens = [
      { name: 'NIFTY 50', symbol: 'NIFTY', token: '99926000', exchange: 'NSE' },
      { name: 'NIFTY BANK', symbol: 'BANKNIFTY', token: '99926009', exchange: 'NSE' },
    ];

    const tokensToFetch = symbols
      ? indexTokens.filter((i) => symbols.includes(i.symbol))
      : indexTokens;

    try {
      const fetched = await angelClient.getQuotes(
        'NSE',
        tokensToFetch.map((t) => t.token)
      );

      return fetched.map((item) => {
        const meta = indexTokens.find((t) => t.token === item.symbolToken);
        return {
          name: meta?.name || item.tradingSymbol,
          symbol: meta?.symbol || item.tradingSymbol,
          value: item.ltp,
          change: item.netChange,
          changePercent: item.percentChange,
          source: 'angel',
          observedAt: new Date().toISOString(),
        };
      });
    } catch {
      return [];
    }
  }
}

export const angelProvider = new AngelProvider();
