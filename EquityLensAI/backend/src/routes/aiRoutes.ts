import { Router } from 'express';
import { AppError } from '../utils/appError.js';

export const aiRouter = Router();

aiRouter.all('/research', (_req, _res, next) => {
  next(new AppError('NOT_IMPLEMENTED', 'AI Research generation is scheduled for Phase 4 (Gemini LLM pipeline)', 501));
});
