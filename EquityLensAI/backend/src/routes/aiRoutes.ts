import { Router } from 'express';
import { runResearch, researchRequestSchema } from '../ai/research/index.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../utils/response.js';

export const aiRouter = Router();

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

aiRouter.all('/research', (_req, res, next) => {
  res.setHeader('Allow', 'POST');
  next(
    new AppError('METHOD_NOT_ALLOWED', 'Use POST /api/v1/ai/research to request AI research.', 405),
  );
});
