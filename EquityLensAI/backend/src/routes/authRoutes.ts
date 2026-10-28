import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validation/auth.js';
import {
  register,
  login,
  logout,
  getSession,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';

import { authEndpointLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/register', authEndpointLimiter.middleware(), validate({ body: registerSchema }), asyncHandler(register));
authRouter.post('/login', authEndpointLimiter.middleware(), validate({ body: loginSchema }), asyncHandler(login));
authRouter.post('/logout', asyncHandler(logout));
authRouter.get('/session', requireAuth, asyncHandler(getSession));
authRouter.post(
  '/forgot-password',
  authEndpointLimiter.middleware(),
  validate({ body: forgotPasswordSchema }),
  asyncHandler(forgotPassword),
);
authRouter.post(
  '/reset-password',
  authEndpointLimiter.middleware(),
  validate({ body: resetPasswordSchema }),
  asyncHandler(resetPassword),
);
