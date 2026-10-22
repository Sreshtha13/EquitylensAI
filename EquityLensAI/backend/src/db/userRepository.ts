import { getEnv } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/appError.js';
import type {
  UserProfile,
  UserPreferences,
  WatchlistSummary,
  SupportedExchange,
  SupportedCurrency,
  SupportedPeriod,
  SupportedLandingPage,
  ThemeOption,
  TableDensityOption,
} from '@equitylensai/shared';

export type WatchlistRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistItemRow = {
  id: string;
  watchlistId: string;
  symbol: string;
  exchange: SupportedExchange;
  sortOrder: number;
  addedAt: string;
};

export type FavoriteRow = {
  id: string;
  userId: string;
  symbol: string;
  exchange: SupportedExchange;
  createdAt: string;
};

interface UserProfileDbRow {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserPreferencesDbRow {
  user_id: string;
  default_exchange: SupportedExchange;
  preferred_currency: SupportedCurrency;
  preferred_period: SupportedPeriod;
  default_landing_page: SupportedLandingPage;
  theme: ThemeOption;
  table_density: TableDensityOption;
  updated_at: string;
}

interface WatchlistDbRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  watchlist_items?: Array<{ count: number }>;
}

interface WatchlistItemDbRow {
  id: string;
  watchlist_id: string;
  symbol: string;
  exchange: SupportedExchange;
  sort_order: number | null;
  added_at: string;
}

interface FavoriteDbRow {
  id: string;
  user_id: string;
  symbol: string;
  exchange: SupportedExchange;
  created_at: string;
}

// ─── In-Memory Store for Testing and Fallback ───
class MemoryUserStore {
  profiles = new Map<string, UserProfile>(); // keyed by authUserId
  preferences = new Map<string, UserPreferences>(); // keyed by userId
  watchlists = new Map<string, WatchlistRow>(); // keyed by id
  watchlistItems = new Map<string, WatchlistItemRow>(); // keyed by id
  favorites = new Map<string, FavoriteRow>(); // keyed by id

  clear(): void {
    this.profiles.clear();
    this.preferences.clear();
    this.watchlists.clear();
    this.watchlistItems.clear();
    this.favorites.clear();
  }
}

export const memoryStore = new MemoryUserStore();

// ─── Supabase PostgREST Client Helper ───
async function supabaseRest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number; ok: boolean }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, status: 503, ok: false };
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${resource}`;
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { data: null, status: res.status, ok: false };
    }

    const text = await res.text();
    const data = text.trim().length > 0 ? (JSON.parse(text) as T) : null;
    return { data, status: res.status, ok: true };
  } catch (error) {
    logger.debug({ error, resource }, 'Supabase PostgREST request failed, using memory store');
    return { data: null, status: 500, ok: false };
  }
}

// ─── Repository Interface & Implementation ───

export const userRepository = {
  // Profiles
  async getProfile(authUserId: string): Promise<UserProfile | null> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<UserProfileDbRow[]>(
        `user_profiles?auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,
      );
      if (ok && data) {
        const row = data[0];
        if (row) {
          return {
            id: row.id,
            authUserId: row.auth_user_id,
            email: row.email,
            displayName: row.display_name ?? null,
            avatarUrl: row.avatar_url ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      }
    }

    return memoryStore.profiles.get(authUserId) ?? null;
  },

  async upsertProfile(profile: UserProfile): Promise<UserProfile> {
    const env = getEnv();
    memoryStore.profiles.set(profile.authUserId, profile);

    if (env.NODE_ENV !== 'test') {
      await supabaseRest('user_profiles?on_conflict=auth_user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: profile.id,
          auth_user_id: profile.authUserId,
          email: profile.email,
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          updated_at: profile.updatedAt,
        }),
      });
    }

    return profile;
  },

  async deleteProfile(authUserId: string): Promise<void> {
    memoryStore.profiles.delete(authUserId);
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(`user_profiles?auth_user_id=eq.${encodeURIComponent(authUserId)}`, {
        method: 'DELETE',
      });
    }
  },

  // Preferences
  async getPreferences(userId: string): Promise<UserPreferences> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<UserPreferencesDbRow[]>(
        `user_preferences?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data) {
        const row = data[0];
        if (row) {
          return {
            userId: row.user_id,
            defaultExchange: row.default_exchange,
            preferredCurrency: row.preferred_currency,
            preferredPeriod: row.preferred_period,
            defaultLandingPage: row.default_landing_page,
            theme: row.theme,
            tableDensity: row.table_density,
            updatedAt: row.updated_at,
          };
        }
      }
    }

    const cached = memoryStore.preferences.get(userId);
    if (cached) return cached;

    // Default preferences
    const defaultPrefs: UserPreferences = {
      userId,
      defaultExchange: 'NSE',
      preferredCurrency: 'INR',
      preferredPeriod: 'annual',
      defaultLandingPage: '/watchlists',
      theme: 'dark',
      tableDensity: 'comfortable',
      updatedAt: new Date().toISOString(),
    };
    memoryStore.preferences.set(userId, defaultPrefs);
    return defaultPrefs;
  },

  async upsertPreferences(preferences: UserPreferences): Promise<UserPreferences> {
    const env = getEnv();
    memoryStore.preferences.set(preferences.userId, preferences);

    if (env.NODE_ENV !== 'test') {
      await supabaseRest('user_preferences?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: preferences.userId,
          default_exchange: preferences.defaultExchange,
          preferred_currency: preferences.preferredCurrency,
          preferred_period: preferences.preferredPeriod,
          default_landing_page: preferences.defaultLandingPage,
          theme: preferences.theme,
          table_density: preferences.tableDensity,
          updated_at: preferences.updatedAt,
        }),
      });
    }

    return preferences;
  },

  async deletePreferences(userId: string): Promise<void> {
    memoryStore.preferences.delete(userId);
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(`user_preferences?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    }
  },

  // Watchlists
  async listWatchlists(userId: string): Promise<WatchlistSummary[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<WatchlistDbRow[]>(
        `watchlists?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,name,description,created_at,updated_at,watchlist_items(count)&order=created_at.asc`,
      );
      if (ok && data) {
        return data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description ?? null,
          itemCount: row.watchlist_items?.[0]?.count ?? 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
    }

    // In-memory lookup
    const list: WatchlistSummary[] = [];
    for (const wl of memoryStore.watchlists.values()) {
      if (wl.userId === userId) {
        let itemCount = 0;
        for (const item of memoryStore.watchlistItems.values()) {
          if (item.watchlistId === wl.id) {
            itemCount++;
          }
        }
        list.push({
          id: wl.id,
          userId: wl.userId,
          name: wl.name,
          description: wl.description,
          itemCount,
          createdAt: wl.createdAt,
          updatedAt: wl.updatedAt,
        });
      }
    }
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getWatchlistById(userId: string, watchlistId: string): Promise<WatchlistRow | null> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<WatchlistDbRow[]>(
        `watchlists?id=eq.${encodeURIComponent(watchlistId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data) {
        const row = data[0];
        if (row) {
          return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            description: row.description ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      }
    }

    const wl = memoryStore.watchlists.get(watchlistId);
    if (wl && wl.userId === userId) {
      return wl;
    }
    return null;
  },

  async createWatchlist(
    userId: string,
    data: { name: string; description?: string | null },
  ): Promise<WatchlistRow> {
    const env = getEnv();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const row: WatchlistRow = {
      id,
      userId,
      name: data.name,
      description: data.description ?? null,
      createdAt: now,
      updatedAt: now,
    };

    memoryStore.watchlists.set(id, row);

    if (env.NODE_ENV !== 'test') {
      const res = await supabaseRest<WatchlistDbRow[]>('watchlists', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          id,
          user_id: userId,
          name: data.name,
          description: data.description ?? null,
          created_at: now,
          updated_at: now,
        }),
      });
      if (res.ok && res.data) {
        const r = res.data[0];
        if (r) {
          return {
            id: r.id,
            userId: r.user_id,
            name: r.name,
            description: r.description ?? null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }
      }
    }

    return row;
  },

  async updateWatchlist(
    userId: string,
    watchlistId: string,
    data: { name?: string | undefined; description?: string | null | undefined },
  ): Promise<WatchlistRow> {
    const wl = await this.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }

    const now = new Date().toISOString();
    const updated: WatchlistRow = {
      ...wl,
      name: data.name ?? wl.name,
      description: data.description !== undefined ? data.description : wl.description,
      updatedAt: now,
    };

    memoryStore.watchlists.set(watchlistId, updated);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `watchlists?id=eq.${encodeURIComponent(watchlistId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            name: updated.name,
            description: updated.description,
            updated_at: now,
          }),
        },
      );
    }

    return updated;
  },

  async deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
    const wl = await this.getWatchlistById(userId, watchlistId);
    if (!wl) {
      throw new AppError('NOT_FOUND', 'Watchlist not found', 404);
    }

    memoryStore.watchlists.delete(watchlistId);
    // Cascade delete items
    for (const [itemId, item] of memoryStore.watchlistItems.entries()) {
      if (item.watchlistId === watchlistId) {
        memoryStore.watchlistItems.delete(itemId);
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `watchlists?id=eq.${encodeURIComponent(watchlistId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        },
      );
    }
  },

  // Watchlist Items
  async listWatchlistItems(watchlistId: string): Promise<WatchlistItemRow[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<WatchlistItemDbRow[]>(
        `watchlist_items?watchlist_id=eq.${encodeURIComponent(watchlistId)}&order=sort_order.asc,added_at.asc`,
      );
      if (ok && data) {
        return data.map((r) => ({
          id: r.id,
          watchlistId: r.watchlist_id,
          symbol: r.symbol,
          exchange: r.exchange,
          sortOrder: r.sort_order ?? 0,
          addedAt: r.added_at,
        }));
      }
    }

    const items: WatchlistItemRow[] = [];
    for (const item of memoryStore.watchlistItems.values()) {
      if (item.watchlistId === watchlistId) {
        items.push(item);
      }
    }
    return items.sort((a, b) => a.sortOrder - b.sortOrder || a.addedAt.localeCompare(b.addedAt));
  },

  async addWatchlistItem(
    watchlistId: string,
    data: { symbol: string; exchange: SupportedExchange; sortOrder?: number },
  ): Promise<WatchlistItemRow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const row: WatchlistItemRow = {
      id,
      watchlistId,
      symbol: data.symbol.toUpperCase(),
      exchange: data.exchange,
      sortOrder: data.sortOrder ?? 0,
      addedAt: now,
    };

    memoryStore.watchlistItems.set(id, row);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('watchlist_items', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id,
          watchlist_id: watchlistId,
          symbol: row.symbol,
          exchange: row.exchange,
          sort_order: row.sortOrder,
          added_at: now,
        }),
      });
    }

    return row;
  },

  async removeWatchlistItem(
    watchlistId: string,
    symbol: string,
    exchange?: SupportedExchange,
  ): Promise<void> {
    const cleanSym = symbol.toUpperCase();
    for (const [id, item] of memoryStore.watchlistItems.entries()) {
      if (
        item.watchlistId === watchlistId &&
        item.symbol === cleanSym &&
        (!exchange || item.exchange === exchange)
      ) {
        memoryStore.watchlistItems.delete(id);
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `watchlist_items?watchlist_id=eq.${encodeURIComponent(watchlistId)}&symbol=eq.${encodeURIComponent(cleanSym)}`;
      if (exchange) {
        query += `&exchange=eq.${encodeURIComponent(exchange)}`;
      }
      await supabaseRest(query, { method: 'DELETE' });
    }
  },

  async reorderWatchlistItems(
    watchlistId: string,
    itemsOrder: { id?: string; symbol: string; sortOrder: number }[],
  ): Promise<void> {
    for (const o of itemsOrder) {
      for (const item of memoryStore.watchlistItems.values()) {
        if (
          item.watchlistId === watchlistId &&
          ((o.id && item.id === o.id) || item.symbol === o.symbol.toUpperCase())
        ) {
          item.sortOrder = o.sortOrder;
        }
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      for (const o of itemsOrder) {
        await supabaseRest(
          `watchlist_items?watchlist_id=eq.${encodeURIComponent(watchlistId)}&symbol=eq.${encodeURIComponent(o.symbol.toUpperCase())}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ sort_order: o.sortOrder }),
          },
        );
      }
    }
  },

  // Favorites
  async listFavorites(userId: string): Promise<FavoriteRow[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<FavoriteDbRow[]>(
        `user_favorites?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
      );
      if (ok && data) {
        return data.map((r) => ({
          id: r.id,
          userId: r.user_id,
          symbol: r.symbol,
          exchange: r.exchange,
          createdAt: r.created_at,
        }));
      }
    }

    const favs: FavoriteRow[] = [];
    for (const f of memoryStore.favorites.values()) {
      if (f.userId === userId) {
        favs.push(f);
      }
    }
    return favs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addFavorite(
    userId: string,
    symbol: string,
    exchange: SupportedExchange,
  ): Promise<FavoriteRow> {
    const cleanSym = symbol.toUpperCase();
    // Check if existing in memory
    for (const f of memoryStore.favorites.values()) {
      if (f.userId === userId && f.symbol === cleanSym && f.exchange === exchange) {
        return f;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: FavoriteRow = {
      id,
      userId,
      symbol: cleanSym,
      exchange,
      createdAt: now,
    };

    memoryStore.favorites.set(id, row);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('user_favorites?on_conflict=user_id%2Csymbol%2Cexchange', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id,
          user_id: userId,
          symbol: cleanSym,
          exchange,
          created_at: now,
        }),
      });
    }

    return row;
  },

  async removeFavorite(
    userId: string,
    symbol: string,
    exchange?: SupportedExchange,
  ): Promise<void> {
    const cleanSym = symbol.toUpperCase();
    for (const [id, f] of memoryStore.favorites.entries()) {
      if (f.userId === userId && f.symbol === cleanSym && (!exchange || f.exchange === exchange)) {
        memoryStore.favorites.delete(id);
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `user_favorites?user_id=eq.${encodeURIComponent(userId)}&symbol=eq.${encodeURIComponent(cleanSym)}`;
      if (exchange) {
        query += `&exchange=eq.${encodeURIComponent(exchange)}`;
      }
      await supabaseRest(query, { method: 'DELETE' });
    }
  },

  async deleteAllUserData(userId: string): Promise<void> {
    // Delete watchlists and items
    const watchlists = await this.listWatchlists(userId);
    for (const wl of watchlists) {
      await this.deleteWatchlist(userId, wl.id);
    }

    // Delete favorites
    for (const [id, f] of memoryStore.favorites.entries()) {
      if (f.userId === userId) {
        memoryStore.favorites.delete(id);
      }
    }

    // Delete preferences & profile
    await this.deletePreferences(userId);
    await this.deleteProfile(userId);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(`user_favorites?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    }
  },
};
