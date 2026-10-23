import { Router } from 'express';
import { alertsController } from '../controllers/alertsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const alertsRouter = Router();

// Public metadata
alertsRouter.get('/supported-types', alertsController.getSupportedTypes);

// Authenticated endpoints
alertsRouter.get('/', asyncHandler(requireAuth), asyncHandler(alertsController.listAlerts));
alertsRouter.post('/', asyncHandler(requireAuth), asyncHandler(alertsController.createAlert));
alertsRouter.post('/preview', asyncHandler(requireAuth), asyncHandler(alertsController.previewAlert));
alertsRouter.post('/evaluate', asyncHandler(requireAuth), asyncHandler(alertsController.evaluateAlerts));
alertsRouter.get(
  '/scheduler-status',
  asyncHandler(requireAuth),
  alertsController.getSchedulerStatus,
);

alertsRouter.get('/:alertId', asyncHandler(requireAuth), asyncHandler(alertsController.getAlert));
alertsRouter.patch('/:alertId', asyncHandler(requireAuth), asyncHandler(alertsController.updateAlert));
alertsRouter.delete('/:alertId', asyncHandler(requireAuth), asyncHandler(alertsController.deleteAlert));
alertsRouter.post(
  '/:alertId/enable',
  asyncHandler(requireAuth),
  asyncHandler(alertsController.enableAlert),
);
alertsRouter.post(
  '/:alertId/disable',
  asyncHandler(requireAuth),
  asyncHandler(alertsController.disableAlert),
);
alertsRouter.get('/:alertId/events', asyncHandler(requireAuth), asyncHandler(alertsController.listEvents));
