import { instrumentRepository } from '../../market/instruments/repository.js';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import type { FinancialAnalysis, CandleInterval } from '@equitylensai/shared';
import { logger } from '../../utils/logger.js';

export interface VerifiedCompanyEvidenceContext {
  symbol: string;
  exchange: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  classification: string;
  currency: string;
  price: number | null;
  dayChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  marketCap: number | null;
  financials: FinancialAnalysis | null;
  performance: {
    oneMonthReturn: number | null;
    threeMonthReturn: number | null;
    sixMonthReturn: number | null;
    oneYearReturn: number | null;
    threeYearCAGR: number | null;
    fiveYearCAGR: number | null;
    annualizedVolatility: number | null;
    maxDrawdown: number | null;
  };
  reportingPeriod: string;
  statementScope: 'consolidated' | 'standalone';
  evidenceMap: Map<string, { id: string; label: string; value: unknown; period: string; source: string }>;
  limitations: string[];
}

function calculateReturnsAndRisk(candles: Array<{ close: number; [key: string]: unknown }>) {
  if (candles.length < 2) {
    return {
      oneMonthReturn: null,
      threeMonthReturn: null,
      sixMonthReturn: null,
      oneYearReturn: null,
      threeYearCAGR: null,
      fiveYearCAGR: null,
      annualizedVolatility: null,
      maxDrawdown: null,
    };
  }

  const latest = candles[candles.length - 1]!.close;
  const count = candles.length;

  const getReturn = (daysBack: number): number | null => {
    if (count <= daysBack) return null;
    const past = candles[Math.max(0, count - 1 - daysBack)]!.close;
    if (past <= 0) return null;
    return Number((((latest - past) / past) * 100).toFixed(2));
  };

  const getCAGR = (yearsBack: number, tradingDaysBack: number): number | null => {
    if (count <= tradingDaysBack) return null;
    const past = candles[Math.max(0, count - 1 - tradingDaysBack)]!.close;
    if (past <= 0) return null;
    const cagr = (Math.pow(latest / past, 1 / yearsBack) - 1) * 100;
    return Number(cagr.toFixed(2));
  };

  // Volatility & Max Drawdown
  const dailyReturns: number[] = [];
  let peak = candles[0]!.close;
  let maxDrawdown = 0;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!.close;
    const curr = candles[i]!.close;
    if (prev > 0) {
      dailyReturns.push((curr - prev) / prev);
    }
    if (curr > peak) {
      peak = curr;
    } else if (peak > 0) {
      const dd = ((peak - curr) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  let annualizedVolatility: number | null = null;
  if (dailyReturns.length > 10) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
    annualizedVolatility = Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
  }

  return {
    oneMonthReturn: getReturn(21),
    threeMonthReturn: getReturn(63),
    sixMonthReturn: getReturn(126),
    oneYearReturn: getReturn(252),
    threeYearCAGR: getCAGR(3, 756),
    fiveYearCAGR: getCAGR(5, 1260),
    annualizedVolatility,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
  };
}

export class ContextBuilder {
  async buildCompanyContext(
    target: { symbol: string; exchange?: string },
    period: 'annual' | 'ttm' = 'annual',
  ): Promise<VerifiedCompanyEvidenceContext> {
    const cleanSym = target.symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const exchange = (target.exchange || 'NSE').toUpperCase();
    const inst = instrumentRepository.getBySymbol(cleanSym, exchange) ||
      instrumentRepository.search(cleanSym, { limit: 1 })[0];

    const limitations: string[] = [];
    const evidenceMap = new Map<string, { id: string; label: string; value: unknown; period: string; source: string }>();

    // 1. Fetch Profile and live quote
    let quote: Awaited<ReturnType<typeof marketService.getQuote>> | null = null;
    try {
      quote = await marketService.getQuote({ symbol: cleanSym, exchange });
    } catch (err) {
      logger.debug({ err, symbol: cleanSym }, 'Could not fetch live quote, using instrument cache');
      limitations.push(`Live quote unavailable for ${cleanSym}; using cached instrument indicators.`);
    }

    // 2. Fetch Financial Analysis
    let financials: FinancialAnalysis | null = null;
    try {
      financials = await financialService.getFinancialAnalysis({ symbol: cleanSym, exchange }, quote?.price);
    } catch (err) {
      logger.debug({ err, symbol: cleanSym }, 'Could not fetch financial analysis');
      limitations.push(`Detailed financial statements could not be retrieved for ${cleanSym}.`);
    }

    // 3. Fetch Historical Prices for performance calculation
    let performance = {
      oneMonthReturn: null as number | null,
      threeMonthReturn: null as number | null,
      sixMonthReturn: null as number | null,
      oneYearReturn: null as number | null,
      threeYearCAGR: null as number | null,
      fiveYearCAGR: null as number | null,
      annualizedVolatility: null as number | null,
      maxDrawdown: null as number | null,
    };

    try {
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 5);
      const toDate = new Date();

      const hist = await marketService.getHistoricalPrices({
        symbol: cleanSym,
        exchange,
        interval: 'ONE_DAY' as CandleInterval,
        from: fromDate.toISOString().split('T')[0]!,
        to: toDate.toISOString().split('T')[0]!,
      });

      if (hist && hist.candles && hist.candles.length > 0) {
        performance = calculateReturnsAndRisk(hist.candles);
      }
    } catch (err) {
      logger.debug({ err, symbol: cleanSym }, 'Could not calculate historical price metrics');
      limitations.push(`Historical price series could not be retrieved for ${cleanSym}.`);
    }

    const companyName = inst?.name || cleanSym;
    const instMeta = (inst as Record<string, unknown> | null | undefined)?.['metadata'] as Record<string, unknown> | undefined;
    const sector = (instMeta?.sector as string) || null;
    const industry = (instMeta?.industry as string) || null;
    const description = (instMeta?.description as string) || null;
    const classification = inst?.classification || (instMeta?.classification as string) || 'MAIN';
    const currency = inst?.currency || 'INR';
    const price = quote?.price ?? (instMeta?.price as number) ?? null;
    const dayChangePercent = quote?.changePercent ?? (instMeta?.changePercent as number) ?? null;
    const fiftyTwoWeekHigh = (quote as Record<string, unknown> | null | undefined)?.['fiftyTwoWeekHigh'] as number ?? (instMeta?.fiftyTwoWeekHigh as number) ?? null;
    const fiftyTwoWeekLow = (quote as Record<string, unknown> | null | undefined)?.['fiftyTwoWeekLow'] as number ?? (instMeta?.fiftyTwoWeekLow as number) ?? null;
    const volume = quote?.volume ?? (instMeta?.volume as number) ?? null;
    const financialsRatios = (financials as Record<string, unknown> | null | undefined)?.['ratios'] as Record<string, Record<string, unknown>> | undefined;
    const marketCap = (financialsRatios?.valuation?.marketCap as number) ?? (instMeta?.marketCap as number) ?? null;

    const reportingPeriod = period === 'ttm' ? 'TTM' : 'FY24 Annual';
    const statementScope: 'consolidated' | 'standalone' = 'consolidated';

    // Populate evidence items
    const registerEvidence = (key: string, label: string, value: unknown, source: string) => {
      if (value !== null && value !== undefined) {
        const id = `EVID_${key.toUpperCase()}_${cleanSym}`;
        evidenceMap.set(id, { id, label, value, period: reportingPeriod, source });
      }
    };

    if (price !== null) registerEvidence('PRICE', 'Current Stock Price', price, 'Market Quote');
    if (marketCap !== null) registerEvidence('MCAP', 'Market Capitalization', marketCap, 'Valuation Ratios');
    if (dayChangePercent !== null) registerEvidence('DAY_CHANGE', 'Day Change %', dayChangePercent, 'Market Quote');
    if (sector) registerEvidence('SECTOR', 'Sector', sector, 'Security Master');
    if (industry) registerEvidence('INDUSTRY', 'Industry', industry, 'Security Master');

    if (financialsRatios) {
      const ratios = financialsRatios;
      if (ratios.profitability) {
        registerEvidence('ROE', 'Return on Equity', ratios.profitability.returnOnEquity, 'Financial Ratios');
        registerEvidence('ROCE', 'Return on Capital Employed', ratios.profitability.returnOnCapitalEmployed, 'Financial Ratios');
        registerEvidence('ROA', 'Return on Assets', ratios.profitability.returnOnAssets, 'Financial Ratios');
        registerEvidence('OPERATING_MARGIN', 'Operating Profit Margin', ratios.profitability.operatingMargin, 'Financial Ratios');
        registerEvidence('NET_MARGIN', 'Net Profit Margin', ratios.profitability.netMargin, 'Financial Ratios');
        registerEvidence('GROSS_MARGIN', 'Gross Profit Margin', ratios.profitability.grossMargin, 'Financial Ratios');
      }

      if (ratios.leverage) {
        registerEvidence('DEBT_TO_EQUITY', 'Debt to Equity', ratios.leverage.debtToEquity, 'Leverage Ratios');
        registerEvidence('INTEREST_COVERAGE', 'Interest Coverage Ratio', ratios.leverage.interestCoverageRatio, 'Leverage Ratios');
      }

      if (ratios.liquidity) {
        registerEvidence('CURRENT_RATIO', 'Current Ratio', ratios.liquidity.currentRatio, 'Liquidity Ratios');
        registerEvidence('QUICK_RATIO', 'Quick Ratio', ratios.liquidity.quickRatio, 'Liquidity Ratios');
      }

      if (ratios.valuation) {
        registerEvidence('PE_RATIO', 'Price-to-Earnings Ratio', ratios.valuation.peRatio, 'Valuation Ratios');
        registerEvidence('PB_RATIO', 'Price-to-Book Ratio', ratios.valuation.priceToBook, 'Valuation Ratios');
        registerEvidence('EV_EBITDA', 'EV / EBITDA', ratios.valuation.evToEbitda, 'Valuation Ratios');
        registerEvidence('DIVIDEND_YIELD', 'Dividend Yield', ratios.valuation.dividendYield, 'Valuation Ratios');
      }

      if (ratios.growth) {
        registerEvidence('REVENUE_GROWTH', 'Revenue Growth YoY', ratios.growth.revenueGrowthYoY, 'Growth Ratios');
        registerEvidence('NET_INCOME_GROWTH', 'Net Income Growth YoY', ratios.growth.netIncomeGrowthYoY, 'Growth Ratios');
        registerEvidence('EPS_GROWTH', 'EPS Growth YoY', ratios.growth.epsGrowthYoY, 'Growth Ratios');
      }

      if (financials?.healthScore) {
        registerEvidence('HEALTH_SCORE', 'Financial Health Score', financials.healthScore.overallScore, 'Health Engine');
      }
    }

    if (performance.oneMonthReturn !== null) registerEvidence('PERF_1M', '1-Month Return', performance.oneMonthReturn, 'Historical Series');
    if (performance.threeMonthReturn !== null) registerEvidence('PERF_3M', '3-Month Return', performance.threeMonthReturn, 'Historical Series');
    if (performance.sixMonthReturn !== null) registerEvidence('PERF_6M', '6-Month Return', performance.sixMonthReturn, 'Historical Series');
    if (performance.oneYearReturn !== null) registerEvidence('PERF_1Y', '1-Year Return', performance.oneYearReturn, 'Historical Series');
    if (performance.threeYearCAGR !== null) registerEvidence('PERF_3Y_CAGR', '3-Year CAGR', performance.threeYearCAGR, 'Historical Series');
    if (performance.fiveYearCAGR !== null) registerEvidence('PERF_5Y_CAGR', '5-Year CAGR', performance.fiveYearCAGR, 'Historical Series');
    if (performance.annualizedVolatility !== null) registerEvidence('VOLATILITY', 'Annualized Volatility', performance.annualizedVolatility, 'Historical Series');
    if (performance.maxDrawdown !== null) registerEvidence('MAX_DRAWDOWN', 'Maximum Drawdown', performance.maxDrawdown, 'Historical Series');

    return {
      symbol: cleanSym,
      exchange,
      companyName,
      sector,
      industry,
      description,
      classification,
      currency,
      price,
      dayChangePercent,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      volume,
      marketCap,
      financials,
      performance,
      reportingPeriod,
      statementScope,
      evidenceMap,
      limitations,
    };
  }
}

export const contextBuilder = new ContextBuilder();
