/**
 * Deterministic financial ratio calculators.
 *
 * PRINCIPLES:
 * - All calculations are pure functions with explicit formulas.
 * - If any required input is null, the metric value is null — never zero-substituted.
 * - Every metric includes its formula and source period for full traceability.
 * - No AI or LLM is involved in any calculation.
 */

import type {
  BalanceSheet,
  CashFlowMetrics,
  CashFlowStatement,
  FinancialMetric,
  FinancialStatements,
  GrowthMetrics,
  IncomeStatement,
  LeverageMetrics,
  LiquidityMetrics,
  ProfitabilityMetrics,
  ValuationMetrics,
} from '@equitylensai/shared';

// ─── Helper ────────────────────────────────────────────────────────────────

/** Safe division — returns null if divisor is null, zero, or dividend is null */
function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

/** Safe multiply by 100 */
function toPercent(ratio: number | null): number | null {
  if (ratio === null) return null;
  return ratio * 100;
}

/** Growth rate from prior to current: (current - prior) / |prior| * 100 */
function growthRate(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

/** CAGR: (endValue / startValue)^(1/years) - 1 */
function cagr(endValue: number | null, startValue: number | null, years: number): number | null {
  if (endValue === null || startValue === null || startValue <= 0 || years <= 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function metric(
  value: number | null,
  formula: string,
  unit: FinancialMetric['unit'],
  periodEndDate: string,
  isBlended?: boolean
): FinancialMetric {
  return { value, formula, unit, periodEndDate, isBlended: isBlended };
}

// ─── Profitability ─────────────────────────────────────────────────────────

export function calcProfitability(
  income: IncomeStatement,
  balanceSheet: BalanceSheet
): ProfitabilityMetrics {
  const p = income.periodEndDate;
  const rev = income.totalRevenue;
  const gp = income.grossProfit;
  const oi = income.operatingIncome;
  const ni = income.netIncome;
  const ebitda = income.ebitda;
  const assets = balanceSheet.totalAssets;
  const equity = balanceSheet.totalStockholderEquity;
  const currLiab = balanceSheet.totalCurrentLiabilities;

  // ROCE: EBIT / (TotalAssets - CurrentLiabilities)
  const capitalEmployed =
    assets !== null && currLiab !== null ? assets - currLiab : null;

  return {
    grossMargin: metric(toPercent(safeDiv(gp, rev)), 'GrossProfit / Revenue × 100', 'percent', p),
    operatingMargin: metric(toPercent(safeDiv(oi, rev)), 'OperatingIncome / Revenue × 100', 'percent', p),
    netMargin: metric(toPercent(safeDiv(ni, rev)), 'NetIncome / Revenue × 100', 'percent', p),
    returnOnAssets: metric(toPercent(safeDiv(ni, assets)), 'NetIncome / TotalAssets × 100', 'percent', p),
    returnOnEquity: metric(toPercent(safeDiv(ni, equity)), 'NetIncome / StockholdersEquity × 100', 'percent', p),
    returnOnCapitalEmployed: metric(
      toPercent(safeDiv(oi, capitalEmployed)),
      'OperatingIncome / (TotalAssets - CurrentLiabilities) × 100',
      'percent', p
    ),
    ebitdaMargin: metric(toPercent(safeDiv(ebitda, rev)), 'EBITDA / Revenue × 100', 'percent', p),
  };
}

// ─── Liquidity ──────────────────────────────────────────────────────────────

export function calcLiquidity(
  balanceSheet: BalanceSheet,
  cashFlow: CashFlowStatement
): LiquidityMetrics {
  const p = balanceSheet.periodEndDate;
  const ca = balanceSheet.totalCurrentAssets;
  const cl = balanceSheet.totalCurrentLiabilities;
  const inv = balanceSheet.inventory;
  const cash = balanceSheet.cash;
  const ocf = cashFlow.operatingCashFlow;

  const quickAssets = ca !== null && inv !== null ? ca - inv : null;

  return {
    currentRatio: metric(safeDiv(ca, cl), 'CurrentAssets / CurrentLiabilities', 'ratio', p),
    quickRatio: metric(safeDiv(quickAssets, cl), '(CurrentAssets - Inventory) / CurrentLiabilities', 'ratio', p),
    cashRatio: metric(safeDiv(cash, cl), 'Cash / CurrentLiabilities', 'ratio', p),
    operatingCashFlowRatio: metric(safeDiv(ocf, cl), 'OperatingCashFlow / CurrentLiabilities', 'ratio', p),
  };
}

// ─── Leverage ───────────────────────────────────────────────────────────────

export function calcLeverage(
  balanceSheet: BalanceSheet,
  income: IncomeStatement
): LeverageMetrics {
  const p = balanceSheet.periodEndDate;
  const equity = balanceSheet.totalStockholderEquity;
  const totalLiab = balanceSheet.totalLiabilities;
  const totalAssets = balanceSheet.totalAssets;
  const ltDebt = balanceSheet.longTermDebt;
  const stDebt = balanceSheet.shortTermDebt;
  const cash = balanceSheet.cash;
  const ebit = income.operatingIncome;
  const interest = income.interestExpense;
  const ebitda = income.ebitda;

  const totalDebt =
    ltDebt !== null || stDebt !== null
      ? (ltDebt ?? 0) + (stDebt ?? 0)
      : null;

  const netDebt =
    totalDebt !== null && cash !== null
      ? totalDebt - cash
      : null;

  return {
    debtToEquity: metric(safeDiv(totalDebt, equity), '(LongTermDebt + ShortTermDebt) / StockholdersEquity', 'ratio', p),
    debtToAssets: metric(safeDiv(totalLiab, totalAssets), 'TotalLiabilities / TotalAssets', 'ratio', p),
    equityMultiplier: metric(safeDiv(totalAssets, equity), 'TotalAssets / StockholdersEquity', 'ratio', p),
    interestCoverageRatio: metric(
      // interest expense from income statement is typically negative; negate it
      interest !== null && interest !== 0
        ? safeDiv(ebit, -interest < 0 ? interest : -interest)
        : null,
      'EBIT / |InterestExpense|',
      'x', p
    ),
    netDebtToEbitda: metric(safeDiv(netDebt, ebitda), '(LongTermDebt + ShortTermDebt - Cash) / EBITDA', 'x', p),
  };
}

// ─── Cash Flow ──────────────────────────────────────────────────────────────

export function calcCashFlow(
  cashFlow: CashFlowStatement,
  income: IncomeStatement,
  marketCapValue: number | null,
  periodEndDate: string
): CashFlowMetrics {
  const p = periodEndDate;
  const fcf = cashFlow.freeCashFlow;
  const ocf = cashFlow.operatingCashFlow;
  const ni = cashFlow.netIncome;
  const capex = cashFlow.capitalExpenditures;
  const rev = income.totalRevenue;

  return {
    freeCashFlowMargin: metric(toPercent(safeDiv(fcf, rev)), 'FreeCashFlow / Revenue × 100', 'percent', p),
    freeCashFlowYield: metric(toPercent(safeDiv(fcf, marketCapValue)), 'FreeCashFlow / MarketCap × 100', 'percent', p),
    operatingCashFlowToNetIncome: metric(safeDiv(ocf, ni), 'OperatingCashFlow / NetIncome', 'ratio', p),
    capexToRevenue: metric(
      toPercent(safeDiv(capex !== null ? Math.abs(capex) : null, rev)),
      '|CapEx| / Revenue × 100',
      'percent', p
    ),
  };
}

// ─── Growth ─────────────────────────────────────────────────────────────────

export function calcGrowth(
  current: FinancialStatements,
  prior: FinancialStatements | undefined,
  allAnnual: FinancialStatements[]
): GrowthMetrics {
  const p = current.income.periodEndDate;

  const curr = current.income;
  const pInc = prior?.income;
  const currCf = current.cashFlow;
  const priorCf = prior?.cashFlow;

  // CAGR: oldest vs newest revenue in available history
  let revCAGR: FinancialMetric | null = null;
  if (allAnnual.length >= 2) {
    const newest = allAnnual[0]!.income.totalRevenue;
    const oldest = allAnnual[allAnnual.length - 1]!.income.totalRevenue;
    const years = allAnnual.length - 1;
    const cagrVal = cagr(newest, oldest, years);
    revCAGR = metric(
      cagrVal,
      `(Revenue[${allAnnual[0]!.income.periodEndDate}] / Revenue[${allAnnual[allAnnual.length - 1]!.income.periodEndDate}])^(1/${years}) - 1`,
      'percent',
      p
    );
  }

  return {
    revenueGrowthYoY: metric(
      growthRate(curr.totalRevenue, pInc?.totalRevenue ?? null),
      '(Revenue_t - Revenue_t-1) / |Revenue_t-1| × 100',
      'percent', p
    ),
    grossProfitGrowthYoY: metric(
      growthRate(curr.grossProfit, pInc?.grossProfit ?? null),
      '(GrossProfit_t - GrossProfit_t-1) / |GrossProfit_t-1| × 100',
      'percent', p
    ),
    operatingIncomeGrowthYoY: metric(
      growthRate(curr.operatingIncome, pInc?.operatingIncome ?? null),
      '(OperatingIncome_t - OperatingIncome_t-1) / |OperatingIncome_t-1| × 100',
      'percent', p
    ),
    netIncomeGrowthYoY: metric(
      growthRate(curr.netIncome, pInc?.netIncome ?? null),
      '(NetIncome_t - NetIncome_t-1) / |NetIncome_t-1| × 100',
      'percent', p
    ),
    epsGrowthYoY: metric(
      growthRate(curr.dilutedEPS, pInc?.dilutedEPS ?? null),
      '(DilutedEPS_t - DilutedEPS_t-1) / |DilutedEPS_t-1| × 100',
      'percent', p
    ),
    freeCashFlowGrowthYoY: metric(
      growthRate(currCf.freeCashFlow, priorCf?.freeCashFlow ?? null),
      '(FCF_t - FCF_t-1) / |FCF_t-1| × 100',
      'percent', p
    ),
    revenueCAGR: revCAGR,
  };
}

// ─── Valuation ───────────────────────────────────────────────────────────────

export function calcValuation(
  income: IncomeStatement,
  balanceSheet: BalanceSheet,
  cashFlow: CashFlowStatement,
  livePrice: number | null,
  sharesOutstanding: number | null
): ValuationMetrics {
  const p = income.periodEndDate;

  const ni = income.netIncome;
  const rev = income.totalRevenue;
  const ebitda = income.ebitda;
  const equity = balanceSheet.totalStockholderEquity;
  const fcf = cashFlow.freeCashFlow;
  const ltDebt = balanceSheet.longTermDebt ?? 0;
  const stDebt = balanceSheet.shortTermDebt ?? 0;
  const cash = balanceSheet.cash ?? 0;

  // Market Cap
  const marketCap =
    livePrice !== null && sharesOutstanding !== null
      ? livePrice * sharesOutstanding
      : null;

  // Enterprise Value = MarketCap + TotalDebt - Cash
  const ev =
    marketCap !== null
      ? marketCap + ltDebt + stDebt - cash
      : null;

  // EPS fallback from net income
  const eps = income.dilutedEPS ?? (ni !== null && sharesOutstanding !== null ? ni / sharesOutstanding : null);

  // Book value per share
  const bvps =
    equity !== null && sharesOutstanding !== null && sharesOutstanding > 0
      ? equity / sharesOutstanding
      : null;

  return {
    peRatio: metric(safeDiv(livePrice, eps), 'Price / DilutedEPS', 'ratio', p),
    forwardPE: metric(null, 'Price / ForwardEPS (not available from provider)', 'ratio', p),
    priceToSales: metric(
      marketCap !== null && rev !== null ? safeDiv(marketCap, rev) : null,
      'MarketCap / Revenue',
      'ratio', p
    ),
    priceToBook: metric(safeDiv(livePrice, bvps), 'Price / (StockholdersEquity / SharesOutstanding)', 'ratio', p),
    evToEbitda: metric(safeDiv(ev, ebitda), 'EnterpriseValue / EBITDA', 'ratio', p),
    evToRevenue: metric(safeDiv(ev, rev), 'EnterpriseValue / Revenue', 'ratio', p),
    priceToFreeCashFlow: metric(
      marketCap !== null ? safeDiv(marketCap, fcf) : null,
      'MarketCap / FreeCashFlow',
      'ratio', p
    ),
    marketCap: metric(marketCap, 'Price × SharesOutstanding', 'currency', p),
    enterpriseValue: metric(ev, 'MarketCap + LongTermDebt + ShortTermDebt - Cash', 'currency', p),
  };
}
