import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { stocksRouter } from './stocksRoutes.js';
import { marketRouter } from './marketRoutes.js';
import { financialRouter } from './financialRoutes.js';
import { aiRouter } from './aiRoutes.js';
import { watchlistsRouter } from './watchlistsRoutes.js';
import { authRouter } from './authRoutes.js';
import { userRouter } from './userRoutes.js';
import { favoritesRouter } from './favoritesRoutes.js';
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
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        logout: 'POST /api/v1/auth/logout',
        session: 'GET /api/v1/auth/session',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
      },
      users: {
        profile: 'GET, PATCH /api/v1/users/me',
        deleteAccount: 'DELETE /api/v1/users/me',
        preferences: 'GET, PATCH /api/v1/users/me/preferences',
      },
      watchlists: {
        list: 'GET /api/v1/watchlists',
        create: 'POST /api/v1/watchlists',
        detail: 'GET /api/v1/watchlists/:watchlistId',
        update: 'PATCH /api/v1/watchlists/:watchlistId',
        delete: 'DELETE /api/v1/watchlists/:watchlistId',
        addItem: 'POST /api/v1/watchlists/:watchlistId/items',
        removeItem: 'DELETE /api/v1/watchlists/:watchlistId/items/:symbol',
        reorder: 'PATCH /api/v1/watchlists/:watchlistId/items/reorder',
      },
      favorites: {
        list: 'GET /api/v1/favorites',
        add: 'POST /api/v1/favorites',
        remove: 'DELETE /api/v1/favorites/:symbol',
      },
      stocks: {
        search: '/api/v1/stocks/search?q={query}',
        quote: '/api/v1/stocks/{symbol}/quote',
        profile: '/api/v1/stocks/{symbol}/profile?exchange={exchange}',
        performance: '/api/v1/stocks/{symbol}/performance?exchange={exchange}',
        resolve: '/api/v1/stocks/{symbol}/resolve?exchange={exchange}',
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
        research: 'POST /api/v1/ai/research',
        screenerMetrics: 'GET /api/v1/ai/screener/metrics',
        screenerInterpret: 'POST /api/v1/ai/screener/interpret',
        screenerExecute: 'POST /api/v1/ai/screener',
      },
    },
  });
});

v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', userRouter);
v1Router.use('/stocks', stocksRouter);
v1Router.use('/market', marketRouter);
v1Router.use('/financial', financialRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/watchlists', watchlistsRouter);
v1Router.use('/favorites', favoritesRouter);

