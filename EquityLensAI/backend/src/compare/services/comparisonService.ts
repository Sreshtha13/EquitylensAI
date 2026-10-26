import type {
  CompanyComparisonRequest,
  CompanyComparisonResult,
  ComparisonCompanySummary,
  CompanyComparisonMetricRow,
  SupportedPeriod,
} from '../types.js';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export const COMPARISON_METRIC_DEFINITIONS: Array<{
  id: string;
  label: string;
  category: 'Valuation' | 'Profitability' | 'Growth' | 'Financial Strength' | 'Cash Flow' | 'Health';
  unit: 'percent' | 'ratio' | 'score' | 'currency' | 'number';
  description: string;
  extract: (analysis: any) => number | null;
}> = [
  // Valuation
  {
    id: 'pe_ratio',
    label: 'P/E Ratio',
    category: 'Valuation',
    unit: 'ratio',
    description: 'Price-to-earnings ratio evaluating stock price relative to earnings per share.',
    extract: (a) => a.valuation?.peRatio?.value ?? null,
  },
  {
    id: 'price_to_book',
    label: 'Price to Book',
    category: 'Valuation',
    unit: 'ratio',
    description: 'Compares market price to book value per share.',
    extract: (a) => a.valuation?.priceToBook?.value ?? null,
  },
  {
    id: 'price_to_sales',
    label: 'Price to Sales',
    category: 'Valuation',
    unit: 'ratio',
    description: 'Compares company market capitalization to total annual revenue.',
    extract: (a) => a.valuation?.priceToSales?.value ?? null,
  },
  {
    id: 'ev_to_ebitda',
    label: 'EV / EBITDA',
    category: 'Valuation',
    unit: 'ratio',
    description: 'Enterprise value divided by earnings before interest, tax, depreciation & amortisation.',
    extract: (a) => a.valuation?.evToEbitda?.value ?? null,
  },
  {
    id: 'dividend_yield',
    label: 'Dividend Yield',
    category: 'Valuation',
    unit: 'percent',
    description: 'Annual dividend payments divided by current stock price.',
    extract: (a) => a.valuation?.dividendYield?.value ?? null,
  },

  // Profitability
  {
    id: 'roe',
    label: 'Return on Equity (ROE)',
    category: 'Profitability',
    unit: 'percent',
    description: 'Net income generated per unit of shareholders equity.',
    extract: (a) => a.profitability?.returnOnEquity?.value ?? null,
  },
  {
    id: 'roce',
    label: 'Return on Capital Employed (ROCE)',
    category: 'Profitability',
    unit: 'percent',
    description: 'EBIT divided by total capital employed (equity + long-term debt).',
    extract: (a) => a.profitability?.returnOnCapitalEmployed?.value ?? null,
  },
  {
    id: 'roa',
    label: 'Return on Assets (ROA)',
    category: 'Profitability',
    unit: 'percent',
    description: 'Net income generated relative to total company assets.',
    extract: (a) => a.profitability?.returnOnAssets?.value ?? null,
  },
  {
    id: 'operating_margin',
    label: 'Operating Margin',
    category: 'Profitability',
    unit: 'percent',
    description: 'Operating income as a percentage of net revenue.',
    extract: (a) => a.profitability?.operatingMargin?.value ?? null,
  },
  {
    id: 'net_margin',
    label: 'Net Profit Margin',
    category: 'Profitability',
    unit: 'percent',
    description: 'Net profit after taxes as a percentage of revenue.',
    extract: (a) => a.profitability?.netProfitMargin?.value ?? null,
  },
  {
    id: 'gross_margin',
    label: 'Gross Margin',
    category: 'Profitability',
    unit: 'percent',
    description: 'Gross profit as a percentage of net sales.',
    extract: (a) => a.profitability?.grossMargin?.value ?? null,
  },

  // Growth
  {
    id: 'revenue_growth',
    label: 'Revenue Growth (YoY)',
    category: 'Growth',
    unit: 'percent',
    description: 'Year-over-year revenue expansion rate.',
    extract: (a) => a.growth?.revenueGrowthYearOverYear?.value ?? null,
  },
  {
    id: 'net_income_growth',
    label: 'Net Income Growth (YoY)',
    category: 'Growth',
    unit: 'percent',
    description: 'Year-over-year net income expansion rate.',
    extract: (a) => a.growth?.netIncomeGrowthYearOverYear?.value ?? null,
  },
  {
    id: 'eps_growth',
    label: 'EPS Growth (YoY)',
    category: 'Growth',
    unit: 'percent',
    description: 'Year-over-year diluted earnings per share growth rate.',
    extract: (a) => a.growth?.epsGrowthYearOverYear?.value ?? null,
  },

  // Financial Strength
  {
    id: 'debt_to_equity',
    label: 'Debt to Equity',
    category: 'Financial Strength',
    unit: 'ratio',
    description: 'Total debt divided by total shareholders equity.',
    extract: (a) => a.leverage?.debtToEquity?.value ?? null,
  },
  {
    id: 'current_ratio',
    label: 'Current Ratio',
    category: 'Financial Strength',
    unit: 'ratio',
    description: 'Short-term liquidity: current assets divided by current liabilities.',
    extract: (a) => a.liquidity?.currentRatio?.value ?? null,
  },
  {
    id: 'quick_ratio',
    label: 'Quick Ratio',
    category: 'Financial Strength',
    unit: 'ratio',
    description: 'Immediate liquidity: liquid assets divided by current liabilities.',
    extract: (a) => a.liquidity?.quickRatio?.value ?? null,
  },
  {
    id: 'interest_coverage',
    label: 'Interest Coverage',
    category: 'Financial Strength',
    unit: 'ratio',
    description: 'Operating income divided by finance costs.',
    extract: (a) => a.leverage?.interestCoverage?.value ?? null,
  },

  // Cash Flow
  {
    id: 'free_cash_flow_margin',
    label: 'FCF Margin',
    category: 'Cash Flow',
    unit: 'percent',
    description: 'Free cash flow as a proportion of total revenue.',
    extract: (a) => a.cashFlow?.freeCashFlowMargin?.value ?? null,
  },

  // Health
  {
    id: 'financial_health_score',
    label: 'Financial Health Score',
    category: 'Health',
    unit: 'score',
    description: 'Deterministic fundamental score from 0 to 100 based on profitability, leverage, liquidity, cash flow, and growth.',
    extract: (a) => a.healthScore?.overallScore?.value ?? null,
  },
];

export class ComparisonService {
  async compareCompanies(request: CompanyComparisonRequest): Promise<CompanyComparisonResult> {
    if (!request.symbols || request.symbols.length < 2) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least two companies are required for comparison.',
        400,
      );
    }

    if (request.symbols.length > 5) {
      throw new AppError(
        'VALIDATION_ERROR',
        'A maximum of 5 companies can be compared simultaneously.',
        400,
      );
    }

    // Deduplicate symbols
    const uniqueSymbolsMap = new Map<string, { symbol: string; exchange: string }>();
    for (const s of request.symbols) {
      const cleanSym = s.symbol.trim().toUpperCase();
      const exch = (s.exchange || 'NSE').trim().toUpperCase();
      const key = `${exch}:${cleanSym}`;
      if (!uniqueSymbolsMap.has(key)) {
        uniqueSymbolsMap.set(key, { symbol: cleanSym, exchange: exch });
      }
    }

    const uniqueTargets = Array.from(uniqueSymbolsMap.values());
    if (uniqueTargets.length < 2) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least two distinct companies are required for comparison.',
        400,
      );
    }

    const period: SupportedPeriod = request.period || 'annual';
    const scope: 'consolidated' | 'standalone' = request.scope || 'consolidated';
    const warnings: string[] = [];

    // Concurrently fetch profiles, quotes, and financial analyses
    const fetchPromises = uniqueTargets.map(async (target) => {
      try {
        const [profile, quote] = await Promise.all([
          marketService.getCompanyProfile({
            symbol: target.symbol,
            exchange: target.exchange,
          }).catch(() => null),
          marketService.getQuote({
            symbol: target.symbol,
            exchange: target.exchange,
          }).catch(() => null),
        ]);

        let analysis: any = null;
        try {
          analysis = await financialService.getFinancialAnalysis(
            {
              symbol: target.symbol,
              exchange: target.exchange,
              annualPeriods: 4,
            },
            quote?.price ?? null,
          );
        } catch (err: unknown) {
          logger.warn(
            { err, symbol: target.symbol },
            'Financial analysis unavailable for comparison target',
          );
          warnings.push(`Financial statements unavailable for ${target.symbol}.`);
        }

        const marketCap =
          profile?.sharesOutstanding && quote?.price
            ? Math.round(profile.sharesOutstanding * quote.price)
            : null;

        const summary: ComparisonCompanySummary = {
          symbol: target.symbol,
          exchange: target.exchange,
          name: profile?.name || quote?.name || target.symbol,
          currency: quote?.currency || 'INR',
          marketCap,
          price: quote?.price ?? null,
          quoteObservedAt: quote?.observedAt ?? null,
          sector: profile?.sector ?? null,
          industry: profile?.industry ?? null,
          description: profile?.description ?? null,
          isStale: quote?.isStale ?? false,
        };

        return {
          target,
          summary,
          analysis,
        };
      } catch (err: unknown) {
        logger.error({ err, symbol: target.symbol }, 'Failed to resolve comparison company');
        warnings.push(`Could not resolve data for ${target.symbol} on ${target.exchange}.`);
        return null;
      }
    });

    const settled = await Promise.all(fetchPromises);
    const validResults = settled.filter((r): r is NonNullable<typeof r> => r !== null);

    if (validResults.length < 2) {
      throw new AppError(
        'COMPARISON_FAILED',
        'Could not retrieve sufficient verified company data for at least two companies.',
        422,
      );
    }

    const companies = validResults.map((r) => r.summary);

    // Build metric rows
    const activeDefs = request.metrics && request.metrics.length > 0
      ? COMPARISON_METRIC_DEFINITIONS.filter((d) => request.metrics!.includes(d.id))
      : COMPARISON_METRIC_DEFINITIONS;

    const metricsRows: CompanyComparisonMetricRow[] = activeDefs.map((def) => {
      const values: Record<string, number | null> = {};
      for (const res of validResults) {
        if (!res.analysis) {
          values[res.target.symbol] = null;
        } else {
          try {
            values[res.target.symbol] = def.extract(res.analysis);
          } catch {
            values[res.target.symbol] = null;
          }
        }
      }

      return {
        metricId: def.id,
        label: def.label,
        category: def.category,
        unit: def.unit,
        description: def.description,
        values,
      };
    });

    return {
      companies,
      period,
      scope,
      metricsRows,
      retrievedAt: new Date().toISOString(),
      warnings,
    };
  }
}

export const comparisonService = new ComparisonService();
