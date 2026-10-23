import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { alertConditionEvaluator } from '../src/alerts/evaluators/alertConditionEvaluator.js';
import { memoryAlertStore, alertRepository } from '../src/alerts/repositories/alertRepository.js';
import { memoryNotificationStore, notificationRepository } from '../src/notifications/repositories/notificationRepository.js';
import { alertEvaluationService } from '../src/alerts/services/alertEvaluationService.js';
import type {
  AlertRule,
  NormalizedQuote,
  FinancialAnalysis,
  CorporateAnnouncement,
  FinancialMetric,
} from '@equitylensai/shared';

describe('Phase 9: Alerts & Notifications System', () => {
  const app = createApp();

  beforeEach(() => {
    memoryAlertStore.clear();
    memoryNotificationStore.clear();
  });

  // ==============================================================
  // 1. Alert Condition Evaluator Unit Tests
  // ==============================================================
  describe('AlertConditionEvaluator (Deterministic Engine)', () => {
    const baseRule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
      id: 'test-rule-1',
      userId: 'user-1',
      name: 'TCS Price Alert',
      alertType: 'price',
      symbol: 'TCS',
      exchange: 'NSE',
      ruleConfig: {
        type: 'price',
        condition: 'rises_above',
        targetPrice: 4000,
      },
      enabled: true,
      cooldownMinutes: 60,
      lastEvaluatedAt: null,
      lastObservationAt: null,
      lastObservedValue: null,
      lastTriggeredAt: null,
      lastState: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    const mockQuote = (price: number, overrides: Partial<NormalizedQuote> = {}): NormalizedQuote => ({
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      exchange: 'NSE',
      market: 'nse',
      assetType: 'equity',
      price,
      change: 20,
      changePercent: 0.5,
      open: 4000,
      high: 4060,
      low: 3990,
      previousClose: 3980,
      volume: 100000,
      currency: 'INR',
      observedAt: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      freshness: 'live',
      isStale: false,
      source: 'test-provider',
      ...overrides,
    });

    it('establishes baseline state on initial evaluation of crossing alert without false trigger', () => {
      const rule = baseRule({
        ruleConfig: { type: 'price', condition: 'crosses_above', targetPrice: 4000 },
        lastState: null,
      });
      const quote = mockQuote(4050);

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(false);
      expect(outcome.skipped).toBe(false);
      expect(outcome.newState).toBe('above');
    });

    it('triggers crosses_above when price transitions from below to above threshold', () => {
      const rule = baseRule({
        ruleConfig: { type: 'price', condition: 'crosses_above', targetPrice: 4000 },
        lastState: 'below',
      });
      const quote = mockQuote(4010);

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(true);
      expect(outcome.newState).toBe('above');
      expect(outcome.title).toContain('crossed above');
    });

    it('does NOT trigger crosses_above if previous state was already above threshold', () => {
      const rule = baseRule({
        ruleConfig: { type: 'price', condition: 'crosses_above', targetPrice: 4000 },
        lastState: 'above',
      });
      const quote = mockQuote(4050);

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(false);
      expect(outcome.newState).toBe('above');
    });

    it('triggers crosses_below when price transitions from above to below threshold', () => {
      const rule = baseRule({
        ruleConfig: { type: 'price', condition: 'crosses_below', targetPrice: 4000 },
        lastState: 'above',
      });
      const quote = mockQuote(3980);

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(true);
      expect(outcome.newState).toBe('below');
      expect(outcome.title).toContain('crossed below');
    });

    it('skips evaluation safely when market quote is stale', () => {
      const rule = baseRule();
      const quote = mockQuote(4100, { isStale: true, freshness: 'stale' });

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(false);
      expect(outcome.skipped).toBe(true);
      expect(outcome.reason).toContain('stale');
    });

    it('skips evaluation safely when price quote is missing or null', () => {
      const rule = baseRule();
      const outcome = alertConditionEvaluator.evaluate(rule, { quote: undefined });
      expect(outcome.triggered).toBe(false);
      expect(outcome.skipped).toBe(true);
    });

    it('suppresses persistent condition alert during active cooldown window', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const rule = baseRule({
        ruleConfig: { type: 'price', condition: 'rises_above', targetPrice: 4000 },
        lastState: 'above',
        lastTriggeredAt: tenMinutesAgo,
        cooldownMinutes: 60,
      });
      const quote = mockQuote(4050);

      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.triggered).toBe(false);
      expect(outcome.reason).toContain('cooldown');
    });

    it('triggers percentage change alerts accurately based on session baseline', () => {
      const rule = baseRule({
        alertType: 'percentage_change',
        ruleConfig: {
          type: 'percentage_change',
          period: '1d',
          targetPercent: 3.5,
          direction: 'up',
        },
      });

      const quotePass = mockQuote(100, { changePercent: 4.2 });
      const passOutcome = alertConditionEvaluator.evaluate(rule, { quote: quotePass });
      expect(passOutcome.triggered).toBe(true);
      expect(passOutcome.title).toContain('+4.20%');

      const quoteFail = mockQuote(100, { changePercent: 2.1 });
      const failOutcome = alertConditionEvaluator.evaluate(rule, { quote: quoteFail });
      expect(failOutcome.triggered).toBe(false);
    });

    it('rejects unsupported percentage change periods safely', () => {
      const rule = baseRule({
        alertType: 'percentage_change',
        ruleConfig: {
          type: 'percentage_change',
          // @ts-expect-error testing unsupported period runtime rejection
          period: '1y',
          targetPercent: 10,
          direction: 'up',
        },
      });
      const quote = mockQuote(100, { changePercent: 12 });
      const outcome = alertConditionEvaluator.evaluate(rule, { quote });
      expect(outcome.skipped).toBe(true);
    });

    it('evaluates volume alerts accurately when volume exceeds threshold', () => {
      const rule = baseRule({
        alertType: 'volume',
        ruleConfig: { type: 'volume', condition: 'exceeds', targetVolume: 500000 },
      });

      const highVolQuote = mockQuote(100, { volume: 750000 });
      const outcome = alertConditionEvaluator.evaluate(rule, { quote: highVolQuote });
      expect(outcome.triggered).toBe(true);
      expect(outcome.title).toContain('Volume Alert: Exceeded 500,000');

      const lowVolQuote = mockQuote(100, { volume: 300000 });
      const failOutcome = alertConditionEvaluator.evaluate(rule, { quote: lowVolQuote });
      expect(failOutcome.triggered).toBe(false);
    });

    it('evaluates financial metric alerts (e.g. ROE > 15%) without fabricating missing values', () => {
      const rule = baseRule({
        alertType: 'financial_metric',
        ruleConfig: {
          type: 'financial_metric',
          metric: 'roe',
          operator: 'gt',
          thresholdValue: 15,
        },
      });

      const metric = (val: number | null): FinancialMetric => ({
        value: val,
        formula: '',
        unit: 'percent',
        periodEndDate: '2025-03-31',
        isBlended: false,
      });

      const mockFinancials = {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        currency: 'INR',
        latestAnnual: {
          periodEndDate: '2025-03-31',
          cashFlow: { freeCashFlow: 35000 },
        },
        profitability: {
          returnOnEquity: metric(24.5),
          returnOnCapitalEmployed: metric(28.0),
          operatingMargin: metric(25.1),
          netMargin: metric(19.3),
        },
        liquidity: { currentRatio: metric(2.1) },
        leverage: { debtToEquity: metric(0.05) },
        valuation: {
          peRatio: metric(26.5),
          priceToBook: metric(8.2),
        },
      } as unknown as FinancialAnalysis;

      const outcome = alertConditionEvaluator.evaluate(rule, { financials: mockFinancials });
      expect(outcome.triggered).toBe(true);
      expect(outcome.title).toContain('roe > 15');
      expect(outcome.message).toContain('FY2025');

      // Missing metric should not be treated as 0
      const missingRoeFinancials = {
        ...mockFinancials,
        profitability: {
          returnOnEquity: metric(null),
        },
      } as unknown as FinancialAnalysis;
      const missingOutcome = alertConditionEvaluator.evaluate(rule, { financials: missingRoeFinancials });
      expect(missingOutcome.triggered).toBe(false);
      expect(missingOutcome.skipped).toBe(true);
    });

    it('matches corporate announcement alerts for specific stock and category', () => {
      const rule = baseRule({
        alertType: 'announcement',
        ruleConfig: {
          type: 'announcement',
          scope: 'stock',
          categories: ['dividend', 'financial_results'],
        },
      });

      const announcements: CorporateAnnouncement[] = [
        {
          id: 'ann-1',
          providerId: 'bse',
          symbol: 'TCS',
          companyName: 'Tata Consultancy Services',
          exchange: 'NSE',
          title: 'Declaration of Interim Dividend',
          category: 'dividend',
          description: 'Dividend of Rs 10 per share declared',
          publishedAt: new Date().toISOString(),
          sourceUrl: 'https://bseindia.com/filing/123',
          retrievedAt: new Date().toISOString(),
        },
      ];

      const outcome = alertConditionEvaluator.evaluate(rule, { announcements });
      expect(outcome.triggered).toBe(true);
      expect(outcome.title).toContain('Official Announcement: Tata Consultancy Services');
      expect(outcome.message).toContain('Declaration of Interim Dividend');
      expect(outcome.deduplicationKey).toBe('ann_test-rule-1_ann-1');
    });
  });

  // ==============================================================
  // 2. Multi-User Isolation & Authorization Tests
  // ==============================================================
  describe('Multi-User Isolation & Security', () => {
    it('prevents User A from viewing or modifying User B alert rules and notifications', async () => {
      // User B creates an alert
      const ruleB = await alertRepository.createRule({
        id: 'rule-user-b',
        userId: 'user-b',
        name: 'Secret Alert B',
        alertType: 'price',
        symbol: 'INFY',
        exchange: 'NSE',
        ruleConfig: { type: 'price', condition: 'rises_above', targetPrice: 2000 },
        enabled: true,
        cooldownMinutes: 60,
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        lastState: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // User B receives a notification
      await notificationRepository.createNotification({
        id: 'notif-user-b',
        userId: 'user-b',
        category: 'price_alert',
        title: 'INFY Cross Alert',
        message: 'INFY has crossed 2000',
        read: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      });

      // User A attempts to read User B's alert rule -> 404
      const getRes = await request(app)
        .get(`/api/v1/alerts/${ruleB.id}`)
        .set('x-test-user-id', 'user-a');
      expect(getRes.status).toBe(404);

      // User A attempts to update User B's alert rule -> 404
      const patchRes = await request(app)
        .patch(`/api/v1/alerts/${ruleB.id}`)
        .set('x-test-user-id', 'user-a')
        .send({ name: 'Hacked Alert' });
      expect(patchRes.status).toBe(404);

      // User A attempts to delete User B's alert rule -> 404
      const delRes = await request(app)
        .delete(`/api/v1/alerts/${ruleB.id}`)
        .set('x-test-user-id', 'user-a');
      expect(delRes.status).toBe(404);

      // User A listing alerts only sees User A alerts
      const listRes = await request(app)
        .get('/api/v1/alerts')
        .set('x-test-user-id', 'user-a');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.rules).toHaveLength(0);

      // User A attempting to mark User B notification as read -> 404
      const notifRes = await request(app)
        .patch('/api/v1/notifications/notif-user-b/read')
        .set('x-test-user-id', 'user-a');
      expect(notifRes.status).toBe(404);
    });

    it('enforces idempotency on alert event creation using deduplication key', async () => {
      const event = {
        id: 'event-1',
        ruleId: 'rule-1',
        userId: 'user-1',
        alertType: 'price' as const,
        symbol: 'TCS',
        exchange: 'NSE' as const,
        triggerTimestamp: new Date().toISOString(),
        observedValue: 4050,
        thresholdContext: { target: 4000 },
        source: 'Test',
        deduplicationKey: 'unique_price_tcs_20261023',
        status: 'triggered' as const,
        createdAt: new Date().toISOString(),
      };

      const first = await alertRepository.createEvent(event);
      expect(first.created).toBe(true);

      // Second attempt with exact same deduplicationKey returns created: false
      const second = await alertRepository.createEvent({
        ...event,
        id: 'event-2', // different event id, same dedup key
      });
      expect(second.created).toBe(false);
      expect(second.event.id).toBe('event-1');
    });
  });

  // ==============================================================
  // 3. API Endpoints Integration Tests
  // ==============================================================
  describe('Alerts & Notifications API Routes', () => {
    it('GET /api/v1/alerts/supported-types returns approved types, metrics, and operators', async () => {
      const res = await request(app).get('/api/v1/alerts/supported-types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alertTypes).toContain('price');
      expect(res.body.data.alertTypes).toContain('financial_metric');
      expect(res.body.data.priceConditions).toContain('crosses_above');
      expect(res.body.data.financialMetrics).toContain('roe');
      expect(res.body.data.financialMetrics).toContain('debtToEquity');
    });

    it('POST /api/v1/alerts validates schema, rejects invalid payloads, and creates valid rules', async () => {
      // Missing symbol for price alert -> 400
      const invalidRes = await request(app)
        .post('/api/v1/alerts')
        .set('x-test-user-id', 'user-1')
        .send({
          name: 'Invalid Alert',
          alertType: 'price',
          ruleConfig: { type: 'price', condition: 'crosses_above', targetPrice: -50 }, // negative price!
        });
      expect(invalidRes.status).toBe(400);

      // Valid price alert creation
      const validRes = await request(app)
        .post('/api/v1/alerts')
        .set('x-test-user-id', 'user-1')
        .send({
          name: 'RELIANCE Cross ₹3,000',
          alertType: 'price',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          cooldownMinutes: 120,
          ruleConfig: {
            type: 'price',
            condition: 'crosses_above',
            targetPrice: 3000,
          },
        });
      expect(validRes.status).toBe(201);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.data.name).toBe('RELIANCE Cross ₹3,000');
      expect(validRes.body.data.symbol).toBe('RELIANCE');
      expect(validRes.body.data.enabled).toBe(true);

      const alertId = validRes.body.data.id;

      // GET /api/v1/alerts/:alertId
      const getRes = await request(app)
        .get(`/api/v1/alerts/${alertId}`)
        .set('x-test-user-id', 'user-1');
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(alertId);

      // POST /api/v1/alerts/:alertId/disable
      const disableRes = await request(app)
        .post(`/api/v1/alerts/${alertId}/disable`)
        .set('x-test-user-id', 'user-1');
      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.enabled).toBe(false);

      // POST /api/v1/alerts/:alertId/enable
      const enableRes = await request(app)
        .post(`/api/v1/alerts/${alertId}/enable`)
        .set('x-test-user-id', 'user-1');
      expect(enableRes.status).toBe(200);
      expect(enableRes.body.data.enabled).toBe(true);

      // DELETE /api/v1/alerts/:alertId
      const delRes = await request(app)
        .delete(`/api/v1/alerts/${alertId}`)
        .set('x-test-user-id', 'user-1');
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);
    });

    it('manages in-app notifications lifecycle: list, unread count, mark read, mark all read', async () => {
      // Seed notifications for user-1
      await notificationRepository.createNotification({
        id: 'n-1',
        userId: 'user-1',
        category: 'price_alert',
        title: 'TCS Crossed 4000',
        message: 'TCS price crossed above 4000',
        read: false,
        readAt: null,
        symbol: 'TCS',
        exchange: 'NSE',
        createdAt: new Date().toISOString(),
      });
      await notificationRepository.createNotification({
        id: 'n-2',
        userId: 'user-1',
        category: 'announcement_alert',
        title: 'INFY Dividend',
        message: 'Interim dividend declared',
        read: false,
        readAt: null,
        symbol: 'INFY',
        exchange: 'NSE',
        createdAt: new Date().toISOString(),
      });

      // GET /api/v1/notifications/unread-count
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('x-test-user-id', 'user-1');
      expect(countRes.status).toBe(200);
      expect(countRes.body.data.unreadCount).toBe(2);

      // GET /api/v1/notifications (list)
      const listRes = await request(app)
        .get('/api/v1/notifications')
        .set('x-test-user-id', 'user-1');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(2);

      // PATCH /api/v1/notifications/:id/read
      const readOneRes = await request(app)
        .patch('/api/v1/notifications/n-1/read')
        .set('x-test-user-id', 'user-1');
      expect(readOneRes.status).toBe(200);

      // Unread count should now be 1
      const countAfter = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('x-test-user-id', 'user-1');
      expect(countAfter.body.data.unreadCount).toBe(1);

      // PATCH /api/v1/notifications/read-all
      const readAllRes = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('x-test-user-id', 'user-1');
      expect(readAllRes.status).toBe(200);

      // Unread count should now be 0
      const countFinal = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('x-test-user-id', 'user-1');
      expect(countFinal.body.data.unreadCount).toBe(0);
    });

    it('GET & PATCH /api/v1/notifications/preferences manages user alert delivery preferences', async () => {
      const getPref = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('x-test-user-id', 'user-pref');
      expect(getPref.status).toBe(200);
      expect(getPref.body.data.inAppEnabled).toBe(true);
      expect(getPref.body.data.emailEnabled).toBe(false);

      const patchPref = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('x-test-user-id', 'user-pref')
        .send({
          inAppEnabled: true,
          emailEnabled: true,
          emailAddress: 'investor@equitylensai.com',
          priceAlerts: true,
        });
      expect(patchPref.status).toBe(200);
      expect(patchPref.body.data.emailAddress).toBe('investor@equitylensai.com');
      expect(patchPref.body.data.emailEnabled).toBe(true);
    });

    it('POST /api/v1/alerts/preview evaluates proposed rule configuration without creating events', async () => {
      const previewRes = await request(app)
        .post('/api/v1/alerts/preview')
        .set('x-test-user-id', 'user-1')
        .send({
          name: 'Preview TCS',
          alertType: 'price',
          symbol: 'TCS',
          exchange: 'NSE',
          ruleConfig: {
            type: 'price',
            condition: 'rises_above',
            targetPrice: 100, // TCS is ~4000+, so should be satisfied
          },
        });
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data).toHaveProperty('currentObservation');
      expect(previewRes.body.data).toHaveProperty('conditionSatisfied');

      // Verify no events or notifications were created
      const events = await alertRepository.listEventsByUser('user-1');
      expect(events).toHaveLength(0);
    });

    it('POST /api/v1/alerts/evaluate runs background evaluation cycle and updates telemetry', async () => {
      // Create a test rule
      await alertRepository.createRule({
        id: 'eval-rule-1',
        userId: 'user-eval',
        name: 'Evaluation Test',
        alertType: 'price',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        ruleConfig: {
          type: 'price',
          condition: 'rises_above',
          targetPrice: 10, // will trigger
        },
        enabled: true,
        cooldownMinutes: 60,
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        lastState: 'below',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const evalRes = await request(app)
        .post('/api/v1/alerts/evaluate')
        .set('x-test-user-id', 'user-eval');

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.data.evaluatedCount).toBeGreaterThanOrEqual(1);

      // Verify scheduler status endpoint
      const statusRes = await request(app)
        .get('/api/v1/alerts/scheduler-status')
        .set('x-test-user-id', 'user-eval');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data).toHaveProperty('lastRunAt');
    });
  });
});
