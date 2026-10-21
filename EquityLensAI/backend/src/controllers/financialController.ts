/**
 * Financial Controller — handles HTTP request/response for financial data endpoints.
 *
 * Validation is intentionally minimal (Zod) so that bad inputs are rejected
 * cleanly without ever reaching the financial service layer.
 */
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { financialService } from '../financial/index.js';
import { sendSuccess } from '../utils/response.js';

// ─── Request schemas ────────────────────────────────────────────────────────

const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[A-Za-z0-9._-]+$/, 'Symbol must contain only alphanumeric characters, dots, hyphens, or underscores'),
});

const analysisQuerySchema = z.object({
  exchange: z.string().max(10).optional(),
  periods: z.coerce.number().int().min(1).max(8).optional(),
});

// ─── Handlers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/financial/:symbol/analysis
 * Returns fully assembled FinancialAnalysis including all statements, calculated
 * ratios, valuation multiples, and health score.
 */
export async function getFinancialAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol } = symbolParamSchema.parse(req.params);
    const { exchange, periods } = analysisQuerySchema.parse(req.query);

    const analysis = await financialService.getFinancialAnalysis({
      symbol: symbol.toUpperCase().replace(/\.(NS|BO)$/i, ''),
      exchange: exchange?.toUpperCase(),
      annualPeriods: periods ?? 4,
    });

    sendSuccess(res, analysis);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/financial/:symbol/statements
 * Returns raw financial statements (income, balance sheet, cash flow) without
 * calculated ratios. Lighter endpoint for statement-only display.
 */
export async function getFinancialStatements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol } = symbolParamSchema.parse(req.params);
    const { exchange, periods } = analysisQuerySchema.parse(req.query);

    const raw = await financialService.getStatements({
      symbol: symbol.toUpperCase().replace(/\.(NS|BO)$/i, ''),
      exchange: exchange?.toUpperCase(),
      annualPeriods: periods ?? 4,
    });

    sendSuccess(res, raw);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/financial/:symbol/health-score
 * Returns only the financial health score (lightweight).
 */
export async function getHealthScore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol } = symbolParamSchema.parse(req.params);
    const { exchange } = analysisQuerySchema.parse(req.query);

    const analysis = await financialService.getFinancialAnalysis({
      symbol: symbol.toUpperCase().replace(/\.(NS|BO)$/i, ''),
      exchange: exchange?.toUpperCase(),
      annualPeriods: 2, // health score only needs most recent + prior year
    });

    sendSuccess(res, analysis.healthScore);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/financial/cache-stats
 * Returns financial cache statistics for monitoring.
 */
export async function getFinancialCacheStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, financialService.getCacheStats());
  } catch (err) {
    next(err);
  }
}
