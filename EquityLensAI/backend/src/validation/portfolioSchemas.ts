import { z } from 'zod';
import {
  PORTFOLIO_TRANSACTION_TYPES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_EXCHANGES,
} from '@equitylensai/shared';

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, 'Portfolio name is required').max(100, 'Portfolio name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').nullish(),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).optional().default('INR'),
  isDefault: z.boolean().optional().default(false),
});

export const updatePortfolioSchema = z.object({
  name: z.string().trim().min(1, 'Portfolio name cannot be empty').max(100).optional(),
  description: z.string().trim().max(500).nullish(),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  isDefault: z.boolean().optional(),
});

export const createTransactionSchema = z.object({
  type: z.enum(PORTFOLIO_TRANSACTION_TYPES),
  symbol: z.string().trim().nullish(),
  exchange: z.enum(SUPPORTED_EXCHANGES).nullish(),
  quantity: z.number().finite().nonnegative('Quantity must be non-negative'),
  price: z.number().finite().nonnegative('Price must be non-negative'),
  currency: z.enum(SUPPORTED_CURRENCIES).optional().default('INR'),
  fees: z.number().finite().nonnegative().optional().default(0),
  taxes: z.number().finite().nonnegative().optional().default(0),
  tradeDate: z.string().nullish(),
  settlementDate: z.string().nullish(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').nullish(),
  splitRatio: z.number().positive('Split ratio must be positive').nullish(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(PORTFOLIO_TRANSACTION_TYPES).optional(),
  symbol: z.string().trim().nullish(),
  exchange: z.enum(SUPPORTED_EXCHANGES).nullish(),
  quantity: z.number().finite().nonnegative().optional(),
  price: z.number().finite().nonnegative().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  fees: z.number().finite().nonnegative().optional(),
  taxes: z.number().finite().nonnegative().optional(),
  tradeDate: z.string().nullish(),
  settlementDate: z.string().nullish(),
  notes: z.string().trim().max(1000).nullish(),
  splitRatio: z.number().positive().nullish(),
});

export const previewImportSchema = z.object({
  csvContent: z.string().min(1, 'CSV content is required'),
});

export const confirmImportSchema = z.object({
  batchId: z.string().min(1, 'batchId is required'),
  rows: z.array(
    z.object({
      index: z.number(),
      type: z.enum(PORTFOLIO_TRANSACTION_TYPES),
      symbol: z.string().nullish(),
      exchange: z.enum(SUPPORTED_EXCHANGES).nullish(),
      quantity: z.number(),
      price: z.number(),
      currency: z.enum(SUPPORTED_CURRENCIES),
      fees: z.number(),
      taxes: z.number(),
      totalAmount: z.number(),
      tradeDate: z.string(),
      notes: z.string().nullish(),
      isValid: z.boolean(),
      errors: z.array(z.string()),
    }),
  ).min(1, 'At least one row required to import'),
});
