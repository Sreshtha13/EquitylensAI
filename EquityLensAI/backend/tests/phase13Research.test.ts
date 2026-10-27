import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';
import {
  memoryResearchProjectStore,
  memoryResearchReportStore,
  memoryResearchNoteStore,
} from '../src/research/repositories/index.js';

const app = createApp();

describe('Phase 13: Research Workbench, Investment Reports & Exportable Analysis', () => {
  const userAId = 'usr-phase13-test-a';
  const userBId = 'usr-phase13-test-b';

  beforeEach(() => {
    resetEnvCache();
    loadEnv({
      NODE_ENV: 'test',
    });
    memoryResearchProjectStore.clear();
    memoryResearchReportStore.clear();
    memoryResearchNoteStore.clear();
  });

  // ─── 1. Templates ──────────────────────────────────────────────────────────

  describe('Report Templates (GET /api/v1/research/templates)', () => {
    it('returns all 8 institutional report templates with descriptions and sections', async () => {
      const res = await request(app)
        .get('/api/v1/research/templates')
        .set('x-test-user-id', userAId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.templates)).toBe(true);
      expect(res.body.data.templates).toHaveLength(8);

      const templateIds = res.body.data.templates.map((t: any) => t.id);
      expect(templateIds).toContain('fundamental_analysis');
      expect(templateIds).toContain('financial_statement_review');
      expect(templateIds).toContain('valuation_multiples');
      expect(templateIds).toContain('peer_comparison');
      expect(templateIds).toContain('growth_profitability');
      expect(templateIds).toContain('financial_risk');
      expect(templateIds).toContain('announcement_impact');
      expect(templateIds).toContain('comprehensive_research');

      const fundamental = res.body.data.templates.find((t: any) => t.id === 'fundamental_analysis');
      expect(fundamental.name).toBe('Company Fundamental Analysis');
      expect(fundamental.defaultSections.length).toBeGreaterThan(3);
      expect(fundamental.supportedDataSources.length).toBeGreaterThan(0);
    });

    it('rejects unauthenticated requests to templates', async () => {
      const res = await request(app).get('/api/v1/research/templates');
      expect(res.status).toBe(401);
    });
  });

  // ─── 2. Research Projects & Multi-User Isolation ───────────────────────────

  describe('Research Projects CRUD & Multi-User Isolation', () => {
    it('creates, retrieves, updates, and deletes research projects with strict user scoping', async () => {
      // Create Project as User A
      const createRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'Reliance Industries Deep Dive',
          description: 'Long term fundamental research and petrochemical/retail margin trends',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          companyName: 'Reliance Industries Limited',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const project = createRes.body.data.project;
      expect(project.id).toBeDefined();
      expect(project.title).toBe('Reliance Industries Deep Dive');
      expect(project.symbol).toBe('RELIANCE');
      expect(project.exchange).toBe('NSE');
      expect(project.status).toBe('draft');

      // List Projects as User A
      const listResA = await request(app)
        .get('/api/v1/research')
        .set('x-test-user-id', userAId);

      expect(listResA.status).toBe(200);
      expect(listResA.body.data.projects).toHaveLength(1);
      expect(listResA.body.data.projects[0].id).toBe(project.id);

      // Verify User B cannot see User A's project
      const listResB = await request(app)
        .get('/api/v1/research')
        .set('x-test-user-id', userBId);

      expect(listResB.status).toBe(200);
      expect(listResB.body.data.projects).toHaveLength(0);

      // Verify User B cannot access User A's project directly (404)
      const getResB = await request(app)
        .get(`/api/v1/research/${project.id}`)
        .set('x-test-user-id', userBId);

      expect(getResB.status).toBe(404);

      // Update Project as User A
      const updateRes = await request(app)
        .patch(`/api/v1/research/${project.id}`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'Reliance Industries — Updated 2026 Thesis',
          status: 'in_progress',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.project.title).toBe('Reliance Industries — Updated 2026 Thesis');
      expect(updateRes.body.data.project.status).toBe('in_progress');

      // Delete Project as User A
      const deleteRes = await request(app)
        .delete(`/api/v1/research/${project.id}`)
        .set('x-test-user-id', userAId);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.deleted).toBe(true);

      // Verify it is gone
      const getAfterDelete = await request(app)
        .get(`/api/v1/research/${project.id}`)
        .set('x-test-user-id', userAId);

      expect(getAfterDelete.status).toBe(404);
    });

    it('creates project with initial report bootstrapped if templateId is provided', async () => {
      const res = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'TCS Fundamental Review',
          symbol: 'TCS',
          exchange: 'NSE',
          templateId: 'fundamental_analysis',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.project).toBeDefined();
      expect(res.body.data.report).toBeDefined();
      expect(res.body.data.report.templateId).toBe('fundamental_analysis');
      expect(res.body.data.report.sections.length).toBeGreaterThan(0);
    });

    it('rejects invalid symbols or empty titles', async () => {
      const res1 = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: '',
          symbol: 'RELIANCE',
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'Invalid Symbol Test',
          symbol: 'BAD TICKER$$$!@#',
        });
      expect(res2.status).toBe(400);
    });
  });

  // ─── 3. Structured Reports & Evidence Provenance ───────────────────────────

  describe('Report Lifecycle, Sections & Evidence Provenance', () => {
    let projectId: string;

    beforeEach(async () => {
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'Infosys Research Workbench',
          symbol: 'INFY',
          exchange: 'NSE',
          companyName: 'Infosys Limited',
        });
      projectId = projRes.body.data.project.id;
    });

    it('creates a structured report from a template with deterministic evidence and sections', async () => {
      const res = await request(app)
        .post(`/api/v1/research/${projectId}/reports`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'Infosys Institutional Fundamental Report',
          templateId: 'fundamental_analysis',
          includePeers: true,
          includeNews: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const report = res.body.data.report;
      expect(report.id).toBeDefined();
      expect(report.researchProjectId).toBe(projectId);
      expect(report.title).toBe('Infosys Institutional Fundamental Report');
      expect(report.templateId).toBe('fundamental_analysis');
      expect(report.status).toBe('draft');
      expect(report.version).toBe(1);

      // Verify sections were assembled
      expect(Array.isArray(report.sections)).toBe(true);
      expect(report.sections.length).toBeGreaterThan(4);

      const coverSec = report.sections.find((s: any) => s.sectionType === 'cover_metadata');
      expect(coverSec).toBeDefined();

      const execSec = report.sections.find((s: any) => s.sectionType === 'executive_summary');
      expect(execSec).toBeDefined();

      const finSec = report.sections.find((s: any) => s.sectionType === 'financial_analysis');
      expect(finSec).toBeDefined();

      // Verify Evidence Provenance Register
      expect(Array.isArray(report.evidence)).toBe(true);
      for (const ev of report.evidence) {
        expect(ev.id).toBeDefined();
        expect(ev.evidenceType).toBeDefined();
        expect(ev.sourceReference).toBeDefined();
      }
    });

    it('updates report sections and prevents concurrent modification conflicts with optimistic locking', async () => {
      const createRes = await request(app)
        .post(`/api/v1/research/${projectId}/reports`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'INFY Report v1',
          templateId: 'valuation_multiples',
        });

      const reportId = createRes.body.data.report.id;
      const initialVersion = createRes.body.data.report.version;

      // Update report with matching version
      const updateRes = await request(app)
        .patch(`/api/v1/research/${projectId}/reports/${reportId}`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'INFY Valuation Review — Finalized Analysis',
          version: initialVersion,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.report.title).toBe('INFY Valuation Review — Finalized Analysis');
      expect(updateRes.body.data.report.version).toBe(initialVersion + 1);

      // Attempt to update using the stale version (optimistic concurrency conflict)
      const conflictRes = await request(app)
        .patch(`/api/v1/research/${projectId}/reports/${reportId}`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'Concurrent Stale Edit',
          version: initialVersion, // Stale!
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.success).toBe(false);
      expect(conflictRes.body.error.code).toBe('CONCURRENT_MODIFICATION');
    });

    it('creates immutable version snapshots when finalizing or explicitly requested', async () => {
      const createRes = await request(app)
        .post(`/api/v1/research/${projectId}/reports`)
        .set('x-test-user-id', userAId)
        .send({
          title: 'INFY Versioned Report',
          templateId: 'financial_risk',
        });

      const reportId = createRes.body.data.report.id;

      // Finalize report (triggers snapshot)
      const finalizeRes = await request(app)
        .patch(`/api/v1/research/${projectId}/reports/${reportId}`)
        .set('x-test-user-id', userAId)
        .send({
          status: 'finalized',
          createSnapshot: true,
          snapshotNotes: 'Initial committee signed-off draft',
        });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.data.report.status).toBe('finalized');

      // Retrieve version history
      const versionsRes = await request(app)
        .get(`/api/v1/research/${projectId}/reports/${reportId}/versions`)
        .set('x-test-user-id', userAId);

      expect(versionsRes.status).toBe(200);
      expect(Array.isArray(resToVersions(versionsRes))).toBe(true);
      expect(resToVersions(versionsRes).length).toBeGreaterThanOrEqual(1);

      const latestVersion = resToVersions(versionsRes)[0];
      expect(latestVersion.versionNumber).toBe(1);
      expect(latestVersion.contentSnapshot).toBeDefined();
      expect(latestVersion.contentSnapshot.title).toBe('INFY Versioned Report');
    });
  });

  // ─── 4. Research Notes ─────────────────────────────────────────────────────

  describe('Research Notes & Tagging', () => {
    let projectId: string;

    beforeEach(async () => {
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'HDFC Bank Research',
          symbol: 'HDFCBANK',
          exchange: 'NSE',
        });
      projectId = projRes.body.data.project.id;
    });

    it('creates, lists, updates, and deletes analyst research notes with tags', async () => {
      // 1. Create Note
      const noteRes = await request(app)
        .post(`/api/v1/research/${projectId}/notes`)
        .set('x-test-user-id', userAId)
        .send({
          tag: 'risk',
          content: 'NIM compression due to higher cost of funds post merger.',
        });

      expect(noteRes.status).toBe(201);
      const note = noteRes.body.data.note;
      expect(note.id).toBeDefined();
      expect(note.tag).toBe('risk');
      expect(note.content).toContain('NIM compression');

      // 2. List Notes
      const listRes = await request(app)
        .get(`/api/v1/research/${projectId}/notes`)
        .set('x-test-user-id', userAId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.notes).toHaveLength(1);

      // 3. Update Note
      const updateRes = await request(app)
        .patch(`/api/v1/research/${projectId}/notes/${note.id}`)
        .set('x-test-user-id', userAId)
        .send({
          tag: 'observation',
          content: 'NIM stabilized at 3.4% in latest quarterly update.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.note.tag).toBe('observation');

      // 4. Delete Note
      const delRes = await request(app)
        .delete(`/api/v1/research/${projectId}/notes/${note.id}`)
        .set('x-test-user-id', userAId);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);
    });
  });

  // ─── 5. Report Refresh Workflow ────────────────────────────────────────────

  describe('Report Refresh Workflow (POST /api/v1/research/:researchId/reports/:reportId/refresh)', () => {
    it('refreshes report data against verified observations and returns structured diff', async () => {
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'TCS Refreshable Research',
          symbol: 'TCS',
          exchange: 'NSE',
          templateId: 'fundamental_analysis',
        });

      const projectId = projRes.body.data.project.id;
      const reportId = projRes.body.data.report.id;

      // Refresh report
      const refreshRes = await request(app)
        .post(`/api/v1/research/${projectId}/reports/${reportId}/refresh`)
        .set('x-test-user-id', userAId)
        .send({
          saveNewVersion: true,
          versionNotes: 'Quarterly review refresh',
        });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);

      const { report, diff } = refreshRes.body.data;
      expect(report.lastRefreshedAt).toBeDefined();
      expect(report.version).toBe(2);

      expect(diff).toBeDefined();
      expect(diff.reportId).toBe(reportId);
      expect(diff.changesSummary).toBeDefined();
      expect(Array.isArray(diff.affectedSections)).toBe(true);
    });
  });

  // ─── 6. PDF and CSV Exports ────────────────────────────────────────────────

  describe('PDF and CSV Report Exports', () => {
    let projectId: string;
    let reportId: string;

    beforeEach(async () => {
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'Export Test Project',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          templateId: 'comprehensive_research',
        });
      projectId = projRes.body.data.project.id;
      reportId = projRes.body.data.report.id;
    });

    it('exports a valid PDF report with correct headers and binary signature', async () => {
      const res = await request(app)
        .get(`/api/v1/research/${projectId}/reports/${reportId}/export/pdf`)
        .set('x-test-user-id', userAId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('.pdf');

      // Validate standard PDF magic number header "%PDF-"
      const isBuffer = Buffer.isBuffer(res.body);
      expect(isBuffer).toBe(true);
      const headerString = res.body.slice(0, 5).toString('ascii');
      expect(headerString).toBe('%PDF-');
    });

    it('exports a valid CSV file with formula-injection protection', async () => {
      // Add a note with potential formula characters
      await request(app)
        .post(`/api/v1/research/${projectId}/notes`)
        .set('x-test-user-id', userAId)
        .send({
          tag: 'risk',
          content: '=CMD|"/C calc"!A1 formula test',
        });

      const res = await request(app)
        .get(`/api/v1/research/${projectId}/reports/${reportId}/export/csv`)
        .set('x-test-user-id', userAId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csvText = res.text;

      expect(csvText).toContain('RELIANCE');
      expect(csvText).toContain('--- EVIDENCE & FINANCIAL METRICS REGISTER ---');
      expect(csvText).toContain('--- REPORT SECTIONS ---');

      // Verify formula injection protection: cell starting with '=' should be prepended with "'"
      expect(csvText).not.toContain(',=CMD');
      expect(csvText).toContain("'=CMD");
    });

    it('rejects export attempts from unauthorized users', async () => {
      const res = await request(app)
        .get(`/api/v1/research/${projectId}/reports/${reportId}/export/pdf`)
        .set('x-test-user-id', userBId);

      expect(res.status).toBe(404);
    });
  });

  // ─── 7. AI Drafting Error & Fallback Handling ─────────────────────────────

  describe('AI Section Drafting', () => {
    it('returns 503 when AI is not configured or disabled', async () => {
      resetEnvCache();
      loadEnv({
        NODE_ENV: 'test',
        AI_RESEARCH_ENABLED: 'false',
      });

      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'AI Drafting Test Project',
          symbol: 'TCS',
          exchange: 'NSE',
          templateId: 'fundamental_analysis',
        });

      const projectId = projRes.body.data.project.id;
      const reportId = projRes.body.data.report.id;

      const res = await request(app)
        .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
        .set('x-test-user-id', userAId)
        .send({
          sectionType: 'executive_summary',
          researchQuestion: 'Analyze recent operating margins',
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
    });

    it('rejects invalid section types', async () => {
      const projRes = await request(app)
        .post('/api/v1/research')
        .set('x-test-user-id', userAId)
        .send({
          title: 'Invalid Section Test',
          symbol: 'TCS',
          exchange: 'NSE',
          templateId: 'fundamental_analysis',
        });

      const projectId = projRes.body.data.project.id;
      const reportId = projRes.body.data.report.id;

      const res = await request(app)
        .post(`/api/v1/research/${projectId}/reports/${reportId}/generate-section`)
        .set('x-test-user-id', userAId)
        .send({
          sectionType: 'non_existent_section_type',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

function resToVersions(res: any) {
  return res.body.data.versions;
}
