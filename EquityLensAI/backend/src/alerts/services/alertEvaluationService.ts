import crypto from 'node:crypto';
import type {
  AlertEvent,
  AppNotification,
  NormalizedQuote,
  FinancialAnalysis,
  CorporateAnnouncement,
  NewsItem,
  IndexSnapshot,
  VolumeShockerItem,
  CircuitStockItem,
  StockMoverItem,
  PriceCandle,
  NotificationCategory,
} from '@equitylensai/shared';
import { alertRepository } from '../repositories/alertRepository.js';
import { notificationService } from '../../notifications/services/notificationService.js';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import { newsRepository } from '../../news/repositories/newsRepository.js';
import { marketIntelligenceService } from '../../market/intelligence/marketIntelligenceService.js';
import { userRepository } from '../../db/userRepository.js';
import { alertConditionEvaluator } from '../evaluators/alertConditionEvaluator.js';
import { logger } from '../../utils/logger.js';
import type { EvaluationJobSummary } from '../types.js';

function mapAlertTypeToNotificationCategory(alertType: string): NotificationCategory {
  switch (alertType) {
    case 'price':
    case '52w_high_low':
      return 'price_alert';
    case 'percentage_change':
      return 'percentage_alert';
    case 'volume':
    case 'unusual_volume':
      return 'volume_alert';
    case 'rsi':
    case 'macd':
    case 'moving_average':
      return 'technical_alert';
    case 'financial_metric':
    case 'financial_results':
      return 'financial_alert';
    case 'announcement':
      return 'announcement_alert';
    case 'corporate_action':
      return 'corporate_action_alert';
    case 'circuit':
    case 'index_movement':
      return 'market_event';
    case 'news':
      return 'news_alert';
    default:
      return 'system';
  }
}

export class AlertEvaluationService {
  private isEvaluating = false;

  async evaluateAll(): Promise<EvaluationJobSummary> {
    const startTime = Date.now();
    if (this.isEvaluating) {
      logger.warn('Alert evaluation cycle already running; skipping concurrent run');
      return {
        evaluatedCount: 0,
        triggeredCount: 0,
        skippedCount: 0,
        duplicatesPrevented: 0,
        errorsCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isEvaluating = true;
    let evaluatedCount = 0;
    let triggeredCount = 0;
    let skippedCount = 0;
    let duplicatesPrevented = 0;
    let errorsCount = 0;

    try {
      // 0. Auto-expire past rules
      const expiredRules = await alertRepository.getExpiredRules();
      for (const exp of expiredRules) {
        await alertRepository.updateRule(exp.id, exp.userId, {
          enabled: false,
          status: 'EXPIRED',
        });
      }

      const enabledRules = await alertRepository.getAllEnabledRules();
      if (enabledRules.length === 0) {
        return {
          evaluatedCount: 0,
          triggeredCount: 0,
          skippedCount: 0,
          duplicatesPrevented: 0,
          errorsCount: 0,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // 1. Group rules by observation requirements
      const quoteTypes = [
        'price',
        'percentage_change',
        'volume',
        'unusual_volume',
        '52w_high_low',
        'circuit',
        'moving_average',
        'rsi',
      ];
      const candleTypes = ['rsi', 'macd', 'moving_average', 'unusual_volume'];

      const quoteRules = enabledRules.filter((r) => quoteTypes.includes(r.alertType));
      const candleRules = enabledRules.filter((r) => candleTypes.includes(r.alertType));
      const financialRules = enabledRules.filter((r) => r.alertType === 'financial_metric');
      const announcementRules = enabledRules.filter(
        (r) =>
          r.alertType === 'announcement' ||
          r.alertType === 'corporate_action' ||
          r.alertType === 'financial_results' ||
          (r.alertType === 'watchlist_event' &&
            r.ruleConfig.type === 'watchlist_event' &&
            r.ruleConfig.eventType === 'announcement'),
      );
      const newsRules = enabledRules.filter(
        (r) =>
          r.alertType === 'news' ||
          (r.alertType === 'watchlist_event' &&
            r.ruleConfig.type === 'watchlist_event' &&
            r.ruleConfig.eventType === 'news'),
      );
      const indexRules = enabledRules.filter((r) => r.alertType === 'index_movement');
      const circuitRules = enabledRules.filter((r) => r.alertType === 'circuit');
      const moverRules = enabledRules.filter((r) => r.alertType === '52w_high_low' || r.alertType === 'unusual_volume');

      // 2. Batch fetch quotes
      const quotesMap = new Map<string, NormalizedQuote>();
      const quoteKeys = Array.from(
        new Set(
          quoteRules
            .filter((r) => Boolean(r.symbol))
            .map((r) => `${(r.exchange || 'NSE').toUpperCase()}:${r.symbol!.toUpperCase()}`),
        ),
      );

      for (const key of quoteKeys) {
        const [exchange, symbol] = key.split(':');
        if (!symbol || !exchange) continue;
        try {
          const quote = await marketService.getQuote({ symbol, exchange });
          quotesMap.set(key, quote);
        } catch (err) {
          logger.debug({ err, symbol, exchange }, 'Failed to fetch quote during evaluation');
        }
      }

      // 3. Batch fetch daily candles for technical indicators
      const candlesMap = new Map<string, PriceCandle[]>();
      const candleKeys = Array.from(
        new Set(
          candleRules
            .filter((r) => Boolean(r.symbol))
            .map((r) => `${(r.exchange || 'NSE').toUpperCase()}:${r.symbol!.toUpperCase()}`),
        ),
      );

      for (const key of candleKeys) {
        const [exchange, symbol] = key.split(':');
        if (!symbol || !exchange) continue;
        try {
          const to = new Date().toISOString();
          const from = new Date(Date.now() - 365 * 86400000).toISOString();
          const history = await marketService.getHistoricalPrices({
            symbol,
            exchange,
            interval: 'ONE_DAY',
            from,
            to,
          });
          if (history && history.candles) {
            candlesMap.set(key, history.candles);
          }
        } catch (err) {
          logger.debug({ err, symbol, exchange }, 'Failed to fetch candles for technical evaluation');
        }
      }

      // 4. Batch fetch financials
      const financialsMap = new Map<string, FinancialAnalysis>();
      const financialKeys = Array.from(
        new Set(
          financialRules
            .filter((r) => Boolean(r.symbol))
            .map((r) => `${(r.exchange || 'NSE').toUpperCase()}:${r.symbol!.toUpperCase()}`),
        ),
      );

      for (const key of financialKeys) {
        const [exchange, symbol] = key.split(':');
        if (!symbol || !exchange) continue;
        try {
          const analysis = await financialService.getFinancialAnalysis({
            symbol,
            exchange,
            annualPeriods: 4,
          });
          financialsMap.set(key, analysis);
        } catch (err) {
          logger.debug({ err, symbol, exchange }, 'Failed to fetch financials during evaluation');
        }
      }

      // 5. Announcements feed
      let latestAnnouncements: CorporateAnnouncement[] = [];
      if (announcementRules.length > 0) {
        try {
          const feed = await newsRepository.getAnnouncements({ limit: 50 });
          latestAnnouncements = feed.items;
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch announcements feed during evaluation');
        }
      }

      // 6. News feed
      let latestNews: NewsItem[] = [];
      if (newsRules.length > 0) {
        try {
          const feed = await newsRepository.getNews({ limit: 50 });
          latestNews = feed.items;
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch news feed during evaluation');
        }
      }

      // 7. Market Indices
      let marketIndices: IndexSnapshot[] = [];
      if (indexRules.length > 0) {
        try {
          marketIndices = await marketIntelligenceService.getMarketIndices();
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch market indices during evaluation');
        }
      }

      // 8. Circuit stocks & movers pool
      let circuitStocks: CircuitStockItem[] = [];
      let moversPool: StockMoverItem[] = [];
      let volumeShockersPool: VolumeShockerItem[] = [];

      if (circuitRules.length > 0) {
        try {
          circuitStocks = await marketIntelligenceService.getCircuitStocks();
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch circuit stocks during evaluation');
        }
      }

      if (moverRules.length > 0) {
        try {
          moversPool = await marketIntelligenceService.getTrackedMoverPool();
          volumeShockersPool = await marketIntelligenceService.getVolumeShockers({ days: 20 });
        } catch (err) {
          logger.debug({ err }, 'Failed to fetch movers/volume shockers during evaluation');
        }
      }

      // 9. User watchlists cache
      const userWatchlistsMap = new Map<string, string[]>();
      const userWatchlistQuotesMap = new Map<string, Map<string, NormalizedQuote>>();

      // 10. Evaluate each rule safely
      for (const rule of enabledRules) {
        evaluatedCount++;
        try {
          let contextWatchlistSymbols: string[] | undefined;
          let contextWatchlistQuotes: Map<string, NormalizedQuote> | undefined;

          const isWatchlistScoped =
            rule.alertType === 'watchlist_event' ||
            (rule.ruleConfig.type === 'announcement' && rule.ruleConfig.scope === 'watchlist') ||
            (rule.ruleConfig.type === 'financial_results' && rule.ruleConfig.scope === 'watchlist') ||
            (rule.ruleConfig.type === 'news' && rule.ruleConfig.scope === 'watchlist');

          if (isWatchlistScoped) {
            if (!userWatchlistsMap.has(rule.userId)) {
              const watchlists = await userRepository.listWatchlists(rule.userId);
              const symbols = new Set<string>();
              for (const w of watchlists) {
                const items = await userRepository.listWatchlistItems(w.id);
                for (const item of items) {
                  symbols.add(item.symbol.toUpperCase());
                }
              }
              const symArray = Array.from(symbols);
              userWatchlistsMap.set(rule.userId, symArray);

              // Pre-fetch quotes for watchlist symbols if rule is price_movement
              const wlQuotes = new Map<string, NormalizedQuote>();
              for (const sym of symArray) {
                const key = `NSE:${sym}`;
                const q = quotesMap.get(key);
                if (q) {
                  wlQuotes.set(sym, q);
                }
              }
              userWatchlistQuotesMap.set(rule.userId, wlQuotes);
            }
            contextWatchlistSymbols = userWatchlistsMap.get(rule.userId);
            contextWatchlistQuotes = userWatchlistQuotesMap.get(rule.userId);
          }

          const stockKey = rule.symbol
            ? `${(rule.exchange || 'NSE').toUpperCase()}:${rule.symbol.toUpperCase()}`
            : undefined;

          const quote = stockKey ? quotesMap.get(stockKey) : undefined;
          const candles = stockKey ? candlesMap.get(stockKey) : undefined;
          const financials = stockKey ? financialsMap.get(stockKey) : undefined;

          const outcome = alertConditionEvaluator.evaluate(rule, {
            quote,
            candles,
            financials,
            announcements: latestAnnouncements,
            news: latestNews,
            indices: marketIndices,
            circuits: circuitStocks,
            movers: moversPool,
            volumeShockers: volumeShockersPool,
            watchlistSymbols: contextWatchlistSymbols,
            watchlistQuotes: contextWatchlistQuotes,
          });

          if (outcome.skipped) {
            skippedCount++;
            await alertRepository.updateRule(rule.id, rule.userId, {
              lastEvaluatedAt: new Date().toISOString(),
              status: outcome.newStatus ?? rule.status,
              enabled: outcome.newStatus === 'EXPIRED' ? false : rule.enabled,
            });
            continue;
          }

          if (!outcome.triggered) {
            await alertRepository.updateRule(rule.id, rule.userId, {
              lastEvaluatedAt: new Date().toISOString(),
              lastState: outcome.newState !== undefined ? outcome.newState : rule.lastState,
              lastObservedValue:
                outcome.observedValue !== undefined ? outcome.observedValue : rule.lastObservedValue,
              lastObservationAt:
                outcome.observationTimestamp !== undefined
                  ? outcome.observationTimestamp
                  : rule.lastObservationAt,
            });
            continue;
          }

          // Triggered!
          const nowStr = new Date().toISOString();
          const dedupKey =
            outcome.deduplicationKey ??
            `${rule.id}_${outcome.observationTimestamp ?? nowStr}_${outcome.observedValue ?? 'met'}`;

          const event: AlertEvent = {
            id: crypto.randomUUID(),
            ruleId: rule.id,
            userId: rule.userId,
            alertType: rule.alertType,
            symbol: rule.symbol,
            exchange: rule.exchange,
            triggerTimestamp: outcome.observationTimestamp ?? nowStr,
            observedValue: outcome.observedValue ?? null,
            thresholdContext: outcome.metadata ?? {},
            source: 'EquityLensAI Alert Engine',
            deduplicationKey: dedupKey,
            status: 'triggered',
            createdAt: nowStr,
          };

          const { created } = await alertRepository.createEvent(event);

          if (!created) {
            duplicatesPrevented++;
            continue;
          }

          triggeredCount++;

          // Build notification
          const notification: AppNotification = {
            id: crypto.randomUUID(),
            userId: rule.userId,
            alertEventId: event.id,
            category: mapAlertTypeToNotificationCategory(rule.alertType),
            title: outcome.title ?? `Alert Triggered: ${rule.name}`,
            message: outcome.message ?? `Condition for '${rule.name}' was met.`,
            read: false,
            readAt: null,
            archived: false,
            link: outcome.link ?? (rule.symbol ? `/stocks/${rule.symbol}` : '/alerts'),
            symbol: rule.symbol,
            exchange: rule.exchange,
            sourceUrl: outcome.sourceUrl ?? null,
            metadata: outcome.metadata ?? {},
            createdAt: nowStr,
          };

          // Dispatch across enabled channels (in-app, email, push)
          await notificationService.dispatchNotification(notification, rule.deliveryChannels ?? ['in_app']);

          // Update rule state, lastTriggeredAt, and status
          const isOneTime = rule.triggerType === 'one_time';
          await alertRepository.updateRule(rule.id, rule.userId, {
            lastTriggeredAt: nowStr,
            lastEvaluatedAt: nowStr,
            lastState: outcome.newState !== undefined ? outcome.newState : rule.lastState,
            lastObservedValue:
              outcome.observedValue !== undefined ? outcome.observedValue : rule.lastObservedValue,
            lastObservationAt:
              outcome.observationTimestamp !== undefined
                ? outcome.observationTimestamp
                : rule.lastObservationAt,
            status: isOneTime ? 'TRIGGERED' : 'ACTIVE',
            enabled: !isOneTime,
          });
        } catch (ruleErr) {
          errorsCount++;
          logger.error({ err: ruleErr, ruleId: rule.id }, 'Error evaluating alert rule');
        }
      }
    } finally {
      this.isEvaluating = false;
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      {
        evaluatedCount,
        triggeredCount,
        skippedCount,
        duplicatesPrevented,
        errorsCount,
        durationMs,
      },
      'Alert evaluation cycle finished',
    );

    return {
      evaluatedCount,
      triggeredCount,
      skippedCount,
      duplicatesPrevented,
      errorsCount,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }
}

export const alertEvaluationService = new AlertEvaluationService();
