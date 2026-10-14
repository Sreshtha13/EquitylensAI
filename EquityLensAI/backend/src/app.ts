import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { getEnv } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { sanitizeRequest } from './middleware/sanitizeRequest.js';
import { v1Router } from './routes/index.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { sendSuccess } from './utils/response.js';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(hpp());
  app.use(requestId);
  app.use(sanitizeRequest);
  app.use(requestLogger);

  app.get(['/', '/api'], (_req, res) => {
    sendSuccess(res, {
      service: 'equitylensai-api',
      status: 'ok',
      version: 'v1',
      health: '/api/v1/health',
    });
  });

  app.use('/api/v1', v1Router);

  app.use(asyncHandler(notFoundHandler));
  app.use(errorHandler);

  return app;
}
