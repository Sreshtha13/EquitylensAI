import type { AppNotification, UserAlertPreferences } from '@equitylensai/shared';
import { notificationRepository, type BrowserPushSubscription, type NotificationDeliveryRecord } from '../repositories/notificationRepository.js';
import { emailDeliveryService } from './emailDeliveryService.js';
import { pushNotificationService } from './pushNotificationService.js';
import { AppError } from '../../utils/appError.js';
import type {
  listNotificationsQuerySchema,
  updateAlertPreferencesSchema,
} from '../../validation/alertSchemas.js';
import type { z } from 'zod';

export class NotificationService {
  /**
   * Dispatches a notification across configured delivery channels (in-app, email, push).
   */
  async dispatchNotification(
    notification: AppNotification,
    deliveryChannels: Array<'in_app' | 'email' | 'push'> = ['in_app'],
  ): Promise<{ inApp: boolean; emailResult?: unknown; pushResult?: unknown }> {
    const preferences = await notificationRepository.getPreferences(notification.userId);

    let inAppCreated = false;
    // 1. In-App delivery
    if (deliveryChannels.includes('in_app') && preferences.inAppEnabled) {
      await notificationRepository.createNotification(notification);
      await notificationRepository.createDeliveryAttempt({
        id: crypto.randomUUID(),
        notificationId: notification.id,
        channel: 'in_app',
        status: 'delivered',
        attemptCount: 1,
        lastAttemptAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
      });
      inAppCreated = true;
    }

    // 2. Email delivery
    let emailResult: unknown;
    if (deliveryChannels.includes('email') && preferences.emailEnabled) {
      emailResult = await emailDeliveryService.processNotification(notification, preferences);
    }

    // 3. Browser Push delivery
    let pushResult: unknown;
    if (deliveryChannels.includes('push') && preferences.pushEnabled) {
      pushResult = await pushNotificationService.processNotification(notification, preferences);
    }

    return { inApp: inAppCreated, emailResult, pushResult };
  }

  async listNotifications(
    userId: string,
    query: z.infer<typeof listNotificationsQuerySchema>,
  ): Promise<{
    items: AppNotification[];
    total: number;
    unreadCount: number;
    limit: number;
    offset: number;
  }> {
    const { items, total, unreadCount } = await notificationRepository.listNotifications(userId, {
      unreadOnly: query.unreadOnly,
      category: query.category,
      archived: query.archived,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items,
      total,
      unreadCount,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await notificationRepository.getUnreadCount(userId);
    return { unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const success = await notificationRepository.markAsRead(notificationId, userId);
    if (!success) {
      throw new AppError('NOTIFICATION_NOT_FOUND', `Notification '${notificationId}' not found`, 404);
    }
  }

  async markAllAsRead(userId: string): Promise<{ markedRead: number }> {
    const markedRead = await notificationRepository.markAllAsRead(userId);
    return { markedRead };
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    const success = await notificationRepository.archiveNotification(notificationId, userId);
    if (!success) {
      throw new AppError('NOTIFICATION_NOT_FOUND', `Notification '${notificationId}' not found`, 404);
    }
  }

  async unarchiveNotification(notificationId: string, userId: string): Promise<void> {
    const success = await notificationRepository.unarchiveNotification(notificationId, userId);
    if (!success) {
      throw new AppError('NOTIFICATION_NOT_FOUND', `Notification '${notificationId}' not found`, 404);
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const success = await notificationRepository.deleteNotification(notificationId, userId);
    if (!success) {
      throw new AppError('NOTIFICATION_NOT_FOUND', `Notification '${notificationId}' not found`, 404);
    }
  }

  async listDeliveries(notificationId: string): Promise<NotificationDeliveryRecord[]> {
    return notificationRepository.listDeliveries(notificationId);
  }

  async subscribePush(
    userId: string,
    subscription: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
  ): Promise<BrowserPushSubscription> {
    return pushNotificationService.subscribe(userId, subscription);
  }

  async unsubscribePush(userId: string, endpoint: string): Promise<{ unsubscribed: boolean }> {
    const unsubscribed = await pushNotificationService.unsubscribe(userId, endpoint);
    return { unsubscribed };
  }

  getPushPublicKey(): { publicKey: string } {
    return pushNotificationService.getPublicKey();
  }

  async getPreferences(userId: string): Promise<UserAlertPreferences> {
    return notificationRepository.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    updates: z.infer<typeof updateAlertPreferencesSchema>,
  ): Promise<UserAlertPreferences> {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    ) as Partial<UserAlertPreferences>;
    return notificationRepository.updatePreferences(userId, cleanUpdates);
  }
}

export const notificationService = new NotificationService();
