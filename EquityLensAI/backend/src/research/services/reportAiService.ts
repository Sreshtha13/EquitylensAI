import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/appError.js';
import { GeminiClient } from '../../ai/clients/gemini.js';
import type { AiClient } from '../../ai/common/types.js';
import type {
  ResearchEvidenceItem,
  ResearchReportSection,
  ReportSectionType,
} from '@equitylensai/shared';

const REPORT_AI_SYSTEM_INSTRUCTION = `You are a financial research assistant for EquityLensAI.
Your task is to write objective, institutional-grade equity research analysis strictly grounded in supplied evidence.

CRITICAL INTEGRITY RULES:
1. Ground every claim strictly in the provided evidence items.
2. Every paragraph or section must cite the exact evidence IDs that substantiate it.
3. NEVER make direct investment recommendations (do NOT say BUY, SELL, or guarantee returns).
4. Clearly distinguish source facts from interpretations.
5. If evidence is missing, contradictory, or outdated, explicitly identify the gap.
6. Do NOT fabricate numbers, ratios, dates, or source URLs.
7. Return your response in clean JSON matching the requested schema.`;

interface GeneratedSectionResult {
  title: string;
  content: string;
  evidenceIds: string[];
}

export class ReportAiService {
  constructor(private client: AiClient = new GeminiClient()) {}

  async generateReportSection(options: {
    symbol: string;
    companyName: string;
    sectionType: ReportSectionType;
    sectionTitle: string;
    evidence: ResearchEvidenceItem[];
    researchQuestion?: string;
    requestId?: string;
  }): Promise<ResearchReportSection> {
    const { symbol, companyName, sectionType, sectionTitle, evidence, researchQuestion, requestId } = options;

    const env = getEnv();
    if (!env.AI_RESEARCH_ENABLED || !env.GEMINI_API_KEY) {
      throw new AppError(
        'AI_NOT_CONFIGURED',
        'AI drafting is currently disabled. Please configure GEMINI_API_KEY and set AI_RESEARCH_ENABLED=true.',
        503,
      );
    }

    const validEvidenceIds = new Set(evidence.map((e) => e.id));

    // Construct bounded evidence payload
    const evidenceContext = evidence.map((e) => ({
      id: e.id,
      type: e.evidenceType,
      title: e.title,
      source: e.sourceReference,
      period: e.reportingPeriod ?? null,
      value: e.value ?? null,
      metadata: e.metadata ?? null,
    }));

    const prompt = `Write an analytical research section for ${companyName} (${symbol}).
Section Type: ${sectionType}
Section Title: ${sectionTitle}
${researchQuestion ? `Specific Research Question: "${researchQuestion}"\n` : ''}

Available Verified Evidence:
${JSON.stringify(evidenceContext, null, 2)}

Respond with a JSON object having the exact shape:
{
  "title": "${sectionTitle}",
  "content": "Detailed, professional analysis in Markdown...",
  "evidenceIds": ["id1", "id2"]
}`;

      const sectionJsonSchema: Record<string, unknown> = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          evidenceIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'content', 'evidenceIds'],
      };

      let response;
      try {
        response = await this.client.generate({
        prompt,
        systemInstruction: REPORT_AI_SYSTEM_INSTRUCTION,
        responseJsonSchema: sectionJsonSchema,
        ...(requestId ? { requestId } : {}),
        instrument: symbol,
        intent: 'GENERAL',
      });

      let parsed: GeneratedSectionResult;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        throw new AppError('AI_INVALID_RESPONSE', 'The AI model returned non-JSON text', 502);
      }

      if (!parsed.content || typeof parsed.content !== 'string') {
        throw new AppError('AI_INVALID_RESPONSE', 'The AI section content was empty or invalid', 502);
      }

      // Check evidence reference validity
      const citedIds = Array.isArray(parsed.evidenceIds) ? parsed.evidenceIds : [];
      const invalidIds = citedIds.filter((id) => !validEvidenceIds.has(id));
      if (invalidIds.length > 0) {
        logger.warn(
          { invalidIds, citedCount: citedIds.length, symbol },
          'ai_report_generation_hallucinated_evidence_id',
        );
      }

      const filteredEvidenceIds = citedIds.filter((id) => validEvidenceIds.has(id));

      return {
        id: crypto.randomUUID(),
        sectionType,
        title: parsed.title || sectionTitle,
        content: parsed.content,
        position: 0,
        status: 'draft',
        generatedBy: 'ai',
        evidenceIds: filteredEvidenceIds,
        updatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      logger.error({ err, symbol, sectionType }, 'ai_report_section_generation_failed');
      throw new AppError(
        'AI_GENERATION_FAILED',
        err instanceof Error ? err.message : 'AI report generation encountered an unexpected error',
        502,
      );
    }
  }

  async generateFullDraft(options: {
    symbol: string;
    companyName: string;
    sections: ResearchReportSection[];
    evidence: ResearchEvidenceItem[];
    researchQuestion?: string;
    requestId?: string;
  }): Promise<ResearchReportSection[]> {
    const { symbol, companyName, sections, evidence, researchQuestion, requestId } = options;

    const aiCapableTypes: ReportSectionType[] = [
      'executive_summary',
      'risks_and_uncertainties',
      'conclusion_open_questions',
    ];

    const updatedSections: ResearchReportSection[] = [];

    for (const section of sections) {
      if (aiCapableTypes.includes(section.sectionType)) {
        try {
          const aiSection = await this.generateReportSection({
            symbol,
            companyName,
            sectionType: section.sectionType,
            sectionTitle: section.title,
            evidence,
            ...(researchQuestion ? { researchQuestion } : {}),
            ...(requestId ? { requestId } : {}),
          });

          updatedSections.push({
            ...section,
            content: aiSection.content,
            evidenceIds: aiSection.evidenceIds,
            generatedBy: 'ai',
            status: 'draft',
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          logger.warn({ err, sectionType: section.sectionType }, 'AI generation skipped for section');
          updatedSections.push(section);
        }
      } else {
        // Retain system-assembled or user-authored section
        updatedSections.push(section);
      }
    }

    return updatedSections;
  }
}

export const reportAiService = new ReportAiService();
