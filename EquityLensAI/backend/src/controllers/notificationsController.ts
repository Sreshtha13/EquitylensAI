import type { Request, Response } from 'express';
import { notificationService } from '../notifications/services/notificationService.js';
import { sendSuccess } from '../utils/response.js';
import {
  listNotificationsQuerySchema,
  updateAlertPreferencesSchema,
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

  async deleteNotification(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.notificationId!;
    await notificationService.deleteNotification(notificationId, userId);
    sendSuccess(res, { deleted: true, notificationId });
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
