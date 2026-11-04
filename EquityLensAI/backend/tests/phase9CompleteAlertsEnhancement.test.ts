import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertConditionEvaluator } from '../src/alerts/evaluators/alertConditionEvaluator.js';
import { calculateRsi, calculateMacd, calculateSma } from '../src/alerts/evaluators/technicalIndicators.js';
import { alertRepository } from '../src/alerts/repositories/alertRepository.js';
import { notificationRepository } from '../src/notifications/repositories/notificationRepository.js';
import { emailDeliveryService } from '../src/notifications/services/emailDeliveryService.js';
import { pushNotificationService } from '../src/notifications/services/pushNotificationService.js';
import { notificationService } from '../src/notifications/services/notificationService.js';
import type { AlertRule, NormalizedQuote, AppNotification, PriceCandle, UserAlertPreferences } from '@equitylensai/shared';
import type { Resend } from 'resend';

describe('Phase 9 Complete Alerts & Notifications Enhancement', () => {
  const userId = 'user-enhancement-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Part 1 & 2: Alert Condition Evaluation Engine', () => {
    it('evaluates price crosses above and arms on initial baseline without crossing', () => {
      const rule: AlertRule = {
        id: 'rule-price-1',
        userId,
        name: 'TCS Cross 4000',
        alertType: 'price',
        symbol: 'TCS',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        ruleConfig: {
          type: 'price',
          condition: 'crosses_above',
          targetPrice: 4000,
        },
        lastState: null,
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quoteInitial: NormalizedQuote = {
        symbol: 'TCS',
        exchange: 'NSE',
        price: 3950,
        change: 10,
        changePercent: 0.25,
        volume: 100000,
        high: 3980,
        low: 3940,
        open: 3945,
        previousClose: 3940,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      // Turn 1: initial baseline establishment -> armed, not triggered
      const eval1 = alertConditionEvaluator.evaluate(rule, { quote: quoteInitial });
      expect(eval1.triggered).toBe(false);
      expect(eval1.newState).toBe('below');

      // Update rule with lastState
      rule.lastState = eval1.newState;

      // Turn 2: price rises to 3990 (still below 4000) -> should not trigger
      const quoteBelow: NormalizedQuote = { ...quoteInitial, price: 3990 };
      const eval2 = alertConditionEvaluator.evaluate(rule, { quote: quoteBelow });
      expect(eval2.triggered).toBe(false);
      expect(eval2.newState).toBe('below');

      // Turn 3: price crosses above 4000 to 4015 -> MUST trigger!
      const quoteCrossed: NormalizedQuote = { ...quoteInitial, price: 4015 };
      const eval3 = alertConditionEvaluator.evaluate(rule, { quote: quoteCrossed });
      expect(eval3.triggered).toBe(true);
      expect(eval3.observedValue).toBe(4015);
      expect(eval3.title).toContain('TCS Price Alert');
      expect(eval3.message).toContain('crossed above');
    });

    it('evaluates price crosses below threshold correctly', () => {
      const rule: AlertRule = {
        id: 'rule-price-below',
        userId,
        name: 'INFY Cross Below 1500',
        alertType: 'price',
        symbol: 'INFY',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: 'above', // armed above 1500
        ruleConfig: {
          type: 'price',
          condition: 'crosses_below',
          targetPrice: 1500,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quoteBelow: NormalizedQuote = {
        symbol: 'INFY',
        exchange: 'NSE',
        price: 1485,
        change: -25,
        changePercent: -1.6,
        volume: 50000,
        high: 1530,
        low: 1480,
        open: 1525,
        previousClose: 1510,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const res = alertConditionEvaluator.evaluate(rule, { quote: quoteBelow });
      expect(res.triggered).toBe(true);
      expect(res.message).toContain('crossed below');
    });

    it('handles one-time trigger transition by returning newStatus: TRIGGERED', () => {
      const rule: AlertRule = {
        id: 'rule-one-time',
        userId,
        name: 'RELIANCE Breakout 3000',
        alertType: 'price',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'one_time',
        lastState: 'below',
        ruleConfig: {
          type: 'price',
          condition: 'crosses_above',
          targetPrice: 3000,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quote: NormalizedQuote = {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        price: 3010,
        change: 25,
        changePercent: 0.8,
        volume: 200000,
        high: 3015,
        low: 2980,
        open: 2985,
        previousClose: 2985,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const res = alertConditionEvaluator.evaluate(rule, { quote });
      expect(res.triggered).toBe(true);
      expect(res.newStatus).toBe('TRIGGERED');
    });

    it('rejects stale quote and skips alert evaluation', () => {
      const rule: AlertRule = {
        id: 'rule-stale-check',
        userId,
        name: 'HDFCBANK Alert',
        alertType: 'price',
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: 'below',
        ruleConfig: {
          type: 'price',
          condition: 'crosses_above',
          targetPrice: 1600,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const staleQuote: NormalizedQuote = {
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        price: 1650,
        change: 50,
        changePercent: 3.1,
        volume: 50000,
        high: 1655,
        low: 1590,
        open: 1600,
        previousClose: 1600,
        observedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'stale',
        isStale: true,
        source: 'mock',
      };

      const res = alertConditionEvaluator.evaluate(rule, { quote: staleQuote });
      expect(res.triggered).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.reason).toContain('stale');
    });

    it('skips evaluation for expired rules and marks newStatus EXPIRED', () => {
      const rule: AlertRule = {
        id: 'rule-expired',
        userId,
        name: 'Old Alert',
        alertType: 'price',
        symbol: 'SBIN',
        exchange: 'NSE',
        enabled: true,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
        cooldownMinutes: 60,
        triggerType: 'one_time',
        lastState: 'below',
        ruleConfig: {
          type: 'price',
          condition: 'crosses_above',
          targetPrice: 800,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quote: NormalizedQuote = {
        symbol: 'SBIN',
        exchange: 'NSE',
        price: 850,
        change: 10,
        changePercent: 1.2,
        volume: 10000,
        high: 855,
        low: 830,
        open: 835,
        previousClose: 840,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const res = alertConditionEvaluator.evaluate(rule, { quote });
      expect(res.triggered).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.newStatus).toBe('EXPIRED');
    });
  });

  describe('Technical Indicators & Advanced Categories', () => {
    const makeCandles = (count: number, basePrice: number, step: number): PriceCandle[] => {
      const now = Date.now();
      return Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(now - (count - i) * 86400000).toISOString(),
        open: basePrice + i * step - 0.5,
        high: basePrice + i * step + 1,
        low: basePrice + i * step - 1,
        close: basePrice + i * step,
        volume: 100000,
        adjustedClose: null,
      }));
    };

    it('calculates deterministic 14-period RSI', () => {
      const candles = makeCandles(25, 100, 2); // Strong uptrend
      const res = calculateRsi(candles, 14);
      expect(res).toBeDefined();
      expect(res?.currentRsi).toBeGreaterThan(70);
    });

    it('calculates MACD correctly with sorted PriceCandles', () => {
      const candles = makeCandles(45, 100, 1.5);
      const macd = calculateMacd(candles, 12, 26, 9);
      expect(macd).toBeDefined();
      expect(typeof macd!.macdLine).toBe('number');
      expect(typeof macd!.signalLine).toBe('number');
      expect(typeof macd!.histogram).toBe('number');
    });

    it('calculates SMA correctly with PriceCandles', () => {
      const candles = makeCandles(60, 100, 1);
      const sma = calculateSma(candles, 50);
      expect(sma).toBeDefined();
      expect(sma!.currentSma).toBeGreaterThan(100);
    });

    it('evaluates unusual volume threshold against baseline', () => {
      const rule: AlertRule = {
        id: 'rule-unusual-vol',
        userId,
        name: 'TATASTEEL Heavy Volume Spike',
        alertType: 'unusual_volume',
        symbol: 'TATASTEEL',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: null,
        ruleConfig: {
          type: 'unusual_volume',
          multiplier: 2.5,
          baselineDays: 20,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quote: NormalizedQuote = {
        symbol: 'TATASTEEL',
        exchange: 'NSE',
        price: 155,
        change: 4,
        changePercent: 2.6,
        volume: 3000000, // 3M shares
        high: 157,
        low: 150,
        open: 151,
        previousClose: 151,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const candles = makeCandles(25, 150, 0.1).map((c) => ({ ...c, volume: 1000000 }));

      const res = alertConditionEvaluator.evaluate(rule, { quote, candles });
      expect(res.triggered).toBe(true);
      expect(res.message).toContain('3.0x the 20-day average');
    });

    it('evaluates 52-week high tolerance condition', () => {
      const rule: AlertRule = {
        id: 'rule-52w',
        userId,
        name: 'BHARTIARTL 52W Range Alert',
        alertType: '52w_high_low',
        symbol: 'BHARTIARTL',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: null,
        ruleConfig: {
          type: '52w_high_low',
          condition: 'within_percent_of_high',
          tolerancePercent: 5,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quote: NormalizedQuote = {
        symbol: 'BHARTIARTL',
        exchange: 'NSE',
        price: 1550,
        change: 20,
        changePercent: 1.3,
        volume: 250000,
        high: 1560,
        low: 1530,
        open: 1535,
        previousClose: 1530,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const movers = [{ symbol: 'BHARTIARTL', high52w: 1600, low52w: 900 } as any];

      const res = alertConditionEvaluator.evaluate(rule, { quote, movers });
      expect(res.triggered).toBe(true);
      expect(res.title).toContain('52-Week');
    });

    it('evaluates upper circuit lock condition', () => {
      const rule: AlertRule = {
        id: 'rule-circuit',
        userId,
        name: 'ZOMATO Upper Circuit',
        alertType: 'circuit',
        symbol: 'ZOMATO',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: null,
        ruleConfig: {
          type: 'circuit',
          condition: 'upper_circuit',
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const quote: NormalizedQuote = {
        symbol: 'ZOMATO',
        exchange: 'NSE',
        price: 250,
        change: 22.7,
        changePercent: 9.98,
        volume: 8000000,
        high: 250,
        low: 230,
        open: 232,
        previousClose: 227.3,
        observedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        freshness: 'realtime',
        isStale: false,
        source: 'mock',
      };

      const circuits = [{ symbol: 'ZOMATO', circuitType: 'UPPER' } as any];

      const res = alertConditionEvaluator.evaluate(rule, { quote, circuits });
      expect(res.triggered).toBe(true);
      expect(res.title).toContain('Hit Upper Circuit');
    });

    it('evaluates corporate action announcement condition', () => {
      const rule: AlertRule = {
        id: 'rule-dividend',
        userId,
        name: 'ITC Dividend Disclosure',
        alertType: 'corporate_action',
        symbol: 'ITC',
        exchange: 'NSE',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: null,
        ruleConfig: {
          type: 'corporate_action',
          actionType: 'dividend',
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const announcements = [
        {
          id: 'ann-123',
          symbol: 'ITC',
          exchange: 'NSE',
          category: 'dividend',
          title: 'Board of Directors recommends interim dividend of Rs 6.50 per share',
          publishedAt: new Date().toISOString(),
        } as any,
      ];

      const res = alertConditionEvaluator.evaluate(rule, { announcements });
      expect(res.triggered).toBe(true);
      expect(res.title).toContain('Corporate Action: DIVIDEND');
    });

    it('evaluates index movement condition', () => {
      const rule: AlertRule = {
        id: 'rule-nifty',
        userId,
        name: 'NIFTY 50 Big Movement',
        alertType: 'index_movement',
        enabled: true,
        cooldownMinutes: 60,
        triggerType: 'recurring',
        lastState: null,
        ruleConfig: {
          type: 'index_movement',
          indexSymbol: 'NIFTY 50',
          condition: 'percent_change',
          threshold: 1.5,
        },
        lastEvaluatedAt: null,
        lastObservationAt: null,
        lastObservedValue: null,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const indices = [
        {
          name: 'NIFTY 50',
          value: 24500,
          change: 450,
          changePercent: 1.85,
        } as any,
      ];

      const res = alertConditionEvaluator.evaluate(rule, { indices });
      expect(res.triggered).toBe(true);
      expect(res.message).toContain('+1.85%');
    });
  });

  describe('Part 5 & 6: Delivery Channels, Email & User Preferences', () => {
    it('suppresses email delivery during active quiet hours', async () => {
      const notification: AppNotification = {
        id: 'notif-quiet-hours',
        userId,
        category: 'price_alert',
        title: 'Price Cross Alert',
        message: 'TCS crossed 4000',
        read: false,
        archived: false,
        createdAt: new Date().toISOString(),
      };

      const preferences = {
        userId,
        inAppEnabled: true,
        emailEnabled: true,
        emailAddress: 'investor@example.com',
        priceAlerts: true,
        percentageAlerts: true,
        volumeAlerts: true,
        financialAlerts: true,
        announcementAlerts: true,
        newsAlerts: true,
        digestFrequency: 'realtime' as const,
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        updatedAt: new Date().toISOString(),
      };

      const res = await emailDeliveryService.processNotification(notification, preferences);
      expect(res.delivered).toBe(false);
      expect(res.status).toBe('skipped');
      expect(res.error).toContain('quiet hours');
    });

    it('checks category preferences before sending email', async () => {
      const notification: AppNotification = {
        id: 'notif-vol-pref',
        userId,
        category: 'volume_alert',
        title: 'Volume Spike',
        message: 'Heavy volume detected',
        read: false,
        archived: false,
        createdAt: new Date().toISOString(),
      };

      const preferences = {
        userId,
        inAppEnabled: true,
        emailEnabled: true,
        emailAddress: 'test@example.com',
        volumeAlerts: false, // disabled!
        priceAlerts: true,
        percentageAlerts: true,
        financialAlerts: true,
        announcementAlerts: true,
        newsAlerts: true,
        digestFrequency: 'realtime' as const,
        quietHoursEnabled: false,
        updatedAt: new Date().toISOString(),
      };

      const res = await emailDeliveryService.processNotification(notification, preferences);
      expect(res.delivered).toBe(false);
      expect(res.status).toBe('skipped');
      expect(res.error).toContain('disabled in user email preferences');
    });

    it('manages browser push subscriptions', async () => {
      const sub = {
        endpoint: 'https://push.example.com/sub/12345',
        p256dh: 'BNcRdreALRF8x+123456789==',
        auth: 'tHIsIsAuThKey==',
        userAgent: 'Mozilla/5.0 TestBrowser',
      };

      const saved = await pushNotificationService.subscribe(userId, sub);
      expect(saved.endpoint).toBe(sub.endpoint);

      const unsub = await pushNotificationService.unsubscribe(userId, sub.endpoint);
      expect(unsub).toBe(true);
    });
  });

  describe('Part 7 & 8: Deduplication, Stats & Multi-Channel Dispatch', () => {
    it('provides aggregated dashboard stats via getStats', async () => {
      const stats = await alertRepository.getStats(userId);
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('paused');
      expect(stats).toHaveProperty('triggeredToday');
      expect(stats).toHaveProperty('expired');
      expect(typeof stats.total).toBe('number');
    });

    it('dispatches multi-channel notification and records delivery attempts', async () => {
      const notifInput: AppNotification = {
        id: 'notif-test-dispatch-1',
        userId,
        category: 'price_alert',
        title: 'Alert Fired',
        message: 'TCS crossed above ₹4000',
        symbol: 'TCS',
        exchange: 'NSE',
        link: '/stocks/NSE/TCS',
        read: false,
        archived: false,
        createdAt: new Date().toISOString(),
      };

      const result = await notificationService.dispatchNotification(notifInput, ['in_app']);
      expect(result.inApp).toBe(true);

      const deliveries = await notificationRepository.listDeliveries(notifInput.id);
      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      expect(deliveries.some((d) => d.channel === 'in_app')).toBe(true);
    });

    it('archives and unarchives notifications cleanly', async () => {
      const notif: AppNotification = {
        id: 'notif-arch-1',
        userId,
        category: 'system',
        title: 'System Notice',
        message: 'Scheduled maintenance update',
        read: false,
        archived: false,
        createdAt: new Date().toISOString(),
      };

      await notificationRepository.createNotification(notif);

      const archived = await notificationRepository.archiveNotification(notif.id, userId);
      expect(archived).toBe(true);

      const fetched = await notificationRepository.getNotificationById(notif.id);
      expect(fetched?.archived).toBe(true);

      const unarchived = await notificationRepository.unarchiveNotification(notif.id, userId);
      expect(unarchived).toBe(true);

      const fetched2 = await notificationRepository.getNotificationById(notif.id);
      expect(fetched2?.archived).toBe(false);
    });
  });

  describe('Resend Email Delivery Provider', () => {
    const preferences: UserAlertPreferences = {
      userId,
      emailEnabled: true,
      emailAddress: 'trader@example.com',
      pushEnabled: false,
      inAppEnabled: true,
      quietHoursEnabled: false,
      priceAlerts: true,
      percentageAlerts: true,
      volumeAlerts: true,
      technicalAlerts: true,
      financialAlerts: true,
      announcementAlerts: true,
      newsAlerts: true,
      digestFrequency: 'realtime',
      updatedAt: new Date().toISOString(),
    };

    const alertNotification: AppNotification = {
      id: 'notif-resend-test-01',
      userId,
      category: 'price_alert',
      title: 'Price Target Hit: RELIANCE',
      message: 'RELIANCE crossed above ₹3,000.00',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      link: '/stocks/NSE/RELIANCE',
      read: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    it('dispatches email via Resend when configured and returns provider message ID', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        data: { id: 're_msg_mock_999888' },
        error: null,
      });

      const mockResend = {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend;

      emailDeliveryService.setResendClient(mockResend);

      try {
        const result = await emailDeliveryService.processNotification(alertNotification, preferences);

        expect(result.delivered).toBe(true);
        expect(result.channel).toBe('email');
        expect(result.status).toBe('delivered');
        expect(result.providerMessageId).toBe('re_msg_mock_999888');
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'trader@example.com',
            subject: expect.stringContaining('RELIANCE'),
          }),
        );
      } finally {
        emailDeliveryService.setResendClient(null);
      }
    });

    it('retries with backoff and reports failure if Resend responds with error', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        data: null,
        error: { name: 'rate_limited', message: 'Too many requests' },
      });

      const mockResend = {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend;

      emailDeliveryService.setResendClient(mockResend);

      try {
        const result = await emailDeliveryService.processNotification(alertNotification, preferences);

        expect(result.delivered).toBe(false);
        expect(result.channel).toBe('email');
        expect(result.status).toBe('failed');
        expect(result.error).toContain('Too many requests');
        // Max retries = 3 attempts
        expect(mockSend).toHaveBeenCalledTimes(3);
      } finally {
        emailDeliveryService.setResendClient(null);
      }
    });

    it('falls back to clean simulation when Resend client is unconfigured', async () => {
      emailDeliveryService.setResendClient(null);

      const result = await emailDeliveryService.processNotification(alertNotification, preferences);

      expect(result.delivered).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.status).toBe('delivered');
      expect(result.providerMessageId).toMatch(/^<.*@equitylensai\.internal>$/);
    });
  });
});
