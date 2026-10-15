import { z } from 'zod';
import { ASSET_TYPES, CANDLE_INTERVALS, MARKETS } from '@equitylensai/shared';

export const searchInstrumentsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(50, 'Search query too long'),
  market: z.enum(MARKETS).optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const quoteParamsSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid symbol format'),
});

export const quoteQuerySchema = z.object({
  exchange: z.string().trim().toUpperCase().optional(),
});

export const historicalParamsSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid symbol format'),
});

export const historicalQuerySchema = z.object({
  exchange: z.string().trim().toUpperCase().optional(),
  interval: z.enum(CANDLE_INTERVALS).default('ONE_DAY'),
  from: z
    .string()
    .trim()
    .default(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }),
  to: z
    .string()
    .trim()
    .default(() => new Date().toISOString()),
});

export const marketOverviewQuerySchema = z.object({
  market: z.enum(MARKETS).default('nse'),
});
