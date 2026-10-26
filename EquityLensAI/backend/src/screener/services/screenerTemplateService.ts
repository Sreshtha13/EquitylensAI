import type { ScreenerTemplate } from '@equitylensai/shared';

const PREBUILT_TEMPLATES: ScreenerTemplate[] = [
  {
    id: 'high-quality-profitability',
    name: 'High Quality & Profitability',
    description:
      'Identifies companies with superior returns on capital, sustained operating profit margins, and robust return on equity.',
    category: 'quality',
    highlights: ['ROE > 15%', 'ROCE > 15%', 'Operating Margin > 15%'],
    assumptions:
      'Evaluates annual financial metrics. Requires complete reported operating income and equity; companies with missing metrics are excluded.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'roe', direction: 'desc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'roe', operator: 'gt', value: 15 },
          { field: 'roce', operator: 'gt', value: 15 },
          { field: 'operating_margin', operator: 'gt', value: 15 },
        ],
      },
      selectedColumns: ['roe', 'roce', 'operating_margin', 'net_margin'],
    },
  },
  {
    id: 'conservative-balance-sheet',
    name: 'Conservative Balance Sheet & Low Leverage',
    description:
      'Filters for financially resilient companies with minimal debt burden, healthy short-term liquidity, and strong composite financial health.',
    category: 'conservative',
    highlights: ['Debt-to-Equity < 0.5', 'Current Ratio > 1.5', 'Health Score >= 65'],
    assumptions:
      'Focuses on low solvency risk and liquidity buffers. Both short and long-term liabilities are factored into debt-to-equity.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'financial_health_score', direction: 'desc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'debt_to_equity', operator: 'lt', value: 0.5 },
          { field: 'current_ratio', operator: 'gt', value: 1.5 },
          { field: 'financial_health_score', operator: 'gte', value: 65 },
        ],
      },
      selectedColumns: ['debt_to_equity', 'current_ratio', 'quick_ratio', 'financial_health_score'],
    },
  },
  {
    id: 'growth-with-margins',
    name: 'Growth with Solid Margins',
    description:
      'Screens for accelerating businesses expanding top-line revenue and bottom-line profit without sacrificing net margins.',
    category: 'growth',
    highlights: ['Revenue Growth YoY > 10%', 'Net Income Growth YoY > 10%', 'Net Margin > 10%'],
    assumptions:
      'Calculated on annual statements with valid prior-year baseline comparison. Highly volatile negative profit baselines are excluded.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'revenue_growth', direction: 'desc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'revenue_growth', operator: 'gt', value: 10 },
          { field: 'net_income_growth', operator: 'gt', value: 10 },
          { field: 'net_margin', operator: 'gt', value: 10 },
        ],
      },
      selectedColumns: ['revenue_growth', 'net_income_growth', 'eps_growth', 'net_margin'],
    },
  },
  {
    id: 'reasonable-valuation',
    name: 'Reasonable Valuation & Strong Returns',
    description:
      'Discovers quality companies generating high returns on equity trading at reasonable earnings and book valuation multiples.',
    category: 'value',
    highlights: ['P/E Ratio between 0 and 25', 'Price-to-Book < 3.5', 'ROE > 15%'],
    assumptions:
      'Requires positive earnings (P/E > 0) to avoid loss-making companies with undefined multiples. Matches current market quotes with reporting periods.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'pe_ratio', direction: 'asc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'pe_ratio', operator: 'between', value: 0, upperValue: 25 },
          { field: 'price_to_book', operator: 'lt', value: 3.5 },
          { field: 'roe', operator: 'gt', value: 15 },
        ],
      },
      selectedColumns: ['pe_ratio', 'price_to_book', 'roe', 'roce'],
    },
  },
  {
    id: 'high-cash-flow-generators',
    name: 'High Free Cash Flow Generators',
    description:
      'Finds cash generative businesses converting a significant portion of revenue into free cash flow alongside solid returns.',
    category: 'cash_flow',
    highlights: ['Free Cash Flow Margin > 10%', 'ROE > 12%'],
    assumptions:
      'Based on operating cash flow minus capital expenditures as reported in cash flow statements.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'free_cash_flow_margin', direction: 'desc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'free_cash_flow_margin', operator: 'gt', value: 10 },
          { field: 'roe', operator: 'gt', value: 12 },
        ],
      },
      selectedColumns: ['free_cash_flow_margin', 'roe', 'operating_margin'],
    },
  },
  {
    id: 'financial-health-leaders',
    name: 'Financial Health Leaders',
    description:
      'Focuses on companies ranking in the top tier of the deterministic composite financial health engine.',
    category: 'health',
    highlights: ['Health Score >= 75', 'Current Ratio >= 1.2'],
    assumptions:
      'Financial Health Score evaluates 5 core dimensions: Profitability, Liquidity, Leverage, Cash Flow, and Growth.',
    definition: {
      schemaVersion: 1,
      period: 'annual',
      sort: { field: 'financial_health_score', direction: 'desc' },
      rootGroup: {
        logic: 'AND',
        conditions: [
          { field: 'financial_health_score', operator: 'gte', value: 75 },
          { field: 'current_ratio', operator: 'gte', value: 1.2 },
        ],
      },
      selectedColumns: ['financial_health_score', 'current_ratio', 'debt_to_equity', 'roe'],
    },
  },
];

export class ScreenerTemplateService {
  listTemplates(): ScreenerTemplate[] {
    return PREBUILT_TEMPLATES;
  }

  getTemplateById(id: string): ScreenerTemplate | null {
    return PREBUILT_TEMPLATES.find((t) => t.id === id) ?? null;
  }
}

export const screenerTemplateService = new ScreenerTemplateService();
