import { SectionInstructionRegistry, type SectionInstruction } from './SectionInstructionRegistry.js';
import type { VerifiedCompanyEvidenceContext } from './ContextBuilder.js';

export class ResearchPromptBuilder {
  /**
   * Builds prompt for AI comparison analysis across 10 structured sections.
   */
  static buildComparisonPrompt(
    companyA: VerifiedCompanyEvidenceContext,
    companyB: VerifiedCompanyEvidenceContext,
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a Senior Equity Research Analyst for EquityLensAI.
Your role is to produce a rigorous, institutional-grade comparative investment analysis between two listed companies.

CRITICAL RULES:
1. ONLY make claims supported by the verified facts provided below. NEVER fabricate numbers, management quotes, estimates, or events.
2. If data for a metric is missing or unavailable, explicitly state that it is unavailable. Never assume missing data is zero.
3. Every numerical assertion or factual claim MUST cite the corresponding Evidence ID in brackets (e.g. [EVID_ROE_TCS]).
4. Always explain WHY: identify root drivers (margins, leverage, business model differences, volume vs pricing) rather than merely stating that one company is higher or lower.
5. In the final assessment, evaluate each category fairly. DO NOT force an arbitrary winner when evidence is inconclusive or the trade-off is neutral.
6. NEVER give direct investment commands (no BUY, SELL, or target prices).
7. Return a valid JSON object matching the requested schema.`;

    const formatCompanyFacts = (c: VerifiedCompanyEvidenceContext) => {
      const facts: string[] = [
        `Company: ${c.companyName} (${c.symbol}, Exchange: ${c.exchange})`,
        `Sector: ${c.sector || 'N/A'}, Industry: ${c.industry || 'N/A'}, Classification: ${c.classification}`,
        `Current Price: ₹${c.price ?? 'N/A'}, Market Cap: ₹${c.marketCap ? (c.marketCap / 1e7).toFixed(1) + ' Cr' : 'N/A'}, Day Change: ${c.dayChangePercent ?? 'N/A'}%`,
        `52W High: ₹${c.fiftyTwoWeekHigh ?? 'N/A'}, 52W Low: ₹${c.fiftyTwoWeekLow ?? 'N/A'}`,
        `Reporting Period: ${c.reportingPeriod}, Scope: ${c.statementScope}`,
        `Historical Price Performance: 1M=${c.performance.oneMonthReturn ?? 'N/A'}%, 3M=${c.performance.threeMonthReturn ?? 'N/A'}%, 6M=${c.performance.sixMonthReturn ?? 'N/A'}%, 1Y=${c.performance.oneYearReturn ?? 'N/A'}%, 3Y CAGR=${c.performance.threeYearCAGR ?? 'N/A'}%, 5Y CAGR=${c.performance.fiveYearCAGR ?? 'N/A'}%, Volatility=${c.performance.annualizedVolatility ?? 'N/A'}%, Max Drawdown=${c.performance.maxDrawdown ?? 'N/A'}%`,
      ];

      facts.push('Verified Evidence Items:');
      for (const [id, item] of c.evidenceMap.entries()) {
        facts.push(`  - [${id}] ${item.label}: ${item.value} (${item.source})`);
      }

      if (c.limitations.length > 0) {
        facts.push(`Data Limitations: ${c.limitations.join('; ')}`);
      }

      return facts.join('\n');
    };

    const userPrompt = `VERIFIED COMPANY A DATA:
${formatCompanyFacts(companyA)}

VERIFIED COMPANY B DATA:
${formatCompanyFacts(companyB)}

Generate the institutional comparative analysis across the 10 core sections:
1. Executive Summary
2. Business Comparison
3. Financial Growth Comparison
4. Profitability Comparison
5. Financial Health
6. Valuation Comparison
7. Stock Performance
8. Dividend Comparison
9. Risk Comparison
10. Final Comparative Assessment`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Builds prompt for generating a specific research report section.
   */
  static buildSectionPrompt(options: {
    symbol: string;
    companyName: string;
    sector?: string | null | undefined;
    industry?: string | null | undefined;
    sectionType: string;
    sectionTitle: string;
    instruction?: SectionInstruction | undefined;
    outline?: string[] | undefined;
    previousSections?: Array<{ title: string; content?: string; summary?: string }> | undefined;
    previousSectionSummaries?: Array<{ title: string; summary: string }> | undefined;
    evidenceText?: string | undefined;
    evidenceContext?: unknown;
    researchQuestion?: string | undefined;
    userNotes?: string[] | undefined;
    action?: 'generate' | 'regenerate' | 'expand' | 'shorten' | 'deepen' | 'update' | undefined;
    customInstructions?: string | undefined;
  }): { systemPrompt: string; userPrompt: string; prompt: string; systemInstruction: string } {
    const {
      symbol,
      companyName,
      sector,
      industry,
      sectionType,
      sectionTitle,
      outline = [],
      previousSections,
      previousSectionSummaries,
      researchQuestion,
      userNotes,
      action = 'generate',
      customInstructions,
    } = options;

    const instruction =
      options.instruction || SectionInstructionRegistry.getInstruction(sectionType, sectionTitle);

    const systemPrompt = `You are an Institutional Equity Research Analyst for EquityLensAI.
Your task is to write a specific, deeply analytical section of an investment research report for ${companyName} (${symbol}).

SECTION IDENTITY & MISSION:
- Target Section: "${sectionTitle}" (${sectionType})
- Core Purpose: ${instruction.purpose}
- Key Analytical Angles: ${instruction.keyAspects.join('; ')}
- Metrics To Scrutinize: ${instruction.metricsToExamine.join(', ')}
- Anti-Duplication Directive: ${instruction.antiDuplicationGuideline}

INTEGRITY & QUALITY RULES:
1. Strictly ground all factual assertions in the provided evidence. Cite Evidence IDs in brackets (e.g. [EVID_...]).
2. If evidence for this specific topic is unavailable or incomplete, explicitly state the limitation. DO NOT fabricate information.
3. DO NOT repeat the executive summary or general company background. Write specifically for the purpose of this section.
4. Maintain report-wide consistency with previously generated sections.
5. NO direct investment advice (NO BUY / SELL / Target Price commands).
6. Return a valid JSON object matching the schema.`;

    const userPromptParts: string[] = [
      `Company: ${companyName} (${symbol}), Sector: ${sector || 'N/A'}, Industry: ${industry || 'N/A'}`,
      outline.length > 0 ? `Report Outline: ${outline.join(' -> ')}` : '',
      `Generation Action: ${action.toUpperCase()}`,
    ].filter(Boolean);

    if (customInstructions) {
      userPromptParts.push(`Custom Directives: "${customInstructions}"`);
    }

    if (researchQuestion) {
      userPromptParts.push(`Primary Research Question: "${researchQuestion}"`);
    }

    const prevSummaries =
      previousSectionSummaries ||
      (previousSections || []).map((s) => ({
        title: s.title,
        summary: s.summary || s.content?.slice(0, 200) || '',
      }));

    if (prevSummaries.length > 0) {
      userPromptParts.push('Summaries of Earlier Generated Sections (DO NOT DUPLICATE THIS CONTENT):');
      for (const s of prevSummaries) {
        userPromptParts.push(`  - Section "${s.title}": ${s.summary}`);
      }
    }

    if (userNotes && userNotes.length > 0) {
      userPromptParts.push('Analyst Notes / Diligence Queries:');
      for (const n of userNotes) {
        userPromptParts.push(`  - Note: ${n}`);
      }
    }

    const evidenceStr =
      options.evidenceText ||
      (options.evidenceContext ? JSON.stringify(options.evidenceContext, null, 2) : '[]');

    userPromptParts.push('\nVerified Evidence Items for this Company:');
    userPromptParts.push(evidenceStr);

    userPromptParts.push(`\nNow draft the comprehensive, evidence-grounded section for "${sectionTitle}".`);

    const userPrompt = userPromptParts.join('\n');
    return {
      systemPrompt,
      userPrompt,
      prompt: userPrompt,
      systemInstruction: systemPrompt,
    };
  }
}
