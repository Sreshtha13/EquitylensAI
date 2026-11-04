import { Router } from 'express';
import { notificationsController } from '../controllers/notificationsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const notificationsRouter = Router();

notificationsRouter.use(asyncHandler(requireAuth));

// Collection routes
notificationsRouter.get('/', asyncHandler(notificationsController.listNotifications));
notificationsRouter.get('/unread-count', asyncHandler(notificationsController.getUnreadCount));
notificationsRouter.patch('/read-all', asyncHandler(notificationsController.markAllRead));
notificationsRouter.get('/preferences', asyncHandler(notificationsController.getPreferences));
notificationsRouter.patch('/preferences', asyncHandler(notificationsController.updatePreferences));

// Browser push routes
notificationsRouter.get('/push/public-key', notificationsController.getPushPublicKey);
notificationsRouter.post('/push/subscribe', asyncHandler(notificationsController.subscribePush));
notificationsRouter.post('/push/unsubscribe', asyncHandler(notificationsController.unsubscribePush));

// Single item routes
notificationsRouter.patch(
  '/:notificationId/read',
  asyncHandler(notificationsController.markRead),
);
notificationsRouter.patch(
  '/:notificationId/archive',
  asyncHandler(notificationsController.archiveNotification),
);
notificationsRouter.patch(
  '/:notificationId/unarchive',
  asyncHandler(notificationsController.unarchiveNotification),
);
notificationsRouter.get(
  '/:notificationId/deliveries',
  asyncHandler(notificationsController.listDeliveries),
);
notificationsRouter.delete(
  '/:notificationId',
  asyncHandler(notificationsController.deleteNotification),
);
