import type { ReportTemplateDefinition, ReportTemplateId } from '@equitylensai/shared';
import { AppError } from '../../utils/appError.js';

const TEMPLATES: Record<ReportTemplateId, ReportTemplateDefinition> = {
  fundamental_analysis: {
    id: 'fundamental_analysis',
    name: 'Company Fundamental Analysis',
    description: 'Comprehensive evaluation of balance sheet solvency, profitability margins, valuation multiples, and business quality.',
    recommendedFor: 'Core equity investment thesis and annual fundamental evaluation',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Research Cover & Metadata',
        description: 'Instrument details, exchange, observation timestamps, and reporting scope',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Executive Summary',
        description: 'Concise evidence-grounded summary of financial health and operational performance',
        required: true,
      },
      {
        sectionType: 'company_profile',
        title: 'Company Profile & Business Overview',
        description: 'Sector, industry classification, business description, and listing data',
        required: true,
      },
      {
        sectionType: 'market_overview',
        title: 'Market Overview & Trading Metrics',
        description: 'Latest eligible quote, market capitalization, 52-week range, and volume',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Financial Analysis & Ratio Diagnostics',
        description: 'Deterministic profitability, liquidity, solvency, and operational metrics',
        required: true,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Key Risks & Evidence Gaps',
        description: 'Leverage concerns, margin pressures, and missing disclosures',
        required: true,
      },
      {
        sectionType: 'conclusion_open_questions',
        title: 'Conclusion & Unresolved Questions',
        description: 'Key takeaways and items requiring management clarification',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Sources & Methodology Register',
        description: 'Full data provenance, retrieval timestamps, and calculation methodology',
        required: true,
      },
    ],
    supportedDataSources: ['Yahoo Finance Financials', 'Exchange Quotes', 'Deterministic Ratios Engine'],
    limitations: ['Relying on audited trailing statements; does not predict forward guidance or earnings calls.'],
  },

  financial_statement_review: {
    id: 'financial_statement_review',
    name: 'Financial Statement Review',
    description: 'Detailed statement-by-statement breakdown of Balance Sheet, Income Statement, and Cash Flow Statement trends.',
    recommendedFor: 'Accounting quality inspection, cash flow reconciliation, and working capital analysis',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Statement Review Cover',
        description: 'Scope, periods analyzed, currency, and audit disclosure status',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Accounting & Statement Summary',
        description: 'Top-line growth, operating cash generation, and balance sheet structure overview',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Financial Statement Tables & Trends',
        description: 'Balance Sheet, Profit & Loss, and Cash Flow 4-period audit tables',
        required: true,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Accounting & Cash Flow Risks',
        description: 'Divergence between net income and operating cash flow, working capital spikes',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Audit Standards & Scope Disclosures',
        description: 'Standalone vs consolidated scope notes and statement date alignment',
        required: true,
      },
    ],
    supportedDataSources: ['Audited Annual Financial Filings', 'Standardized Accounting Schedules'],
    limitations: ['Statements reflect historical reported periods; unaudited intermediate adjustments excluded.'],
  },

  valuation_multiples: {
    id: 'valuation_multiples',
    name: 'Valuation & Multiples Review',
    description: 'Multi-metric valuation assessment across P/E, P/B, EV/EBITDA, EV/Sales, and cash flow yields.',
    recommendedFor: 'Relative valuation, entry timing, and historical multiple dispersion',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Valuation Snapshot Cover',
        description: 'Latest price timestamp, share count, and enterprise value calculation',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Valuation Assessment Summary',
        description: 'Current trading multiples relative to historical and peer medians',
        required: true,
      },
      {
        sectionType: 'market_overview',
        title: 'Market Capitalization & Enterprise Value',
        description: 'Calculated EV breakdown including total debt and cash balances',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Valuation Multiples & Historical Bands',
        description: 'Trailing P/E, PEG, Price to Book, EV/EBITDA, and FCF Yield',
        required: true,
      },
      {
        sectionType: 'comparative_analysis',
        title: 'Peer Multiple Benchmark',
        description: 'Cross-company multiple comparison against peer group median',
        required: false,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Valuation Formulas & Metric Definitions',
        description: 'Enterprise value formula, trailing twelve months normalization formulas',
        required: true,
      },
    ],
    supportedDataSources: ['Live Quotes', 'Trailing Annual Income & Balance Sheet', 'Enterprise Value Calculator'],
    limitations: ['Does not constitute a target price or discounted cash flow projection.'],
  },

  peer_comparison: {
    id: 'peer_comparison',
    name: 'Peer Comparison Report',
    description: 'Benchmarking against direct sector peers across growth, profitability margins, debt leverage, and valuation.',
    recommendedFor: 'Competitive landscape positioning and relative quality analysis',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Peer Benchmark Cover',
        description: 'Peer group composition, selection criteria, and alignment period',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Peer Benchmarking Summary',
        description: 'Rankings across operating margins, return on capital, and leverage tiers',
        required: true,
      },
      {
        sectionType: 'comparative_analysis',
        title: 'Cross-Company Comparative Matrix',
        description: 'Side-by-side metric tables with peer group percentiles and medians',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Company Specific Outlier Metrics',
        description: 'Metrics where target company significantly outperforms or lags peers',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Peer Selection Methodology & Sample Sizes',
        description: 'SIC/Industry classifications, market cap tiering, and data comparability notes',
        required: true,
      },
    ],
    supportedDataSources: ['Phase 12 Peer Discovery Service', 'Cross-Company Comparison Engine'],
    limitations: ['Peer groups may differ in business segment mix and geographical revenue exposure.'],
  },

  growth_profitability: {
    id: 'growth_profitability',
    name: 'Growth & Profitability Analysis',
    description: 'Multi-year trajectory of revenue CAGR, EBITDA margins, ROE, ROCE, and asset turnover efficiency.',
    recommendedFor: 'Quality and growth investor analysis, capital allocation track record',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Growth & Returns Cover',
        description: 'Evaluation window, compound calculation periods, and revenue basis',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Growth & Profitability Synthesis',
        description: 'High-level synthesis of margin expansion, capital efficiency, and reinvestment rate',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Margins & Capital Efficiency Diagnostics',
        description: 'Gross, operating, net margin trends, Dupont ROE decomposition, and ROCE',
        required: true,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Growth Deceleration & Margin Pressures',
        description: 'Input cost inflation, diminishing returns on incremental invested capital',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'CAGR & Margin Calculation Methodology',
        description: 'Formula standards for return on capital employed and margin normalizers',
        required: true,
      },
    ],
    supportedDataSources: ['Multi-period Income Statements', 'Balance Sheets', 'Ratio Calculators'],
    limitations: ['Past CAGR does not guarantee continued revenue or margin expansion.'],
  },

  financial_risk: {
    id: 'financial_risk',
    name: 'Financial Risk Review',
    description: 'Deep solvency and liquidity diagnostic examining debt maturity, interest coverage, Altman Z/health scores, and working capital.',
    recommendedFor: 'Credit risk assessment, downside protection analysis, distress screening',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Risk Diagnostic Cover',
        description: 'Evaluation date, debt figures currency, and liquidity horizon',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Solvency & Risk Diagnostic Summary',
        description: 'Overall quantitative health score classification and primary vulnerability factors',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Solvency, Leverage & Liquidity Diagnostics',
        description: 'Current ratio, quick ratio, debt-to-equity, interest coverage, and net debt/EBITDA',
        required: true,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Material Risk Factors & Stress Points',
        description: 'Refinancing risks, debt covenants vulnerability, and operating cash burn',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Health Score Engine & Solvency Benchmarks',
        description: 'Weighting methodology across profitability, leverage, and liquidity dimensions',
        required: true,
      },
    ],
    supportedDataSources: ['Deterministic Health Score Engine', 'Balance Sheet Solvency Metrics'],
    limitations: ['Off-balance sheet guarantees and undisclosed litigation contingent liabilities excluded.'],
  },

  announcement_impact: {
    id: 'announcement_impact',
    name: 'Corporate Announcement Impact Review',
    description: 'Evaluation of verified corporate disclosures, board decisions, earnings filings, and official announcements.',
    recommendedFor: 'Event-driven research, governance monitoring, and disclosure tracking',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Announcement Register Cover',
        description: 'Exchange disclosure stream, date range, and regulatory source',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Disclosures & Developments Summary',
        description: 'Material regulatory filings, executive changes, and corporate actions',
        required: true,
      },
      {
        sectionType: 'news_and_developments',
        title: 'Verified Corporate Announcements Feed',
        description: 'Chronological official circulars with category tagging and PDF attachment links',
        required: true,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Governance & Disclosure Considerations',
        description: 'Frequency of auditor resignations, delayed filings, or regulatory inquiries',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Regulatory Filing Provenance',
        description: 'NSE / BSE circular registry linkage and verification criteria',
        required: true,
      },
    ],
    supportedDataSources: ['NSE / BSE Official Filings', 'Phase 8 Announcements Ingestion Service'],
    limitations: ['Causality between announcements and intraday stock volatility is not inferred without evidence.'],
  },

  comprehensive_research: {
    id: 'comprehensive_research',
    name: 'Comprehensive Company Research Report',
    description: 'All-inclusive institutional research report covering fundamentals, valuation, peer benchmarks, news, and risk.',
    recommendedFor: 'Complete investment memo, committee review, and archived equity research',
    defaultSections: [
      {
        sectionType: 'cover_metadata',
        title: 'Institutional Research Cover',
        description: 'Complete research metadata, author, timestamps, and reporting scope',
        required: true,
      },
      {
        sectionType: 'executive_summary',
        title: 'Executive Summary',
        description: 'Comprehensive evidence-grounded investment memo synthesis',
        required: true,
      },
      {
        sectionType: 'company_profile',
        title: 'Company Profile & Business Segments',
        description: 'Business model, leadership, sector, and industry details',
        required: true,
      },
      {
        sectionType: 'market_overview',
        title: 'Market Overview & Trading Diagnostics',
        description: 'Market valuation, historical returns over 1M/3M/1Y/5Y, volume patterns',
        required: true,
      },
      {
        sectionType: 'financial_analysis',
        title: 'Financial Statements & Quantitative Metrics',
        description: 'In-depth multi-year statements, profitability, liquidity, and solvency ratios',
        required: true,
      },
      {
        sectionType: 'comparative_analysis',
        title: 'Peer Group Benchmarks',
        description: 'Multi-company comparison matrix against top sector peers',
        required: false,
      },
      {
        sectionType: 'news_and_developments',
        title: 'News & Official Corporate Disclosures',
        description: 'Verified regulatory announcements and curated market news',
        required: false,
      },
      {
        sectionType: 'risks_and_uncertainties',
        title: 'Material Financial & Operational Risks',
        description: 'Comprehensive risk factor analysis grounded in reported evidence',
        required: true,
      },
      {
        sectionType: 'research_notes',
        title: 'Analyst Notes & Thesis Observations',
        description: 'User-authored observations, thesis hypotheses, and field questions',
        required: false,
      },
      {
        sectionType: 'conclusion_open_questions',
        title: 'Synthesis & Open Diligence Questions',
        description: 'Unresolved questions for management and next research steps',
        required: true,
      },
      {
        sectionType: 'sources_and_methodology',
        title: 'Evidence Register & Research Methodology',
        description: 'Full source register, formulas, and data freshness disclosures',
        required: true,
      },
    ],
    supportedDataSources: [
      'Financial Statement Filings',
      'Market Quotes & History',
      'Peer Discovery & Benchmarks',
      'Corporate Announcements',
      'Deterministic Calculation Engine',
    ],
    limitations: [
      'Independent financial research memo. Does not provide algorithmic BUY or SELL instructions.',
    ],
  },
};

export class ReportTemplateService {
  listTemplates(): ReportTemplateDefinition[] {
    return Object.values(TEMPLATES);
  }

  getTemplate(id: string): ReportTemplateDefinition {
    const template = TEMPLATES[id as ReportTemplateId];
    if (!template) {
      throw new AppError('TEMPLATE_NOT_FOUND', `Report template '${id}' does not exist`, 404);
    }
    return template;
  }
}

export const reportTemplateService = new ReportTemplateService();
