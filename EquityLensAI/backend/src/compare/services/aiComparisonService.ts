import type {
  ComparisonCompanyTarget,
  AiComparisonAnalysis,
  SupportedPeriod,
  AiComparisonCategoryComparison,
} from '../types.js';
import { GeminiClient } from '../../ai/clients/gemini.js';
import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
  contextBuilder,
  type VerifiedCompanyEvidenceContext,
  ResearchPromptBuilder,
  StructuredOutputValidator,
  CitationResolver,
  financialDataGroundingService,
} from '../../ai/framework/index.js';
import { AppError } from '../../utils/appError.js';

export class AiComparisonService {
  private geminiClient = new GeminiClient();

  async analyzeComparison(
    targets: ComparisonCompanyTarget[],
    period: SupportedPeriod = 'annual',
  ): Promise<AiComparisonAnalysis> {
    if (!targets || targets.length < 2) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least two companies are required for comparative analysis.',
        400,
      );
    }

    const targetA = targets[0]!;
    const targetB = targets[1]!;

    // ── A. Data Collection Before Analysis ─────────────────────────────────────
    const [contextA, contextB] = await Promise.all([
      contextBuilder.buildCompanyContext(targetA, period === 'ttm' ? 'ttm' : 'annual'),
      contextBuilder.buildCompanyContext(targetB, period === 'ttm' ? 'ttm' : 'annual'),
    ]);

    // Check period alignment
    const periodAudit = financialDataGroundingService.checkPeriodAlignment(contextA, contextB);
    const limitations = [
      ...contextA.limitations,
      ...contextB.limitations,
      ...(periodAudit.isAligned ? [] : [periodAudit.note!]),
    ];

    const env = getEnv();
    if (!env.GEMINI_API_KEY || !env.AI_RESEARCH_ENABLED) {
      return this.generateDeterministicComparison(contextA, contextB, limitations);
    }

    // ── Prompt Building & AI Calling ─────────────────────────────────────────
    const { systemPrompt, userPrompt } = ResearchPromptBuilder.buildComparisonPrompt(contextA, contextB);

    try {
      const response = await this.geminiClient.generate({
        systemInstruction: systemPrompt,
        prompt: userPrompt,
        intent: 'COMPARATIVE_ANALYSIS',
        responseJsonSchema: { type: 'object' },
      });

      const parsed = StructuredOutputValidator.parseJson<Record<string, unknown>>(
        response.text,
        'Comparative Analysis',
      );

      return this.harmonizeAiOutput(parsed, contextA, contextB, limitations, response.model || 'gemini');
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Gemini comparative analysis failed, falling back to deterministic synthesis',
      );
      return this.generateDeterministicComparison(contextA, contextB, limitations);
    }
  }

  /**
   * Harmonizes AI response into the canonical 10-section contract, guaranteeing schema safety.
   */
  private harmonizeAiOutput(
    parsed: Record<string, unknown>,
    contextA: VerifiedCompanyEvidenceContext,
    contextB: VerifiedCompanyEvidenceContext,
    limitations: string[],
    model: string,
  ): AiComparisonAnalysis {
    const fallback = this.generateDeterministicComparison(contextA, contextB, limitations);

    const safeCategory = (
      val: unknown,
      fallbackCat: AiComparisonCategoryComparison,
    ): AiComparisonCategoryComparison => {
      if (typeof val !== 'object' || val === null) return fallbackCat;
      const obj = val as Record<string, unknown>;
      const evidence = Array.isArray(obj.evidence) ? obj.evidence.map(String) : fallbackCat.evidence;
      const validEvidence = CitationResolver.filterValidCitations(
        evidence,
        Array.from(contextA.evidenceMap.values()).concat(Array.from(contextB.evidenceMap.values())),
      );

      return {
        analysis: typeof obj.analysis === 'string' && obj.analysis.trim().length > 20 ? obj.analysis : fallbackCat.analysis,
        company_a_metrics: typeof obj.company_a_metrics === 'object' && obj.company_a_metrics !== null
          ? (obj.company_a_metrics as Record<string, unknown>)
          : fallbackCat.company_a_metrics,
        company_b_metrics: typeof obj.company_b_metrics === 'object' && obj.company_b_metrics !== null
          ? (obj.company_b_metrics as Record<string, unknown>)
          : fallbackCat.company_b_metrics,
        comparative_conclusion: typeof obj.comparative_conclusion === 'string' && obj.comparative_conclusion.length > 5
          ? obj.comparative_conclusion
          : fallbackCat.comparative_conclusion,
        evidence: validEvidence.length > 0 ? validEvidence : fallbackCat.evidence,
        reporting_period: typeof obj.reporting_period === 'string' ? obj.reporting_period : fallbackCat.reporting_period,
        data_availability: fallbackCat.data_availability,
      };
    };

    const businessComp = safeCategory(parsed.business_comparison, fallback.business_comparison!);
    const growthComp = safeCategory(parsed.growth_comparison, fallback.growth_comparison!);
    const profitComp = safeCategory(parsed.profitability_comparison, fallback.profitability_comparison!);
    const healthComp = safeCategory(parsed.financial_health, fallback.financial_health!);
    const valComp = safeCategory(parsed.valuation_comparison, fallback.valuation_comparison!);
    const perfComp = safeCategory(parsed.stock_performance, fallback.stock_performance!);
    const divComp = safeCategory(parsed.dividend_comparison, fallback.dividend_comparison!);
    const riskComp = safeCategory(parsed.risk_comparison, fallback.risk_comparison!);

    const summary = typeof parsed.comparison_summary === 'string' && parsed.comparison_summary.trim().length > 30
      ? parsed.comparison_summary
      : (typeof parsed.summary === 'string' && parsed.summary.trim().length > 30 ? parsed.summary : fallback.summary);

    const sections = [
      {
        title: '1. Executive Summary',
        content: summary,
        evidenceIds: Array.from(new Set([...profitComp.evidence, ...valComp.evidence])),
      },
      {
        title: '2. Business Comparison',
        content: `${businessComp.analysis}\n\n**Comparative Conclusion:** ${businessComp.comparative_conclusion}`,
        evidenceIds: businessComp.evidence,
      },
      {
        title: '3. Financial Growth Comparison',
        content: `${growthComp.analysis}\n\n**Comparative Conclusion:** ${growthComp.comparative_conclusion}`,
        evidenceIds: growthComp.evidence,
      },
      {
        title: '4. Profitability Comparison',
        content: `${profitComp.analysis}\n\n**Comparative Conclusion:** ${profitComp.comparative_conclusion}`,
        evidenceIds: profitComp.evidence,
      },
      {
        title: '5. Financial Health & Solvency',
        content: `${healthComp.analysis}\n\n**Comparative Conclusion:** ${healthComp.comparative_conclusion}`,
        evidenceIds: healthComp.evidence,
      },
      {
        title: '6. Valuation Comparison',
        content: `${valComp.analysis}\n\n**Comparative Conclusion:** ${valComp.comparative_conclusion}`,
        evidenceIds: valComp.evidence,
      },
      {
        title: '7. Stock Performance & Volatility',
        content: `${perfComp.analysis}\n\n**Comparative Conclusion:** ${perfComp.comparative_conclusion}`,
        evidenceIds: perfComp.evidence,
      },
      {
        title: '8. Dividend Comparison',
        content: `${divComp.analysis}\n\n**Comparative Conclusion:** ${divComp.comparative_conclusion}`,
        evidenceIds: divComp.evidence,
      },
      {
        title: '9. Risk Comparison',
        content: `${riskComp.analysis}\n\n**Comparative Conclusion:** ${riskComp.comparative_conclusion}`,
        evidenceIds: riskComp.evidence,
      },
      {
        title: '10. Final Comparative Assessment',
        content: typeof parsed.final_assessment === 'object' && parsed.final_assessment !== null && 'overall_takeaway' in parsed.final_assessment
          ? String((parsed.final_assessment as { overall_takeaway: string }).overall_takeaway)
          : fallback.final_assessment!.overall_takeaway,
        evidenceIds: [],
      },
    ];

    return {
      summary,
      sections,
      disclaimer: 'This comparison analysis is strictly for research purposes and does not constitute financial advisory or investment advice.',
      model,
      generatedAt: new Date().toISOString(),
      comparison_summary: summary,
      companies: fallback.companies,
      business_comparison: businessComp,
      growth_comparison: growthComp,
      profitability_comparison: profitComp,
      financial_health: healthComp,
      valuation_comparison: valComp,
      stock_performance: perfComp,
      dividend_comparison: divComp,
      risk_comparison: riskComp,
      category_winners: typeof parsed.category_winners === 'object' && parsed.category_winners !== null
        ? (parsed.category_winners as Record<string, { winner: string | null; rationale: string }>)
        : fallback.category_winners,
      final_assessment: typeof parsed.final_assessment === 'object' && parsed.final_assessment !== null
        ? (parsed.final_assessment as NonNullable<AiComparisonAnalysis['final_assessment']>)
        : fallback.final_assessment,
      data_sources: fallback.data_sources,
      data_limitations: limitations,
    };
  }

  /**
   * Deterministic rule-based analytical engine across all 10 required sections.
   */
  private generateDeterministicComparison(
    cA: VerifiedCompanyEvidenceContext,
    cB: VerifiedCompanyEvidenceContext,
    limitations: string[],
  ): AiComparisonAnalysis {
    const sA = cA.symbol;
    const sB = cB.symbol;
    const nA = cA.companyName;
    const nB = cB.companyName;

    const rA: any = (cA.financials as any)?.ratios;
    const rB: any = (cB.financials as any)?.ratios;

    // Helper for comparative text
    const compareMetrics = (
      label: string,
      valA: number | null | undefined,
      valB: number | null | undefined,
      unit: string,
      higherIsBetter = true,
    ): {
      winner: string | null;
      rationale: string;
      strA: string;
      strB: string;
    } => {
      const strA = valA !== null && valA !== undefined ? `${valA}${unit}` : 'N/A';
      const strB = valB !== null && valB !== undefined ? `${valB}${unit}` : 'N/A';

      if (valA === null || valA === undefined || valB === null || valB === undefined) {
        return {
          winner: null,
          rationale: `Data for ${label} is incomplete across one or both companies (${sA}: ${strA}, ${sB}: ${strB}). Neither holds a conclusive advantage.`,
          strA,
          strB,
        };
      }

      const diff = Math.abs(valA - valB);
      if (diff < 0.001) {
        return {
          winner: null,
          rationale: `Both ${sA} and ${sB} report identical ${label} of ${strA}.`,
          strA,
          strB,
        };
      }

      const aIsBetter = higherIsBetter ? valA > valB : valA < valB;
      const winner = aIsBetter ? sA : sB;
      const winnerName = aIsBetter ? nA : nB;
      const loserName = aIsBetter ? nB : nA;
      const winnerVal = aIsBetter ? strA : strB;
      const loserVal = aIsBetter ? strB : strA;

      return {
        winner,
        rationale: `${winnerName} (${winner}) outperforms with ${label} of ${winnerVal} compared to ${loserName}'s ${loserVal}, reflecting greater operational strength in this parameter.`,
        strA,
        strB,
      };
    };

    // 1. Business
    const businessAnalysis = `${nA} (${sA}) operates in the ${cA.sector || 'N/A'} sector (${cA.industry || 'N/A'}) with a market capitalization of ${cA.marketCap ? `₹${(cA.marketCap / 1e7).toFixed(1)} Cr` : 'N/A'}. In comparison, ${nB} (${sB}) operates in ${cB.sector || 'N/A'} (${cB.industry || 'N/A'}) with a market capitalization of ${cB.marketCap ? `₹${(cB.marketCap / 1e7).toFixed(1)} Cr` : 'N/A'}. Both enterprises exhibit distinct operational footprints and customer segment exposures.`;
    const businessComp: AiComparisonCategoryComparison = {
      analysis: businessAnalysis,
      company_a_metrics: { sector: cA.sector, industry: cA.industry, marketCap: cA.marketCap },
      company_b_metrics: { sector: cB.sector, industry: cB.industry, marketCap: cB.marketCap },
      comparative_conclusion: `${cA.marketCap && cB.marketCap ? (cA.marketCap > cB.marketCap ? sA : sB) : sA} maintains larger total market capitalization scale.`,
      evidence: Array.from(new Set([`EVID_SECTOR_${sA}`, `EVID_SECTOR_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: cA.sector && cB.sector ? 'complete' : 'partial',
    };

    // 2. Growth
    const revComp = compareMetrics('Revenue Growth YoY', rA?.growth.revenueGrowthYoY, rB?.growth.revenueGrowthYoY, '%', true);
    const profitGrowthComp = compareMetrics('Net Profit Growth YoY', rA?.growth.netIncomeGrowthYoY, rB?.growth.netIncomeGrowthYoY, '%', true);
    const growthAnalysis = `${nA} reported revenue growth of ${revComp.strA} and net income growth of ${profitGrowthComp.strA} for ${cA.reportingPeriod}. ${nB} delivered revenue growth of ${revComp.strB} alongside net income growth of ${profitGrowthComp.strB}. ${revComp.rationale} ${profitGrowthComp.rationale}`;
    const growthWinner = revComp.winner === profitGrowthComp.winner ? revComp.winner : (revComp.winner || profitGrowthComp.winner);
    const growthComp: AiComparisonCategoryComparison = {
      analysis: growthAnalysis,
      company_a_metrics: { revenueGrowthYoY: rA?.growth.revenueGrowthYoY ?? null, netIncomeGrowthYoY: rA?.growth.netIncomeGrowthYoY ?? null },
      company_b_metrics: { revenueGrowthYoY: rB?.growth.revenueGrowthYoY ?? null, netIncomeGrowthYoY: rB?.growth.netIncomeGrowthYoY ?? null },
      comparative_conclusion: growthWinner ? `${growthWinner} demonstrates stronger overall expansion across reported top-line and bottom-line growth.` : 'Growth trajectory between both companies is balanced across top and bottom lines.',
      evidence: Array.from(new Set([`EVID_REVENUE_GROWTH_${sA}`, `EVID_REVENUE_GROWTH_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: rA?.growth && rB?.growth ? 'complete' : 'partial',
    };

    // 3. Profitability
    const roceComp = compareMetrics('ROCE', rA?.profitability?.returnOnCapitalEmployed, rB?.profitability?.returnOnCapitalEmployed, '%', true);
    const roeComp = compareMetrics('ROE', rA?.profitability?.returnOnEquity, rB?.profitability?.returnOnEquity, '%', true);
    const opMarginComp = compareMetrics('Operating Margin', rA?.profitability?.operatingMargin, rB?.profitability?.operatingMargin, '%', true);
    const netMarginComp = compareMetrics('Net Margin', rA?.profitability?.netMargin, rB?.profitability?.netMargin, '%', true);
    const profAnalysis = `${nA} reports ROCE of ${roceComp.strA} and ROE of ${roeComp.strA}, supported by an operating margin of ${opMarginComp.strA} and net profit margin of ${netMarginComp.strA}. By comparison, ${nB} achieves ROCE of ${roceComp.strB} and ROE of ${roeComp.strB}, with operating margins of ${opMarginComp.strB} and net profit margins of ${netMarginComp.strB}. ${roceComp.rationale} This reflects underlying differences in capital efficiency and operating cost structures.`;
    const profWinner = roceComp.winner || roeComp.winner;
    const profitComp: AiComparisonCategoryComparison = {
      analysis: profAnalysis,
      company_a_metrics: { roe: rA?.profitability?.returnOnEquity ?? null, roce: rA?.profitability?.returnOnCapitalEmployed ?? null, operatingMargin: rA?.profitability?.operatingMargin ?? null, netMargin: rA?.profitability?.netMargin ?? null },
      company_b_metrics: { roe: rB?.profitability?.returnOnEquity ?? null, roce: rB?.profitability?.returnOnCapitalEmployed ?? null, operatingMargin: rB?.profitability?.operatingMargin ?? null, netMargin: rB?.profitability?.netMargin ?? null },
      comparative_conclusion: profWinner ? `${profWinner} commands superior return on capital employed and margin conversion.` : 'Profitability returns are comparable across both companies.',
      evidence: Array.from(new Set([`EVID_ROCE_${sA}`, `EVID_ROCE_${sB}`, `EVID_ROE_${sA}`, `EVID_ROE_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: rA?.profitability && rB?.profitability ? 'complete' : 'partial',
    };

    // 4. Financial Health
    const deComp = compareMetrics('Debt-to-Equity', rA?.leverage?.debtToEquity, rB?.leverage?.debtToEquity, 'x', false);
    const crComp = compareMetrics('Current Ratio', rA?.liquidity?.currentRatio, rB?.liquidity?.currentRatio, 'x', true);
    const healthScoreComp = compareMetrics('Financial Health Score', cA.financials?.healthScore?.overallScore, cB.financials?.healthScore?.overallScore, '/100', true);
    const healthAnalysis = `${nA} maintains a debt-to-equity ratio of ${deComp.strA} and current ratio of ${crComp.strA}, yielding a composite health score of ${healthScoreComp.strA}. Conversely, ${nB} registers a debt-to-equity ratio of ${deComp.strB} and current ratio of ${crComp.strB}, resulting in a composite health score of ${healthScoreComp.strB}. ${deComp.rationale}`;
    const healthWinner = deComp.winner || healthScoreComp.winner;
    const healthComp: AiComparisonCategoryComparison = {
      analysis: healthAnalysis,
      company_a_metrics: { debtToEquity: rA?.leverage?.debtToEquity ?? null, currentRatio: rA?.liquidity?.currentRatio ?? null, healthScore: cA.financials?.healthScore?.overallScore ?? null },
      company_b_metrics: { debtToEquity: rB?.leverage?.debtToEquity ?? null, currentRatio: rB?.liquidity?.currentRatio ?? null, healthScore: cB.financials?.healthScore?.overallScore ?? null },
      comparative_conclusion: healthWinner ? `${healthWinner} possesses a sturdier balance sheet with superior solvency and liquidity buffers.` : 'Both balance sheets exhibit healthy solvency buffers.',
      evidence: Array.from(new Set([`EVID_DEBT_TO_EQUITY_${sA}`, `EVID_DEBT_TO_EQUITY_${sB}`, `EVID_HEALTH_SCORE_${sA}`, `EVID_HEALTH_SCORE_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: rA?.leverage && rB?.leverage ? 'complete' : 'partial',
    };

    // 5. Valuation
    const peComp = compareMetrics('P/E Ratio', rA?.valuation?.peRatio, rB?.valuation?.peRatio, 'x', false);
    const pbComp = compareMetrics('P/B Ratio', rA?.valuation?.priceToBook, rB?.valuation?.priceToBook, 'x', false);
    const dyComp = compareMetrics('Dividend Yield', rA?.valuation?.dividendYield, rB?.valuation?.dividendYield, '%', true);
    const valAnalysis = `${nA} is currently valued at a P/E multiple of ${peComp.strA} and P/B of ${pbComp.strA}, with a dividend yield of ${dyComp.strA}. Meanwhile, ${nB} trades at a P/E of ${peComp.strB} and P/B of ${pbComp.strB}, offering a dividend yield of ${dyComp.strB}. Important context: Valuation must not be evaluated on P/E alone; premiums or discounts must be weighed against ROCE and earnings consistency.`;
    const valWinner = peComp.winner;
    const valComp: AiComparisonCategoryComparison = {
      analysis: valAnalysis,
      company_a_metrics: { peRatio: rA?.valuation?.peRatio ?? null, priceToBook: rA?.valuation?.priceToBook ?? null, dividendYield: rA?.valuation?.dividendYield ?? null },
      company_b_metrics: { peRatio: rB?.valuation?.peRatio ?? null, priceToBook: rB?.valuation?.priceToBook ?? null, dividendYield: rB?.valuation?.dividendYield ?? null },
      comparative_conclusion: valWinner ? `${valWinner} trades at a more modest valuation multiple, though premium justification must consider return metrics.` : 'Valuation multiples are broadly comparable.',
      evidence: Array.from(new Set([`EVID_PE_RATIO_${sA}`, `EVID_PE_RATIO_${sB}`, `EVID_PB_RATIO_${sA}`, `EVID_PB_RATIO_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: rA?.valuation && rB?.valuation ? 'complete' : 'partial',
    };

    // 6. Stock Performance
    const ret1YComp = compareMetrics('1-Year Return', cA.performance.oneYearReturn, cB.performance.oneYearReturn, '%', true);
    const cagr3YComp = compareMetrics('3-Year CAGR', cA.performance.threeYearCAGR, cB.performance.threeYearCAGR, '%', true);
    const volComp = compareMetrics('Annualized Volatility', cA.performance.annualizedVolatility, cB.performance.annualizedVolatility, '%', false);
    const ddComp = compareMetrics('Maximum Drawdown', cA.performance.maxDrawdown, cB.performance.maxDrawdown, '%', false);
    const perfAnalysis = `Over the past year, ${nA} generated a return of ${ret1YComp.strA} (3Y CAGR: ${cagr3YComp.strA}) with annualized volatility of ${volComp.strA} and max drawdown of ${ddComp.strA}. In contrast, ${nB} logged a 1Y return of ${ret1YComp.strB} (3Y CAGR: ${cagr3YComp.strB}) with volatility of ${volComp.strB} and max drawdown of ${ddComp.strB}. ${ret1YComp.rationale}`;
    const perfWinner = ret1YComp.winner || cagr3YComp.winner;
    const perfComp: AiComparisonCategoryComparison = {
      analysis: perfAnalysis,
      company_a_metrics: { oneYearReturn: cA.performance.oneYearReturn, threeYearCAGR: cA.performance.threeYearCAGR, volatility: cA.performance.annualizedVolatility, maxDrawdown: cA.performance.maxDrawdown },
      company_b_metrics: { oneYearReturn: cB.performance.oneYearReturn, threeYearCAGR: cB.performance.threeYearCAGR, volatility: cB.performance.annualizedVolatility, maxDrawdown: cB.performance.maxDrawdown },
      comparative_conclusion: perfWinner ? `${perfWinner} delivered superior risk-adjusted historical equity returns.` : 'Historical share performance is evenly balanced across the evaluation period.',
      evidence: Array.from(new Set([`EVID_PERF_1Y_${sA}`, `EVID_PERF_1Y_${sB}`, `EVID_VOLATILITY_${sA}`, `EVID_VOLATILITY_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: 'Adjusted Historical Daily Series',
      data_availability: cA.performance.oneYearReturn !== null && cB.performance.oneYearReturn !== null ? 'complete' : 'partial',
    };

    // 7. Dividend
    const divAnalysis = `${nA} offers a dividend yield of ${dyComp.strA}, whereas ${nB} provides a dividend yield of ${dyComp.strB}. ${dyComp.rationale} Dividend sustainability depends on operating cash flow generation and CapEx commitments.`;
    const divComp: AiComparisonCategoryComparison = {
      analysis: divAnalysis,
      company_a_metrics: { dividendYield: rA?.valuation?.dividendYield ?? null },
      company_b_metrics: { dividendYield: rB?.valuation?.dividendYield ?? null },
      comparative_conclusion: dyComp.winner ? `${dyComp.winner} provides a higher cash dividend yield to shareholders.` : 'Dividend yield profiles are comparable.',
      evidence: Array.from(new Set([`EVID_DIVIDEND_YIELD_${sA}`, `EVID_DIVIDEND_YIELD_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: rA?.valuation?.dividendYield !== undefined && rB?.valuation?.dividendYield !== undefined ? 'complete' : 'partial',
    };

    // 8. Risk
    const riskAnalysis = `Evaluating risk across leverage and equity volatility: ${nA} carries a debt-to-equity ratio of ${deComp.strA} alongside historical drawdown of ${ddComp.strA} and annualized volatility of ${volComp.strA}. Meanwhile, ${nB} has debt-to-equity of ${deComp.strB}, drawdown of ${ddComp.strB}, and volatility of ${volComp.strB}. Lower leverage and milder drawdown buffer against downside market stress.`;
    const riskWinner = deComp.winner || ddComp.winner;
    const riskComp: AiComparisonCategoryComparison = {
      analysis: riskAnalysis,
      company_a_metrics: { debtToEquity: rA?.leverage?.debtToEquity ?? null, volatility: cA.performance.annualizedVolatility, maxDrawdown: cA.performance.maxDrawdown },
      company_b_metrics: { debtToEquity: rB?.leverage?.debtToEquity ?? null, volatility: cB.performance.annualizedVolatility, maxDrawdown: cB.performance.maxDrawdown },
      comparative_conclusion: riskWinner ? `${riskWinner} demonstrates lower fundamental solvency and market volatility risk exposure.` : 'Risk profiles are broadly matched across solvency and market beta.',
      evidence: Array.from(new Set([`EVID_DEBT_TO_EQUITY_${sA}`, `EVID_DEBT_TO_EQUITY_${sB}`])).filter((id) => cA.evidenceMap.has(id) || cB.evidenceMap.has(id)),
      reporting_period: cA.reportingPeriod,
      data_availability: 'complete',
    };

    // Category Winners
    const categoryWinners = {
      business_model: { winner: null, rationale: 'Both operate scaled domestic and global business models without a structural single-company monopoly.' },
      growth: { winner: growthWinner, rationale: growthComp.comparative_conclusion },
      profitability: { winner: profWinner, rationale: profitComp.comparative_conclusion },
      financial_health: { winner: healthWinner, rationale: healthComp.comparative_conclusion },
      valuation: { winner: valWinner, rationale: valComp.comparative_conclusion },
      stock_performance: { winner: perfWinner, rationale: perfComp.comparative_conclusion },
      dividend: { winner: dyComp.winner, rationale: divComp.comparative_conclusion },
      risk_profile: { winner: riskWinner, rationale: riskComp.comparative_conclusion },
    };

    // Advantages / Disadvantages
    const keyAdvantagesA: string[] = [];
    const keyAdvantagesB: string[] = [];
    const keyDisadvantagesA: string[] = [];
    const keyDisadvantagesB: string[] = [];

    if (profWinner === sA) {
      keyAdvantagesA.push(`Superior ROCE (${roceComp.strA} vs ${roceComp.strB})`);
      keyDisadvantagesB.push(`Lower return on capital employed (${roceComp.strB})`);
    } else if (profWinner === sB) {
      keyAdvantagesB.push(`Superior ROCE (${roceComp.strB} vs ${roceComp.strA})`);
      keyDisadvantagesA.push(`Lower return on capital employed (${roceComp.strA})`);
    }

    if (valWinner === sA) {
      keyAdvantagesA.push(`Lower P/E valuation multiple (${peComp.strA} vs ${peComp.strB})`);
      keyDisadvantagesB.push(`Valuation multiple premium (${peComp.strB})`);
    } else if (valWinner === sB) {
      keyAdvantagesB.push(`Lower P/E valuation multiple (${peComp.strB} vs ${peComp.strA})`);
      keyDisadvantagesA.push(`Valuation multiple premium (${peComp.strA})`);
    }

    if (growthWinner === sA) {
      keyAdvantagesA.push(`Higher revenue growth (${revComp.strA} vs ${revComp.strB})`);
    } else if (growthWinner === sB) {
      keyAdvantagesB.push(`Higher revenue growth (${revComp.strB} vs ${revComp.strA})`);
    }

    const summary = `Comprehensive institutional comparison between ${nA} (${sA}) and ${nB} (${sB}) for reporting period ${cA.reportingPeriod}. ${profWinner ? `${profWinner} leads in capital efficiency and profitability.` : ''} ${valWinner ? `${valWinner} offers a more modest valuation multiple.` : ''} Investment decisions require balancing valuation discounts against capital return differentials.`;

    const sections = [
      {
        title: '1. Executive Summary',
        content: summary,
        evidenceIds: Array.from(new Set([...profitComp.evidence, ...valComp.evidence])),
      },
      {
        title: '2. Business Comparison',
        content: `${businessComp.analysis}\n\n**Conclusion:** ${businessComp.comparative_conclusion}`,
        evidenceIds: businessComp.evidence,
      },
      {
        title: '3. Financial Growth Comparison',
        content: `${growthComp.analysis}\n\n**Conclusion:** ${growthComp.comparative_conclusion}`,
        evidenceIds: growthComp.evidence,
      },
      {
        title: '4. Profitability Comparison',
        content: `${profitComp.analysis}\n\n**Conclusion:** ${profitComp.comparative_conclusion}`,
        evidenceIds: profitComp.evidence,
      },
      {
        title: '5. Financial Health & Solvency',
        content: `${healthComp.analysis}\n\n**Conclusion:** ${healthComp.comparative_conclusion}`,
        evidenceIds: healthComp.evidence,
      },
      {
        title: '6. Valuation Comparison',
        content: `${valComp.analysis}\n\n**Conclusion:** ${valComp.comparative_conclusion}`,
        evidenceIds: valComp.evidence,
      },
      {
        title: '7. Stock Performance & Volatility',
        content: `${perfComp.analysis}\n\n**Conclusion:** ${perfComp.comparative_conclusion}`,
        evidenceIds: perfComp.evidence,
      },
      {
        title: '8. Dividend Comparison',
        content: `${divComp.analysis}\n\n**Conclusion:** ${divComp.comparative_conclusion}`,
        evidenceIds: divComp.evidence,
      },
      {
        title: '9. Risk Comparison',
        content: `${riskComp.analysis}\n\n**Conclusion:** ${riskComp.comparative_conclusion}`,
        evidenceIds: riskComp.evidence,
      },
      {
        title: '10. Final Comparative Assessment',
        content: `A balanced review reveals distinct investment trade-offs between ${nA} and ${nB}. Investors seeking higher return on capital and margin expansion may favor ${profWinner || sA}, whereas valuation-sensitive investors may prioritize ${valWinner || sB}. Neither company holds an absolute advantage across all 10 evaluated dimensions.`,
        evidenceIds: [],
      },
    ];

    return {
      summary,
      sections,
      disclaimer: 'This comparison analysis is strictly for research purposes and does not constitute financial advisory or investment advice.',
      model: 'deterministic-rules',
      generatedAt: new Date().toISOString(),
      comparison_summary: summary,
      companies: [
        {
          symbol: cA.symbol,
          exchange: cA.exchange,
          name: cA.companyName,
          sector: cA.sector,
          industry: cA.industry,
          marketCap: cA.marketCap,
          price: cA.price,
        },
        {
          symbol: cB.symbol,
          exchange: cB.exchange,
          name: cB.companyName,
          sector: cB.sector,
          industry: cB.industry,
          marketCap: cB.marketCap,
          price: cB.price,
        },
      ],
      business_comparison: businessComp,
      growth_comparison: growthComp,
      profitability_comparison: profitComp,
      financial_health: healthComp,
      valuation_comparison: valComp,
      stock_performance: perfComp,
      dividend_comparison: divComp,
      risk_comparison: riskComp,
      category_winners: categoryWinners,
      final_assessment: {
        overall_takeaway: `The comparison between ${sA} and ${sB} presents an established quality versus valuation trade-off. ${profWinner ? `${profWinner} demonstrates superior operating profitability.` : ''} ${valWinner ? `${valWinner} trades at a discount multiple.` : ''}`,
        key_advantages: {
          [sA]: keyAdvantagesA.length > 0 ? keyAdvantagesA : ['Established market presence and operational scale'],
          [sB]: keyAdvantagesB.length > 0 ? keyAdvantagesB : ['Established market presence and operational scale'],
        },
        key_disadvantages: {
          [sA]: keyDisadvantagesA.length > 0 ? keyDisadvantagesA : ['Exposure to sector cyclicality'],
          [sB]: keyDisadvantagesB.length > 0 ? keyDisadvantagesB : ['Exposure to sector cyclicality'],
        },
        trade_offs: [
          `Trading off valuation multiples (${sA}: ${peComp.strA} P/E vs ${sB}: ${peComp.strB} P/E) against return on capital (${sA}: ${roceComp.strA} ROCE vs ${sB}: ${roceComp.strB} ROCE).`,
        ],
        inconclusive_areas: [
          'Detailed non-public segment margin breakdowns and granular international customer contract durations.',
        ],
      },
      data_sources: [
        { name: 'NSE/BSE Scrip Master', type: 'Exchange Master Registry', retrievedAt: new Date().toISOString() },
        { name: 'Company Financial Disclosures', type: 'Annual/TTM Financial Statements', retrievedAt: new Date().toISOString() },
        { name: 'Market Trading Observation Engine', type: 'Adjusted Historical Prices', retrievedAt: new Date().toISOString() },
      ],
      data_limitations: limitations,
    };
  }
}

export const aiComparisonService = new AiComparisonService();
