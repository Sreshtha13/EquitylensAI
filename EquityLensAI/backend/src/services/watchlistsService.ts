import { userRepository } from '../db/userRepository.js';
import { instrumentRepository } from '../market/instruments/repository.js';
import { marketService } from '../market/marketService.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import type {
  WatchlistSummary,
  WatchlistDetail,
  WatchlistItemWithQuote,
  SupportedExchange,
  NormalizedQuote,
} from '@equitylensai/shared';

const MAX_WATCHLISTS_PER_USER = 50;

export class WatchlistsService {
  async listWatchlists(userId: string): Promise<WatchlistSummary[]> {
    return userRepository.listWatchlists(userId);
  }

  async createWatchlist(
    userId: string,
    data: { name: string; description?: string | null },
  ): Promise<WatchlistSummary> {
    const existing = await userRepository.listWatchlists(userId);
    if (existing.length >= MAX_WATCHLISTS_PER_USER) {
      throw new AppError(
        'LIMIT_EXCEEDED',
        `Maximum limit of ${MAX_WATCHLISTS_PER_USER} watchlists reached`,
        400,
      );
    }

    const cleanName = data.name.trim();
    const isDuplicate = existing.some(
      (w) => w.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (isDuplicate) {
      throw new AppError(
        'WATCHLIST_ALREADY_EXISTS',
        `A watchlist named "${cleanName}" already exists`,
        409,
      );
    }

    const row = await userRepository.createWatchlist(userId, {
      name: cleanName,
      description: data.description?.trim() || null,
    });

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      itemCount: 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getWatchlistDetail(userId: string, watchlistId: string): Promise<WatchlistDetail> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }

    const items = await userRepository.listWatchlistItems(watchlistId);

    // Coordinate quotes retrieval in parallel without failing on individual quote errors
    const itemsWithQuotes: WatchlistItemWithQuote[] = await Promise.all(
      items.map(async (item) => {
        const instrument = instrumentRepository.getBySymbol(item.symbol, item.exchange);
        let quote: NormalizedQuote | null = null;

        try {
          quote = await marketService.getQuote({
            symbol: item.symbol,
            exchange: item.exchange,
          });
        } catch (error) {
          logger.warn(
            { error, symbol: item.symbol, exchange: item.exchange },
            'Market quote unavailable for watchlist item',
          );
        }

        return {
          id: item.id,
          watchlistId: item.watchlistId,
          symbol: item.symbol,
          exchange: item.exchange,
          name: instrument?.name || item.symbol,
          assetType: instrument?.assetType || 'equity',
          currency: instrument?.currency || 'INR',
          addedAt: item.addedAt,
          sortOrder: item.sortOrder,
          quote,
        };
      }),
    );

    return {
      id: wl.id,
      userId: wl.userId,
      name: wl.name,
      description: wl.description,
      createdAt: wl.createdAt,
      updatedAt: wl.updatedAt,
      items: itemsWithQuotes,
    };
  }

  async updateWatchlist(
    userId: string,
    watchlistId: string,
    data: { name?: string; description?: string | null },
  ): Promise<WatchlistSummary> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }

    if (data.name) {
      const cleanName = data.name.trim();
      const existing = await userRepository.listWatchlists(userId);
      const isDuplicate = existing.some(
        (w) => w.id !== watchlistId && w.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (isDuplicate) {
        throw new AppError(
          'WATCHLIST_ALREADY_EXISTS',
          `A watchlist named "${cleanName}" already exists`,
          409,
        );
      }
    }

    const updated = await userRepository.updateWatchlist(userId, watchlistId, {
      name: data.name ? data.name.trim() : undefined,
      description: data.description !== undefined ? data.description?.trim() || null : undefined,
    });

    const items = await userRepository.listWatchlistItems(watchlistId);

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      description: updated.description,
      itemCount: items.length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }
    await userRepository.deleteWatchlist(userId, watchlistId);
  }

  async addItem(
    userId: string,
    watchlistId: string,
    data: { symbol: string; exchange: SupportedExchange; sortOrder?: number },
  ): Promise<WatchlistItemWithQuote> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }

    const cleanSymbol = data.symbol.trim().toUpperCase();
    const instrument = instrumentRepository.getBySymbol(cleanSymbol, data.exchange);
    if (!instrument) {
      throw new AppError(
        'INSTRUMENT_NOT_FOUND',
        `Stock symbol "${cleanSymbol}" on exchange "${data.exchange}" was not found in supported instruments`,
        404,
      );
    }

    const existingItems = await userRepository.listWatchlistItems(watchlistId);
    const alreadyExists = existingItems.some(
      (item) => item.symbol === cleanSymbol && item.exchange === data.exchange,
    );
    if (alreadyExists) {
      throw new AppError(
        'DUPLICATE_ITEM',
        `Stock "${cleanSymbol}" is already in this watchlist`,
        409,
      );
    }

    const row = await userRepository.addWatchlistItem(watchlistId, {
      symbol: cleanSymbol,
      exchange: data.exchange,
      sortOrder: data.sortOrder ?? existingItems.length,
    });

    let quote: NormalizedQuote | null = null;
    try {
      quote = await marketService.getQuote({
        symbol: cleanSymbol,
        exchange: data.exchange,
      });
    } catch {
      // Graceful quote retrieval
    }

    return {
      id: row.id,
      watchlistId: row.watchlistId,
      symbol: row.symbol,
      exchange: row.exchange,
      name: instrument.name,
      assetType: instrument.assetType,
      currency: instrument.currency,
      addedAt: row.addedAt,
      sortOrder: row.sortOrder,
      quote,
    };
  }

  async removeItem(
    userId: string,
    watchlistId: string,
    symbol: string,
    exchange?: SupportedExchange,
  ): Promise<void> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }
    await userRepository.removeWatchlistItem(watchlistId, symbol, exchange);
  }

  async reorderItems(userId: string, watchlistId: string, symbols: string[]): Promise<void> {
    const wl = await userRepository.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }
    const order = symbols.map((symbol, idx) => ({
      symbol,
      sortOrder: idx,
    }));
    await userRepository.reorderWatchlistItems(watchlistId, order);
  }
}

export const watchlistsService = new WatchlistsService();
