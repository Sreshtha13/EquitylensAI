import type { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  sendSuccess(res, result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  await authService.logout(token);
  sendSuccess(res, { message: 'Logged out successfully' });
}

export async function getSession(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  sendSuccess(res, { user: req.user });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, {
    message: 'If an account exists for this email, password recovery instructions have been sent.',
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Recovery token is required', 401);
  }
  await authService.resetPassword(token, req.body.password);
  sendSuccess(res, { message: 'Password updated successfully' });
}
