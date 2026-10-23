import { Router } from 'express';
import { notificationsController } from '../controllers/notificationsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const notificationsRouter = Router();

notificationsRouter.use(asyncHandler(requireAuth));

notificationsRouter.get('/', asyncHandler(notificationsController.listNotifications));
notificationsRouter.get('/unread-count', asyncHandler(notificationsController.getUnreadCount));
notificationsRouter.patch('/read-all', asyncHandler(notificationsController.markAllRead));
notificationsRouter.get('/preferences', asyncHandler(notificationsController.getPreferences));
notificationsRouter.patch('/preferences', asyncHandler(notificationsController.updatePreferences));

notificationsRouter.patch(
  '/:notificationId/read',
  asyncHandler(notificationsController.markRead),
);
notificationsRouter.delete(
  '/:notificationId',
  asyncHandler(notificationsController.deleteNotification),
);
