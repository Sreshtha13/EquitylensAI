import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getFinancialAnalysis,
  getFinancialStatements,
  getHealthScore,
  getFinancialCacheStats,
} from '../controllers/financialController.js';

export const financialRouter = Router();

// GET /api/v1/financial/cache-stats
financialRouter.get('/cache-stats', asyncHandler(getFinancialCacheStats));

// GET /api/v1/financial/:symbol/analysis
financialRouter.get('/:symbol/analysis', asyncHandler(getFinancialAnalysis));

// GET /api/v1/financial/:symbol/statements
financialRouter.get('/:symbol/statements', asyncHandler(getFinancialStatements));

// GET /api/v1/financial/:symbol/health-score
financialRouter.get('/:symbol/health-score', asyncHandler(getHealthScore));
