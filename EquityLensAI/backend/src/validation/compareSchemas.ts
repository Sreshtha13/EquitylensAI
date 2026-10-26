import { z } from 'zod';

export const companyTargetSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  exchange: z.string().trim().min(1).max(10).default('NSE'),
});

export const compareRequestSchema = z.object({
  symbols: z.array(companyTargetSchema).min(2, 'At least 2 companies are required for comparison').max(5, 'At most 5 companies can be compared'),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional().default('annual'),
  scope: z.enum(['consolidated', 'standalone']).optional().default('consolidated'),
  metrics: z.array(z.string()).optional(),
});

export const peerDiscoveryQuerySchema = z.object({
  exchange: z.string().trim().optional(),
});

export const benchmarkRequestSchema = z.object({
  symbols: z.array(companyTargetSchema).min(2, 'At least 2 companies are required for benchmark statistics').max(10),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional().default('annual'),
  metrics: z.array(z.string()).optional(),
});

export const historicalCompareRequestSchema = z.object({
  symbols: z.array(companyTargetSchema).min(1, 'At least 1 company is required').max(5),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional().default('annual'),
  interval: z.enum(['1M', '3M', '6M', '1Y', '5Y']).optional().default('1Y'),
  includeIndex: z.boolean().optional().default(false),
});

export const aiComparisonRequestSchema = z.object({
  symbols: z.array(companyTargetSchema).min(2).max(5),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional().default('annual'),
});

export const createSavedComparisonSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  symbols: z.array(companyTargetSchema).min(2, 'At least 2 companies are required').max(5),
  metrics: z.array(z.string()).optional(),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional().default('annual'),
  scope: z.enum(['consolidated', 'standalone']).optional().default('consolidated'),
});

export const updateSavedComparisonSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  symbols: z.array(companyTargetSchema).min(2).max(5).optional(),
  metrics: z.array(z.string()).optional(),
  period: z.enum(['annual', 'quarterly', 'ttm']).optional(),
  scope: z.enum(['consolidated', 'standalone']).optional(),
});
