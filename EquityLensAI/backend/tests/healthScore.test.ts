import { describe, expect, it } from 'vitest';
import { calcHealthScore } from '../src/financial/healthScore/healthScoreEngine.js';
import {
  calcCashFlow,
  calcGrowth,
  calcLeverage,
  calcLiquidity,
  calcProfitability,
} from '../src/financial/calculators/ratioCalculators.js';
import type {
  BalanceSheet,
  CashFlowStatement,
  FinancialStatements,
  IncomeStatement,
} from '@equitylensai/shared';

describe('Financial Health Score Engine', () => {
  const strongIncome: IncomeStatement = {
    symbol: 'HEALTHY',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    totalRevenue: 10000,
    costOfRevenue: 4000,
    grossProfit: 6000,
    researchAndDevelopment: 500,
    sellingGeneralAdministrative: null,
    totalOperatingExpenses: 3500,
    operatingIncome: 2500,
    interestExpense: -100,
    totalOtherIncomeExpense: null,
    incomeBeforeTax: 2100,
    incomeTaxExpense: 300,
    netIncome: 1800,
    basicEPS: 18,
    dilutedEPS: 18,
    basicSharesOutstanding: 100,
    dilutedSharesOutstanding: 100,
    ebitda: 3000,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  const strongBalanceSheet: BalanceSheet = {
    symbol: 'HEALTHY',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    cash: 5000,
    shortTermInvestments: null,
    netReceivables: null,
    inventory: 1500,
    totalCurrentAssets: 12000,
    longTermInvestments: null,
    propertyPlantEquipment: null,
    goodwill: null,
    intangibleAssets: null,
    totalAssets: 25000,
    shortTermDebt: 500,
    accountsPayable: null,
    totalCurrentLiabilities: 3000,
    longTermDebt: 1000,
    totalLiabilities: 6000,
    retainedEarnings: 10000,
    totalStockholderEquity: 19000,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  const strongCashFlow: CashFlowStatement = {
    symbol: 'HEALTHY',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    operatingCashFlow: 2200,
    capitalExpenditures: -400,
    freeCashFlow: 1800,
    netIncome: 1800,
    deprecationAndAmortization: 500,
    changesInWorkingCapital: -100,
    investingCashFlow: -500,
    financingCashFlow: -300,
    dividendsPaid: -200,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  const priorStatements: FinancialStatements = {
    symbol: 'HEALTHY',
    periodType: 'annual',
    periodEndDate: '2024-12-31',
    income: {
      ...strongIncome,
      periodEndDate: '2024-12-31',
      totalRevenue: 8500,
      netIncome: 1400,
      dilutedEPS: 14,
    },
    balanceSheet: strongBalanceSheet,
    cashFlow: { ...strongCashFlow, freeCashFlow: 1400 },
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    isStale: false,
  };

  const currStatements: FinancialStatements = {
    symbol: 'HEALTHY',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    income: strongIncome,
    balanceSheet: strongBalanceSheet,
    cashFlow: strongCashFlow,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    isStale: false,
  };

  it('produces a high composite score and A/B grade for a financially strong company', () => {
    const prof = calcProfitability(strongIncome, strongBalanceSheet);
    const liq = calcLiquidity(strongBalanceSheet, strongCashFlow);
    const lev = calcLeverage(strongBalanceSheet, strongIncome);
    const cf = calcCashFlow(strongCashFlow, strongIncome, 50000, '2025-12-31');
    const growth = calcGrowth(currStatements, priorStatements, [currStatements, priorStatements]);

    const result = calcHealthScore('HEALTHY', prof, liq, lev, cf, growth, '2025-12-31');

    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(['A+', 'A', 'B']).toContain(result.grade);
    expect(result.dimensions.profitability.score).toBeGreaterThan(60);
    expect(result.dimensions.liquidity.score).toBeGreaterThan(60);
    expect(result.dimensions.leverage.score).toBeGreaterThan(60);
    expect(result.dimensions.cashFlow.score).toBeGreaterThan(60);
    expect(result.dimensions.growth.score).toBeGreaterThan(50);
  });

  it('grades distressed companies appropriately with low scores', () => {
    const distressedIncome: IncomeStatement = {
      ...strongIncome,
      grossProfit: 500,
      operatingIncome: -500,
      netIncome: -800,
      ebitda: -300,
    };
    const distressedBalanceSheet: BalanceSheet = {
      ...strongBalanceSheet,
      totalCurrentAssets: 1000,
      totalCurrentLiabilities: 4000,
      totalStockholderEquity: 200,
      longTermDebt: 8000,
      shortTermDebt: 3000,
      cash: 50,
      inventory: 500,
    };
    const distressedCashFlow: CashFlowStatement = {
      ...strongCashFlow,
      operatingCashFlow: -600,
      freeCashFlow: -900,
    };

    const prof = calcProfitability(distressedIncome, distressedBalanceSheet);
    const liq = calcLiquidity(distressedBalanceSheet, distressedCashFlow);
    const lev = calcLeverage(distressedBalanceSheet, distressedIncome);
    const cf = calcCashFlow(distressedCashFlow, distressedIncome, 5000, '2025-12-31');
    const growth = calcGrowth(
      { ...currStatements, income: distressedIncome, cashFlow: distressedCashFlow },
      priorStatements,
      [
        { ...currStatements, income: distressedIncome, cashFlow: distressedCashFlow },
        priorStatements,
      ],
    );

    const result = calcHealthScore('DISTRESSED', prof, liq, lev, cf, growth, '2025-12-31');

    expect(result.overallScore).toBeLessThan(45);
    expect(['D', 'F']).toContain(result.grade);
  });

  it('records missing metrics as data quality warnings without failing', () => {
    const incompleteIncome: IncomeStatement = {
      ...strongIncome,
      grossProfit: null,
      ebitda: null,
    };
    const prof = calcProfitability(incompleteIncome, strongBalanceSheet);
    const liq = calcLiquidity(strongBalanceSheet, strongCashFlow);
    const lev = calcLeverage(strongBalanceSheet, incompleteIncome);
    const cf = calcCashFlow(strongCashFlow, incompleteIncome, null, '2025-12-31');
    const growth = calcGrowth(currStatements, undefined, [currStatements]);

    const result = calcHealthScore('INCOMPLETE', prof, liq, lev, cf, growth, '2025-12-31');

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.dataQualityWarnings.length).toBeGreaterThan(0);
    expect(result.summary).toContain('metric(s) were unavailable');
  });
});
