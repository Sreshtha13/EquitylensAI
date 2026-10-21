import { userRepository } from '../db/userRepository.js';
import { instrumentRepository } from '../market/instruments/repository.js';
import { marketService } from '../market/marketService.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import type {
  FavoriteItemWithQuote,
  SupportedExchange,
  NormalizedQuote,
} from '@equitylensai/shared';

export class FavoritesService {
  async listFavorites(userId: string): Promise<FavoriteItemWithQuote[]> {
    const favorites = await userRepository.listFavorites(userId);

    const itemsWithQuotes: FavoriteItemWithQuote[] = await Promise.all(
      favorites.map(async (fav) => {
        const instrument = instrumentRepository.getBySymbol(fav.symbol, fav.exchange);
        let quote: NormalizedQuote | null = null;

        try {
          quote = await marketService.getQuote({
            symbol: fav.symbol,
            exchange: fav.exchange,
          });
        } catch (error) {
          logger.warn(
            { error, symbol: fav.symbol, exchange: fav.exchange },
            'Market quote unavailable for favorite item',
          );
        }

        return {
          id: fav.id,
          userId: fav.userId,
          symbol: fav.symbol,
          exchange: fav.exchange,
          name: instrument?.name || fav.symbol,
          assetType: instrument?.assetType || 'equity',
          currency: instrument?.currency || 'INR',
          addedAt: fav.createdAt,
          quote,
        };
      }),
    );

    return itemsWithQuotes;
  }

  async addFavorite(
    userId: string,
    symbol: string,
    exchange: SupportedExchange,
  ): Promise<FavoriteItemWithQuote> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const instrument = instrumentRepository.getBySymbol(cleanSymbol, exchange);
    if (!instrument) {
      throw new AppError(
        'INSTRUMENT_NOT_FOUND',
        `Stock symbol "${cleanSymbol}" on exchange "${exchange}" was not found in supported instruments`,
        404,
      );
    }

    const row = await userRepository.addFavorite(userId, cleanSymbol, exchange);

    let quote: NormalizedQuote | null = null;
    try {
      quote = await marketService.getQuote({
        symbol: cleanSymbol,
        exchange,
      });
    } catch {
      // Graceful quote retrieval
    }

    return {
      id: row.id,
      userId: row.userId,
      symbol: row.symbol,
      exchange: row.exchange,
      name: instrument.name,
      assetType: instrument.assetType,
      currency: instrument.currency,
      addedAt: row.createdAt,
      quote,
    };
  }

  async removeFavorite(
    userId: string,
    symbol: string,
    exchange?: SupportedExchange,
  ): Promise<void> {
    await userRepository.removeFavorite(userId, symbol.trim().toUpperCase(), exchange);
  }
}

export const favoritesService = new FavoritesService();
