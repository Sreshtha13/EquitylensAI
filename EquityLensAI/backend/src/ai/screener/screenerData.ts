import type { FinancialAnalysis, FinancialMetric } from '@equitylensai/shared';
import {
  calcCashFlow,
  calcGrowth,
  calcLeverage,
  calcLiquidity,
  calcProfitability,
} from '../../financial/calculators/ratioCalculators.js';
import { calcHealthScore } from '../../financial/healthScore/healthScoreEngine.js';
import type { GrowthMetrics } from '../../financial/types.js';
import type { ScreenerMetric, ScreenerPeriodType } from './screenerSchema.js';
import type { ScreenerMetricRow } from './screenerRepository.js';

type MetricUnit = 'percent' | 'ratio' | 'score';

function metric(
  value: FinancialMetric,
  unit?: MetricUnit,
): {
  value: number | null;
  unit: MetricUnit;
  periodEndDate: string;
  formula: string;
} {
  return {
    value: value.value !== null && Number.isFinite(value.value) ? value.value : null,
    unit: unit ?? (value.unit === 'percent' ? 'percent' : 'ratio'),
    periodEndDate: value.periodEndDate,
    formula: value.formula,
  };
}

function unavailableMetric(periodEndDate: string, formula: string): FinancialMetric {
  return {
    value: null,
    formula,
    unit: 'percent',
    periodEndDate,
    isBlended: undefined,
  };
}

function getGrowth(
  periodType: ScreenerPeriodType,
  analysis: FinancialAnalysis,
  periodEndDate: string,
): GrowthMetrics {
  if (periodType === 'annual') {
    return calcGrowth(analysis.latestAnnual, analysis.annualHistory[1], analysis.annualHistory);
  }
  const unavailable = unavailableMetric(periodEndDate, 'Unavailable for TTM screening');
  return {
    revenueGrowthYoY: unavailable,
    grossProfitGrowthYoY: unavailable,
    operatingIncomeGrowthYoY: unavailable,
    netIncomeGrowthYoY: unavailable,
    epsGrowthYoY: unavailable,
    freeCashFlowGrowthYoY: unavailable,
    revenueCAGR: null,
  };
}

export function buildScreenerRows(
  analysis: FinancialAnalysis,
  instrument: {
    symbol: string;
    name: string;
    exchange: 'NSE' | 'BSE';
    currency: string;
  },
): ScreenerMetricRow[] {
  const statements = [
    { periodType: 'annual' as const, value: analysis.latestAnnual },
    ...(analysis.ttm ? [{ periodType: 'ttm' as const, value: analysis.ttm }] : []),
  ];

  return statements.map(({ periodType, value }) => {
    const periodDate = new Date(`${value.periodEndDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value.periodEndDate) ||
      Number.isNaN(periodDate.getTime()) ||
      periodDate.toISOString().slice(0, 10) !== value.periodEndDate
    ) {
      throw new Error(`Invalid reporting date for ${instrument.symbol}.`);
    }
    const profitability = calcProfitability(value.income, value.balanceSheet);
    const liquidity = calcLiquidity(value.balanceSheet, value.cashFlow);
    const leverage = calcLeverage(value.balanceSheet, value.income);
    const cashFlow = calcCashFlow(value.cashFlow, value.income, null, value.periodEndDate);
    const growth = getGrowth(periodType, analysis, value.periodEndDate);
    const healthScore = calcHealthScore(
      analysis.symbol,
      profitability,
      liquidity,
      leverage,
      cashFlow,
      growth,
      value.periodEndDate,
    );

    const valuationPeriodMatches =
      (analysis.ttm !== null ? periodType === 'ttm' : periodType === 'annual') &&
      analysis.valuation.peRatio.periodEndDate === value.periodEndDate;
    const values: Record<ScreenerMetric, ReturnType<typeof metric>> = {
      roe: metric(profitability.returnOnEquity),
      roa: metric(profitability.returnOnAssets),
      roce: metric(profitability.returnOnCapitalEmployed),
      gross_margin: metric(profitability.grossMargin),
      operating_margin: metric(profitability.operatingMargin),
      net_margin: metric(profitability.netMargin),
      debt_to_equity: metric(leverage.debtToEquity),
      current_ratio: metric(liquidity.currentRatio),
      quick_ratio: metric(liquidity.quickRatio),
      interest_coverage: metric(leverage.interestCoverageRatio),
      revenue_growth: metric(growth.revenueGrowthYoY),
      net_income_growth: metric(growth.netIncomeGrowthYoY),
      eps_growth: metric(growth.epsGrowthYoY),
      free_cash_flow_margin: metric(cashFlow.freeCashFlowMargin),
      pe_ratio: metric(
        valuationPeriodMatches
          ? analysis.valuation.peRatio
          : {
              value: null,
              formula: 'No valuation data for this reporting period',
              unit: 'ratio',
              periodEndDate: value.periodEndDate,
              isBlended: undefined,
            },
      ),
      price_to_book: metric(
        valuationPeriodMatches &&
          analysis.valuation.priceToBook.periodEndDate === value.periodEndDate
          ? analysis.valuation.priceToBook
          : {
              value: null,
              formula: 'No valuation data for this reporting period',
              unit: 'ratio',
              periodEndDate: value.periodEndDate,
              isBlended: undefined,
            },
      ),
      financial_health_score: {
        value: healthScore.overallScore,
        unit: 'score',
        periodEndDate: value.periodEndDate,
        formula: 'Deterministic 0–100 composite financial health score',
      },
    };

    return {
      symbol: instrument.symbol,
      companyName: instrument.name || analysis.name,
      exchange: instrument.exchange,
      assetType: 'equity',
      currency: instrument.currency || analysis.currency,
      periodType,
      periodEndDate: value.periodEndDate,
      source: value.source,
      retrievedAt: value.retrievedAt,
      isStale: analysis.isStale || value.isStale,
      metrics: values,
    };
  });
}
