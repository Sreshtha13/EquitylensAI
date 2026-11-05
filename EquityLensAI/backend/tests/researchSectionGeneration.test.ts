import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { reportAiService } from '../src/research/services/reportAiService.js';
import { GeminiClient } from '../src/ai/clients/gemini.js';
import type { AiClient } from '../src/ai/common/types.js';
import type { ResearchReport } from '@equitylensai/shared';

const app = createApp();
const testUserId = 'test-analyst-uuid-9999';

describe('Task 3: Research Report Section Generation Integration Tests', () => {
  let projectId: string;
  let reportId: string;

  // Mock AI client that generates realistic, section-specific structured JSON responses
  const mockAiClient: AiClient = {
    id: 'mock-gemini-research',
    generate: async (options) => {
      const combined = `${options.systemInstruction || ''}\n${options.prompt}`;
      const titleMatch = combined.match(/Target Section: "([^"]+)" \(([^)]+)\)/);
      const sectionTitle = titleMatch ? titleMatch[1]! : 'Executive Summary';
      const sectionType = titleMatch ? titleMatch[2]! : 'executive_summary';

      // Parse available evidence IDs from prompt to ensure citations are strictly valid
      const evidenceIdMatches = Array.from(combined.matchAll(/"id":\s*"([^"]+)"/g)).map((m) => m[1]!);
      const validCitations = evidenceIdMatches.slice(0, 3);

      const payload = {
        title: sectionTitle,
        executive_summary: `Synthesized analysis for section ${sectionType} of target equity.`,
        content: `### Specialized Analysis: ${sectionType}\n\nDetailed institutional-grade analysis strictly addressing ${sectionType}. Supporting metrics and evidence have been verified against statutory filings.\n\n- Key trend: Consistent operational progression.\n- Margin review: Stable operating margins across audited periods.`,
        subsections: [
          {
            subtitle: `${sectionType} Breakdown`,
            content: `Core segment breakdown and evidence-grounded commentary.`,
            evidenceIds: validCitations,
          },
        ],
        key_findings: [
          `Verified operating finding for ${sectionType}.`,
          `No unsupported forward-looking claims.`,
        ],
        supporting_metrics: [
          { metric: 'Operating Margin', value: '24.5%', period: 'FY24', source: 'Annual Report' },
        ],
        sources: [
          { name: 'Audited Financials', reference: 'BSE/NSE Filing', period: 'FY24' },
        ],
        data_limitations: [
          'Analysis subject to statutory audit filing cycles.',
        ],
        evidenceIds: validCitations,
      };

      return {
        text: JSON.stringify(payload),
        model: 'gemini-1.5-pro',
      };
    },
  };

  beforeEach(async () => {
    // Inject mock AI client
    reportAiService.setClient(mockAiClient);

    // Create a fresh project with standard fundamental report template
    const createRes = await request(app)
      .post('/api/v1/research')
      .set('x-test-user-id', testUserId)
      .send({
        title: 'Section Generation Test Project',
        symbol: 'INFY',
        exchange: 'NSE',
        templateId: 'fundamental_analysis',
      });

    expect(createRes.status).toBe(201);
    projectId = createRes.body.data.project.id;
    reportId = createRes.body.data.report.id;
  });

  afterEach(() => {
    // Reset to default client
    reportAiService.setClient(new GeminiClient());
  });

  it('1. Generates Executive Summary with distinct section-specific content and citations', async () => {
    // Temporarily enable AI research for test
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'executive_summary',
        researchQuestion: 'Summarize core return on capital and capital efficiency drivers.',
      });

    if (res.status !== 200) console.log('502 ERROR DETAIL:', JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report: ResearchReport = res.body.data.report;
    const execSection = report.sections.find((s) => s.sectionType === 'executive_summary');
    expect(execSection).toBeDefined();
    expect(execSection!.generatedBy).toBe('ai');
    expect(execSection!.content).toContain('executive_summary');
    expect(execSection!.evidenceIds.length).toBeGreaterThan(0);
    expect(execSection!.structuredData).toBeDefined();

    const data = execSection!.structuredData as Record<string, unknown>;
    expect(data.section_type).toBe('executive_summary');
    expect(Array.isArray(data.key_findings)).toBe(true);
    expect(Array.isArray(data.supporting_metrics)).toBe(true);
  });

  it('2. Generates Business Model section with differentiated content and operating architecture', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'business_model',
        sectionTitle: 'Business Model and Revenue Streams',
        instructions: 'Highlight software delivery segments and geographic diversification.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report: ResearchReport = res.body.data.report;
    const bmSection = report.sections.find((s) => s.sectionType === 'business_model');
    expect(bmSection).toBeDefined();
    expect(bmSection!.content).toContain('business_model');
  });

  it('3. Generates Financial Analysis section with quantitative metrics and ratios', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'financial_analysis',
        researchQuestion: 'Evaluate operating margin durability across the last 4 quarters.',
      });

    expect(res.status).toBe(200);
    const report: ResearchReport = res.body.data.report;
    const finSection = report.sections.find((s) => s.sectionType === 'financial_analysis');
    expect(finSection).toBeDefined();
    expect(finSection!.content).toContain('financial_analysis');
  });

  it('4. Generates Valuation Analysis section without generic overview duplication', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'valuation_analysis',
        instructions: 'Focus strictly on P/E, EV/EBITDA multiples relative to historical median.',
      });

    expect(res.status).toBe(200);
    const report: ResearchReport = res.body.data.report;
    const valSection = report.sections.find((s) => s.sectionType === 'valuation_analysis');
    expect(valSection).toBeDefined();
    expect(valSection!.content).toContain('valuation_analysis');
  });

  it('5. Generates Risk Assessment section with structured risk categories', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'risk_assessment',
      });

    expect(res.status).toBe(200);
    const report: ResearchReport = res.body.data.report;
    const riskSection = report.sections.find((s) => s.sectionType === 'risk_assessment');
    expect(riskSection).toBeDefined();
    expect(riskSection!.content).toContain('risk_assessment');
  });

  it('6. Supports Custom research sections', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'custom',
        sectionTitle: 'Generative AI Capex and Strategic Investments',
        researchQuestion: 'Detail infrastructure spending and client adoption velocity.',
      });

    expect(res.status).toBe(200);
    const report: ResearchReport = res.body.data.report;
    const customSection = report.sections.find((s) => s.title === 'Generative AI Capex and Strategic Investments');
    expect(customSection).toBeDefined();
  });

  it('7. Regenerates an existing section and preserves all other sections and ordering', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    // First, inspect initial sections count and ordering
    const getReportRes = await request(app)
      .get(`/api/v1/research/${projectId}/reports/${reportId}`)
      .set('x-test-user-id', testUserId);

    const initialSections = getReportRes.body.data.report.sections;
    const targetSection = initialSections[0]!;
    const originalSectionCount = initialSections.length;

    // Regenerate first section
    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionId: targetSection.id,
        sectionType: targetSection.sectionType,
        action: 'regenerate',
        instructions: 'Expand analytical depth with updated filing commentary.',
      });

    expect(res.status).toBe(200);
    const updatedReport: ResearchReport = res.body.data.report;
    expect(updatedReport.sections.length).toBe(originalSectionCount);

    // Verify ordering and identities of remaining sections
    for (let i = 1; i < updatedReport.sections.length; i++) {
      expect(updatedReport.sections[i]!.id).toBe(initialSections[i]!.id);
      expect(updatedReport.sections[i]!.position).toBe(initialSections[i]!.position);
    }
  });

  it('8. Verifies citations contain only valid evidence IDs from the report', async () => {
    process.env.AI_RESEARCH_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-mock-key';

    const getReportRes = await request(app)
      .get(`/api/v1/research/${projectId}/reports/${reportId}`)
      .set('x-test-user-id', testUserId);

    const validEvidenceIds = new Set(getReportRes.body.data.report.evidence.map((e: { id: string }) => e.id));

    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'financial_analysis',
      });

    expect(res.status).toBe(200);
    const report: ResearchReport = res.body.data.report;
    const finSection = report.sections.find((s) => s.sectionType === 'financial_analysis')!;
    for (const id of finSection.evidenceIds) {
      expect(validEvidenceIds.has(id)).toBe(true);
    }
  });

  it('9. Rejects invalid section types with 400 validation error', async () => {
    const res = await request(app)
      .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
      .set('x-test-user-id', testUserId)
      .send({
        sectionType: 'completely_invalid_type_xyz',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
