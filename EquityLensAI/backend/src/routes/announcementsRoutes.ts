import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { announcementsQuerySchema, announcementParamsSchema } from '../validation/news.js';
import {
  getAnnouncements,
  getAnnouncementDetail,
  summarizeAnnouncement,
} from '../controllers/newsController.js';

export const announcementsRouter = Router();

announcementsRouter.get('/', validate({ query: announcementsQuerySchema }), getAnnouncements);
announcementsRouter.get(
  '/:announcementId',
  validate({ params: announcementParamsSchema }),
  getAnnouncementDetail,
);
announcementsRouter.get(
  '/:announcementId/summarize',
  validate({ params: announcementParamsSchema }),
  summarizeAnnouncement,
);
