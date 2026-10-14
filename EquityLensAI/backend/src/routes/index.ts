import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { stocksRouter } from './stocksRoutes.js';
import { marketRouter } from './marketRoutes.js';
import { sendSuccess } from '../utils/response.js';

export const v1Router = Router();

v1Router.get('/', (_req, res) => {
  sendSuccess(res, {
    service: 'equitylensai-api',
    status: 'ok',
    version: 'v1',
    endpoints: {
      health: '/api/v1/health',
      docs: '/docs',
      openapi: '/api/v1/openapi.json',
      stocks: {
        search: '/api/v1/stocks/search?q={query}',
        quote: '/api/v1/stocks/{symbol}/quote',
        history: '/api/v1/stocks/{symbol}/history?interval={interval}&from={from}&to={to}',
        ingest: '/api/v1/stocks/ingest',
        ingestStatus: '/api/v1/stocks/ingest/status',
      },
      market: {
        overview: '/api/v1/market/overview?market={market}',
        providers: '/api/v1/market/providers',
      },
    },
  });
});

v1Router.use('/health', healthRouter);
v1Router.use('/stocks', stocksRouter);
v1Router.use('/market', marketRouter);
