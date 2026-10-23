import type { AppNotification, UserAlertPreferences } from '@equitylensai/shared';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { AppError } from '../../utils/appError.js';
import type {
  listNotificationsQuerySchema,
  updateAlertPreferencesSchema,
} from '../../validation/alertSchemas.js';
import type { z } from 'zod';

export class NotificationService {
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

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const success = await notificationRepository.deleteNotification(notificationId, userId);
    if (!success) {
      throw new AppError('NOTIFICATION_NOT_FOUND', `Notification '${notificationId}' not found`, 404);
    }
  }

  async getPreferences(userId: string): Promise<UserAlertPreferences> {
    return notificationRepository.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    updates: z.infer<typeof updateAlertPreferencesSchema>,
  ): Promise<UserAlertPreferences> {
    return notificationRepository.updatePreferences(userId, updates);
  }
}

export const notificationService = new NotificationService();
