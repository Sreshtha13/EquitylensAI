import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  updateProfileSchema,
  deleteAccountSchema,
  updatePreferencesSchema,
} from '../validation/auth.js';
import {
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
  deleteAccount,
} from '../controllers/userController.js';

export const userRouter = Router();

userRouter.use(asyncHandler(requireAuth));

userRouter.get('/me', asyncHandler(getProfile));
userRouter.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(updateProfile));
userRouter.delete('/me', validate({ body: deleteAccountSchema }), asyncHandler(deleteAccount));

userRouter.get('/me/preferences', asyncHandler(getPreferences));
userRouter.patch(
  '/me/preferences',
  validate({ body: updatePreferencesSchema }),
  asyncHandler(updatePreferences),
);
