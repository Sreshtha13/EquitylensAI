import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { stocksRouter } from './stocksRoutes.js';
import { marketRouter } from './marketRoutes.js';
import { financialRouter } from './financialRoutes.js';
import { aiRouter } from './aiRoutes.js';
import { watchlistsRouter } from './watchlistsRoutes.js';
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
      financial: {
        analysis: '/api/v1/financial/{symbol}/analysis?exchange={exchange}&periods={periods}',
        statements: '/api/v1/financial/{symbol}/statements',
        healthScore: '/api/v1/financial/{symbol}/health-score',
        cacheStats: '/api/v1/financial/cache-stats',
      },
      ai: {
        research: '/api/v1/ai/research (Phase 4)',
      },
      watchlists: '/api/v1/watchlists (Phase 5)',
    },
  });
});

v1Router.use('/health', healthRouter);
v1Router.use('/stocks', stocksRouter);
v1Router.use('/market', marketRouter);
v1Router.use('/financial', financialRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/watchlists', watchlistsRouter);
