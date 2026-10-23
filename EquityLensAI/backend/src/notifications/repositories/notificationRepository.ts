import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type {
  AppNotification,
  UserAlertPreferences,
  NotificationCategory,
  SupportedExchange,
} from '@equitylensai/shared';

interface NotificationDbRow {
  id: string;
  user_id: string;
  alert_event_id: string | null;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  read_at: string | null;
  symbol: string | null;
  exchange: SupportedExchange | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserAlertPreferencesDbRow {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_address: string | null;
  price_alerts: boolean;
  percentage_alerts: boolean;
  volume_alerts: boolean;
  financial_alerts: boolean;
  announcement_alerts: boolean;
  news_alerts: boolean;
  digest_frequency: 'realtime' | 'daily' | 'off';
  updated_at: string;
}

class MemoryNotificationStore {
  notifications = new Map<string, AppNotification>(); // notificationId -> AppNotification
  preferences = new Map<string, UserAlertPreferences>(); // userId -> UserAlertPreferences

  clear(): void {
    this.notifications.clear();
    this.preferences.clear();
  }
}

export const memoryNotificationStore = new MemoryNotificationStore();

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

function mapNotificationRowToDomain(row: NotificationDbRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    alertEventId: row.alert_event_id,
    category: row.category,
    title: row.title,
    message: row.message,
    read: Boolean(row.read),
    readAt: row.read_at,
    symbol: row.symbol,
    exchange: row.exchange,
    sourceUrl: row.source_url,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

const DEFAULT_PREFERENCES = (userId: string): UserAlertPreferences => ({
  userId,
  inAppEnabled: true,
  emailEnabled: false,
  emailAddress: null,
  priceAlerts: true,
  percentageAlerts: true,
  volumeAlerts: true,
  financialAlerts: true,
  announcementAlerts: true,
  newsAlerts: true,
  digestFrequency: 'realtime',
  updatedAt: new Date().toISOString(),
});

export const notificationRepository = {
  async createNotification(notification: AppNotification): Promise<AppNotification> {
    memoryNotificationStore.notifications.set(notification.id, notification);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('notifications', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: notification.id,
          user_id: notification.userId,
          alert_event_id: notification.alertEventId ?? null,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          read_at: notification.readAt,
          symbol: notification.symbol,
          exchange: notification.exchange,
          source_url: notification.sourceUrl,
          metadata: notification.metadata ?? {},
          created_at: notification.createdAt,
        }),
      });
    }

    return notification;
  },

  async listNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean | undefined;
      category?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    },
  ): Promise<{ items: AppNotification[]; total: number; unreadCount: number }> {
    const unreadCount = await this.getUnreadCount(userId);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `notifications?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
      if (options?.unreadOnly) {
        query += `&read=eq.false`;
      }
      if (options?.category) {
        query += `&category=eq.${encodeURIComponent(options.category)}`;
      }
      if (options?.limit) {
        query += `&limit=${options.limit}`;
      }
      if (options?.offset) {
        query += `&offset=${options.offset}`;
      }

      const { data, ok } = await supabaseRest<NotificationDbRow[]>(query, {
        headers: { Prefer: 'count=exact' },
      });
      if (ok && data) {
        const items = data.map(mapNotificationRowToDomain);
        return { items, total: items.length, unreadCount };
      }
    }

    let items = Array.from(memoryNotificationStore.notifications.values()).filter(
      (n) => n.userId === userId,
    );

    if (options?.unreadOnly) {
      items = items.filter((n) => !n.read);
    }
    if (options?.category) {
      items = items.filter((n) => n.category === options.category);
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = items.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    items = items.slice(offset, offset + limit);

    return { items, total, unreadCount };
  },

  async getUnreadCount(userId: string): Promise<number> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<Array<{ id: string }>>(
        `notifications?user_id=eq.${encodeURIComponent(userId)}&read=eq.false&select=id`,
      );
      if (ok && data) {
        return data.length;
      }
    }

    return Array.from(memoryNotificationStore.notifications.values()).filter(
      (n) => n.userId === userId && !n.read,
    ).length;
  },

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const existing = memoryNotificationStore.notifications.get(notificationId);
    if (existing && existing.userId === userId) {
      existing.read = true;
      existing.readAt = new Date().toISOString();
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { ok } = await supabaseRest(
        `notifications?id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            read: true,
            read_at: new Date().toISOString(),
          }),
        },
      );
      return ok;
    }

    return Boolean(existing && existing.userId === userId);
  },

  async markAllAsRead(userId: string): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const notification of memoryNotificationStore.notifications.values()) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        notification.readAt = now;
        count++;
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `notifications?user_id=eq.${encodeURIComponent(userId)}&read=eq.false`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            read: true,
            read_at: now,
          }),
        },
      );
    }

    return count;
  },

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const existing = memoryNotificationStore.notifications.get(notificationId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    memoryNotificationStore.notifications.delete(notificationId);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `notifications?id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        },
      );
    }

    return true;
  },

  async getPreferences(userId: string): Promise<UserAlertPreferences> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<UserAlertPreferencesDbRow[]>(
        `user_alert_preferences?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data && data.length > 0) {
        const row = data[0]!;
        return {
          userId: row.user_id,
          inAppEnabled: Boolean(row.in_app_enabled),
          emailEnabled: Boolean(row.email_enabled),
          emailAddress: row.email_address,
          priceAlerts: Boolean(row.price_alerts),
          percentageAlerts: Boolean(row.percentage_alerts),
          volumeAlerts: Boolean(row.volume_alerts),
          financialAlerts: Boolean(row.financial_alerts),
          announcementAlerts: Boolean(row.announcement_alerts),
          newsAlerts: Boolean(row.news_alerts),
          digestFrequency: row.digest_frequency,
          updatedAt: row.updated_at,
        };
      }
    }

    if (!memoryNotificationStore.preferences.has(userId)) {
      memoryNotificationStore.preferences.set(userId, DEFAULT_PREFERENCES(userId));
    }
    return memoryNotificationStore.preferences.get(userId)!;
  },

  async updatePreferences(
    userId: string,
    updates: {
      inAppEnabled?: boolean | undefined;
      emailEnabled?: boolean | undefined;
      emailAddress?: string | null | undefined;
      priceAlerts?: boolean | undefined;
      percentageAlerts?: boolean | undefined;
      volumeAlerts?: boolean | undefined;
      financialAlerts?: boolean | undefined;
      announcementAlerts?: boolean | undefined;
      newsAlerts?: boolean | undefined;
      digestFrequency?: 'realtime' | 'daily' | 'off' | undefined;
    },
  ): Promise<UserAlertPreferences> {
    const current = await this.getPreferences(userId);
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    const updated: UserAlertPreferences = {
      ...current,
      ...cleanedUpdates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    memoryNotificationStore.preferences.set(userId, updated);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('user_alert_preferences?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          in_app_enabled: updated.inAppEnabled,
          email_enabled: updated.emailEnabled,
          email_address: updated.emailAddress,
          price_alerts: updated.priceAlerts,
          percentage_alerts: updated.percentageAlerts,
          volume_alerts: updated.volumeAlerts,
          financial_alerts: updated.financialAlerts,
          announcement_alerts: updated.announcementAlerts,
          news_alerts: updated.newsAlerts,
          digest_frequency: updated.digestFrequency,
          updated_at: updated.updatedAt,
        }),
      });
    }

    return updated;
  },
};
