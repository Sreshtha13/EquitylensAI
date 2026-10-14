import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  searchInstrumentsQuerySchema,
  quoteParamsSchema,
  quoteQuerySchema,
  historicalParamsSchema,
  historicalQuerySchema,
} from '../validation/market.js';
import {
  searchStocks,
  getStockQuote,
  getStockHistorical,
  triggerIngestion,
  getIngestStatus,
} from '../controllers/stocksController.js';

export const stocksRouter = Router();

stocksRouter.get('/search', validate({ query: searchInstrumentsQuerySchema }), searchStocks);

stocksRouter.get(
  '/:symbol/quote',
  validate({ params: quoteParamsSchema, query: quoteQuerySchema }),
  getStockQuote
);

stocksRouter.get(
  '/:symbol/history',
  validate({ params: historicalParamsSchema, query: historicalQuerySchema }),
  getStockHistorical
);

stocksRouter.post('/ingest', triggerIngestion);
stocksRouter.get('/ingest/status', getIngestStatus);
