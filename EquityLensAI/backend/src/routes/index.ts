import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { sendSuccess } from '../utils/response.js';

export const v1Router = Router();

v1Router.get('/', (_req, res) => {
  sendSuccess(res, {
    service: 'equitylensai-api',
    status: 'ok',
    version: 'v1',
    endpoints: {
      health: '/api/v1/health',
    },
  });
});

v1Router.use('/health', healthRouter);
