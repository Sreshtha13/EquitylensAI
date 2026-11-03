import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('POST /api/v1/ai/comparison-analysis Comprehensive Integration Tests', { timeout: 60000 }, () => {
  const app = createApp();

  it('generates the complete 10-section comparative analysis with structured metrics', async () => {
    const res = await request(app)
      .post('/api/v1/ai/comparison-analysis')
      .send({
        symbols: [
          { symbol: 'TCS', exchange: 'NSE' },
          { symbol: 'INFY', exchange: 'NSE' },
        ],
        period: 'annual',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;

    // 1. Core Summary & Metadata
    expect(data.summary).toBeDefined();
    expect(data.comparison_summary).toBeDefined();
    expect(data.disclaimer).toContain('research purposes');
    expect(data.generatedAt).toBeDefined();
    expect(data.model).toBeDefined();

    // 2. Both Companies present
    expect(data.companies).toHaveLength(2);
    expect(data.companies[0].symbol).toBe('TCS');
    expect(data.companies[1].symbol).toBe('INFY');

    // 3. Ten Structured Analytical Categories
    expect(data.business_comparison).toBeDefined();
    expect(data.business_comparison.analysis).toBeDefined();
    expect(data.business_comparison.comparative_conclusion).toBeDefined();

    expect(data.growth_comparison).toBeDefined();
    expect(data.growth_comparison.company_a_metrics).toBeDefined();
    expect(data.growth_comparison.company_b_metrics).toBeDefined();

    expect(data.profitability_comparison).toBeDefined();
    expect(data.profitability_comparison.evidence).toBeInstanceOf(Array);

    expect(data.financial_health).toBeDefined();
    expect(data.financial_health.data_availability).toBeDefined();

    expect(data.valuation_comparison).toBeDefined();
    expect(data.stock_performance).toBeDefined();
    expect(data.dividend_comparison).toBeDefined();
    expect(data.risk_comparison).toBeDefined();

    // 4. Category-by-Category Winners & Final Assessment
    expect(data.category_winners).toBeDefined();
    expect(data.category_winners.profitability).toBeDefined();
    expect(data.category_winners.valuation).toBeDefined();
    expect(data.category_winners.business_model).toBeDefined();

    expect(data.final_assessment).toBeDefined();
    expect(data.final_assessment.overall_takeaway).toBeDefined();
    expect(data.final_assessment.key_advantages).toBeDefined();
    expect(data.final_assessment.key_disadvantages).toBeDefined();
    expect(data.final_assessment.trade_offs).toBeInstanceOf(Array);
    expect(data.final_assessment.inconclusive_areas).toBeInstanceOf(Array);

    // 5. Data Sources & Limitations
    expect(data.data_sources).toBeInstanceOf(Array);
    expect(data.data_sources.length).toBeGreaterThan(0);
    expect(data.data_limitations).toBeInstanceOf(Array);

    // 6. Backward Compatibility for 10 Sections
    expect(data.sections).toHaveLength(10);
    const titles = data.sections.map((s: { title: string }) => s.title);
    expect(titles[0]).toContain('Executive Summary');
    expect(titles[1]).toContain('Business Comparison');
    expect(titles[2]).toContain('Growth Comparison');
    expect(titles[3]).toContain('Profitability Comparison');
    expect(titles[4]).toContain('Financial Health');
    expect(titles[5]).toContain('Valuation Comparison');
    expect(titles[6]).toContain('Stock Performance');
    expect(titles[7]).toContain('Dividend Comparison');
    expect(titles[8]).toContain('Risk Comparison');
    expect(titles[9]).toContain('Final Comparative Assessment');
  });

  it('rejects comparisons with fewer than 2 companies', async () => {
    const res = await request(app)
      .post('/api/v1/ai/comparison-analysis')
      .send({
        symbols: [{ symbol: 'TCS', exchange: 'NSE' }],
        period: 'annual',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles missing metrics without fabricating zero', async () => {
    const res = await request(app)
      .post('/api/v1/ai/comparison-analysis')
      .send({
        symbols: [
          { symbol: 'TATAMOTORS', exchange: 'NSE' },
          { symbol: 'MARUTI', exchange: 'NSE' },
        ],
        period: 'annual',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.companies).toHaveLength(2);
    // Data limitations tracks missing data
    expect(res.body.data.data_limitations).toBeInstanceOf(Array);
  });

  it('supports TTM period reporting', async () => {
    const res = await request(app)
      .post('/api/v1/ai/comparison-analysis')
      .send({
        symbols: [
          { symbol: 'HDFCBANK', exchange: 'NSE' },
          { symbol: 'ICICIBANK', exchange: 'NSE' },
        ],
        period: 'ttm',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profitability_comparison.reporting_period).toBe('TTM');
  });
});
