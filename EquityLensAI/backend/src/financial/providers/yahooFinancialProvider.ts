/**
 * Yahoo Finance financial data provider.
 *
 * Combines Yahoo Finance's `fundamentalsTimeSeries` API (for comprehensive multi-year
 * audited annual financial statements) and `quoteSummary` (for real-time key statistics,
 * company profile, and TTM summary).
 *
 * All field values that are not reported are explicitly set to null.
 * We never substitute zero or any synthetic value for a missing figure.
 */
import { yf } from '../../market/providers/yahoo/client.js';
import type { FinancialDataRequest, FinancialProvider, RawFinancialData } from '../types.js';
import type {
  BalanceSheet,
  CashFlowStatement,
  FiscalPeriodType,
  IncomeStatement,
} from '@equitylensai/shared';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

/** Coerce number: undefined → null, 0 is a valid value */
function n(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isNaN(num) ? null : num;
}

/** Format a Date to YYYY-MM-DD or return 'unknown' */
function formatDate(d: Date | string | undefined | null): string {
  if (!d) return 'unknown';
  if (typeof d === 'string') return d.split('T')[0]!;
  return d.toISOString().split('T')[0]!;
}

class YahooFinancialProvider implements FinancialProvider {
  readonly id = 'yahoo-financial';
  readonly name = 'Yahoo Finance (Financial Statements)';

  isConfigured(): boolean {
    return true;
  }

  async getFinancialData(request: FinancialDataRequest): Promise<RawFinancialData> {
    const periods = request.annualPeriods ?? 4;
    const ticker = this.buildTicker(request.symbol, request.exchange);
    const retrievedAt = new Date().toISOString();

    logger.info({ ticker, symbol: request.symbol }, 'Fetching Yahoo Finance financial statements');

    try {
      // 1. Fetch quoteSummary modules for metadata and key statistics
      const [priceData, keyStatsData, financialDataModule] = await Promise.all([
        yf.quoteSummary(ticker, { modules: ['price', 'summaryDetail'] }).catch(() => null),
        yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] }).catch(() => null),
        yf.quoteSummary(ticker, { modules: ['financialData'] }).catch(() => null),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const priceObj = (priceData as any)?.price as Record<string, unknown> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsObj = (keyStatsData as any)?.defaultKeyStatistics as
        Record<string, unknown> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finObj = (financialDataModule as any)?.financialData as
        Record<string, unknown> | undefined;

      const name = (priceObj?.['longName'] ?? priceObj?.['shortName'] ?? request.symbol) as string;
      const currency = (priceObj?.['currency'] ?? finObj?.['financialCurrency'] ?? 'INR') as string;

      // 2. Fetch multi-year annual statement history via fundamentalsTimeSeries
      let annualTs: Record<string, unknown>[] = [];
      try {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 6);
        const p1 = fiveYearsAgo.toISOString().split('T')[0]!;

        const rawTs = await yf.fundamentalsTimeSeries(ticker, {
          period1: p1,
          type: 'annual',
          module: 'all',
        });
        annualTs = (rawTs as unknown as Record<string, unknown>[]) || [];
      } catch (tsErr) {
        logger.warn(
          { ticker, tsErr },
          'fundamentalsTimeSeries annual fetch failed; will attempt quoteSummary fallback',
        );
      }

      // Sort chronological descending (most recent first)
      const sortedAnnual = [...annualTs].sort((a, b) => {
        const da = new Date((a['date'] as string | Date) || 0).getTime();
        const db = new Date((b['date'] as string | Date) || 0).getTime();
        return db - da;
      });

      let incomeStatements: IncomeStatement[] = [];
      let balanceSheets: BalanceSheet[] = [];
      let cashFlowStatements: CashFlowStatement[] = [];

      if (sortedAnnual.length > 0) {
        incomeStatements = sortedAnnual
          .slice(0, periods)
          .map((row) => this.mapTimeSeriesIncome(row, request.symbol, currency, retrievedAt));

        balanceSheets = sortedAnnual
          .slice(0, periods)
          .map((row) => this.mapTimeSeriesBalanceSheet(row, request.symbol, currency, retrievedAt));

        cashFlowStatements = sortedAnnual
          .slice(0, periods)
          .map((row) => this.mapTimeSeriesCashFlow(row, request.symbol, currency, retrievedAt));
      } else {
        // Fallback to legacy quoteSummary submodules if fundamentalsTimeSeries yielded nothing
        const [legacyIncome, legacyBs, legacyCf] = await Promise.all([
          yf.quoteSummary(ticker, { modules: ['incomeStatementHistory'] }).catch(() => null),
          yf.quoteSummary(ticker, { modules: ['balanceSheetHistory'] }).catch(() => null),
          yf.quoteSummary(ticker, { modules: ['cashflowStatementHistory'] }).catch(() => null),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const incRaw = ((legacyIncome as any)?.incomeStatementHistory?.incomeStatementHistory ??
          []) as unknown[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bsRaw = ((legacyBs as any)?.balanceSheetHistory?.balanceSheetStatements ??
          []) as unknown[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cfRaw = ((legacyCf as any)?.cashflowStatementHistory?.cashflowStatements ??
          []) as unknown[];

        incomeStatements = incRaw
          .slice(0, periods)
          .map((s) => this.normalizeLegacyIncome(s, request.symbol, currency, retrievedAt));
        balanceSheets = bsRaw
          .slice(0, periods)
          .map((s) => this.normalizeLegacyBalanceSheet(s, request.symbol, currency, retrievedAt));
        cashFlowStatements = cfRaw
          .slice(0, periods)
          .map((s) => this.normalizeLegacyCashFlow(s, request.symbol, currency, retrievedAt));
      }

      if (incomeStatements.length === 0) {
        throw new AppError(
          'FINANCIAL_DATA_UNAVAILABLE',
          `No annual financial statement data found for ${request.symbol} (${ticker}) via Yahoo Finance`,
          502,
        );
      }

      // 3. Assemble TTM statements if quarterly data is available
      let ttmIncome: IncomeStatement | undefined = undefined;
      let ttmBalanceSheet: BalanceSheet | undefined = undefined;
      let ttmCashFlow: CashFlowStatement | undefined = undefined;
      let quarterlyIncomeStatements: IncomeStatement[] = [];
      let quarterlyBalanceSheets: BalanceSheet[] = [];
      let quarterlyCashFlowStatements: CashFlowStatement[] = [];

      try {
        const rawQuarterly = await yf.fundamentalsTimeSeries(ticker, {
          period1: new Date(Date.now() - 6 * 365 * 86400 * 1000).toISOString().split('T')[0]!,
          type: 'quarterly',
          module: 'all',
        });
        const quarterlyTs = (rawQuarterly as unknown as Record<string, unknown>[]) || [];
        const sortedQ = [...quarterlyTs].sort((a, b) => {
          const da = new Date((a['date'] as string | Date) || 0).getTime();
          const db = new Date((b['date'] as string | Date) || 0).getTime();
          return db - da;
        });

        quarterlyIncomeStatements = sortedQ.map((row) =>
          this.mapTimeSeriesIncome(row, request.symbol, currency, retrievedAt, 'quarterly'),
        );
        quarterlyBalanceSheets = sortedQ.map((row) =>
          this.mapTimeSeriesBalanceSheet(row, request.symbol, currency, retrievedAt, 'quarterly'),
        );
        quarterlyCashFlowStatements = sortedQ.map((row) =>
          this.mapTimeSeriesCashFlow(row, request.symbol, currency, retrievedAt, 'quarterly'),
        );

        if (sortedQ.length >= 4) {
          const last4 = sortedQ.slice(0, 4);
          const latestQDate = formatDate(last4[0]!['date'] as Date | string);

          const sumQ = (key: string): number | null => {
            const vals = last4.map((q) => n(q[key]));
            if (vals.some((v) => v === null)) return null;
            return vals.reduce<number>((acc, v) => acc + (v as number), 0);
          };

          ttmIncome = {
            symbol: request.symbol,
            periodType: 'ttm',
            periodEndDate: latestQDate,
            currency,
            totalRevenue: sumQ('totalRevenue') ?? n(finObj?.['totalRevenue']),
            costOfRevenue: sumQ('costOfRevenue'),
            grossProfit: sumQ('grossProfit') ?? n(finObj?.['grossProfits']),
            researchAndDevelopment: sumQ('researchAndDevelopment'),
            sellingGeneralAdministrative: sumQ('sellingGeneralAdministrative'),
            totalOperatingExpenses: sumQ('totalOperatingExpenses'),
            operatingIncome: sumQ('operatingIncome'),
            interestExpense: sumQ('interestExpense'),
            totalOtherIncomeExpense: sumQ('otherNonOperatingIncomeExpenses'),
            incomeBeforeTax: sumQ('pretaxIncome'),
            incomeTaxExpense: sumQ('taxProvision'),
            netIncome: sumQ('netIncome') ?? n(statsObj?.['netIncomeToCommon']),
            basicEPS: n(statsObj?.['trailingEps']),
            dilutedEPS: n(statsObj?.['trailingEps']),
            basicSharesOutstanding: n(statsObj?.['sharesOutstanding']),
            dilutedSharesOutstanding: n(statsObj?.['sharesOutstanding']),
            ebitda: n(finObj?.['ebitda']),
            source: this.id,
            retrievedAt,
          };

          ttmBalanceSheet = this.mapTimeSeriesBalanceSheet(
            last4[0]!,
            request.symbol,
            currency,
            retrievedAt,
            'ttm',
          );
          ttmCashFlow = {
            symbol: request.symbol,
            periodType: 'ttm',
            periodEndDate: latestQDate,
            currency,
            netIncome: sumQ('netIncome'),
            deprecationAndAmortization: sumQ('depreciationAndAmortization'),
            changesInWorkingCapital: sumQ('changeInWorkingCapital'),
            operatingCashFlow: sumQ('operatingCashFlow') ?? n(finObj?.['operatingCashflow']),
            capitalExpenditures: sumQ('capitalExpenditure'),
            investingCashFlow: sumQ('investingCashFlow'),
            dividendsPaid: sumQ('cashDividendsPaid'),
            financingCashFlow: sumQ('financingCashFlow'),
            freeCashFlow: sumQ('freeCashFlow') ?? n(finObj?.['freeCashflow']),
            source: this.id,
            retrievedAt,
          };
        }
      } catch (ttmErr) {
        logger.debug(
          { ticker, ttmErr },
          'Quarterly TTM rollup unavailable; using annual as primary baseline',
        );
      }

      return {
        symbol: request.symbol,
        name,
        currency,
        incomeStatements,
        balanceSheets,
        cashFlowStatements,
        quarterlyIncomeStatements,
        quarterlyBalanceSheets,
        quarterlyCashFlowStatements,
        ttmIncome,
        ttmBalanceSheet,
        ttmCashFlow,
        source: this.id,
        retrievedAt,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, ticker }, 'Yahoo Finance financial data fetch failed');
      throw new AppError(
        'FINANCIAL_PROVIDER_ERROR',
        `Yahoo Finance financial data fetch failed for ${request.symbol}: ${String(err)}`,
        502,
        { cause: err },
      );
    }
  }

  // ── Mappers for fundamentalsTimeSeries ──────────────────────────────────────

  private mapTimeSeriesIncome(
    r: Record<string, unknown>,
    symbol: string,
    currency: string,
    retrievedAt: string,
    periodType: FiscalPeriodType = 'annual',
  ): IncomeStatement {
    const totalRevenue = n(r['totalRevenue']) ?? n(r['operatingRevenue']);
    const costOfRevenue = n(r['costOfRevenue']) ?? n(r['reconciledCostOfRevenue']);
    const grossProfit =
      n(r['grossProfit']) ??
      (totalRevenue !== null && costOfRevenue !== null ? totalRevenue - costOfRevenue : null);
    const operatingIncome = n(r['operatingIncome']);
    const da = n(r['depreciationAndAmortization']) ?? n(r['depreciationAmortizationDepletion']);
    const ebitda =
      n(r['ebitda']) ?? (operatingIncome !== null && da !== null ? operatingIncome + da : null);

    return {
      symbol,
      periodType,
      periodEndDate: formatDate(r['date'] as Date | string),
      currency,
      totalRevenue,
      costOfRevenue,
      grossProfit,
      researchAndDevelopment: n(r['researchAndDevelopment']),
      sellingGeneralAdministrative: n(r['sellingGeneralAdministrative']),
      totalOperatingExpenses: n(r['totalOperatingExpenses']),
      operatingIncome,
      interestExpense:
        n(r['interestExpense']) !== null ? -Math.abs(n(r['interestExpense'])!) : null,
      totalOtherIncomeExpense: n(r['otherNonOperatingIncomeExpenses']),
      incomeBeforeTax: n(r['pretaxIncome']),
      incomeTaxExpense: n(r['taxProvision']),
      netIncome: n(r['netIncome']) ?? n(r['netIncomeCommonStockholders']),
      basicEPS: n(r['basicEPS']),
      dilutedEPS: n(r['dilutedEPS']),
      basicSharesOutstanding: n(r['basicAverageShares']),
      dilutedSharesOutstanding: n(r['dilutedAverageShares']),
      ebitda,
      source: this.id,
      retrievedAt,
    };
  }

  private mapTimeSeriesBalanceSheet(
    r: Record<string, unknown>,
    symbol: string,
    currency: string,
    retrievedAt: string,
    periodType: FiscalPeriodType = 'annual',
  ): BalanceSheet {
    const currentDebt = n(r['currentDebt']) ?? n(r['currentDebtAndCapitalLeaseObligation']);
    const ltDebt = n(r['longTermDebt']) ?? n(r['longTermDebtAndCapitalLeaseObligation']);
    const totalLiab =
      n(r['totalLiabilitiesNetMinorityInterest']) ??
      (n(r['totalAssets']) !== null && n(r['stockholdersEquity']) !== null
        ? (n(r['totalAssets']) as number) - (n(r['stockholdersEquity']) as number)
        : null);

    return {
      symbol,
      periodType,
      periodEndDate: formatDate(r['date'] as Date | string),
      currency,
      cash: n(r['cashAndCashEquivalents']) ?? n(r['cashCashEquivalentsAndShortTermInvestments']),
      shortTermInvestments: n(r['otherShortTermInvestments']),
      netReceivables: n(r['receivables']) ?? n(r['accountsReceivable']),
      inventory: n(r['inventory']),
      totalCurrentAssets: n(r['currentAssets']),
      longTermInvestments: n(r['investmentinFinancialAssets']),
      propertyPlantEquipment: n(r['netPPE']) ?? n(r['grossPPE']),
      goodwill: n(r['goodwill']),
      intangibleAssets: n(r['otherIntangibleAssets']) ?? n(r['goodwillAndOtherIntangibleAssets']),
      totalAssets: n(r['totalAssets']),
      shortTermDebt: currentDebt,
      accountsPayable: n(r['accountsPayable']),
      totalCurrentLiabilities: n(r['currentLiabilities']),
      longTermDebt: ltDebt,
      totalLiabilities: totalLiab,
      retainedEarnings: n(r['retainedEarnings']),
      totalStockholderEquity: n(r['stockholdersEquity']) ?? n(r['commonStockEquity']),
      source: this.id,
      retrievedAt,
    };
  }

  private mapTimeSeriesCashFlow(
    r: Record<string, unknown>,
    symbol: string,
    currency: string,
    retrievedAt: string,
    periodType: FiscalPeriodType = 'annual',
  ): CashFlowStatement {
    const ocf = n(r['operatingCashFlow']);
    const capex = n(r['capitalExpenditure']) ?? n(r['capitalExpenditures']);
    const fcf =
      n(r['freeCashFlow']) ??
      (ocf !== null && capex !== null ? ocf + (capex < 0 ? capex : -capex) : null);

    return {
      symbol,
      periodType,
      periodEndDate: formatDate(r['date'] as Date | string),
      currency,
      netIncome: n(r['netIncome']),
      deprecationAndAmortization:
        n(r['depreciationAndAmortization']) ?? n(r['depreciationAmortizationDepletion']),
      changesInWorkingCapital: n(r['changeInWorkingCapital']),
      operatingCashFlow: ocf,
      capitalExpenditures: capex !== null ? (capex < 0 ? capex : -capex) : null,
      investingCashFlow: n(r['investingCashFlow']),
      dividendsPaid: n(r['cashDividendsPaid']),
      financingCashFlow: n(r['financingCashFlow']),
      freeCashFlow: fcf,
      source: this.id,
      retrievedAt,
    };
  }

  // ── Mappers for legacy quoteSummary submodules (Fallback) ────────────────────

  private normalizeLegacyIncome(
    s: unknown,
    symbol: string,
    currency: string,
    retrievedAt: string,
  ): IncomeStatement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (s || {}) as Record<string, any>;
    const totalRevenue = n(r['totalRevenue']);
    const costOfRevenue = n(r['costOfRevenue']);
    const grossProfit =
      n(r['grossProfit']) ??
      (totalRevenue !== null && costOfRevenue !== null ? totalRevenue - costOfRevenue : null);
    const operatingIncome = n(r['operatingIncome']) ?? n(r['ebit']);
    const da = n(r['depreciation']) ?? n(r['depreciationAndAmortization']);
    const ebitda =
      n(r['ebitda']) ?? (operatingIncome !== null && da !== null ? operatingIncome + da : null);

    return {
      symbol,
      periodType: 'annual',
      periodEndDate: formatDate(r['endDate'] as Date | undefined),
      currency,
      totalRevenue,
      costOfRevenue,
      grossProfit,
      researchAndDevelopment: n(r['researchDevelopment']),
      sellingGeneralAdministrative: n(r['sellingGeneralAdministrative']),
      totalOperatingExpenses: n(r['totalOperatingExpenses']),
      operatingIncome,
      interestExpense: n(r['interestExpense']),
      totalOtherIncomeExpense: n(r['totalOtherIncomeExpenseNet']),
      incomeBeforeTax: n(r['incomeBeforeTax']),
      incomeTaxExpense: n(r['incomeTaxExpense']),
      netIncome: n(r['netIncome']),
      basicEPS: null,
      dilutedEPS: null,
      basicSharesOutstanding: null,
      dilutedSharesOutstanding: null,
      ebitda,
      source: this.id,
      retrievedAt,
    };
  }

  private normalizeLegacyBalanceSheet(
    s: unknown,
    symbol: string,
    currency: string,
    retrievedAt: string,
  ): BalanceSheet {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (s || {}) as Record<string, any>;
    return {
      symbol,
      periodType: 'annual',
      periodEndDate: formatDate(r['endDate'] as Date | undefined),
      currency,
      cash: n(r['cash']),
      shortTermInvestments: n(r['shortTermInvestments']),
      netReceivables: n(r['netReceivables']),
      inventory: n(r['inventory']),
      totalCurrentAssets: n(r['totalCurrentAssets']),
      longTermInvestments: n(r['longTermInvestments']),
      propertyPlantEquipment: n(r['propertyPlantEquipment']),
      goodwill: n(r['goodwill']),
      intangibleAssets: n(r['intangibleAssets']),
      totalAssets: n(r['totalAssets']),
      shortTermDebt: n(r['shortLongTermDebt']),
      accountsPayable: n(r['accountsPayable']),
      totalCurrentLiabilities: n(r['totalCurrentLiabilities']),
      longTermDebt: n(r['longTermDebt']),
      totalLiabilities: n(r['totalLiab']),
      retainedEarnings: n(r['retainedEarnings']),
      totalStockholderEquity: n(r['totalStockholderEquity']),
      source: this.id,
      retrievedAt,
    };
  }

  private normalizeLegacyCashFlow(
    s: unknown,
    symbol: string,
    currency: string,
    retrievedAt: string,
  ): CashFlowStatement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (s || {}) as Record<string, any>;
    const ocf = n(r['totalCashFromOperatingActivities']);
    const capex = n(r['capitalExpenditures']);
    const fcf = ocf !== null && capex !== null ? ocf + capex : null;

    return {
      symbol,
      periodType: 'annual',
      periodEndDate: formatDate(r['endDate'] as Date | undefined),
      currency,
      netIncome: n(r['netIncome']),
      deprecationAndAmortization: n(r['depreciation']),
      changesInWorkingCapital: n(r['changeToWorkingCapital']),
      operatingCashFlow: ocf,
      capitalExpenditures: capex,
      investingCashFlow: n(r['totalCashflowsFromInvestingActivities']),
      dividendsPaid: n(r['dividendsPaid']),
      financingCashFlow: n(r['totalCashFromFinancingActivities']),
      freeCashFlow: fcf,
      source: this.id,
      retrievedAt,
    };
  }

  // ── Smart Ticker Builder ───────────────────────────────────────────────────

  private buildTicker(symbol: string, exchange?: string): string {
    const clean = symbol.trim().toUpperCase();

    // Already explicitly suffixed
    if (clean.endsWith('.NS') || clean.endsWith('.BO') || clean.startsWith('^')) {
      return clean;
    }

    const exch = (exchange ?? '').toUpperCase();
    if (exch === 'NSE') return `${clean.replace(/\.(NS|BO)$/i, '')}.NS`;
    if (exch === 'BSE') return `${clean.replace(/\.(NS|BO)$/i, '')}.BO`;

    // Query instrument repository to check market
    const instrument = instrumentRepository.getBySymbol(clean, exchange);
    if (instrument) {
      if (instrument.exchange === 'NSE' || instrument.market === 'nse') {
        return `${clean}.NS`;
      }
      if (instrument.exchange === 'BSE' || instrument.market === 'bse') {
        return `${clean}.BO`;
      }
      return instrument.symbol;
    }

    // Default: for US and generic equities, return clean symbol
    return clean;
  }
}

export const yahooFinancialProvider = new YahooFinancialProvider();
