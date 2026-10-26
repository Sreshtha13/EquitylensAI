import type {
  ComparisonCompanyTarget,
  AiComparisonAnalysis,
  SupportedPeriod,
} from '../types.js';
import { comparisonService } from './comparisonService.js';
import { benchmarkService } from './benchmarkService.js';
import { GeminiClient } from '../../ai/clients/gemini.js';
import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class AiComparisonService {
  private geminiClient = new GeminiClient();

  async analyzeComparison(
    targets: ComparisonCompanyTarget[],
    period: SupportedPeriod = 'annual',
  ): Promise<AiComparisonAnalysis> {
    const [comparison, benchmarks] = await Promise.all([
      comparisonService.compareCompanies({ symbols: targets, period }),
      benchmarkService.calculateBenchmarks(targets, period),
    ]);

    // Build evidence-grounded facts
    const facts: string[] = [];
    const evidenceIds: string[] = [];

    for (const c of comparison.companies) {
      facts.push(
        `Company ${c.name} (${c.symbol}, ${c.exchange}): Sector=${c.sector || 'N/A'}, Industry=${c.industry || 'N/A'}, MarketCap=${c.marketCap !== null ? `₹${(c.marketCap / 1e7).toFixed(1)} Cr` : 'N/A'}, Price=${c.price !== null ? c.price : 'N/A'}.`,
      );
    }

    for (const row of comparison.metricsRows) {
      const rowParts: string[] = [];
      for (const [sym, val] of Object.entries(row.values)) {
        if (val !== null && Number.isFinite(val)) {
          const evid = `EVID_${row.metricId.toUpperCase()}_${sym}`;
          evidenceIds.push(evid);
          rowParts.push(`${sym}: ${val} ${row.unit} (ID: ${evid})`);
        } else {
          rowParts.push(`${sym}: N/A (Missing)`);
        }
      }
      facts.push(`Metric "${row.label}" (${row.category}): ${rowParts.join(', ')}.`);
    }

    const env = getEnv();
    if (!env.GEMINI_API_KEY) {
      // Deterministic rule-based analytical summary if no AI API key configured
      return this.generateDeterministicSummary(comparison, benchmarks);
    }

    const systemPrompt = `You are a financial analysis assistant for EquityLensAI.
Your role is to explain verified comparative financial metrics between companies.
RULES:
1. ONLY make claims supported by the verified facts provided. Do NOT fabricate numbers, estimates, or company events.
2. If a company lacks data for a metric, explicitly mention it is unavailable.
3. Every numerical assertion MUST reference an evidence ID from the context (e.g. [EVID_ROE_TCS]).
4. NEVER provide buy/sell advice, stock price predictions, or target prices.
5. Return ONLY a valid JSON object matching this schema:
{
  "summary": "2-3 sentence executive comparative overview",
  "sections": [
    {
      "title": "Profitability & Operating Efficiency",
      "content": "detailed comparative paragraph citing evidence IDs",
      "evidenceIds": ["EVID_..."]
    },
    {
      "title": "Financial Strength & Solvency",
      "content": "detailed comparative paragraph citing evidence IDs",
      "evidenceIds": ["EVID_..."]
    },
    {
      "title": "Valuation & Relative Pricing",
      "content": "detailed comparative paragraph citing evidence IDs",
      "evidenceIds": ["EVID_..."]
    },
    {
      "title": "Data Coverage & Caveats",
      "content": "notes on missing observations or differences in reporting scale",
      "evidenceIds": []
    }
  ],
  "disclaimer": "This analysis is for research purposes only and does not constitute investment advice."
}`;

    const userPrompt = `Verified Comparative Financial Facts:\n${facts.join('\n')}\n\nGenerate the structured comparative synthesis:`;

    try {
      const response = await this.geminiClient.generate({
        systemInstruction: systemPrompt,
        prompt: userPrompt,
        responseJsonSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  evidenceIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'content', 'evidenceIds'],
              },
            },
            disclaimer: { type: 'string' },
          },
          required: ['summary', 'sections', 'disclaimer'],
        },
      });

      const cleaned = response.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        summary: parsed.summary || 'Comparative fundamental synthesis based on reported statements.',
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        disclaimer: parsed.disclaimer || 'This comparative analysis is generated for research purposes only.',
        model: response.model || 'gemini',
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      logger.warn({ err }, 'Gemini comparative analysis failed, falling back to deterministic synthesis');
      return this.generateDeterministicSummary(comparison, benchmarks);
    }
  }

  private generateDeterministicSummary(comparison: any, benchmarks: any): AiComparisonAnalysis {
    const companyNames = comparison.companies.map((c: any) => `${c.name} (${c.symbol})`).join(', ');
    const summary = `Side-by-side fundamental comparison for ${companyNames} evaluated against reporting period ${comparison.period.toUpperCase()}.`;

    const sections = [
      {
        title: 'Profitability & Capital Efficiency',
        content: `Evaluated return on equity, ROCE, and profit margins across ${comparison.companies.length} companies. Missing metrics are preserved as unavailable rather than assumed zero.`,
        evidenceIds: [],
      },
      {
        title: 'Financial Strength & Balance Sheet Health',
        content: `Evaluated leverage (debt-to-equity), interest coverage, and liquidity ratios (current and quick ratios). Companies maintaining lower leverage exhibit greater solvency buffers.`,
        evidenceIds: [],
      },
      {
        title: 'Valuation & Multiples',
        content: `Compared price-to-earnings, price-to-book, and EV/EBITDA ratios using current market prices. Undefined ratios resulting from negative earnings are excluded from peer medians.`,
        evidenceIds: [],
      },
    ];

    return {
      summary,
      sections,
      disclaimer: 'This comparison is deterministic and based strictly on verified historical statements and market data.',
      model: 'deterministic-rules',
      generatedAt: new Date().toISOString(),
    };
  }
}

export const aiComparisonService = new AiComparisonService();
