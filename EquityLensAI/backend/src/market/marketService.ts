import type {
  HistoricalPrices,
  HistoricalRequest,
  InstrumentSummary,
  Market,
  MarketOverview,
  MarketProvider,
  NormalizedQuote,
  ProviderStatus,
  QuoteRequest,
  SearchInstrumentsQuery,
} from './types.js';
import { angelProvider } from './providers/angel/index.js';
import { yahooProvider } from './providers/yahoo/index.js';
import { instrumentRepository } from './instruments/repository.js';
import { marketCache } from './cache/memoryCache.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class MarketService {
  private readonly providers: Record<string, MarketProvider> = {
    angel: angelProvider,
    yahoo: yahooProvider,
  };

  getProvider(id: string): MarketProvider {
    const provider = this.providers[id];
    if (!provider) {
      throw new AppError('MARKET_PROVIDER_UNKNOWN', `Unknown market provider: ${id}`, 400);
    }
    return provider;
  }

  listProviders(): ProviderStatus[] {
    return [
      {
        id: angelProvider.id,
        name: angelProvider.name,
        configured: angelProvider.isConfigured(),
        isPrimaryForNSE: true,
      },
      {
        id: yahooProvider.id,
        name: yahooProvider.name,
        configured: yahooProvider.isConfigured(),
        isPrimaryForNSE: false,
      },
    ];
  }

  searchInstruments(query: SearchInstrumentsQuery): InstrumentSummary[] {
    return instrumentRepository.search(query.query, {
      market: query.market,
      assetType: query.assetType,
      limit: query.limit ?? 20,
    });
  }

  async getQuote(request: QuoteRequest): Promise<NormalizedQuote> {
    const cleanSym = request.symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = `quote:${exchange}:${cleanSym}`;

    const cached = marketCache.get<NormalizedQuote>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
    const isNSE = exchange === 'NSE' || instrument?.market === 'nse';

    let lastError: unknown = null;

    // 1. If NSE and Angel is configured, attempt Angel first
    if (isNSE && angelProvider.isConfigured()) {
      try {
        const quote = await angelProvider.getQuote({
          symbol: cleanSym,
          exchange,
          token: request.token || instrument?.providerToken,
        });

        marketCache.set(cacheKey, quote, { ttlSeconds: 10, staleTtlSeconds: 60 });
        return quote;
      } catch (err) {
        lastError = err;
        logger.warn(
          { err, symbol: cleanSym },
          'Angel One quote failed; attempting Yahoo Finance fallback'
        );
      }
    }

    // 2. Fallback to Yahoo Finance
    try {
      const quote = await yahooProvider.getQuote({
        symbol: cleanSym,
        exchange: instrument?.exchange || exchange,
      });

      marketCache.set(cacheKey, quote, { ttlSeconds: 15, staleTtlSeconds: 90 });
      return quote;
    } catch (err) {
      lastError = err;
      logger.warn({ err, symbol: cleanSym }, 'Yahoo Finance quote failed');
    }

    // 3. If stale cache exists, serve it marked as stale
    if (cached) {
      logger.warn({ symbol: cleanSym }, 'Serving stale cached quote as all providers failed');
      return {
        ...cached.value,
        isStale: true,
        freshness: 'stale',
      };
    }

    if (lastError instanceof AppError) {
      throw lastError;
    }

    throw new AppError(
      'MARKET_DATA_UNAVAILABLE',
      `Unable to retrieve quote for ${request.symbol} from any active provider`,
      502
    );
  }

  async getHistoricalPrices(request: HistoricalRequest): Promise<HistoricalPrices> {
    const cleanSym = request.symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = `history:${exchange}:${cleanSym}:${request.interval}:${request.from}:${request.to}`;

    const cached = marketCache.get<HistoricalPrices>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
    const isNSE = exchange === 'NSE' || instrument?.market === 'nse';

    let lastError: unknown = null;

    // 1. Try Angel One if configured and NSE
    if (isNSE && angelProvider.isConfigured()) {
      try {
        const history = await angelProvider.getHistoricalPrices({
          ...request,
          symbol: cleanSym,
          exchange,
          token: request.token || instrument?.providerToken,
        });

        marketCache.set(cacheKey, history, { ttlSeconds: 60, staleTtlSeconds: 300 });
        return history;
      } catch (err) {
        lastError = err;
        logger.warn(
          { err, symbol: cleanSym },
          'Angel One historical data failed; attempting Yahoo Finance fallback'
        );
      }
    }

    // 2. Fallback to Yahoo Finance
    try {
      const history = await yahooProvider.getHistoricalPrices({
        ...request,
        symbol: cleanSym,
        exchange: instrument?.exchange || exchange,
      });

      marketCache.set(cacheKey, history, { ttlSeconds: 60, staleTtlSeconds: 300 });
      return history;
    } catch (err) {
      lastError = err;
      logger.warn({ err, symbol: cleanSym }, 'Yahoo Finance historical data failed');
    }

    // 3. Check stale cache
    if (cached) {
      return cached.value;
    }

    if (lastError instanceof AppError) {
      throw lastError;
    }

    throw new AppError(
      'MARKET_DATA_UNAVAILABLE',
      `Unable to retrieve historical prices for ${request.symbol} from any active provider`,
      502
    );
  }

  async getMarketOverview(market: Market = 'nse'): Promise<MarketOverview> {
    const cacheKey = `overview:${market}`;
    const cached = marketCache.get<MarketOverview>(cacheKey);

    if (cached && !cached.isStale) {
      return cached.value;
    }

    let indices: MarketOverview['indices'] = [];
    let source = 'yahoo';
    let freshness: MarketOverview['freshness'] = 'delayed';

    if (market === 'nse') {
      if (angelProvider.isConfigured()) {
        try {
          indices = await angelProvider.getIndices();
          if (indices.length > 0) {
            source = 'angel';
            freshness = 'live';
          }
        } catch {
          // fallback
        }
      }

      if (indices.length === 0) {
        indices = await yahooProvider.getIndices(['NIFTY', 'BANKNIFTY', 'SENSEX']);
        source = 'yahoo';
        freshness = 'delayed';
      }
    } else {
      // US or global
      indices = await yahooProvider.getIndices(['SP500']);
      source = 'yahoo';
      freshness = 'delayed';
    }

    const overview: MarketOverview = {
      market,
      indices,
      retrievedAt: new Date().toISOString(),
      source,
      freshness,
      isStale: false,
    };

    marketCache.set(cacheKey, overview, { ttlSeconds: 15, staleTtlSeconds: 60 });
    return overview;
  }
}

export const marketService = new MarketService();
export function getMarketProvider(id: string): MarketProvider {
  return marketService.getProvider(id);
}
export function listMarketProviders(): string[] {
  return marketService.listProviders().map((p) => p.id);
}
