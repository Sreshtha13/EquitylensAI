import { describe, expect, it } from 'vitest';
import {
  calcCashFlow,
  calcGrowth,
  calcLeverage,
  calcLiquidity,
  calcProfitability,
  calcValuation,
} from '../src/financial/calculators/ratioCalculators.js';
import type {
  BalanceSheet,
  CashFlowStatement,
  FinancialStatements,
  IncomeStatement,
} from '@equitylensai/shared';

describe('Deterministic Ratio Calculators', () => {
  const sampleIncome: IncomeStatement = {
    symbol: 'TEST',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    totalRevenue: 1000,
    costOfRevenue: 600,
    grossProfit: 400,
    researchAndDevelopment: 10,
    sellingGeneralAdministrative: null,
    totalOperatingExpenses: 200,
    operatingIncome: 200,
    interestExpense: -20,
    totalOtherIncomeExpense: null,
    incomeBeforeTax: 180,
    incomeTaxExpense: 30,
    netIncome: 150,
    basicEPS: 15,
    dilutedEPS: 15,
    basicSharesOutstanding: 10,
    dilutedSharesOutstanding: 10,
    ebitda: 250,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  const sampleBalanceSheet: BalanceSheet = {
    symbol: 'TEST',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    cash: 300,
    shortTermInvestments: null,
    netReceivables: null,
    inventory: 200,
    totalCurrentAssets: 800,
    longTermInvestments: null,
    propertyPlantEquipment: null,
    goodwill: null,
    intangibleAssets: null,
    totalAssets: 2000,
    shortTermDebt: 100,
    accountsPayable: null,
    totalCurrentLiabilities: 400,
    longTermDebt: 300,
    totalLiabilities: 1000,
    retainedEarnings: 500,
    totalStockholderEquity: 1000,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  const sampleCashFlow: CashFlowStatement = {
    symbol: 'TEST',
    periodType: 'annual',
    periodEndDate: '2025-12-31',
    currency: 'INR',
    operatingCashFlow: 180,
    capitalExpenditures: -50,
    freeCashFlow: 130,
    netIncome: 150,
    deprecationAndAmortization: 50,
    changesInWorkingCapital: -20,
    investingCashFlow: -60,
    financingCashFlow: -40,
    dividendsPaid: -30,
    source: 'test',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };

  describe('calcProfitability', () => {
    it('computes margins and return metrics correctly', () => {
      const res = calcProfitability(sampleIncome, sampleBalanceSheet);

      expect(res.grossMargin.value).toBe(40); // 400 / 1000 * 100
      expect(res.grossMargin.formula).toBe('GrossProfit / Revenue × 100');
      expect(res.grossMargin.unit).toBe('percent');

      expect(res.operatingMargin.value).toBe(20); // 200 / 1000 * 100
      expect(res.netMargin.value).toBe(15); // 150 / 1000 * 100
      expect(res.returnOnAssets.value).toBe(7.5); // 150 / 2000 * 100
      expect(res.returnOnEquity.value).toBe(15); // 150 / 1000 * 100
      expect(res.ebitdaMargin.value).toBe(25); // 250 / 1000 * 100
      // capitalEmployed = 2000 - 400 = 1600. ROCE = 200 / 1600 * 100 = 12.5%
      expect(res.returnOnCapitalEmployed.value).toBe(12.5);
    });

    it('returns null instead of zero when inputs are null or division by zero', () => {
      const zeroRevIncome: IncomeStatement = {
        ...sampleIncome,
        totalRevenue: 0,
        grossProfit: null,
      };
      const res = calcProfitability(zeroRevIncome, sampleBalanceSheet);
      expect(res.grossMargin.value).toBeNull();
      expect(res.netMargin.value).toBeNull();
    });
  });

  describe('calcLiquidity', () => {
    it('computes current, quick, cash, and OCF ratios', () => {
      const res = calcLiquidity(sampleBalanceSheet, sampleCashFlow);

      // current = 800 / 400 = 2.0
      expect(res.currentRatio.value).toBe(2);
      // quick = (800 - 200) / 400 = 1.5
      expect(res.quickRatio.value).toBe(1.5);
      // cash = 300 / 400 = 0.75
      expect(res.cashRatio.value).toBe(0.75);
      // ocf = 180 / 400 = 0.45
      expect(res.operatingCashFlowRatio.value).toBe(0.45);
    });

    it('handles zero current liabilities by returning null without throwing', () => {
      const noLiab: BalanceSheet = {
        ...sampleBalanceSheet,
        totalCurrentLiabilities: 0,
      };
      const res = calcLiquidity(noLiab, sampleCashFlow);
      expect(res.currentRatio.value).toBeNull();
    });
  });

  describe('calcLeverage', () => {
    it('computes leverage ratios, debt-to-equity, and interest coverage', () => {
      const res = calcLeverage(sampleBalanceSheet, sampleIncome);

      // total debt = 300 + 100 = 400. D/E = 400 / 1000 = 0.4
      expect(res.debtToEquity.value).toBe(0.4);
      // totalLiabilities / totalAssets = 1000 / 2000 = 0.5
      expect(res.debtToAssets.value).toBe(0.5);
      // interestCoverage = EBIT (200) / |-20| = 10
      expect(res.interestCoverageRatio.value).toBe(10);
      // net debt = 400 - 300 = 100. EBITDA = 250. 100 / 250 = 0.4
      expect(res.netDebtToEbitda.value).toBe(0.4);
    });
  });

  describe('calcCashFlow', () => {
    it('computes free cash flow metrics and ratios', () => {
      const marketCap = 3000;
      const res = calcCashFlow(sampleCashFlow, sampleIncome, marketCap, '2025-12-31');

      // FCF margin = 130 / 1000 * 100 = 13%
      expect(res.freeCashFlowMargin.value).toBe(13);
      // FCF yield = 130 / 3000 * 100 = 4.333...%
      expect(res.freeCashFlowYield.value).toBeCloseTo(4.333, 2);
      // OCF / NI = 180 / 150 = 1.2
      expect(res.operatingCashFlowToNetIncome.value).toBe(1.2);
      // CapEx / Rev = |-50| / 1000 * 100 = 5%
      expect(res.capexToRevenue.value).toBe(5);
    });
  });

  describe('calcGrowth', () => {
    it('computes YoY growth rates and CAGR across periods', () => {
      const priorIncome: IncomeStatement = {
        ...sampleIncome,
        periodEndDate: '2024-12-31',
        totalRevenue: 800,
        netIncome: 100,
        dilutedEPS: 10,
      };
      const priorStatements: FinancialStatements = {
        symbol: 'TEST',
        periodType: 'annual',
        periodEndDate: '2024-12-31',
        income: priorIncome,
        balanceSheet: sampleBalanceSheet,
        cashFlow: { ...sampleCashFlow, freeCashFlow: 100 },
        source: 'test',
        retrievedAt: '2026-01-01T00:00:00.000Z',
        isStale: false,
      };

      const currStatements: FinancialStatements = {
        symbol: 'TEST',
        periodType: 'annual',
        periodEndDate: '2025-12-31',
        income: sampleIncome,
        balanceSheet: sampleBalanceSheet,
        cashFlow: sampleCashFlow,
        source: 'test',
        retrievedAt: '2026-01-01T00:00:00.000Z',
        isStale: false,
      };

      const res = calcGrowth(currStatements, priorStatements, [currStatements, priorStatements]);

      // Revenue YoY = (1000 - 800) / 800 * 100 = 25%
      expect(res.revenueGrowthYoY.value).toBe(25);
      // Net Income YoY = (150 - 100) / 100 * 100 = 50%
      expect(res.netIncomeGrowthYoY.value).toBe(50);
      // EPS YoY = (15 - 10) / 10 * 100 = 50%
      expect(res.epsGrowthYoY.value).toBe(50);
      // FCF YoY = (130 - 100) / 100 * 100 = 30%
      expect(res.freeCashFlowGrowthYoY.value).toBe(30);
      // 1-year CAGR = (1000 / 800)^1 - 1 = 25%
      expect(res.revenueCAGR?.value).toBe(25);
    });
  });

  describe('calcValuation', () => {
    it('computes P/E, P/B, P/S, EV/EBITDA accurately with live price', () => {
      const livePrice = 300;
      const shares = 10;
      // marketCap = 300 * 10 = 3000
      // debt = 300 + 100 = 400. cash = 300. EV = 3000 + 400 - 300 = 3100
      // EPS = 15. BVPS = 1000 / 10 = 100
      const res = calcValuation(
        sampleIncome,
        sampleBalanceSheet,
        sampleCashFlow,
        livePrice,
        shares,
      );

      expect(res.marketCap.value).toBe(3000);
      expect(res.enterpriseValue.value).toBe(3100);
      // PE = 300 / 15 = 20
      expect(res.peRatio.value).toBe(20);
      // PB = 300 / 100 = 3
      expect(res.priceToBook.value).toBe(3);
      // PS = 3000 / 1000 = 3
      expect(res.priceToSales.value).toBe(3);
      // EV/EBITDA = 3100 / 250 = 12.4
      expect(res.evToEbitda.value).toBe(12.4);
      // Price to FCF = 3000 / 130 = 23.0769
      expect(res.priceToFreeCashFlow.value).toBeCloseTo(23.08, 1);
    });

    it('sets valuation multiples to null when live price is null', () => {
      const res = calcValuation(sampleIncome, sampleBalanceSheet, sampleCashFlow, null, 10);
      expect(res.peRatio.value).toBeNull();
      expect(res.marketCap.value).toBeNull();
      expect(res.enterpriseValue.value).toBeNull();
    });
  });
});
