import type { Request, Response } from 'express';
import { userProfileService } from '../services/userProfileService.js';
import { userPreferencesService } from '../services/userPreferencesService.js';
import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';

export async function getProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const profile = await userProfileService.getProfile(req.user.id);
  sendSuccess(res, profile);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const updated = await userProfileService.updateProfile(req.user.id, req.body);
  sendSuccess(res, updated);
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const preferences = await userPreferencesService.getPreferences(req.user.id);
  sendSuccess(res, preferences);
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  const updated = await userPreferencesService.updatePreferences(req.user.id, req.body);
  sendSuccess(res, updated);
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }
  await authService.deleteAccount(req.user.id);
  sendSuccess(res, { message: 'Account and associated application data deleted successfully.' });
}
