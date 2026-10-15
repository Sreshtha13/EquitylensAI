import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { marketOverviewQuerySchema } from '../validation/market.js';
import { getMarketOverview, listProviders } from '../controllers/marketController.js';

export const marketRouter = Router();

marketRouter.get('/', validate({ query: marketOverviewQuerySchema }), getMarketOverview);
marketRouter.get('/overview', validate({ query: marketOverviewQuerySchema }), getMarketOverview);
marketRouter.get('/providers', listProviders);
