import type { Request, Response } from 'express';
import { notificationService } from '../notifications/services/notificationService.js';
import { sendSuccess } from '../utils/response.js';
import {
  listNotificationsQuerySchema,
  updateAlertPreferencesSchema,
  subscribePushSchema,
} from '../validation/alertSchemas.js';

export const notificationsController = {
  async listNotifications(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await notificationService.listNotifications(userId, query);
    sendSuccess(res, result);
  },

  async getUnreadCount(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await notificationService.getUnreadCount(userId);
    sendSuccess(res, result);
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.notificationId!;
    await notificationService.markAsRead(notificationId, userId);
    sendSuccess(res, { markedRead: true, notificationId });
  },

  async markAllRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await notificationService.markAllAsRead(userId);
    sendSuccess(res, result);
  },

  async archiveNotification(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.notificationId!;
    await notificationService.archiveNotification(notificationId, userId);
    sendSuccess(res, { archived: true, notificationId });
  },

  async unarchiveNotification(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.notificationId!;
    await notificationService.unarchiveNotification(notificationId, userId);
    sendSuccess(res, { archived: false, notificationId });
  },

  async deleteNotification(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.notificationId!;
    await notificationService.deleteNotification(notificationId, userId);
    sendSuccess(res, { deleted: true, notificationId });
  },

  async listDeliveries(req: Request, res: Response): Promise<void> {
    const notificationId = req.params.notificationId!;
    const deliveries = await notificationService.listDeliveries(notificationId);
    sendSuccess(res, { deliveries, count: deliveries.length });
  },

  async subscribePush(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = subscribePushSchema.parse(req.body);
    const sub = await notificationService.subscribePush(userId, {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    });
    sendSuccess(res, sub, 201);
  },

  async unsubscribePush(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const endpoint = req.body?.endpoint as string;
    const result = await notificationService.unsubscribePush(userId, endpoint || '');
    sendSuccess(res, result);
  },

  getPushPublicKey(_req: Request, res: Response): void {
    const key = notificationService.getPushPublicKey();
    sendSuccess(res, key);
  },

  async getPreferences(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const preferences = await notificationService.getPreferences(userId);
    sendSuccess(res, preferences);
  },

  async updatePreferences(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = updateAlertPreferencesSchema.parse(req.body);
    const updated = await notificationService.updatePreferences(userId, input);
    sendSuccess(res, updated);
  },
};
