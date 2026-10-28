import { Router } from 'express';
import {
  getHealth,
  getReadiness,
  getDependencies,
} from '../controllers/healthController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/ready', asyncHandler(getReadiness));
healthRouter.get('/dependencies', asyncHandler(getDependencies));
