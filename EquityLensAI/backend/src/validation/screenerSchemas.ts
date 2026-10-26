import { z } from 'zod';
import { screenerStrategyDefinitionSchema } from '../ai/screener/screenerSchema.js';

export const createSavedScreenSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    definition: screenerStrategyDefinitionSchema,
  })
  .strict();

export const updateSavedScreenSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    definition: screenerStrategyDefinitionSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined || data.description !== undefined || data.definition !== undefined,
    { message: 'At least one field must be provided to update.' },
  );

export const savedScreenParamsSchema = z
  .object({
    screenId: z.string().uuid({ message: 'Invalid screen ID format; UUID required.' }),
  })
  .strict();

export const runSavedScreenSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

export const screenerRunsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const screenerRunParamsSchema = z
  .object({
    runId: z.string().uuid({ message: 'Invalid run ID format; UUID required.' }),
  })
  .strict();
