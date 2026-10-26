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
import { newsRouter } from './newsRoutes.js';
import { announcementsRouter } from './announcementsRoutes.js';
import { alertsRouter } from './alertsRoutes.js';
import { notificationsRouter } from './notificationsRoutes.js';
import { portfolioRouter } from './portfolioRoutes.js';
import { screenerRouter } from './screenerRoutes.js';
import { compareRouter } from './compareRoutes.js';
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
        watchlistNews: 'GET /api/v1/users/me/watchlist-news',
      },
      portfolios: {
        list: 'GET /api/v1/portfolios',
        create: 'POST /api/v1/portfolios',
        detail: 'GET, PATCH, DELETE /api/v1/portfolios/:portfolioId',
        holdings: 'GET /api/v1/portfolios/:portfolioId/holdings',
        summary: 'GET /api/v1/portfolios/:portfolioId/summary',
        allocation: 'GET /api/v1/portfolios/:portfolioId/allocation',
        performance: 'GET /api/v1/portfolios/:portfolioId/performance?range={1M|3M|6M|1Y|3Y|ALL}',
        transactions: 'GET, POST /api/v1/portfolios/:portfolioId/transactions',
        transactionDetail: 'GET, PATCH, DELETE /api/v1/portfolios/:portfolioId/transactions/:transactionId',
        exportCsv: 'GET /api/v1/portfolios/:portfolioId/transactions/export',
        previewImport: 'POST /api/v1/portfolios/:portfolioId/import/preview',
        confirmImport: 'POST /api/v1/portfolios/:portfolioId/import/confirm',
      },
      screener: {
        run: 'POST /api/v1/screener/run',
        metrics: 'GET /api/v1/screener/metrics',
        templates: 'GET /api/v1/screener/templates',
        saved: 'GET, POST /api/v1/screener/saved',
        savedDetail: 'GET, PATCH, DELETE /api/v1/screener/saved/:screenId',
        savedRun: 'POST /api/v1/screener/saved/:screenId/run',
        savedDuplicate: 'POST /api/v1/screener/saved/:screenId/duplicate',
        runs: 'GET /api/v1/screener/runs',
        runDetail: 'GET /api/v1/screener/runs/:runId',
      },
      alerts: {
        list: 'GET /api/v1/alerts',
        create: 'POST /api/v1/alerts',
        supportedTypes: 'GET /api/v1/alerts/supported-types',
        preview: 'POST /api/v1/alerts/preview',
        evaluate: 'POST /api/v1/alerts/evaluate',
        schedulerStatus: 'GET /api/v1/alerts/scheduler-status',
        detail: 'GET, PATCH, DELETE /api/v1/alerts/:alertId',
        enable: 'POST /api/v1/alerts/:alertId/enable',
        disable: 'POST /api/v1/alerts/:alertId/disable',
        events: 'GET /api/v1/alerts/:alertId/events',
      },
      notifications: {
        list: 'GET /api/v1/notifications',
        unreadCount: 'GET /api/v1/notifications/unread-count',
        markRead: 'PATCH /api/v1/notifications/:notificationId/read',
        markAllRead: 'PATCH /api/v1/notifications/read-all',
        delete: 'DELETE /api/v1/notifications/:notificationId',
        preferences: 'GET, PATCH /api/v1/notifications/preferences',
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
      news: {
        marketNews: 'GET /api/v1/news?category=&limit=&page=',
        newsDetail: 'GET /api/v1/news/:newsId',
        summarize: 'GET /api/v1/news/:newsId/summarize',
        status: 'GET /api/v1/news/status',
        ingest: 'POST /api/v1/news/ingest',
      },
      announcements: {
        feed: 'GET /api/v1/announcements?category=&exchange=&limit=&page=',
        detail: 'GET /api/v1/announcements/:announcementId',
        summarize: 'GET /api/v1/announcements/:announcementId/summarize',
      },
      stocks: {
        search: '/api/v1/stocks/search?q={query}',
        quote: '/api/v1/stocks/{symbol}/quote',
        profile: '/api/v1/stocks/{symbol}/profile?exchange={exchange}',
        performance: '/api/v1/stocks/{symbol}/performance?exchange={exchange}',
        news: '/api/v1/stocks/{symbol}/news?exchange={exchange}',
        announcements: '/api/v1/stocks/{symbol}/announcements?exchange={exchange}',
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
      compare: {
        compareCompanies: 'POST /api/v1/compare',
        peers: 'GET /api/v1/compare/peers/:symbol',
        benchmarks: 'POST /api/v1/compare/benchmarks',
        history: 'POST /api/v1/compare/history',
        aiAnalysis: 'POST /api/v1/compare/ai-analysis (or /api/v1/ai/comparison-analysis)',
        saved: 'GET, POST /api/v1/compare/saved',
        savedDetail: 'GET, PATCH, DELETE /api/v1/compare/saved/:id',
        savedDuplicate: 'POST /api/v1/compare/saved/:id/duplicate',
      },
      ai: {
        research: 'POST /api/v1/ai/research',
        comparisonAnalysis: 'POST /api/v1/ai/comparison-analysis',
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
v1Router.use('/portfolios', portfolioRouter);
v1Router.use('/screener', screenerRouter);
v1Router.use('/compare', compareRouter);
v1Router.use('/alerts', alertsRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/stocks', stocksRouter);
v1Router.use('/market', marketRouter);
v1Router.use('/financial', financialRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/watchlists', watchlistsRouter);
v1Router.use('/favorites', favoritesRouter);
v1Router.use('/news', newsRouter);
v1Router.use('/announcements', announcementsRouter);

