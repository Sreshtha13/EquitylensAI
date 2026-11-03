export interface SectionInstruction {
  title: string;
  purpose: string;
  keyAspects: string[];
  metricsToExamine: string[];
  antiDuplicationGuideline: string;
  suggestedSubsections: string[];
}

export class SectionInstructionRegistry {
  private static readonly INSTRUCTIONS: Record<string, SectionInstruction> = {
    executive_summary: {
      title: 'Executive Summary',
      purpose: 'Deliver a concise, high-level synthesis of the investment thesis, core financial highlights, key risks, and strategic outlook.',
      keyAspects: ['Investment thesis overview', 'Critical operational strengths and weaknesses', 'Key financial findings', 'Material risk factors'],
      metricsToExamine: ['Market Cap', 'Stock Price', 'P/E Ratio', 'ROE', 'Health Score', '1Y Return'],
      antiDuplicationGuideline: 'Synthesize findings concisely without diving into detailed line-by-line financial statement dissections.',
      suggestedSubsections: ['Company at a Glance', 'Core Highlights', 'Key Sensitivities & Outlook'],
    },
    company_overview: {
      title: 'Company Overview',
      purpose: 'Detail the founding background, operational scale, corporate footprint, organizational structure, and exchange listing.',
      keyAspects: ['Corporate origin and history', 'Operational footprint and headquarters', 'Exchange listing & classification', 'Organizational scale'],
      metricsToExamine: ['Classification', 'Exchange', 'Market Cap'],
      antiDuplicationGuideline: 'Focus strictly on corporate background and operational scale; do not duplicate financial ratio analysis or valuation multiples.',
      suggestedSubsections: ['Corporate Background', 'Scale and Infrastructure', 'Listing Profile'],
    },
    company_profile: {
      title: 'Company Profile',
      purpose: 'Provide a structured summary of the enterprise profile, leadership overview, and operational domains.',
      keyAspects: ['Sector and industry positioning', 'Core business lines', 'Corporate profile summary'],
      metricsToExamine: ['Sector', 'Industry', 'Market Cap'],
      antiDuplicationGuideline: 'Avoid repeating comprehensive financial histories; focus on profile and sector domain.',
      suggestedSubsections: ['Corporate Profile', 'Operational Domains', 'Industry Standing'],
    },
    business_model: {
      title: 'Business Model',
      purpose: 'Explain in detail how the company creates, delivers, and captures economic value, including revenue drivers and monetization mechanics.',
      keyAspects: ['Value proposition', 'Customer segments and distribution channels', 'Monetization models', 'Cost structure and operating leverage'],
      metricsToExamine: ['Gross Margin', 'Operating Margin', 'Revenue Growth'],
      antiDuplicationGuideline: 'Detail the operational mechanics of value creation rather than generic industry descriptions.',
      suggestedSubsections: ['Value Proposition & Monetization', 'Customer Segments & Channels', 'Cost Structure & Economics'],
    },
    industry_overview: {
      title: 'Industry Overview',
      purpose: 'Analyze the broader macroeconomic, industry, and sectoral landscape in which the company operates.',
      keyAspects: ['Industry total addressable market (TAM)', 'Secular demand tailwinds', 'Regulatory dynamics', 'Supply chain trends'],
      metricsToExamine: ['Sector', 'Industry'],
      antiDuplicationGuideline: 'Focus on macroeconomic and sectoral forces; do not repeat internal company operations.',
      suggestedSubsections: ['Industry Structure & TAM', 'Regulatory Environment', 'Macroeconomic Growth Drivers'],
    },
    market_position: {
      title: 'Market Position',
      purpose: 'Evaluate the enterprise market share, brand power, entry barriers, and competitive moat.',
      keyAspects: ['Estimated market share', 'Moats and entry barriers (network effects, switching costs)', 'Pricing power', 'Brand reputation'],
      metricsToExamine: ['Market Cap', 'Operating Margin', 'ROCE'],
      antiDuplicationGuideline: 'Focus on sustainable competitive advantages and market rank.',
      suggestedSubsections: ['Market Share & Ranking', 'Economic Moats & Defensibility', 'Pricing Power'],
    },
    competitive_analysis: {
      title: 'Competitive Analysis',
      purpose: 'Conduct a peer-to-peer benchmarking analysis against key listed domestic competitors across growth, profitability, and multiples.',
      keyAspects: ['Direct competitor identification', 'Relative margin and return benchmarking', 'Competitive strengths and vulnerabilities'],
      metricsToExamine: ['P/E Ratio', 'ROE', 'ROCE', 'Revenue Growth', 'Operating Margin'],
      antiDuplicationGuideline: 'Emphasize relative differences rather than absolute standalone descriptions.',
      suggestedSubsections: ['Peer Landscape', 'Comparative Return Metrics', 'Relative Competitive Advantages'],
    },
    products_and_services: {
      title: 'Products and Services',
      purpose: 'Break down the enterprise product portfolio, service catalog, innovation pipeline, and customer solutions.',
      keyAspects: ['Key product/service families', 'Revenue contribution by product line', 'R&D and product development pipeline'],
      metricsToExamine: ['Gross Margin', 'Revenue'],
      antiDuplicationGuideline: 'Catalog and analyze offerings; do not repeat high-level company history.',
      suggestedSubsections: ['Core Product Portfolios', 'Services & Solutions', 'Product Lifecycle & R&D'],
    },
    revenue_analysis: {
      title: 'Revenue Analysis',
      purpose: 'Dissect top-line revenue trajectories, segment contributions, volume vs price mix, and growth sustainability.',
      keyAspects: ['Historical revenue trajectory', 'Segment-wise and geographic breakdown', 'Organic vs acquired growth', 'Customer concentration'],
      metricsToExamine: ['Revenue Growth YoY', 'Revenue'],
      antiDuplicationGuideline: 'Confine analysis to top-line performance; do not analyze bottom-line or balance sheet debt here.',
      suggestedSubsections: ['Revenue Growth Trajectory', 'Segment & Geographic Breakdown', 'Concentration Risks'],
    },
    financial_performance: {
      title: 'Financial Performance',
      purpose: 'Evaluate holistic historical financial results across revenue, EBITDA, EBIT, and net profit over multi-year reporting cycles.',
      keyAspects: ['Multi-year income statement trends', 'EBITDA and PAT margins', 'Consistency of earnings growth', 'Quality of earnings'],
      metricsToExamine: ['Revenue Growth YoY', 'Net Income Growth YoY', 'Operating Margin', 'Net Margin'],
      antiDuplicationGuideline: 'Provide comprehensive P&L analysis without duplicating balance sheet capital structure details.',
      suggestedSubsections: ['Historical Earnings Trend', 'Operating Leverage & Conversion', 'Earnings Quality'],
    },
    financial_analysis: {
      title: 'Financial Analysis',
      purpose: 'Provide a thorough fundamental financial evaluation synthesizing growth, margins, capital efficiency, and leverage.',
      keyAspects: ['Integrated financial statement review', 'Historical growth trends', 'Ratio decomposition'],
      metricsToExamine: ['ROE', 'ROCE', 'Debt to Equity', 'Interest Coverage', 'Current Ratio'],
      antiDuplicationGuideline: 'Provide synthesis across statements rather than repeating standalone company background.',
      suggestedSubsections: ['Financial Highlights', 'Capital Efficiency', 'Balance Sheet Assessment'],
    },
    profitability_analysis: {
      title: 'Profitability Analysis',
      purpose: 'Examine return on capital employed (ROCE), return on equity (ROE), operating margins, and DuPont return decomposition.',
      keyAspects: ['ROCE and ROE trends', 'Operating vs Net margin spread', 'Cost inflation absorption capacity', 'DuPont drivers'],
      metricsToExamine: ['ROE', 'ROCE', 'ROA', 'Gross Margin', 'Operating Margin', 'Net Margin'],
      antiDuplicationGuideline: 'Focus strictly on capital efficiency and margins; avoid drifting into valuation multiples.',
      suggestedSubsections: ['Return on Capital (ROE & ROCE)', 'Margin Profile & Sustainability', 'DuPont Decomposition Insights'],
    },
    balance_sheet_analysis: {
      title: 'Balance Sheet Analysis',
      purpose: 'Assess balance sheet health, asset quality, leverage ratios, working capital cycles, and solvency buffers.',
      keyAspects: ['Debt composition (short-term vs long-term)', 'Debt-to-equity and interest coverage', 'Working capital management', 'Liquidity cushions'],
      metricsToExamine: ['Debt to Equity', 'Interest Coverage', 'Current Ratio', 'Quick Ratio'],
      antiDuplicationGuideline: 'Focus on assets, liabilities, and solvency; do not repeat revenue or valuation analysis.',
      suggestedSubsections: ['Capital Structure & Solvency', 'Working Capital & Liquidity', 'Asset Quality'],
    },
    cash_flow_analysis: {
      title: 'Cash Flow Analysis',
      purpose: 'Evaluate operating cash flows (CFO), capital expenditures (CapEx), free cash flow (FCF) generation, and dividend funding.',
      keyAspects: ['Operating cash flow vs net income conversion', 'Free cash flow yield and margin', 'CapEx intensity', 'Cash reinvestment efficiency'],
      metricsToExamine: ['Free Cash Flow Margin', 'Operating Cash Flow', 'CapEx'],
      antiDuplicationGuideline: 'Focus strictly on cash flow statements and FCF generation.',
      suggestedSubsections: ['Cash Flow from Operations (CFO)', 'Free Cash Flow Generation & CapEx', 'Cash Conversion Quality'],
    },
    fundamental_analysis: {
      title: 'Fundamental Analysis',
      purpose: 'Deliver an institutional fundamental audit combining quantitative health scores, capital returns, and operating stability.',
      keyAspects: ['Composite financial health score', 'Balance sheet stability', 'Return consistency across cycles'],
      metricsToExamine: ['Financial Health Score', 'ROE', 'Debt to Equity', 'Current Ratio'],
      antiDuplicationGuideline: 'Synthesize verified fundamental ratios; do not repeat basic company overview.',
      suggestedSubsections: ['Composite Health Score', 'Solvency & Liquidity Buffer', 'Operational Robustness'],
    },
    valuation_analysis: {
      title: 'Valuation Analysis',
      purpose: 'Examine relative valuation multiples (P/E, P/B, EV/EBITDA, Dividend Yield) against historical averages and peer benchmarks.',
      keyAspects: ['Trailing and forward valuation multiples', 'Historical valuation range', 'Premium/discount justification', 'Earnings yield'],
      metricsToExamine: ['P/E Ratio', 'P/B Ratio', 'EV/EBITDA', 'Dividend Yield'],
      antiDuplicationGuideline: 'Do not declare a stock cheap or expensive based on P/E alone; contextualize multiples with ROCE and growth.',
      suggestedSubsections: ['Current Multiples vs Peers', 'Multiples in Historical Context', 'Valuation Justification & Risks'],
    },
    historical_stock_performance: {
      title: 'Historical Stock Performance',
      purpose: 'Review multi-timeframe equity price performance, compound annual growth rate (CAGR), volatility, and historical drawdown.',
      keyAspects: ['1M, 3M, 6M, 1Y price performance', '3Y and 5Y CAGR returns', 'Annualized price volatility', 'Maximum historical drawdown'],
      metricsToExamine: ['1Y Return', '3Y CAGR', '5Y CAGR', 'Annualized Volatility', 'Maximum Drawdown', '52W High/Low'],
      antiDuplicationGuideline: 'Confine analysis to share price dynamics and risk metrics; do not repeat financial statement details.',
      suggestedSubsections: ['Multi-Timeframe Returns', 'Risk-Adjusted Performance (CAGR vs Volatility)', 'Drawdown & Price Ranges'],
    },
    management_analysis: {
      title: 'Management Analysis',
      purpose: 'Evaluate leadership tenure, capital allocation track record, corporate integrity, and promoter commitment.',
      keyAspects: ['Promoter leadership track record', 'Historical capital allocation prudence', 'Execution against stated targets'],
      metricsToExamine: ['ROCE', 'ROE'],
      antiDuplicationGuideline: 'Focus on governance, strategic leadership, and capital allocation.',
      suggestedSubsections: ['Leadership Profile & Tenure', 'Capital Allocation Prudence', 'Strategic Execution'],
    },
    shareholding_analysis: {
      title: 'Shareholding Analysis',
      purpose: 'Analyze promoter holding, institutional participation (FII/DII), public float, and pledging trends.',
      keyAspects: ['Promoter holding stability', 'Institutional (FII/DII) positioning', 'Promoter share pledge status', 'Retail float distribution'],
      metricsToExamine: ['Promoter Holding', 'Pledge %', 'FII Holding', 'DII Holding'],
      antiDuplicationGuideline: 'Focus on ownership structure and institutional conviction.',
      suggestedSubsections: ['Ownership Structure', 'Institutional Inflows & Outflows', 'Pledge & Governance Indicators'],
    },
    corporate_governance: {
      title: 'Corporate Governance',
      purpose: 'Examine board independence, audit quality, related party transactions, and regulatory compliance history.',
      keyAspects: ['Board independence and committee quality', 'Auditor qualifications and changes', 'Related-party transaction scrutiny'],
      metricsToExamine: ['Health Score'],
      antiDuplicationGuideline: 'Assess corporate governance risks and transparency.',
      suggestedSubsections: ['Board Independence & Structure', 'Audit Quality & Related Party Deals', 'Regulatory Record'],
    },
    risk_assessment: {
      title: 'Risk Assessment',
      purpose: 'Identify, classify, and evaluate operational, financial, industry, regulatory, and valuation risks facing the company.',
      keyAspects: ['Operating and business risks', 'Financial and leverage risks', 'Regulatory and compliance exposure', 'Valuation and multiples compression risk'],
      metricsToExamine: ['Debt to Equity', 'Interest Coverage', 'P/E Ratio', 'Volatility'],
      antiDuplicationGuideline: 'Categorize specific risk factors with potential impact; do not make vague generic assertions.',
      suggestedSubsections: ['Operational & Commercial Risks', 'Financial & Solvency Risks', 'Regulatory & Industry Risks'],
    },
    growth_opportunities: {
      title: 'Growth Opportunities',
      purpose: 'Evaluate potential growth levers including capacity expansion, product launches, market share gains, and international reach.',
      keyAspects: ['CapEx and capacity additions', 'New market entries and geographic diversification', 'Product innovations and TAM expansion'],
      metricsToExamine: ['Revenue Growth YoY', 'CapEx'],
      antiDuplicationGuideline: 'Highlight forward growth catalysts grounded in verifiable corporate investments.',
      suggestedSubsections: ['Capacity & CapEx Catalysts', 'New Market & Segment Expansion', 'Strategic Growth Initiatives'],
    },
    investment_thesis: {
      title: 'Investment Thesis',
      purpose: 'Articulate the foundational arguments for long-term fundamental compounding, supported by verifiable data points.',
      keyAspects: ['Core fundamental compounding levers', 'Structural industry tailwinds', 'Return on capital advantages', 'Key monitoring triggers'],
      metricsToExamine: ['ROE', 'ROCE', 'Revenue Growth YoY', 'P/E Ratio', 'Health Score'],
      antiDuplicationGuideline: 'Synthesize the investment rationale with rigorous evidentiary grounding; do not provide buy/sell advice.',
      suggestedSubsections: ['Core Value Drivers', 'Competitive Moats in Action', 'Key Milestone Triggers'],
    },
    bear_case: {
      title: 'Bear Case',
      purpose: 'Delineate downside scenarios, stress tests, vulnerability to margin compression, and negative catalysts.',
      keyAspects: ['Downside scenario catalysts', 'Margin contraction and debt vulnerability', 'Multiple derating scenarios'],
      metricsToExamine: ['Debt to Equity', 'P/E Ratio', 'Max Drawdown'],
      antiDuplicationGuideline: 'Construct a data-grounded stress test of what could go wrong.',
      suggestedSubsections: ['Key Downside Triggers', 'Financial Sensitivity Under Stress', 'Multiple Derating Risk'],
    },
    bull_case: {
      title: 'Bull Case',
      purpose: 'Present the upside scenario, operational operating leverage expansion, and valuation rerating catalysts.',
      keyAspects: ['Positive earnings surprises', 'Margin expansion catalysts', 'Multiple rerating tailwinds'],
      metricsToExamine: ['Revenue Growth YoY', 'ROCE', 'Free Cash Flow Margin'],
      antiDuplicationGuideline: 'Construct realistic upside potential based on operating leverage and reinvestment rates.',
      suggestedSubsections: ['Upside Growth Accelerators', 'Margin Expansion Scenarios', 'Rerating Catalysts'],
    },
    conclusion: {
      title: 'Conclusion',
      purpose: 'Synthesize report conclusions, critical trade-offs, and open analytical questions without introducing unverified new claims.',
      keyAspects: ['Summary of core findings', 'Key trade-offs and monitoring horizons', 'Open diligence questions'],
      metricsToExamine: ['Health Score', 'P/E Ratio', 'ROE'],
      antiDuplicationGuideline: 'Synthesize previously substantiated findings; do not repeat earlier text verbatim or fabricate new facts.',
      suggestedSubsections: ['Synthesis of Findings', 'Critical Trade-Offs', 'Key Questions for Ongoing Diligence'],
    },
    conclusion_open_questions: {
      title: 'Conclusion & Open Questions',
      purpose: 'Synthesize report conclusions, critical trade-offs, and open analytical questions without introducing unverified new claims.',
      keyAspects: ['Summary of core findings', 'Key trade-offs and monitoring horizons', 'Open diligence questions'],
      metricsToExamine: ['Health Score', 'P/E Ratio', 'ROE'],
      antiDuplicationGuideline: 'Synthesize previously substantiated findings; do not repeat earlier text verbatim.',
      suggestedSubsections: ['Synthesis of Findings', 'Critical Trade-Offs', 'Key Questions for Ongoing Diligence'],
    },
  };

  static getInstruction(sectionType: string, customTitle?: string): SectionInstruction {
    const normalizedKey = sectionType.toLowerCase().replace(/[\s-]+/g, '_');
    const existing = this.INSTRUCTIONS[normalizedKey];
    if (existing) {
      return {
        ...existing,
        title: customTitle || existing.title,
      };
    }

    // Dynamic support for custom section types
    const displayTitle = customTitle || sectionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: displayTitle,
      purpose: `Provide specialized, evidence-grounded research analysis focusing on "${displayTitle}".`,
      keyAspects: ['Analyze supplied facts and evidence directly relevant to this section', 'Reference specific verified metrics', 'Highlight trade-offs and limitations'],
      metricsToExamine: ['Relevant verified financial and market indicators'],
      antiDuplicationGuideline: `Focus strictly on aspects pertinent to "${displayTitle}"; do not repeat the general company overview or executive summary.`,
      suggestedSubsections: ['Key Observations', 'Detailed Analysis', 'Implications & Limitations'],
    };
  }

  static isRegistered(sectionType: string): boolean {
    const normalizedKey = sectionType.toLowerCase().replace(/[\s-]+/g, '_');
    return normalizedKey in this.INSTRUCTIONS;
  }
}
