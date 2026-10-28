import type {
  CompanyProfile,
  HistoricalPrices,
  HistoricalRequest,
  InstrumentRecord,
  InstrumentSummary,
  Market,
  MarketOverview,
  MarketProvider,
  NormalizedQuote,
  ProviderStatus,
  QuoteRequest,
  SearchInstrumentsQuery,
  StockPerformanceResponse,
} from './types.js';
import { angelProvider } from './providers/angel/index.js';
import { yahooProvider } from './providers/yahoo/index.js';
import { instrumentRepository } from './instruments/repository.js';
import { marketCache } from './cache/memoryCache.js';
import { CacheManager } from './cache/cacheManager.js';
import { observationRepository } from './observations/observationRepository.js';
import { calculateStockPerformance } from './performanceCalculator.js';
import { yf } from './providers/yahoo/client.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class MarketService {
  private readonly providers: Record<string, MarketProvider> = {
    angel: angelProvider,
    yahoo: yahooProvider,
  };
  private readonly inFlightQuotes = new Map<string, Promise<NormalizedQuote>>();
  private readonly inFlightHistory = new Map<string, Promise<HistoricalPrices>>();
  private readonly inFlightOverview = new Map<string, Promise<MarketOverview>>();

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
    const cleanSym = request.symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = `quote:${exchange}:${cleanSym}`;

    const cached = marketCache.get<NormalizedQuote>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    // Coalesce in-flight requests for the same instrument to prevent cache stampedes
    const inFlight = this.inFlightQuotes.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise: Promise<NormalizedQuote> = (async (): Promise<NormalizedQuote> => {
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
            'Angel One quote failed; attempting Yahoo Finance fallback',
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
          freshness: 'stale' as const,
        };
      }

      if (lastError instanceof AppError) {
        throw lastError;
      }

      throw new AppError(
        'MARKET_DATA_UNAVAILABLE',
        `Unable to retrieve quote for ${request.symbol} from any active provider`,
        502,
      );
    })();

    this.inFlightQuotes.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightQuotes.delete(cacheKey);
    }
  }

  async getHistoricalPrices(request: HistoricalRequest): Promise<HistoricalPrices> {
    const cleanSym = request.symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = `history:${exchange}:${cleanSym}:${request.interval}:${request.from}:${request.to}`;

    const cached = marketCache.get<HistoricalPrices>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    const inFlight = this.inFlightHistory.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = (async () => {
      const instrument = instrumentRepository.getBySymbol(cleanSym, exchange);
      const isNSE = exchange === 'NSE' || instrument?.market === 'nse';
      const requestsFullHistory =
        request.interval === 'ONE_DAY' && request.from.startsWith('1900-01-01');

      // Check canonical persistence store for daily candles
      if (request.interval === 'ONE_DAY' && !requestsFullHistory) {
        try {
          const persisted = await observationRepository.getDailySeries(
            exchange,
            cleanSym,
            request.from,
            request.to,
          );
          if (persisted.length > 0) {
            const history: HistoricalPrices = {
              symbol: cleanSym,
              exchange,
              interval: 'ONE_DAY',
              candles: persisted,
              retrievedAt: new Date().toISOString(),
              source: 'canonical_db',
              fromDate: request.from,
              toDate: request.to,
            };
            marketCache.set(cacheKey, history, { ttlSeconds: 60, staleTtlSeconds: 300 });
            return history;
          }
        } catch (err) {
          logger.debug({ err, symbol: cleanSym }, 'Could not read historical observations from DB');
        }
      }

      let lastError: unknown = null;

      // Angel's NSE history endpoint is intended for bounded ranges; use Yahoo for MAX.
      if (!requestsFullHistory && isNSE && angelProvider.isConfigured()) {
        try {
          const history = await angelProvider.getHistoricalPrices({
            ...request,
            symbol: cleanSym,
            exchange,
            token: request.token || instrument?.providerToken,
          });

          marketCache.set(cacheKey, history, { ttlSeconds: 60, staleTtlSeconds: 300 });

          if (request.interval === 'ONE_DAY' && history.candles.length > 0) {
            void observationRepository
              .upsertDailyObservations(exchange, cleanSym, history.candles, history.source)
              .catch(() => {});
          }

          return history;
        } catch (err) {
          lastError = err;
          logger.warn(
            { err, symbol: cleanSym },
            'Angel One historical data failed; attempting Yahoo Finance fallback',
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

        if (request.interval === 'ONE_DAY' && history.candles.length > 0) {
          void observationRepository
            .upsertDailyObservations(exchange, cleanSym, history.candles, history.source)
            .catch(() => {});
        }

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
        502,
      );
    })();

    this.inFlightHistory.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightHistory.delete(cacheKey);
    }
  }

  async getMarketOverview(market: Market = 'nse'): Promise<MarketOverview> {
    const cacheKey = `overview:${market}`;
    const cached = marketCache.get<MarketOverview>(cacheKey);

    if (cached && !cached.isStale) {
      return cached.value;
    }

    const inFlight = this.inFlightOverview.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = (async () => {
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
    })();

    this.inFlightOverview.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightOverview.delete(cacheKey);
    }
  }

  /**
   * Resolves an instrument against the local master or verified live provider.
   * Throws 404 AppError if the instrument cannot be found anywhere.
   */
  async resolveInstrument(request: {
    symbol: string;
    exchange?: string | undefined;
  }): Promise<InstrumentRecord> {
    const cleanSym = request.symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();

    const existing = instrumentRepository.getBySymbol(cleanSym, exchange);
    if (existing) {
      return existing;
    }

    // Attempt live quote resolution to verify if the symbol is real
    try {
      const quote = await this.getQuote({ symbol: cleanSym, exchange });
      const record: InstrumentRecord = {
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        market: quote.market,
        assetType: quote.assetType,
        currency: quote.currency,
      };
      instrumentRepository.upsert(record);
      return record;
    } catch {
      throw new AppError(
        'INSTRUMENT_NOT_FOUND',
        `Instrument ${cleanSym} on exchange ${exchange} not found or unsupported`,
        404,
      );
    }
  }

  /**
   * Retrieves verified company profile metadata (sector, industry, description, website, HQ).
   * Missing fields are null with zero fabrication.
   */
  async getCompanyProfile(request: {
    symbol: string;
    exchange?: string | undefined;
  }): Promise<CompanyProfile> {
    const cleanSym = request.symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = `profile:${exchange}:${cleanSym}`;

    const cached = marketCache.get<CompanyProfile>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    const instrument = await this.resolveInstrument({ symbol: cleanSym, exchange });
    const isNSE = exchange === 'NSE' || instrument.market === 'nse';
    const ticker = isNSE ? `${cleanSym}.NS` : exchange === 'BSE' ? `${cleanSym}.BO` : cleanSym;

    const retrievedAt = new Date().toISOString();

    // Default baseline from repository
    let sector: string | null = null;
    let industry: string | null = null;
    let description: string | null = null;
    let website: string | null = null;
    let headquarters: string | null = null;
    let employees: number | null = null;
    let sharesOutstanding: number | null = null;
    let floatShares: number | null = null;
    let fiscalYearEnd: string | null = null;
    let name = instrument.name;
    let source = 'instrument_master';

    try {
      // Query Yahoo quoteSummary for profile & statistics
      const [profileData, statsData, priceData] = await Promise.all([
        yf.quoteSummary(ticker, { modules: ['assetProfile'] }).catch(() => null),
        yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] }).catch(() => null),
        yf.quoteSummary(ticker, { modules: ['price'] }).catch(() => null),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ap = (profileData as any)?.assetProfile as Record<string, unknown> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ks = (statsData as any)?.defaultKeyStatistics as Record<string, unknown> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pr = (priceData as any)?.price as Record<string, unknown> | undefined;

      if (ap || ks || pr) {
        source = 'yahoo';
        if (pr?.['longName'] || pr?.['shortName']) {
          name = (pr['longName'] ?? pr['shortName']) as string;
        }
        if (typeof ap?.['sector'] === 'string' && ap['sector'].trim()) {
          sector = ap['sector'].trim();
        }
        if (typeof ap?.['industry'] === 'string' && ap['industry'].trim()) {
          industry = ap['industry'].trim();
        }
        if (typeof ap?.['longBusinessSummary'] === 'string' && ap['longBusinessSummary'].trim()) {
          description = ap['longBusinessSummary'].trim();
        }
        if (typeof ap?.['website'] === 'string' && ap['website'].trim()) {
          website = ap['website'].trim();
        }

        const hqParts = [ap?.['city'], ap?.['state'], ap?.['country']].filter(
          (p): p is string => typeof p === 'string' && Boolean(p.trim()),
        );
        if (hqParts.length > 0) {
          headquarters = hqParts.join(', ');
        }

        if (typeof ap?.['fullTimeEmployees'] === 'number' && ap['fullTimeEmployees'] > 0) {
          employees = ap['fullTimeEmployees'];
        }

        if (typeof ks?.['sharesOutstanding'] === 'number' && ks['sharesOutstanding'] > 0) {
          sharesOutstanding = ks['sharesOutstanding'];
        }
        if (typeof ks?.['floatShares'] === 'number' && ks['floatShares'] > 0) {
          floatShares = ks['floatShares'];
        }
        if (ks?.['fiscalYearEnd']) {
          fiscalYearEnd = String(ks['fiscalYearEnd']).split('T')[0] ?? null;
        }
      }
    } catch (err) {
      logger.warn(
        { err, ticker },
        'Could not fetch extended profile summary; using baseline instrument',
      );
    }

    const profile: CompanyProfile = {
      symbol: cleanSym,
      name,
      exchange: instrument.exchange,
      market: instrument.market,
      assetType: instrument.assetType,
      currency: instrument.currency,
      isin: instrument.isin ?? null,
      sector,
      industry,
      description,
      website,
      headquarters,
      employees,
      sharesOutstanding,
      floatShares,
      fiscalYearEnd,
      source,
      retrievedAt,
    };

    marketCache.set(cacheKey, profile, { ttlSeconds: 24 * 3600, staleTtlSeconds: 48 * 3600 });
    return profile;
  }

  /**
   * Calculates deterministic historical performance metrics across multiple periods.
   */
  async getStockPerformance(request: {
    symbol: string;
    exchange?: string | undefined;
  }): Promise<StockPerformanceResponse> {
    const cleanSym = request.symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, '');
    const exchange = (request.exchange || 'NSE').toUpperCase();
    const cacheKey = CacheManager.performanceKey(exchange, cleanSym);

    const cached = marketCache.get<StockPerformanceResponse>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value;
    }

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const history = await this.getHistoricalPrices({
      symbol: cleanSym,
      exchange,
      interval: 'ONE_DAY',
      from: fiveYearsAgo.toISOString(),
      to: new Date().toISOString(),
    });

    const performance = calculateStockPerformance(
      cleanSym,
      exchange,
      history.candles,
      history.source,
    );

    marketCache.set(cacheKey, performance, { ttlSeconds: 3600, staleTtlSeconds: 86400 });
    return performance;
  }
}

export const marketService = new MarketService();
export function getMarketProvider(id: string): MarketProvider {
  return marketService.getProvider(id);
}
export function listMarketProviders(): string[] {
  return marketService.listProviders().map((p) => p.id);
}
