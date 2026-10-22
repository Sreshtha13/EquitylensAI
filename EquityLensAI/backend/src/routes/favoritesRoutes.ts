import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addFavoriteSchema,
  favoriteParamsSchema,
  favoriteQuerySchema,
} from '../validation/auth.js';
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController.js';

export const favoritesRouter = Router();

favoritesRouter.use(asyncHandler(requireAuth));

favoritesRouter.get('/', asyncHandler(listFavorites));
favoritesRouter.post('/', validate({ body: addFavoriteSchema }), asyncHandler(addFavorite));
favoritesRouter.delete(
  '/:symbol',
  validate({ params: favoriteParamsSchema, query: favoriteQuerySchema }),
  asyncHandler(removeFavorite),
);
