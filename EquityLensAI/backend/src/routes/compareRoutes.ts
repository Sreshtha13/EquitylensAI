import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import {
  compareRequestSchema,
  peerDiscoveryQuerySchema,
  benchmarkRequestSchema,
  historicalCompareRequestSchema,
  aiComparisonRequestSchema,
  createSavedComparisonSchema,
  updateSavedComparisonSchema,
} from '../validation/compareSchemas.js';
import {
  compareCompanies,
  discoverPeers,
  calculateBenchmarks,
  compareHistory,
  analyzeComparisonAi,
  listSavedComparisons,
  getSavedComparison,
  createSavedComparison,
  updateSavedComparison,
  duplicateSavedComparison,
  deleteSavedComparison,
} from '../controllers/compareController.js';

export const compareRouter = Router();

// Core Comparison & Discovery
compareRouter.post(
  '/',
  validate({ body: compareRequestSchema }),
  asyncHandler(compareCompanies),
);

compareRouter.get(
  '/peers/:symbol',
  validate({ query: peerDiscoveryQuerySchema }),
  asyncHandler(discoverPeers),
);

compareRouter.post(
  '/benchmarks',
  validate({ body: benchmarkRequestSchema }),
  asyncHandler(calculateBenchmarks),
);

compareRouter.post(
  '/history',
  validate({ body: historicalCompareRequestSchema }),
  asyncHandler(compareHistory),
);

compareRouter.post(
  '/ai-analysis',
  aiRateLimit,
  validate({ body: aiComparisonRequestSchema }),
  asyncHandler(analyzeComparisonAi),
);

// Authenticated Saved Comparisons
compareRouter.get(
  '/saved',
  asyncHandler(requireAuth),
  asyncHandler(listSavedComparisons),
);

compareRouter.post(
  '/saved',
  asyncHandler(requireAuth),
  validate({ body: createSavedComparisonSchema }),
  asyncHandler(createSavedComparison),
);

compareRouter.get(
  '/saved/:id',
  asyncHandler(requireAuth),
  asyncHandler(getSavedComparison),
);

compareRouter.patch(
  '/saved/:id',
  asyncHandler(requireAuth),
  validate({ body: updateSavedComparisonSchema }),
  asyncHandler(updateSavedComparison),
);

compareRouter.delete(
  '/saved/:id',
  asyncHandler(requireAuth),
  asyncHandler(deleteSavedComparison),
);

compareRouter.post(
  '/saved/:id/duplicate',
  asyncHandler(requireAuth),
  asyncHandler(duplicateSavedComparison),
);
