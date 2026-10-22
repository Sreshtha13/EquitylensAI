import type {
  NewsFeedResponse,
  AnnouncementsFeedResponse,
  WatchlistNewsResponse,
  NewsItem,
  CorporateAnnouncement,
  GroundedAiSummary,
  AnnouncementCategory,
} from '@equitylensai/shared';
import { newsRepository } from '../repositories/newsRepository.js';
import { providerRegistry } from '../providers/registry.js';
import { newsNormalizer } from '../normalizers/newsNormalizer.js';
import { newsSummarizer } from '../summarization/newsSummarizer.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { userRepository } from '../../db/userRepository.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export class NewsService {
  async getMarketNews(
    options: {
      category?: string | undefined;
      sourceType?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
      limit?: number | undefined;
      page?: number | undefined;
    } = {},
  ): Promise<NewsFeedResponse> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
    const page = Math.max(Number(options.page) || 1, 1);

    let { items, total } = await newsRepository.getNews({
      category: options.category,
      sourceType: options.sourceType,
      from: options.from,
      to: options.to,
      limit,
      page,
    });

    // If cache/db has no items, proactively fetch from news provider
    if (items.length === 0 && page === 1) {
      const googleNews = providerRegistry.getNewsProvider('google_news_rss');
      if (googleNews) {
        try {
          const raw = await googleNews.fetchNews({
            category: options.category,
            limit: 30,
          });
          const normalized = raw
            .map((r) => newsNormalizer.normalizeNewsItem(r))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          await newsRepository.saveNewsItems(normalized);

          const refreshed = await newsRepository.getNews({
            category: options.category,
            sourceType: options.sourceType,
            from: options.from,
            to: options.to,
            limit,
            page,
          });
          items = refreshed.items;
          total = refreshed.total;
        } catch (err) {
          logger.warn({ err }, 'Proactive market news fetch failed');
        }
      }
    }

    const hasMore = page * limit < total;
    return {
      items,
      pagination: {
        page,
        pageSize: limit,
        total,
        hasMore,
      },
      freshness: {
        lastRetrievedAt: items[0]?.retrievedAt || new Date().toISOString(),
        provider: 'Google News RSS (Verified Financial Press)',
        isStale: false,
      },
    };
  }

  async getStockNews(
    symbol: string,
    exchange?: string | undefined,
    options: { limit?: number | undefined; page?: number | undefined } = {},
  ): Promise<NewsFeedResponse> {
    const cleanSym = symbol.trim().toUpperCase();
    const cleanExch = exchange?.trim().toUpperCase() || 'NSE';

    const instrument = instrumentRepository.getBySymbol(cleanSym, cleanExch);
    const resolvedSymbol = instrument?.symbol || cleanSym;
    const resolvedExchange = instrument?.exchange || cleanExch;

    const limit = Math.min(Math.max(Number(options.limit) || 15, 1), 50);
    const page = Math.max(Number(options.page) || 1, 1);

    let { items, total } = await newsRepository.getNews({
      symbol: resolvedSymbol,
      exchange: resolvedExchange,
      limit,
      page,
    });

    if (items.length === 0 && page === 1) {
      const googleNews = providerRegistry.getNewsProvider('google_news_rss');
      if (googleNews) {
        try {
          const query = instrument
            ? `${instrument.name} ${resolvedSymbol} ${resolvedExchange} news`
            : `${resolvedSymbol} ${resolvedExchange} news`;

          const raw = await googleNews.fetchNews({
            query,
            symbol: resolvedSymbol,
            exchange: resolvedExchange,
            limit: 20,
          });

          const normalized = raw
            .map((r) => newsNormalizer.normalizeNewsItem(r, resolvedSymbol, resolvedExchange))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          await newsRepository.saveNewsItems(normalized);

          const refreshed = await newsRepository.getNews({
            symbol: resolvedSymbol,
            exchange: resolvedExchange,
            limit,
            page,
          });
          items = refreshed.items;
          total = refreshed.total;
        } catch (err) {
          logger.warn({ err, symbol: resolvedSymbol }, 'Proactive stock news fetch failed');
        }
      }
    }

    const hasMore = page * limit < total;
    return {
      items,
      pagination: {
        page,
        pageSize: limit,
        total,
        hasMore,
      },
      freshness: {
        lastRetrievedAt: items[0]?.retrievedAt || new Date().toISOString(),
        provider: 'Google News RSS',
        isStale: false,
      },
    };
  }

  async getAnnouncements(
    options: {
      symbol?: string | undefined;
      exchange?: string | undefined;
      category?: AnnouncementCategory | undefined;
      from?: string | undefined;
      to?: string | undefined;
      limit?: number | undefined;
      page?: number | undefined;
    } = {},
  ): Promise<AnnouncementsFeedResponse> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
    const page = Math.max(Number(options.page) || 1, 1);

    let { items, total } = await newsRepository.getAnnouncements({
      symbol: options.symbol,
      exchange: options.exchange,
      category: options.category,
      from: options.from,
      to: options.to,
      limit,
      page,
    });

    if (items.length === 0 && page === 1) {
      const nseProvider = providerRegistry.getAnnouncementsProvider('nse_official');
      if (nseProvider) {
        try {
          const raw = await nseProvider.fetchAnnouncements({
            symbol: options.symbol,
            category: options.category,
            limit: 40,
          });

          const normalized = raw
            .map((r) => newsNormalizer.normalizeAnnouncement(r))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          await newsRepository.saveAnnouncements(normalized);

          const refreshed = await newsRepository.getAnnouncements({
            symbol: options.symbol,
            exchange: options.exchange,
            category: options.category,
            from: options.from,
            to: options.to,
            limit,
            page,
          });
          items = refreshed.items;
          total = refreshed.total;
        } catch (err) {
          logger.warn({ err }, 'Proactive announcements fetch failed');
        }
      }
    }

    const hasMore = page * limit < total;
    return {
      items,
      pagination: {
        page,
        pageSize: limit,
        total,
        hasMore,
      },
      freshness: {
        lastRetrievedAt: items[0]?.retrievedAt || new Date().toISOString(),
        provider: 'Official Exchange Disclosures (NSE/BSE)',
        isStale: false,
      },
    };
  }

  async getStockAnnouncements(
    symbol: string,
    exchange?: string | undefined,
    options: {
      category?: AnnouncementCategory | undefined;
      from?: string | undefined;
      to?: string | undefined;
      limit?: number | undefined;
      page?: number | undefined;
    } = {},
  ): Promise<AnnouncementsFeedResponse> {
    const cleanSym = symbol.trim().toUpperCase();
    const cleanExch = exchange?.trim().toUpperCase() || 'NSE';

    const instrument = instrumentRepository.getBySymbol(cleanSym, cleanExch);
    const resolvedSymbol = instrument?.symbol || cleanSym;
    const resolvedExchange = instrument?.exchange || cleanExch;

    const limit = Math.min(Math.max(Number(options.limit) || 15, 1), 50);
    const page = Math.max(Number(options.page) || 1, 1);

    let { items, total } = await newsRepository.getAnnouncements({
      symbol: resolvedSymbol,
      exchange: resolvedExchange,
      category: options.category,
      from: options.from,
      to: options.to,
      limit,
      page,
    });

    if (items.length === 0 && page === 1) {
      const nseProvider = providerRegistry.getAnnouncementsProvider('nse_official');
      if (nseProvider) {
        try {
          const raw = await nseProvider.fetchAnnouncements({
            symbol: resolvedSymbol,
            category: options.category,
            limit: 30,
          });

          const normalized = raw
            .map((r) => newsNormalizer.normalizeAnnouncement(r))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          await newsRepository.saveAnnouncements(normalized);

          const refreshed = await newsRepository.getAnnouncements({
            symbol: resolvedSymbol,
            exchange: resolvedExchange,
            category: options.category,
            from: options.from,
            to: options.to,
            limit,
            page,
          });
          items = refreshed.items;
          total = refreshed.total;
        } catch (err) {
          logger.warn(
            { err, symbol: resolvedSymbol },
            'Proactive stock announcements fetch failed',
          );
        }
      }
    }

    const hasMore = page * limit < total;
    return {
      items,
      pagination: {
        page,
        pageSize: limit,
        total,
        hasMore,
      },
      freshness: {
        lastRetrievedAt: items[0]?.retrievedAt || new Date().toISOString(),
        provider: `${resolvedExchange} Official Corporate Filings`,
        isStale: false,
      },
    };
  }

  async getAnnouncementById(id: string): Promise<CorporateAnnouncement> {
    const item = await newsRepository.getAnnouncementById(id);
    if (!item) {
      throw new AppError(
        'ANNOUNCEMENT_NOT_FOUND',
        `Announcement with id '${id}' was not found`,
        404,
      );
    }
    return item;
  }

  async getNewsById(id: string): Promise<NewsItem> {
    const item = await newsRepository.getNewsById(id);
    if (!item) {
      throw new AppError('NEWS_NOT_FOUND', `News item with id '${id}' was not found`, 404);
    }
    return item;
  }

  async getWatchlistNews(
    userId: string,
    options: { limit?: number | undefined; page?: number | undefined } = {},
  ): Promise<WatchlistNewsResponse> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
    const page = Math.max(Number(options.page) || 1, 1);

    // Get user's watchlists and favorites
    const watchlists = await userRepository.listWatchlists(userId);
    const favorites = await userRepository.listFavorites(userId);

    const symbolSet = new Set<string>();
    for (const f of favorites) {
      symbolSet.add(f.symbol.toUpperCase());
    }

    for (const wl of watchlists) {
      const items = await userRepository.listWatchlistItems(wl.id);
      for (const it of items) {
        symbolSet.add(it.symbol.toUpperCase());
      }
    }

    const symbolsWatched = Array.from(symbolSet);
    if (symbolsWatched.length === 0) {
      return {
        items: [],
        symbolsWatched: [],
        pagination: { page, pageSize: limit, total: 0, hasMore: false },
        freshness: { lastRetrievedAt: new Date().toISOString(), provider: 'None', isStale: false },
      };
    }

    // Query news matching any of these symbols
    const aggregated: NewsItem[] = [];
    const seenIds = new Set<string>();

    for (const sym of symbolsWatched) {
      const stockNews = await this.getStockNews(sym, 'NSE', { limit: 10, page: 1 });
      for (const item of stockNews.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          aggregated.push(item);
        }
      }
    }

    // Sort descending by publishedAt
    aggregated.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    const total = aggregated.length;
    const offset = (page - 1) * limit;
    const items = aggregated.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items,
      symbolsWatched,
      pagination: { page, pageSize: limit, total, hasMore },
      freshness: {
        lastRetrievedAt: items[0]?.retrievedAt || new Date().toISOString(),
        provider: 'Aggregated Watchlist News',
        isStale: false,
      },
    };
  }

  async summarizeNewsItem(newsId: string): Promise<GroundedAiSummary> {
    const item = await this.getNewsById(newsId);
    if (item.aiSummary) {
      return item.aiSummary;
    }

    const firstSymbol = item.symbols[0]?.symbol;
    const summary = await newsSummarizer.summarizeItem({
      title: item.title,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt,
      contentExcerpt: item.contentExcerpt || undefined,
      symbol: firstSymbol,
      isAnnouncement: false,
    });

    await newsRepository.updateNewsAiSummary(newsId, summary);
    return summary;
  }

  async summarizeAnnouncement(announcementId: string): Promise<GroundedAiSummary> {
    const item = await this.getAnnouncementById(announcementId);
    if (item.aiSummary) {
      return item.aiSummary;
    }

    const summary = await newsSummarizer.summarizeItem({
      title: item.title,
      sourceName: `${item.exchange} Official Disclosures`,
      publishedAt: item.publishedAt,
      contentExcerpt: item.description || undefined,
      symbol: item.symbol,
      isAnnouncement: true,
    });

    await newsRepository.updateAnnouncementAiSummary(announcementId, summary);
    return summary;
  }
}

export const newsService = new NewsService();
