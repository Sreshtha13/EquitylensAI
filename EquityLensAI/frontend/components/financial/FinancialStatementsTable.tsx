'use client';

import { useState } from 'react';
import type { FinancialAnalysis } from '@/types';

type StatementType = 'income' | 'balanceSheet' | 'cashFlow';

type FinancialStatementsTableProps = {
  analysis: FinancialAnalysis;
};

function formatAmount(val: number | null | undefined, currency: string): string {
  if (val === null || val === undefined) return '—';
  const prefix = currency === 'INR' ? '₹' : '$';

  if (currency === 'INR') {
    // Format in Crores for INR
    const inCr = val / 10_000_000;
    return `${prefix}${inCr.toLocaleString(undefined, { maximumFractionDigits: 2 })} Cr`;
  }

  // Format in Millions/Billions for USD and others
  if (Math.abs(val) >= 1e9) {
    return `${prefix}${(val / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(val) >= 1e6) {
    return `${prefix}${(val / 1e6).toFixed(2)}M`;
  }
  return `${prefix}${val.toLocaleString()}`;
}

export function FinancialStatementsTable({ analysis }: FinancialStatementsTableProps) {
  const [statementType, setStatementType] = useState<StatementType>('income');

  const { currency, ttm, annualHistory, source } = analysis;

  // Periods list: TTM first (if available), then annual history
  const periods = [
    ...(ttm ? [{ label: 'TTM', period: ttm.periodEndDate, statements: ttm }] : []),
    ...annualHistory.map((h) => ({
      label: h.periodEndDate.slice(0, 4),
      period: h.periodEndDate,
      statements: h,
    })),
  ];

  // Define rows per statement type
  type StatementRow = {
    label: string;
    key: string;
    bold?: boolean | undefined;
    isEps?: boolean | undefined;
  };

  const incomeRows: StatementRow[] = [
    { label: 'Total Revenue', key: 'totalRevenue', bold: true },
    { label: 'Cost of Revenue', key: 'costOfRevenue' },
    { label: 'Gross Profit', key: 'grossProfit', bold: true },
    { label: 'Operating Expense', key: 'operatingExpense' },
    { label: 'Research & Development', key: 'researchAndDevelopment' },
    { label: 'Operating Income (EBIT)', key: 'operatingIncome', bold: true },
    { label: 'EBITDA', key: 'ebitda' },
    { label: 'Interest Expense', key: 'interestExpense' },
    { label: 'Tax Expense', key: 'taxExpense' },
    { label: 'Net Income', key: 'netIncome', bold: true },
    { label: 'Diluted EPS', key: 'dilutedEPS', isEps: true },
  ];

  const balanceRows: StatementRow[] = [
    { label: 'Cash & Short-term Equivalents', key: 'cash' },
    { label: 'Total Current Assets', key: 'totalCurrentAssets', bold: true },
    { label: 'Inventory', key: 'inventory' },
    { label: 'Total Assets', key: 'totalAssets', bold: true },
    { label: 'Short-term Debt', key: 'shortTermDebt' },
    { label: 'Total Current Liabilities', key: 'totalCurrentLiabilities', bold: true },
    { label: 'Long-term Debt', key: 'longTermDebt' },
    { label: 'Total Liabilities', key: 'totalLiabilities', bold: true },
    { label: 'Retained Earnings', key: 'retainedEarnings' },
    { label: 'Stockholders Equity', key: 'totalStockholderEquity', bold: true },
  ];

  const cashFlowRows: StatementRow[] = [
    { label: 'Net Income', key: 'netIncome' },
    { label: 'Depreciation & Amortization', key: 'deprecationAndAmortization' },
    { label: 'Working Capital Changes', key: 'changesInWorkingCapital' },
    { label: 'Operating Cash Flow', key: 'operatingCashFlow', bold: true },
    { label: 'Capital Expenditures (CapEx)', key: 'capitalExpenditures' },
    { label: 'Investing Cash Flow', key: 'investingCashFlow' },
    { label: 'Dividends Paid', key: 'dividendsPaid' },
    { label: 'Financing Cash Flow', key: 'financingCashFlow' },
    { label: 'Free Cash Flow', key: 'freeCashFlow', bold: true },
  ];

  const currentRows =
    statementType === 'income'
      ? incomeRows
      : statementType === 'balanceSheet'
        ? balanceRows
        : cashFlowRows;

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Financial Statements
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Reported figures across historical reporting periods • Currency: <span className="font-semibold text-white">{currency}</span> • Source: {source}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl border border-white/10 bg-slate-950/60 p-1">
          <button
            onClick={() => setStatementType('income')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              statementType === 'income'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Income Statement
          </button>
          <button
            onClick={() => setStatementType('balanceSheet')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              statementType === 'balanceSheet'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Balance Sheet
          </button>
          <button
            onClick={() => setStatementType('cashFlow')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              statementType === 'cashFlow'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cash Flow
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-6 font-semibold">Line Item</th>
              {periods.map((p, idx) => (
                <th key={idx} className="px-4 py-3 text-right font-semibold">
                  <div>{p.label}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{p.period}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {currentRows.map((row) => (
              <tr
                key={row.key}
                className={`transition hover:bg-slate-800/40 ${
                  row.bold ? 'font-semibold text-white' : 'text-slate-300'
                }`}
              >
                <td className="py-3 pr-6 text-xs sm:text-sm">
                  {row.label}
                </td>
                {periods.map((p, idx) => {
                  const targetObj =
                    statementType === 'income'
                      ? p.statements.income
                      : statementType === 'balanceSheet'
                        ? p.statements.balanceSheet
                        : p.statements.cashFlow;

                  const rawVal = (targetObj as Record<string, unknown>)?.[row.key] as number | null | undefined;
                  const displayVal = row.isEps
                    ? rawVal !== null && rawVal !== undefined
                      ? `${currency === 'INR' ? '₹' : '$'}${rawVal.toFixed(2)}`
                      : '—'
                    : formatAmount(rawVal, currency);

                  return (
                    <td key={idx} className="px-4 py-3 text-right font-mono text-xs sm:text-sm">
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
