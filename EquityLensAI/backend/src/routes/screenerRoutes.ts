import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { screenerRequestSchema } from '../ai/screener/screenerSchema.js';
import {
  createSavedScreenSchema,
  updateSavedScreenSchema,
  savedScreenParamsSchema,
  runSavedScreenSchema,
  screenerRunsQuerySchema,
  screenerRunParamsSchema,
} from '../validation/screenerSchemas.js';
import {
  getMetrics,
  getTemplates,
  runStructuredScreen,
  listSavedScreens,
  createSavedScreen,
  getSavedScreen,
  updateSavedScreen,
  deleteSavedScreen,
  duplicateSavedScreen,
  runSavedScreen,
  listScreenerRuns,
  getScreenerRun,
} from '../controllers/screenerController.js';

export const screenerRouter = Router();

// Public Screener Definitions & Execution
screenerRouter.get('/metrics', asyncHandler(getMetrics));
screenerRouter.get('/templates', asyncHandler(getTemplates));
screenerRouter.post(
  '/run',
  aiRateLimit,
  validate({ body: screenerRequestSchema }),
  asyncHandler(runStructuredScreen),
);

// Authenticated Saved Screens & Runs
screenerRouter.get('/saved', asyncHandler(requireAuth), asyncHandler(listSavedScreens));
screenerRouter.post(
  '/saved',
  asyncHandler(requireAuth),
  validate({ body: createSavedScreenSchema }),
  asyncHandler(createSavedScreen),
);
screenerRouter.get(
  '/saved/:screenId',
  asyncHandler(requireAuth),
  validate({ params: savedScreenParamsSchema }),
  asyncHandler(getSavedScreen),
);
screenerRouter.patch(
  '/saved/:screenId',
  asyncHandler(requireAuth),
  validate({ params: savedScreenParamsSchema, body: updateSavedScreenSchema }),
  asyncHandler(updateSavedScreen),
);
screenerRouter.delete(
  '/saved/:screenId',
  asyncHandler(requireAuth),
  validate({ params: savedScreenParamsSchema }),
  asyncHandler(deleteSavedScreen),
);
screenerRouter.post(
  '/saved/:screenId/run',
  asyncHandler(requireAuth),
  validate({ params: savedScreenParamsSchema, body: runSavedScreenSchema }),
  asyncHandler(runSavedScreen),
);
screenerRouter.post(
  '/saved/:screenId/duplicate',
  asyncHandler(requireAuth),
  validate({ params: savedScreenParamsSchema }),
  asyncHandler(duplicateSavedScreen),
);

// Screening Run History
screenerRouter.get(
  '/runs',
  asyncHandler(requireAuth),
  validate({ query: screenerRunsQuerySchema }),
  asyncHandler(listScreenerRuns),
);
screenerRouter.get(
  '/runs/:runId',
  asyncHandler(requireAuth),
  validate({ params: screenerRunParamsSchema }),
  asyncHandler(getScreenerRun),
);
