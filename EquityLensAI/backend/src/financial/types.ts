import type {
  BalanceSheet,
  CashFlowMetrics,
  CashFlowStatement,
  FinancialAnalysis,
  FinancialHealthScore,
  FinancialHistory,
  FinancialMetric,
  FinancialStatements,
  FiscalPeriodType,
  GrowthMetrics,
  IncomeStatement,
  LeverageMetrics,
  LiquidityMetrics,
  ProfitabilityMetrics,
  ValuationMetrics,
} from '@equitylensai/shared';

// Re-export for intra-module use
export type {
  BalanceSheet,
  CashFlowMetrics,
  CashFlowStatement,
  FinancialAnalysis,
  FinancialHealthScore,
  FinancialHistory,
  FinancialMetric,
  FinancialStatements,
  FiscalPeriodType,
  GrowthMetrics,
  IncomeStatement,
  LeverageMetrics,
  LiquidityMetrics,
  ProfitabilityMetrics,
  ValuationMetrics,
};

// ─── Provider request / response contracts ──────────────────────────────────

export type FinancialDataRequest = {
  symbol: string;
  exchange: string | undefined;
  /** Number of annual periods to retrieve (default: 4) */
  annualPeriods: number | undefined;
};

/** Raw financial data returned by a provider before normalisation */
export type RawFinancialData = {
  symbol: string;
  name: string;
  currency: string;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
  /** Provider-supplied TTM income statement — undefined if not available */
  ttmIncome: IncomeStatement | undefined;
  /** Provider-supplied TTM balance sheet — undefined if not available */
  ttmBalanceSheet: BalanceSheet | undefined;
  /** Provider-supplied TTM cash flow — undefined if not available */
  ttmCashFlow: CashFlowStatement | undefined;
  source: string;
  retrievedAt: string;
};

/** Contract every financial data provider must satisfy */
export interface FinancialProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getFinancialData(request: FinancialDataRequest): Promise<RawFinancialData>;
}
