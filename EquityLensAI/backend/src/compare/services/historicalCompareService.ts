import type {
  ComparisonCompanyTarget,
  HistoricalComparisonResult,
  HistoricalFinancialPoint,
  NormalizedPricePoint,
  SupportedPeriod,
} from '../types.js';
import { financialService } from '../../financial/financialService.js';
import { marketService } from '../../market/marketService.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

function computeFromDate(interval: '1M' | '3M' | '6M' | '1Y' | '5Y'): string {
  const d = new Date();
  switch (interval) {
    case '1M':
      d.setMonth(d.getMonth() - 1);
      break;
    case '3M':
      d.setMonth(d.getMonth() - 3);
      break;
    case '6M':
      d.setMonth(d.getMonth() - 6);
      break;
    case '5Y':
      d.setFullYear(d.getFullYear() - 5);
      break;
    case '1Y':
    default:
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString().split('T')[0]!;
}

export class HistoricalCompareService {
  async compareHistory(
    targets: ComparisonCompanyTarget[],
    options: {
      period?: SupportedPeriod;
      interval?: '1M' | '3M' | '6M' | '1Y' | '5Y';
      includeIndex?: boolean;
    } = {},
  ): Promise<HistoricalComparisonResult> {
    if (!targets || targets.length < 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least one company is required for historical comparison.',
        400,
      );
    }

    const period: SupportedPeriod = options.period || 'annual';
    const interval = options.interval || '1Y';
    const from = computeFromDate(interval);
    const to = new Date().toISOString().split('T')[0]!;

    // ── 1. Financial Trends ──────────────────────────────────────────────────
    const financialTrends: Record<string, HistoricalFinancialPoint[]> = {};

    await Promise.all(
      targets.map(async (target) => {
        try {
          const analysis = await financialService.getFinancialAnalysis({
            symbol: target.symbol,
            exchange: target.exchange,
            annualPeriods: 4,
          });

          const stmts = analysis.annualHistory;

          const points: HistoricalFinancialPoint[] = stmts.map((stmt) => {
            const inc = stmt.income;
            const bal = stmt.balanceSheet;
            const cf = stmt.cashFlow;

            const rev = inc.totalRevenue ?? null;
            const netInc = inc.netIncome ?? null;
            const opInc = inc.operatingIncome ?? null;
            const opMargin =
              opInc !== null && rev !== null && rev !== 0
                ? Math.round((opInc / rev) * 10000) / 100
                : null;

            const equity = bal.totalStockholderEquity ?? null;
            const roe =
              netInc !== null && equity !== null && equity !== 0
                ? Math.round((netInc / equity) * 10000) / 100
                : null;

            const debt =
              bal.shortTermDebt !== null || bal.longTermDebt !== null
                ? (bal.shortTermDebt ?? 0) + (bal.longTermDebt ?? 0)
                : null;
            const debtToEquity =
              debt !== null && equity !== null && equity !== 0
                ? Math.round((debt / equity) * 100) / 100
                : null;

            const fcf = cf?.freeCashFlow ?? null;

            return {
              periodEndDate: stmt.periodEndDate,
              fiscalYear: stmt.periodEndDate.slice(0, 4),
              revenue: rev,
              netIncome: netInc,
              operatingMargin: opMargin,
              roe,
              debtToEquity,
              freeCashFlow: fcf,
            };
          });

          // Sort chronologically (oldest to newest)
          points.sort(
            (a, b) =>
              new Date(a.periodEndDate).getTime() - new Date(b.periodEndDate).getTime(),
          );

          financialTrends[target.symbol] = points;
        } catch (err: unknown) {
          logger.warn(
            { err, symbol: target.symbol },
            'Could not load historical statements for company',
          );
          financialTrends[target.symbol] = [];
        }
      }),
    );

    // ── 2. Normalized Price Performance ──────────────────────────────────────
    const allCandleSeries: Record<string, Array<{ date: string; close: number }>> = {};

    await Promise.all(
      targets.map(async (target) => {
        try {
          const history = await marketService.getHistoricalPrices({
            symbol: target.symbol,
            exchange: target.exchange,
            interval: 'ONE_DAY',
            from,
            to,
          });

          const series = history.candles
            .filter((c) => c.close !== null && Number.isFinite(c.close))
            .map((c) => ({
              date: c.timestamp.split('T')[0]!,
              close: c.close,
            }));

          // Sort chronologically
          series.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          allCandleSeries[target.symbol] = series;
        } catch (err: unknown) {
          logger.warn(
            { err, symbol: target.symbol },
            'Could not load historical candles for company',
          );
          allCandleSeries[target.symbol] = [];
        }
      }),
    );

    // Collect all unique trading dates
    const allDatesSet = new Set<string>();
    for (const series of Object.values(allCandleSeries)) {
      for (const pt of series) {
        allDatesSet.add(pt.date);
      }
    }
    const sortedDates = Array.from(allDatesSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    // Compute base price and normalized points
    const basePrices: Record<string, number> = {};
    const summaryReturns: Record<string, number | null> = {};

    for (const [sym, series] of Object.entries(allCandleSeries)) {
      if (series.length > 0 && series[0]) {
        basePrices[sym] = series[0].close;
        const last = series[series.length - 1]!;
        const totalReturn =
          Math.round(((last.close - series[0].close) / series[0].close) * 10000) / 100;
        summaryReturns[sym] = totalReturn;
      } else {
        summaryReturns[sym] = null;
      }
    }

    // Build normalized price points (start=100)
    // Map dates to close prices for fast lookup
    const dateLookupMap: Record<string, Map<string, number>> = {};
    for (const [sym, series] of Object.entries(allCandleSeries)) {
      dateLookupMap[sym] = new Map(series.map((p) => [p.date, p.close]));
    }

    // Carry forward last known price if a specific date had no trade for that symbol
    const lastKnownPrices: Record<string, number | null> = {};
    for (const sym of targets.map((t) => t.symbol)) {
      lastKnownPrices[sym] = null;
    }

    const points: NormalizedPricePoint[] = sortedDates.map((date) => {
      const values: Record<string, number | null> = {};

      for (const target of targets) {
        const sym = target.symbol;
        const base = basePrices[sym];
        const dayClose = dateLookupMap[sym]?.get(date);

        if (dayClose !== undefined) {
          lastKnownPrices[sym] = dayClose;
        }

        const currentPrice = lastKnownPrices[sym] ?? null;
        if (currentPrice !== null && base && base > 0) {
          values[sym] = Math.round((currentPrice / base) * 10000) / 100;
        } else {
          values[sym] = null;
        }
      }

      return {
        date,
        values,
      };
    });

    return {
      period,
      financialTrends,
      pricePerformance: {
        interval,
        startDate: sortedDates[0] || from,
        endDate: sortedDates[sortedDates.length - 1] || to,
        points,
        summaryReturns,
      },
    };
  }
}

export const historicalCompareService = new HistoricalCompareService();
