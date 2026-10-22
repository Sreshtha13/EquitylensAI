import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createWatchlistSchema,
  updateWatchlistSchema,
  watchlistParamsSchema,
  addWatchlistItemSchema,
  watchlistItemParamsSchema,
  watchlistItemQuerySchema,
} from '../validation/auth.js';
import {
  listWatchlists,
  createWatchlist,
  getWatchlistDetail,
  updateWatchlist,
  deleteWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  reorderWatchlistItems,
} from '../controllers/watchlistsController.js';

export const watchlistsRouter = Router();

watchlistsRouter.use(asyncHandler(requireAuth));

watchlistsRouter.get('/', asyncHandler(listWatchlists));
watchlistsRouter.post(
  '/',
  validate({ body: createWatchlistSchema }),
  asyncHandler(createWatchlist),
);

watchlistsRouter.get(
  '/:watchlistId',
  validate({ params: watchlistParamsSchema }),
  asyncHandler(getWatchlistDetail),
);

watchlistsRouter.patch(
  '/:watchlistId',
  validate({ params: watchlistParamsSchema, body: updateWatchlistSchema }),
  asyncHandler(updateWatchlist),
);

watchlistsRouter.delete(
  '/:watchlistId',
  validate({ params: watchlistParamsSchema }),
  asyncHandler(deleteWatchlist),
);

watchlistsRouter.post(
  '/:watchlistId/items',
  validate({ params: watchlistParamsSchema, body: addWatchlistItemSchema }),
  asyncHandler(addWatchlistItem),
);

watchlistsRouter.delete(
  '/:watchlistId/items/:symbol',
  validate({ params: watchlistItemParamsSchema, query: watchlistItemQuerySchema }),
  asyncHandler(removeWatchlistItem),
);

watchlistsRouter.patch(
  '/:watchlistId/items/reorder',
  validate({ params: watchlistParamsSchema }),
  asyncHandler(reorderWatchlistItems),
);
