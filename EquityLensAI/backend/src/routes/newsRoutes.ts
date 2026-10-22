import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { newsQuerySchema, newsParamsSchema } from '../validation/news.js';
import {
  getMarketNews,
  getNewsDetail,
  summarizeNews,
  triggerNewsIngestion,
  getNewsIngestStatus,
} from '../controllers/newsController.js';

export const newsRouter = Router();

newsRouter.get('/', validate({ query: newsQuerySchema }), getMarketNews);
newsRouter.get('/status', getNewsIngestStatus);
newsRouter.post('/ingest', triggerNewsIngestion);
newsRouter.get('/:newsId', validate({ params: newsParamsSchema }), getNewsDetail);
newsRouter.get('/:newsId/summarize', validate({ params: newsParamsSchema }), summarizeNews);
