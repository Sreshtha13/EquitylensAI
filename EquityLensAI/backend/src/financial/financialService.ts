/**
 * FinancialService — orchestrates financial data retrieval, normalisation,
 * deterministic calculation, and health scoring.
 *
 * Provider chain: Yahoo Finance (primary, no key required) → error propagated.
 * Results are cached in memory with a 4-hour TTL and 24-hour stale window
 * because financial statements change quarterly, not minute-to-minute.
 */

import type { FinancialAnalysis, FinancialStatements } from '@equitylensai/shared';
import { yahooFinancialProvider } from './providers/yahooFinancialProvider.js';
import {
  calcCashFlow,
  calcGrowth,
  calcLeverage,
  calcLiquidity,
  calcProfitability,
  calcValuation,
} from './calculators/ratioCalculators.js';
import { calcHealthScore } from './healthScore/healthScoreEngine.js';
import type { FinancialDataRequest, RawFinancialData } from './types.js';
import { MemoryCache } from '../market/cache/memoryCache.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { marketService } from '../market/marketService.js';

/** Cache with 4-hour fresh TTL, 24-hour stale window */
const financialCache = new MemoryCache({
  defaultTtlSeconds: 4 * 3600,
  defaultStaleTtlSeconds: 24 * 3600,
});

class FinancialService {
  /**
   * Retrieve and calculate full financial analysis for a symbol.
   * livePrice is fetched from the market service if not provided.
   */
  async getFinancialAnalysis(
    request: FinancialDataRequest,
    livePrice?: number | null,
  ): Promise<FinancialAnalysis> {
    const cacheKey = `financial:${(request.exchange ?? 'default').toUpperCase()}:${request.symbol.toUpperCase()}`;

    const cached = financialCache.get<FinancialAnalysis>(cacheKey);
    if (cached && !cached.isStale) {
      logger.debug({ symbol: request.symbol }, 'Financial analysis served from cache (fresh)');
      return cached.value;
    }

    let raw: RawFinancialData;
    try {
      raw = await yahooFinancialProvider.getFinancialData(request);
    } catch (err) {
      // If stale cache exists, serve it with flag
      if (cached) {
        logger.warn({ symbol: request.symbol }, 'Serving stale financial data; provider failed');
        return { ...cached.value, isStale: true };
      }
      throw err;
    }

    // ── Resolve live price ───────────────────────────────────────────────────
    let price: number | null = livePrice ?? null;
    if (price === null) {
      try {
        const quote = await marketService.getQuote({
          symbol: request.symbol,
          exchange: request.exchange,
        });
        price = quote.price;
      } catch {
        logger.debug(
          { symbol: request.symbol },
          'Could not fetch live price for valuation; will use null',
        );
      }
    }

    // ── Assemble statements ─────────────────────────────────────────────────
    const annualHistory = this.alignPeriods(raw, 'annual');
    const quarterlyHistory = this.alignPeriods(raw, 'quarterly');
    if (annualHistory.length === 0) {
      throw new AppError(
        'FINANCIAL_DATA_UNAVAILABLE',
        `No aligned financial periods available for ${request.symbol}`,
        502,
      );
    }

    const latestAnnual = annualHistory[0]!;

    // TTM assembly
    const ttm: FinancialStatements | null =
      raw.ttmIncome && raw.ttmCashFlow && raw.ttmBalanceSheet
        ? {
            symbol: request.symbol,
            periodType: 'ttm',
            periodEndDate: raw.ttmIncome.periodEndDate,
            income: raw.ttmIncome,
            balanceSheet: raw.ttmBalanceSheet,
            cashFlow: raw.ttmCashFlow,
            source: raw.source,
            retrievedAt: raw.retrievedAt,
            isStale: false,
          }
        : null;

    // Use TTM statements for ratio calculation if available, else latest annual
    const baseStatements = ttm ?? latestAnnual;
    const baseIncome = baseStatements.income;
    const baseBalance = baseStatements.balanceSheet;
    const baseCashFlow = baseStatements.cashFlow;

    // ── Calculate metrics ───────────────────────────────────────────────────
    const profitability = calcProfitability(baseIncome, baseBalance);
    const liquidity = calcLiquidity(baseBalance, baseCashFlow);
    const leverage = calcLeverage(baseBalance, baseIncome);

    // Shares outstanding from base income or latest annual statement
    const shares =
      baseIncome.dilutedSharesOutstanding ??
      baseIncome.basicSharesOutstanding ??
      latestAnnual.income.dilutedSharesOutstanding ??
      latestAnnual.income.basicSharesOutstanding;
    const marketCapValue = price !== null && shares !== null ? price * shares : null;

    const cashFlow = calcCashFlow(
      baseCashFlow,
      baseIncome,
      marketCapValue,
      baseIncome.periodEndDate,
    );
    const growth = calcGrowth(latestAnnual, annualHistory[1], annualHistory);
    const valuation = calcValuation(baseIncome, baseBalance, baseCashFlow, price, shares);

    const healthScore = calcHealthScore(
      request.symbol,
      profitability,
      liquidity,
      leverage,
      cashFlow,
      growth,
      baseIncome.periodEndDate,
    );

    const analysis: FinancialAnalysis = {
      symbol: request.symbol,
      name: raw.name,
      currency: raw.currency,
      latestAnnual,
      ttm,
      annualHistory,
      quarterlyHistory,
      profitability,
      liquidity,
      leverage,
      cashFlow,
      growth,
      valuation,
      healthScore,
      source: raw.source,
      retrievedAt: raw.retrievedAt,
      isStale: false,
    };

    financialCache.set(cacheKey, analysis);
    return analysis;
  }

  /**
   * Returns just the raw financial statements (no ratio calculation).
   * Useful for the statements-only endpoint.
   */
  async getStatements(request: FinancialDataRequest) {
    const cacheKey = `stmts:${(request.exchange ?? 'default').toUpperCase()}:${request.symbol.toUpperCase()}`;

    const cached = financialCache.get<RawFinancialData>(cacheKey);
    if (cached && !cached.isStale) return cached.value;

    const raw = await yahooFinancialProvider.getFinancialData(request);
    financialCache.set(cacheKey, raw);
    return raw;
  }

  /** Align income, balance sheet, and cash flow periods by periodEndDate */
  private alignPeriods(
    raw: RawFinancialData,
    periodType: 'annual' | 'quarterly',
  ): FinancialStatements[] {
    const result: FinancialStatements[] = [];
    const incomeStatements =
      periodType === 'annual' ? raw.incomeStatements : raw.quarterlyIncomeStatements;
    const balanceSheets = periodType === 'annual' ? raw.balanceSheets : raw.quarterlyBalanceSheets;
    const cashFlowStatements =
      periodType === 'annual' ? raw.cashFlowStatements : raw.quarterlyCashFlowStatements;

    for (const income of incomeStatements) {
      const period = income.periodEndDate;
      const bs = balanceSheets.find((b) => b.periodEndDate === period);
      const cf = cashFlowStatements.find((c) => c.periodEndDate === period);

      // We need at least the balance sheet; cash flow is highly desirable
      if (!bs) continue;

      result.push({
        symbol: income.symbol,
        periodType: income.periodType,
        periodEndDate: period,
        income,
        balanceSheet: bs,
        cashFlow:
          cf ??
          this.emptyCashFlow(
            income.symbol,
            income.currency,
            period,
            raw.source,
            raw.retrievedAt,
            periodType,
          ),
        source: raw.source,
        retrievedAt: raw.retrievedAt,
        isStale: false,
      });
    }

    return result;
  }

  private emptyCashFlow(
    symbol: string,
    currency: string,
    periodEndDate: string,
    source: string,
    retrievedAt: string,
    periodType: 'annual' | 'quarterly',
  ) {
    return {
      symbol,
      periodType,
      periodEndDate,
      currency,
      netIncome: null,
      deprecationAndAmortization: null,
      changesInWorkingCapital: null,
      operatingCashFlow: null,
      capitalExpenditures: null,
      investingCashFlow: null,
      dividendsPaid: null,
      financingCashFlow: null,
      freeCashFlow: null,
      source,
      retrievedAt,
    };
  }

  getCacheStats() {
    return financialCache.getStats();
  }
}

export const financialService = new FinancialService();
