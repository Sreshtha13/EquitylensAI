import { z } from 'zod';
import { ANNOUNCEMENT_CATEGORIES, SOURCE_TYPES } from '@equitylensai/shared';

export const newsQuerySchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'US']).optional(),
  symbol: z.string().trim().max(20).optional(),
  category: z.string().trim().max(50).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

export const announcementsQuerySchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'US']).optional(),
  symbol: z.string().trim().max(20).optional(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

export const announcementParamsSchema = z.object({
  announcementId: z.string().trim().min(1).max(100),
});

export const newsParamsSchema = z.object({
  newsId: z.string().trim().min(1).max(100),
});

export const stockNewsParamsSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
});

export const stockNewsQuerySchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'US']).default('NSE'),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  page: z.coerce.number().int().min(1).default(1),
});

export const stockAnnouncementsQuerySchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'US']).default('NSE'),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  page: z.coerce.number().int().min(1).default(1),
});
