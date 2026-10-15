/**
 * Financial Health Score Engine.
 *
 * Produces a 0–100 composite score across five dimensions: profitability,
 * liquidity, leverage, cash flow, and growth.
 *
 * PRINCIPLES:
 * - Scoring is entirely deterministic; no AI involved.
 * - Missing metrics do NOT produce a zero — they reduce the denominator
 *   of the dimension score and are reported in dataQualityWarnings.
 * - Thresholds are calibrated for broad-market equities (not sector-specific).
 * - The grade is derived from the composite score alone.
 */

import type {
  CashFlowMetrics,
  FinancialHealthScore,
  GrowthMetrics,
  HealthScoreDimension,
  LeverageMetrics,
  LiquidityMetrics,
  ProfitabilityMetrics,
} from '@equitylensai/shared';

type RatingResult = { score: number; max: number; notes: string[] };

// ─── Individual sub-scorers ────────────────────────────────────────────────

function scoreValue(
  value: number | null,
  thresholds: { excellent: number; good: number; fair: number; poor: number },
  higherIsBetter: boolean,
  max: number
): number {
  if (value === null) return 0; // missing — caller will note the absence

  const compare = (a: number, b: number) => (higherIsBetter ? a >= b : a <= b);

  if (compare(value, thresholds.excellent)) return max;
  if (compare(value, thresholds.good)) return max * 0.75;
  if (compare(value, thresholds.fair)) return max * 0.5;
  if (compare(value, thresholds.poor)) return max * 0.25;
  return 0;
}

// ─── Dimension scorers ──────────────────────────────────────────────────────

function scoreProfitability(m: ProfitabilityMetrics): RatingResult {
  const notes: string[] = [];
  let score = 0;
  let max = 0;

  const items: Array<{ name: string; value: number | null; thresholds: { excellent: number; good: number; fair: number; poor: number }; higher: boolean; weight: number }> = [
    { name: 'grossMargin', value: m.grossMargin.value, thresholds: { excellent: 50, good: 35, fair: 20, poor: 10 }, higher: true, weight: 10 },
    { name: 'operatingMargin', value: m.operatingMargin.value, thresholds: { excellent: 20, good: 12, fair: 5, poor: 0 }, higher: true, weight: 15 },
    { name: 'netMargin', value: m.netMargin.value, thresholds: { excellent: 15, good: 8, fair: 3, poor: 0 }, higher: true, weight: 15 },
    { name: 'returnOnEquity', value: m.returnOnEquity.value, thresholds: { excellent: 20, good: 12, fair: 6, poor: 0 }, higher: true, weight: 10 },
    { name: 'returnOnAssets', value: m.returnOnAssets.value, thresholds: { excellent: 10, good: 6, fair: 3, poor: 0 }, higher: true, weight: 10 },
    { name: 'ebitdaMargin', value: m.ebitdaMargin.value, thresholds: { excellent: 25, good: 15, fair: 8, poor: 0 }, higher: true, weight: 10 },
    { name: 'returnOnCapitalEmployed', value: m.returnOnCapitalEmployed.value, thresholds: { excellent: 20, good: 12, fair: 6, poor: 0 }, higher: true, weight: 10 },
  ];

  for (const item of items) {
    max += item.weight;
    if (item.value === null) {
      notes.push(`${item.name} unavailable`);
    } else {
      score += scoreValue(item.value, item.thresholds, item.higher, item.weight);
    }
  }

  return { score, max, notes };
}

function scoreLiquidity(m: LiquidityMetrics): RatingResult {
  const notes: string[] = [];
  let score = 0;
  let max = 0;

  const items = [
    { name: 'currentRatio', value: m.currentRatio.value, thresholds: { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.75 }, higher: true, weight: 20 },
    { name: 'quickRatio', value: m.quickRatio.value, thresholds: { excellent: 1.5, good: 1.0, fair: 0.7, poor: 0.5 }, higher: true, weight: 20 },
    { name: 'cashRatio', value: m.cashRatio.value, thresholds: { excellent: 0.5, good: 0.3, fair: 0.1, poor: 0.0 }, higher: true, weight: 10 },
    { name: 'operatingCashFlowRatio', value: m.operatingCashFlowRatio.value, thresholds: { excellent: 1.0, good: 0.7, fair: 0.4, poor: 0.1 }, higher: true, weight: 10 },
  ];

  for (const item of items) {
    max += item.weight;
    if (item.value === null) {
      notes.push(`${item.name} unavailable`);
    } else {
      score += scoreValue(item.value, item.thresholds, item.higher, item.weight);
    }
  }

  return { score, max, notes };
}

function scoreLeverage(m: LeverageMetrics): RatingResult {
  const notes: string[] = [];
  let score = 0;
  let max = 0;

  const items = [
    { name: 'debtToEquity', value: m.debtToEquity.value, thresholds: { excellent: 0.3, good: 0.75, fair: 1.5, poor: 3.0 }, higher: false, weight: 20 },
    { name: 'debtToAssets', value: m.debtToAssets.value, thresholds: { excellent: 0.2, good: 0.4, fair: 0.6, poor: 0.8 }, higher: false, weight: 15 },
    { name: 'interestCoverageRatio', value: m.interestCoverageRatio.value, thresholds: { excellent: 8, good: 4, fair: 2, poor: 1 }, higher: true, weight: 15 },
    { name: 'netDebtToEbitda', value: m.netDebtToEbitda.value, thresholds: { excellent: 0.5, good: 1.5, fair: 3.0, poor: 5.0 }, higher: false, weight: 10 },
  ];

  for (const item of items) {
    max += item.weight;
    if (item.value === null) {
      notes.push(`${item.name} unavailable`);
    } else {
      score += scoreValue(item.value, item.thresholds, item.higher, item.weight);
    }
  }

  return { score, max, notes };
}

function scoreCashFlow(m: CashFlowMetrics): RatingResult {
  const notes: string[] = [];
  let score = 0;
  let max = 0;

  const items = [
    { name: 'freeCashFlowMargin', value: m.freeCashFlowMargin.value, thresholds: { excellent: 15, good: 8, fair: 3, poor: 0 }, higher: true, weight: 20 },
    { name: 'operatingCashFlowToNetIncome', value: m.operatingCashFlowToNetIncome.value, thresholds: { excellent: 1.2, good: 0.9, fair: 0.6, poor: 0.2 }, higher: true, weight: 15 },
    { name: 'capexToRevenue', value: m.capexToRevenue.value, thresholds: { excellent: 2, good: 5, fair: 10, poor: 20 }, higher: false, weight: 10 },
    { name: 'freeCashFlowYield', value: m.freeCashFlowYield.value, thresholds: { excellent: 5, good: 3, fair: 1, poor: 0 }, higher: true, weight: 15 },
  ];

  for (const item of items) {
    max += item.weight;
    if (item.value === null) {
      notes.push(`${item.name} unavailable`);
    } else {
      score += scoreValue(item.value, item.thresholds, item.higher, item.weight);
    }
  }

  return { score, max, notes };
}

function scoreGrowth(m: GrowthMetrics): RatingResult {
  const notes: string[] = [];
  let score = 0;
  let max = 0;

  const items = [
    { name: 'revenueGrowthYoY', value: m.revenueGrowthYoY.value, thresholds: { excellent: 20, good: 10, fair: 5, poor: 0 }, higher: true, weight: 15 },
    { name: 'netIncomeGrowthYoY', value: m.netIncomeGrowthYoY.value, thresholds: { excellent: 20, good: 10, fair: 5, poor: 0 }, higher: true, weight: 15 },
    { name: 'epsGrowthYoY', value: m.epsGrowthYoY.value, thresholds: { excellent: 20, good: 10, fair: 5, poor: 0 }, higher: true, weight: 10 },
    { name: 'freeCashFlowGrowthYoY', value: m.freeCashFlowGrowthYoY.value, thresholds: { excellent: 20, good: 10, fair: 5, poor: 0 }, higher: true, weight: 10 },
    ...(m.revenueCAGR
      ? [{ name: 'revenueCAGR', value: m.revenueCAGR.value, thresholds: { excellent: 15, good: 8, fair: 3, poor: 0 }, higher: true, weight: 10 }]
      : []),
  ];

  for (const item of items) {
    max += item.weight;
    if (item.value === null) {
      notes.push(`${item.name} unavailable`);
    } else {
      score += scoreValue(item.value, item.thresholds, item.higher, item.weight);
    }
  }

  return { score, max, notes };
}

// ─── Grade ──────────────────────────────────────────────────────────────────

function toGrade(score: number): FinancialHealthScore['grade'] {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

function buildDimension(
  name: string,
  result: RatingResult,
  keyMetrics: string[]
): HealthScoreDimension {
  const normalised = result.max > 0
    ? Math.round((result.score / result.max) * 100)
    : 0;

  const rationale =
    result.max === 0
      ? 'No data available to score this dimension.'
      : result.notes.length === 0
        ? `All ${keyMetrics.length} key metrics were available and scored.`
        : `Scored with ${result.notes.length} missing metric(s): ${result.notes.join(', ')}.`;

  return {
    name,
    score: normalised,
    maxScore: 100,
    rationale,
    keyMetrics,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function calcHealthScore(
  symbol: string,
  profitability: ProfitabilityMetrics,
  liquidity: LiquidityMetrics,
  leverage: LeverageMetrics,
  cashFlow: CashFlowMetrics,
  growth: GrowthMetrics,
  asOfPeriod: string
): FinancialHealthScore {
  const profResult = scoreProfitability(profitability);
  const liqResult = scoreLiquidity(liquidity);
  const levResult = scoreLeverage(leverage);
  const cfResult = scoreCashFlow(cashFlow);
  const growResult = scoreGrowth(growth);

  // Weighted composite: profitability 25%, liquidity 20%, leverage 20%, cashflow 20%, growth 15%
  const weights = { prof: 0.25, liq: 0.20, lev: 0.20, cf: 0.20, grow: 0.15 };

  const normalise = (r: RatingResult) =>
    r.max > 0 ? (r.score / r.max) * 100 : 0;

  const composite = Math.round(
    normalise(profResult) * weights.prof +
    normalise(liqResult) * weights.liq +
    normalise(levResult) * weights.lev +
    normalise(cfResult) * weights.cf +
    normalise(growResult) * weights.grow
  );

  const grade = toGrade(composite);

  const allWarnings = [
    ...profResult.notes.map((n) => `Profitability: ${n}`),
    ...liqResult.notes.map((n) => `Liquidity: ${n}`),
    ...levResult.notes.map((n) => `Leverage: ${n}`),
    ...cfResult.notes.map((n) => `CashFlow: ${n}`),
    ...growResult.notes.map((n) => `Growth: ${n}`),
  ];

  const summary = buildSummary(composite, grade, allWarnings.length);

  return {
    symbol,
    overallScore: composite,
    grade,
    summary,
    dimensions: {
      profitability: buildDimension('Profitability', profResult, ['grossMargin', 'operatingMargin', 'netMargin', 'ROE', 'ROA', 'EBITDA margin', 'ROCE']),
      liquidity: buildDimension('Liquidity', liqResult, ['currentRatio', 'quickRatio', 'cashRatio', 'operatingCFRatio']),
      leverage: buildDimension('Leverage', levResult, ['debtToEquity', 'debtToAssets', 'interestCoverage', 'netDebtToEBITDA']),
      cashFlow: buildDimension('Cash Flow', cfResult, ['FCFMargin', 'FCFYield', 'OCF/NI', 'CapEx/Revenue']),
      growth: buildDimension('Growth', growResult, ['revenueGrowthYoY', 'netIncomeGrowthYoY', 'EPSGrowthYoY', 'FCFGrowthYoY', 'revenueCAGR']),
    },
    dataQualityWarnings: allWarnings,
    asOfPeriod,
    scoredAt: new Date().toISOString(),
  };
}

function buildSummary(score: number, grade: string, missingCount: number): string {
  const base =
    score >= 80
      ? 'Strong financial profile with broad-based quality across all dimensions.'
      : score >= 65
        ? 'Solid fundamentals with room for improvement in certain areas.'
        : score >= 50
          ? 'Moderate financial quality; notable gaps or weaknesses present.'
          : score >= 35
            ? 'Below-average financial health; significant risk factors identified.'
            : 'Weak financial profile; multiple dimensions show material concerns.';

  const caveat =
    missingCount > 0
      ? ` Note: ${missingCount} metric(s) were unavailable and excluded from scoring.`
      : '';

  return `${base} Overall grade: ${grade}.${caveat}`;
}
