import { z } from 'zod';
import {
  SUPPORTED_EXCHANGES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_PERIODS,
  SUPPORTED_LANDING_PAGES,
  THEME_OPTIONS,
  TABLE_DENSITY_OPTIONS,
} from '@equitylensai/shared';

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be 100 characters or fewer')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().trim().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be 100 characters or fewer')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).nullable().optional(),
  avatarUrl: z.string().trim().url('Invalid avatar URL').nullable().optional(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE_ACCOUNT', {
    errorMap: () => ({ message: "Must explicitly provide 'DELETE_ACCOUNT' to confirm deletion" }),
  }),
});

export const updatePreferencesSchema = z.object({
  defaultExchange: z.enum(SUPPORTED_EXCHANGES).optional(),
  preferredCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  preferredPeriod: z.enum(SUPPORTED_PERIODS).optional(),
  defaultLandingPage: z.enum(SUPPORTED_LANDING_PAGES).optional(),
  theme: z.enum(THEME_OPTIONS).optional(),
  tableDensity: z.enum(TABLE_DENSITY_OPTIONS).optional(),
});

export const createWatchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Watchlist name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .nullable()
    .optional(),
});

export const updateWatchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Watchlist name cannot be empty')
    .max(100, 'Name must be 100 characters or fewer')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .nullable()
    .optional(),
});

export const watchlistParamsSchema = z.object({
  watchlistId: z.string().trim().min(1, 'Watchlist ID is required'),
});

export const addWatchlistItemSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid symbol format'),
  exchange: z.enum(SUPPORTED_EXCHANGES).default('NSE'),
  sortOrder: z.number().int().optional(),
});

export const watchlistItemParamsSchema = z.object({
  watchlistId: z.string().trim().min(1, 'Watchlist ID is required'),
  symbol: z.string().trim().min(1, 'Symbol is required'),
});

export const watchlistItemQuerySchema = z.object({
  exchange: z.enum(SUPPORTED_EXCHANGES).optional(),
});

export const addFavoriteSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid symbol format'),
  exchange: z.enum(SUPPORTED_EXCHANGES).default('NSE'),
});

export const favoriteParamsSchema = z.object({
  symbol: z.string().trim().min(1, 'Symbol is required'),
});

export const favoriteQuerySchema = z.object({
  exchange: z.enum(SUPPORTED_EXCHANGES).optional(),
});
