import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { marketOverviewQuerySchema } from '../validation/market.js';
import { getMarketOverview, listProviders } from '../controllers/marketController.js';
import {
  getMarketIndices,
  getMarketBreadth,
  getTopGainers,
  getTopLosers,
  getVolumeShockers,
  getMostActive,
  getMostWatched,
  getTrendingStocks,
  getSectorPerformance,
  getHighsLows,
  getCircuits,
  getNewListings,
} from '../controllers/marketIntelligenceController.js';

export const marketRouter = Router();

// Legacy and Overview routes
marketRouter.get('/', validate({ query: marketOverviewQuerySchema }), getMarketOverview);
marketRouter.get('/overview', validate({ query: marketOverviewQuerySchema }), getMarketOverview);
marketRouter.get('/providers', listProviders);

// Market Intelligence Dashboard endpoints
marketRouter.get('/indices', getMarketIndices);
marketRouter.get('/breadth', getMarketBreadth);
marketRouter.get('/movers/gainers', getTopGainers);
marketRouter.get('/movers/losers', getTopLosers);
marketRouter.get('/movers/volume-shockers', getVolumeShockers);
marketRouter.get('/most-active', getMostActive);
marketRouter.get('/most-watched', getMostWatched);
marketRouter.get('/trending', getTrendingStocks);
marketRouter.get('/sectors', getSectorPerformance);
marketRouter.get('/highs-lows', getHighsLows);
marketRouter.get('/circuits', getCircuits);
marketRouter.get('/new-listings', getNewListings);
