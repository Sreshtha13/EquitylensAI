import { Router } from 'express';
import { runResearch, researchRequestSchema } from '../ai/research/index.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../utils/response.js';
import {
  getScreenerMetricCatalog,
  interpretScreenerQuery,
  runScreener,
  screenerInterpretationRequestSchema,
  screenerRequestSchema,
} from '../ai/screener/index.js';
import { aiComparisonRequestSchema } from '../validation/compareSchemas.js';
import { analyzeComparisonAi } from '../controllers/compareController.js';

export const aiRouter = Router();

aiRouter.post(
  '/comparison-analysis',
  aiRateLimit,
  validate({ body: aiComparisonRequestSchema }),
  asyncHandler(analyzeComparisonAi),
);

aiRouter.post(
  '/research',
  aiRateLimit,
  (req, _res, next) => {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 8192) {
      next(new AppError('VALIDATION_ERROR', 'Research request body exceeds the 8 KB limit.', 413));
      return;
    }
    next();
  },
  validate({ body: researchRequestSchema }),
  asyncHandler(async (req, res) => {
    const research = await runResearch(req.body, req.requestId);
    sendSuccess(res, research);
  }),
);

aiRouter.get('/screener/metrics', (_req, res) => {
  sendSuccess(res, getScreenerMetricCatalog());
});

aiRouter.post(
  '/screener/interpret',
  aiRateLimit,
  (req, _res, next) => {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 8192) {
      next(new AppError('VALIDATION_ERROR', 'Screener query body exceeds the 8 KB limit.', 413));
      return;
    }
    next();
  },
  validate({ body: screenerInterpretationRequestSchema }),
  asyncHandler(async (req, res) => {
    const interpretation = await interpretScreenerQuery(req.body, req.requestId);
    sendSuccess(res, interpretation);
  }),
);

aiRouter.post(
  '/screener',
  aiRateLimit,
  (req, _res, next) => {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 8192) {
      next(new AppError('VALIDATION_ERROR', 'Screener request body exceeds the 8 KB limit.', 413));
      return;
    }
    next();
  },
  validate({ body: screenerRequestSchema }),
  asyncHandler(async (req, res) => {
    const result = await runScreener(req.body);
    sendSuccess(res, result);
  }),
);

aiRouter.all('/research', (_req, res, next) => {
  res.setHeader('Allow', 'POST');
  next(
    new AppError('METHOD_NOT_ALLOWED', 'Use POST /api/v1/ai/research to request AI research.', 405),
  );
});

aiRouter.all('/screener/interpret', (_req, res, next) => {
  res.setHeader('Allow', 'POST');
  next(
    new AppError(
      'METHOD_NOT_ALLOWED',
      'Use POST /api/v1/ai/screener/interpret to interpret screening criteria.',
      405,
    ),
  );
});

aiRouter.all('/screener/metrics', (_req, res, next) => {
  res.setHeader('Allow', 'GET');
  next(
    new AppError(
      'METHOD_NOT_ALLOWED',
      'Use GET /api/v1/ai/screener/metrics to list supported screening metrics.',
      405,
    ),
  );
});

aiRouter.all('/screener', (_req, res, next) => {
  res.setHeader('Allow', 'POST');
  next(
    new AppError(
      'METHOD_NOT_ALLOWED',
      'Use POST /api/v1/ai/screener to submit a validated screener request.',
      405,
    ),
  );
});
