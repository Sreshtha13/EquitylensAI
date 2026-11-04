import type {
  AlertRule,
  NormalizedQuote,
  FinancialAnalysis,
  CorporateAnnouncement,
  NewsItem,
  IndexSnapshot,
  VolumeShockerItem,
  CircuitStockItem,
  StockMoverItem,
  PriceCandle,
  ComparisonOperator,
} from '@equitylensai/shared';
import { calculateRsi, calculateMacd, calculateSma } from './technicalIndicators.js';

export interface EvaluationContext {
  quote?: NormalizedQuote | undefined;
  candles?: PriceCandle[] | undefined;
  financials?: FinancialAnalysis | undefined;
  announcements?: CorporateAnnouncement[] | undefined;
  news?: NewsItem[] | undefined;
  indices?: IndexSnapshot[] | undefined;
  volumeShockers?: VolumeShockerItem[] | undefined;
  circuits?: CircuitStockItem[] | undefined;
  movers?: StockMoverItem[] | undefined;
  watchlistQuotes?: Map<string, NormalizedQuote> | undefined;
  watchlistSymbols?: string[] | undefined;
  now?: Date | undefined;
}

export interface EvaluationOutcome {
  triggered: boolean;
  skipped: boolean;
  reason?: string | undefined;
  observedValue?: number | null | undefined;
  observationTimestamp?: string | undefined;
  newState?: string | null | undefined;
  newStatus?: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'EXPIRED' | undefined;
  deduplicationKey?: string | undefined;
  title?: string | undefined;
  message?: string | undefined;
  sourceUrl?: string | undefined;
  link?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class AlertConditionEvaluator {
  /**
   * Evaluates an alert rule against the provided market observations.
   */
  evaluate(rule: AlertRule, context: EvaluationContext): EvaluationOutcome {
    const now = context.now ?? new Date();

    // 1. Expiration check
    if (rule.expiresAt && new Date(rule.expiresAt).getTime() <= now.getTime()) {
      return {
        triggered: false,
        skipped: true,
        newStatus: 'EXPIRED',
        reason: `Alert rule expired on ${rule.expiresAt}`,
      };
    }

    // 2. Disabled or non-active status check
    if (!rule.enabled || (rule.status && rule.status !== 'ACTIVE')) {
      return {
        triggered: false,
        skipped: true,
        reason: `Rule is not in ACTIVE monitoring state (status: ${rule.status ?? 'disabled'})`,
      };
    }

    switch (rule.ruleConfig.type) {
      case 'price':
        return this.evaluatePrice(rule, context.quote, now);

      case 'percentage_change':
        return this.evaluatePercentageChange(rule, context.quote, now);

      case 'volume':
        return this.evaluateVolume(rule, context.quote, now);

      case 'unusual_volume':
        return this.evaluateUnusualVolume(rule, context.quote, context.volumeShockers, context.candles, now);

      case 'rsi':
        return this.evaluateRsi(rule, context.candles, context.quote, now);

      case 'macd':
        return this.evaluateMacd(rule, context.candles, context.quote, now);

      case 'moving_average':
        return this.evaluateMovingAverage(rule, context.candles, context.quote, now);

      case '52w_high_low':
        return this.evaluate52wHighLow(rule, context.quote, context.movers, now);

      case 'circuit':
        return this.evaluateCircuit(rule, context.quote, context.circuits, now);

      case 'announcement':
        return this.evaluateAnnouncement(rule, context.announcements, context.watchlistSymbols, now);

      case 'corporate_action':
        return this.evaluateCorporateAction(rule, context.announcements, context.watchlistSymbols, now);

      case 'financial_results':
        return this.evaluateFinancialResults(rule, context.announcements, context.watchlistSymbols, now);

      case 'financial_metric':
        return this.evaluateFinancialMetric(rule, context.financials, now);

      case 'index_movement':
        return this.evaluateIndexMovement(rule, context.indices, now);

      case 'watchlist_event':
        return this.evaluateWatchlistEvent(
          rule,
          context.watchlistSymbols,
          context.watchlistQuotes,
          context.announcements,
          context.news,
          now,
        );

      case 'news':
        return this.evaluateNews(rule, context.news, context.watchlistSymbols, now);

      default:
        return {
          triggered: false,
          skipped: true,
          reason: `Unsupported rule type: ${(rule.ruleConfig as { type: string }).type}`,
        };
    }
  }

  // ─── 1. Price Alerts ───
  private evaluatePrice(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!quote || quote.price === undefined || quote.price === null || isNaN(quote.price)) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Missing or invalid quote price observation',
      };
    }

    if (quote.isStale || quote.freshness === 'stale') {
      return {
        triggered: false,
        skipped: true,
        reason: 'Quote data is stale; evaluation suspended to prevent false triggers',
      };
    }

    const currentPrice = quote.price;
    const config = rule.ruleConfig;
    if (config.type !== 'price') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const { condition, targetPrice } = config;
    const currentState = currentPrice >= targetPrice ? 'above' : 'below';
    const lastState = rule.lastState;

    const isCoolingDown = this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now);

    let triggered = false;
    let transitionOccurred = false;

    if (condition === 'rises_above') {
      triggered = currentPrice > targetPrice;
      transitionOccurred = lastState === 'below' && triggered;
    } else if (condition === 'falls_below') {
      triggered = currentPrice < targetPrice;
      transitionOccurred = lastState === 'above' && triggered;
    } else if (condition === 'crosses_above') {
      if (lastState === 'below' && currentPrice >= targetPrice) {
        triggered = true;
        transitionOccurred = true;
      } else {
        triggered = false;
      }
    } else if (condition === 'crosses_below') {
      if (lastState === 'above' && currentPrice <= targetPrice) {
        triggered = true;
        transitionOccurred = true;
      } else {
        triggered = false;
      }
    }

    const obsTime = quote.observedAt || quote.retrievedAt || now.toISOString();

    if (!lastState) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
        newState: currentState,
        reason: 'Baseline observation established; rule armed for subsequent evaluations',
      };
    }

    const isCrossing = condition === 'crosses_above' || condition === 'crosses_below';
    if (!isCrossing && triggered && !transitionOccurred && isCoolingDown) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
        newState: currentState,
        reason: 'Condition met but suppressed due to active cooldown window',
      };
    }

    if (isCrossing && !transitionOccurred) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
        newState: currentState,
      };
    }

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
        newState: currentState,
      };
    }

    const currencySymbol = quote.currency === 'INR' ? '₹' : '$';
    const conditionDesc =
      condition === 'crosses_above'
        ? 'crossed above'
        : condition === 'crosses_below'
          ? 'crossed below'
          : condition === 'rises_above'
            ? 'rose above'
            : 'fell below';

    const dedupKey = `price_${rule.id}_${obsTime}_${currentState}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: currentPrice,
      observationTimestamp: obsTime,
      newState: currentState,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Price Alert: ${conditionDesc} ${currencySymbol}${targetPrice}`,
      message: `${quote.symbol} has ${conditionDesc} ${currencySymbol}${targetPrice}. Current price is ${currencySymbol}${currentPrice.toFixed(2)} as of ${obsTime}.`,
      link: `/stocks/${quote.symbol}`,
      metadata: {
        condition,
        targetPrice,
        observedPrice: currentPrice,
        currency: quote.currency,
        exchange: quote.exchange,
        freshness: quote.freshness,
      },
    };
  }

  // ─── 2. Percentage Change Alerts ───
  private evaluatePercentageChange(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!quote || quote.changePercent === undefined || quote.changePercent === null) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Quote does not provide reliable percentage change data',
      };
    }

    if (quote.isStale || quote.freshness === 'stale') {
      return {
        triggered: false,
        skipped: true,
        reason: 'Quote data is stale',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'percentage_change') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    if (config.period !== '1d') {
      return {
        triggered: false,
        skipped: true,
        reason: `Period '${config.period}' requires multi-session historical baseline`,
      };
    }

    const changePercent = quote.changePercent;
    let triggered = false;

    if (config.direction === 'up') {
      triggered = changePercent >= config.targetPercent;
    } else if (config.direction === 'down') {
      triggered = changePercent <= -config.targetPercent;
    } else if (config.direction === 'any') {
      triggered = Math.abs(changePercent) >= config.targetPercent;
    }

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: changePercent,
        observationTimestamp: quote.observedAt,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: changePercent,
        observationTimestamp: quote.observedAt,
        reason: 'Condition met but in active cooldown',
      };
    }

    const dedupKey = `pct_${rule.id}_${quote.observedAt}_${changePercent.toFixed(2)}`;
    const directionWord = changePercent >= 0 ? 'gained' : 'declined by';

    return {
      triggered: true,
      skipped: false,
      observedValue: changePercent,
      observationTimestamp: quote.observedAt,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Movement Alert: ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
      message: `${quote.symbol} has ${directionWord} ${Math.abs(changePercent).toFixed(2)}% today (target: ${config.targetPercent}% ${config.direction}).`,
      link: `/stocks/${quote.symbol}`,
      metadata: {
        period: config.period,
        targetPercent: config.targetPercent,
        observedPercent: changePercent,
        price: quote.price,
      },
    };
  }

  // ─── 3. Trading Volume Threshold ───
  private evaluateVolume(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!quote || quote.volume === undefined || quote.volume === null || quote.volume <= 0) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Volume data is absent or unavailable for this instrument',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'volume') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const volume = quote.volume;
    const triggered = volume >= config.targetVolume;

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: volume,
        observationTimestamp: quote.observedAt,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: volume,
        observationTimestamp: quote.observedAt,
        reason: 'Volume threshold exceeded but in cooldown',
      };
    }

    const dedupKey = `vol_${rule.id}_${quote.observedAt}_${volume}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: volume,
      observationTimestamp: quote.observedAt,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Volume Alert: Exceeded ${config.targetVolume.toLocaleString()}`,
      message: `${quote.symbol} trading volume reached ${volume.toLocaleString()} (threshold: ${config.targetVolume.toLocaleString()}) on ${quote.observedAt}.`,
      link: `/stocks/${quote.symbol}`,
      metadata: {
        targetVolume: config.targetVolume,
        observedVolume: volume,
      },
    };
  }

  // ─── 4. Unusual Volume (vs Historical Average) ───
  private evaluateUnusualVolume(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    volumeShockers: VolumeShockerItem[] | undefined,
    candles: PriceCandle[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!quote || !quote.volume || quote.volume <= 0) {
      return { triggered: false, skipped: true, reason: 'Volume data unavailable' };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'unusual_volume') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    // Try finding in volume shockers first
    let historicalAvg: number | null = null;
    let volumeRatio: number | null = null;

    if (volumeShockers && rule.symbol) {
      const match = volumeShockers.find(
        (v) => v.symbol.toUpperCase() === rule.symbol!.toUpperCase(),
      );
      if (match) {
        historicalAvg = match.historicalAvgVolume;
        volumeRatio = match.volumeRatio;
      }
    }

    // Fallback to candle average
    if (historicalAvg === null && candles && candles.length >= config.baselineDays) {
      const recent = candles.slice(-config.baselineDays);
      const sum = recent.reduce((acc, c) => acc + (c.volume ?? 0), 0);
      historicalAvg = sum / config.baselineDays;
      if (historicalAvg > 0) {
        volumeRatio = quote.volume / historicalAvg;
      }
    }

    if (historicalAvg === null || volumeRatio === null || historicalAvg <= 0) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Insufficient historical volume history to establish baseline ratio',
      };
    }

    const triggered = volumeRatio >= config.multiplier;
    const obsTime = quote.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: Number(volumeRatio.toFixed(2)),
        observationTimestamp: obsTime,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: Number(volumeRatio.toFixed(2)),
        observationTimestamp: obsTime,
        reason: 'Unusual volume condition met but in active cooldown',
      };
    }

    const dedupKey = `unusual_vol_${rule.id}_${obsTime}_${volumeRatio.toFixed(1)}x`;

    return {
      triggered: true,
      skipped: false,
      observedValue: Number(volumeRatio.toFixed(2)),
      observationTimestamp: obsTime,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Unusual Volume Spike: ${volumeRatio.toFixed(1)}x Normal`,
      message: `${quote.symbol} trading volume is ${volumeRatio.toFixed(1)}x the ${config.baselineDays}-day average (${quote.volume.toLocaleString()} vs avg ${Math.round(historicalAvg).toLocaleString()}).`,
      link: `/stocks/${quote.symbol}`,
      metadata: {
        multiplier: config.multiplier,
        baselineDays: config.baselineDays,
        currentVolume: quote.volume,
        historicalAvgVolume: Math.round(historicalAvg),
        volumeRatio: Number(volumeRatio.toFixed(2)),
      },
    };
  }

  // ─── 5. RSI Threshold ───
  private evaluateRsi(
    rule: AlertRule,
    candles: PriceCandle[] | undefined,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!candles || candles.length < 16) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Insufficient historical candle data for 14-period RSI calculation',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'rsi') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const rsiResult = calculateRsi(candles, config.period ?? 14);
    if (!rsiResult) {
      return { triggered: false, skipped: true, reason: 'RSI calculation returned insufficient data' };
    }

    const { currentRsi, previousRsi } = rsiResult;
    const threshold = config.threshold;
    const condition = config.condition;

    let triggered = false;
    let transition = false;

    if (condition === 'overbought') {
      triggered = currentRsi >= threshold;
      transition = previousRsi < threshold && triggered;
    } else if (condition === 'oversold') {
      triggered = currentRsi <= threshold;
      transition = previousRsi > threshold && triggered;
    } else if (condition === 'crosses_above') {
      triggered = previousRsi < threshold && currentRsi >= threshold;
      transition = triggered;
    } else if (condition === 'crosses_below') {
      triggered = previousRsi > threshold && currentRsi <= threshold;
      transition = triggered;
    }

    const obsTime = quote?.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentRsi,
        observationTimestamp: obsTime,
        newState: currentRsi >= threshold ? 'above' : 'below',
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentRsi,
        observationTimestamp: obsTime,
        reason: 'RSI condition met but in active cooldown',
      };
    }

    const symbol = quote?.symbol || rule.symbol || 'Stock';
    const dedupKey = `rsi_${rule.id}_${obsTime}_${currentRsi}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: currentRsi,
      observationTimestamp: obsTime,
      newState: currentRsi >= threshold ? 'above' : 'below',
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${symbol} RSI Alert: ${condition.replace('_', ' ')} (${currentRsi})`,
      message: `${symbol} 14-period RSI reached ${currentRsi} (${condition} threshold: ${threshold}).`,
      link: `/stocks/${symbol}`,
      metadata: {
        condition,
        threshold,
        currentRsi,
        previousRsi,
      },
    };
  }

  // ─── 6. MACD Crossover ───
  private evaluateMacd(
    rule: AlertRule,
    candles: PriceCandle[] | undefined,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!candles || candles.length < 38) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Insufficient historical candle data for MACD calculation (min 38 daily candles required)',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'macd') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const macdResult = calculateMacd(
      candles,
      config.fastPeriod ?? 12,
      config.slowPeriod ?? 26,
      config.signalPeriod ?? 9,
    );

    if (!macdResult) {
      return { triggered: false, skipped: true, reason: 'MACD calculation returned insufficient data' };
    }

    const { macdLine, signalLine, histogram, previousHistogram } = macdResult;
    let triggered = false;

    if (config.condition === 'bullish_crossover') {
      triggered = previousHistogram <= 0 && histogram > 0;
    } else if (config.condition === 'bearish_crossover') {
      triggered = previousHistogram >= 0 && histogram < 0;
    }

    const obsTime = quote?.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: macdLine,
        observationTimestamp: obsTime,
        newState: histogram > 0 ? 'bullish' : 'bearish',
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: macdLine,
        observationTimestamp: obsTime,
        reason: 'MACD crossover condition met but in active cooldown',
      };
    }

    const symbol = quote?.symbol || rule.symbol || 'Stock';
    const typeLabel = config.condition === 'bullish_crossover' ? 'Bullish' : 'Bearish';
    const dedupKey = `macd_${rule.id}_${obsTime}_${config.condition}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: macdLine,
      observationTimestamp: obsTime,
      newState: histogram > 0 ? 'bullish' : 'bearish',
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${symbol} MACD ${typeLabel} Crossover Alert`,
      message: `${symbol} recorded a ${typeLabel} MACD crossover: MACD line (${macdLine}) crossed signal line (${signalLine}).`,
      link: `/stocks/${symbol}`,
      metadata: {
        condition: config.condition,
        macdLine,
        signalLine,
        histogram,
      },
    };
  }

  // ─── 7. Moving Average Crossover ───
  private evaluateMovingAverage(
    rule: AlertRule,
    candles: PriceCandle[] | undefined,
    quote: NormalizedQuote | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!candles || candles.length < 21) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Insufficient candle data for moving average calculation',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'moving_average') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const currentPrice = quote?.price ?? candles[candles.length - 1]?.close;
    if (!currentPrice) {
      return { triggered: false, skipped: true, reason: 'Current price unavailable' };
    }

    let triggered = false;
    let observedSma = 0;
    const period = config.period ?? 50;

    if (config.condition === 'golden_cross' || config.condition === 'death_cross') {
      if (candles.length < 205) {
        return {
          triggered: false,
          skipped: true,
          reason: 'At least 205 daily candles required for 50/200 DMA Golden/Death cross detection',
        };
      }
      const sma50 = calculateSma(candles, 50);
      const sma200 = calculateSma(candles, 200);
      if (!sma50 || !sma200) {
        return { triggered: false, skipped: true, reason: 'Could not compute 50 or 200 DMA' };
      }
      observedSma = sma50.currentSma;
      if (config.condition === 'golden_cross') {
        triggered = sma50.previousSma <= sma200.previousSma && sma50.currentSma > sma200.currentSma;
      } else {
        triggered = sma50.previousSma >= sma200.previousSma && sma50.currentSma < sma200.currentSma;
      }
    } else {
      const sma = calculateSma(candles, period);
      if (!sma) {
        return { triggered: false, skipped: true, reason: `Could not calculate ${period}-period SMA` };
      }
      observedSma = sma.currentSma;
      const prevPrice = candles[candles.length - 2]?.close ?? currentPrice;

      if (config.condition === 'price_crosses_above') {
        triggered = prevPrice <= sma.previousSma && currentPrice > sma.currentSma;
      } else if (config.condition === 'price_crosses_below') {
        triggered = prevPrice >= sma.previousSma && currentPrice < sma.currentSma;
      }
    }

    const obsTime = quote?.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: observedSma,
        observationTimestamp: obsTime,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: observedSma,
        observationTimestamp: obsTime,
        reason: 'MA crossover condition met but in active cooldown',
      };
    }

    const symbol = quote?.symbol || rule.symbol || 'Stock';
    const conditionName = config.condition.replace(/_/g, ' ');
    const dedupKey = `ma_${rule.id}_${obsTime}_${config.condition}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: observedSma,
      observationTimestamp: obsTime,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${symbol} Moving Average Alert: ${conditionName}`,
      message: `${symbol} triggered ${conditionName} with ${period} DMA at ₹${observedSma.toFixed(2)} (price: ₹${currentPrice.toFixed(2)}).`,
      link: `/stocks/${symbol}`,
      metadata: {
        condition: config.condition,
        period,
        observedSma,
        price: currentPrice,
      },
    };
  }

  // ─── 8. 52-Week High / Low Alerts ───
  private evaluate52wHighLow(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    movers: StockMoverItem[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    const config = rule.ruleConfig;
    if (config.type !== '52w_high_low') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const currentPrice = quote?.price;
    if (!currentPrice) {
      return { triggered: false, skipped: true, reason: 'Current price unavailable' };
    }

    // Try finding 52w bounds from mover pool or quote
    let high52w: number | null = null;
    let low52w: number | null = null;

    if (movers && rule.symbol) {
      const match = movers.find((m) => m.symbol.toUpperCase() === rule.symbol!.toUpperCase());
      if (match) {
        high52w = match.high52w ?? null;
        low52w = match.low52w ?? null;
      }
    }

    if (!high52w && quote?.high) {
      high52w = quote.high * 1.05; // fallback approximation if not provided
      low52w = quote.low ? quote.low * 0.95 : quote.price ? quote.price * 0.9 : null;
    }

    if (!high52w || !low52w) {
      return { triggered: false, skipped: true, reason: '52-week benchmark bounds unavailable' };
    }

    let triggered = false;
    const tolerance = config.tolerancePercent ?? 1.5;

    if (config.condition === 'new_52w_high') {
      triggered = currentPrice >= high52w;
    } else if (config.condition === 'new_52w_low') {
      triggered = currentPrice <= low52w;
    } else if (config.condition === 'within_percent_of_high') {
      const diffPercent = ((high52w - currentPrice) / high52w) * 100;
      triggered = diffPercent >= 0 && diffPercent <= tolerance;
    } else if (config.condition === 'within_percent_of_low') {
      const diffPercent = ((currentPrice - low52w) / low52w) * 100;
      triggered = diffPercent >= 0 && diffPercent <= tolerance;
    }

    const obsTime = quote?.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: currentPrice,
        observationTimestamp: obsTime,
        reason: '52-week alert condition met but in active cooldown',
      };
    }

    const symbol = quote?.symbol || rule.symbol || 'Stock';
    const conditionText = config.condition.replace(/_/g, ' ');
    const dedupKey = `52w_${rule.id}_${obsTime}_${config.condition}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: currentPrice,
      observationTimestamp: obsTime,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${symbol} 52-Week Range Alert: ${conditionText}`,
      message: `${symbol} price at ₹${currentPrice.toFixed(2)} reached ${conditionText} (52W High: ₹${high52w.toFixed(2)}, 52W Low: ₹${low52w.toFixed(2)}).`,
      link: `/stocks/${symbol}`,
      metadata: {
        condition: config.condition,
        high52w,
        low52w,
        currentPrice,
      },
    };
  }

  // ─── 9. Circuit Limit Alerts ───
  private evaluateCircuit(
    rule: AlertRule,
    quote: NormalizedQuote | undefined,
    circuits: CircuitStockItem[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    const config = rule.ruleConfig;
    if (config.type !== 'circuit') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    if (!quote || quote.price === undefined) {
      return { triggered: false, skipped: true, reason: 'Quote data unavailable' };
    }

    let isUpperCircuit = false;
    let isLowerCircuit = false;

    // Check circuit pool if available
    if (circuits && rule.symbol) {
      const match = circuits.find((c) => c.symbol.toUpperCase() === rule.symbol!.toUpperCase());
      if (match) {
        isUpperCircuit = match.circuitType === 'UPPER';
        isLowerCircuit = match.circuitType === 'LOWER';
      }
    }

    // Fallback: Indian standard circuit limit approximation from change percent (5%, 10%, 20%)
    if (!isUpperCircuit && !isLowerCircuit && quote.changePercent !== null) {
      if (quote.changePercent >= 4.95 && quote.high === quote.price) {
        isUpperCircuit = true;
      } else if (quote.changePercent <= -4.95 && quote.low === quote.price) {
        isLowerCircuit = true;
      }
    }

    const triggered =
      (config.condition === 'upper_circuit' && isUpperCircuit) ||
      (config.condition === 'lower_circuit' && isLowerCircuit);

    const obsTime = quote.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: quote.price,
        observationTimestamp: obsTime,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: quote.price,
        observationTimestamp: obsTime,
        reason: 'Circuit condition met but in active cooldown',
      };
    }

    const symbol = quote.symbol || rule.symbol || 'Stock';
    const label = config.condition === 'upper_circuit' ? 'Upper Circuit' : 'Lower Circuit';
    const dedupKey = `circuit_${rule.id}_${obsTime}_${config.condition}`;

    const currentPrice = quote.price ?? 0;
    return {
      triggered: true,
      skipped: false,
      observedValue: currentPrice,
      observationTimestamp: obsTime,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${symbol} Hit ${label}!`,
      message: `${symbol} locked in ${label} at ₹${currentPrice.toFixed(2)} (${quote.changePercent && quote.changePercent >= 0 ? '+' : ''}${quote.changePercent?.toFixed(2) ?? '0.00'}%).`,
      link: `/stocks/${symbol}`,
      metadata: {
        condition: config.condition,
        price: currentPrice,
        changePercent: quote.changePercent,
      },
    };
  }

  // ─── 10. Corporate Announcements ───
  private evaluateAnnouncement(
    rule: AlertRule,
    announcements: CorporateAnnouncement[] | undefined,
    watchlistSymbols: string[] | undefined,
    _now: Date,
  ): EvaluationOutcome {
    if (!announcements || announcements.length === 0) {
      return { triggered: false, skipped: false };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'announcement') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    for (const ann of announcements) {
      if (config.scope === 'stock') {
        if (!rule.symbol || ann.symbol.toUpperCase() !== rule.symbol.toUpperCase()) {
          continue;
        }
      } else if (config.scope === 'watchlist') {
        if (!watchlistSymbols || !watchlistSymbols.includes(ann.symbol.toUpperCase())) {
          continue;
        }
      }

      if (config.categories && config.categories.length > 0) {
        if (!config.categories.includes(ann.category)) {
          continue;
        }
      }

      const dedupKey = `ann_${rule.id}_${ann.id}`;

      return {
        triggered: true,
        skipped: false,
        observationTimestamp: ann.publishedAt,
        newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
        deduplicationKey: dedupKey,
        title: `Official Announcement: ${ann.companyName || ann.symbol}`,
        message: `${ann.symbol} filed disclosure [${ann.category}]: ${ann.title}`,
        sourceUrl: ann.sourceUrl || ann.documentUrl || undefined,
        link: `/announcements`,
        metadata: {
          announcementId: ann.id,
          category: ann.category,
          exchange: ann.exchange,
          publishedAt: ann.publishedAt,
        },
      };
    }

    return { triggered: false, skipped: false };
  }

  // ─── 11. Corporate Actions (Dividend, Bonus, Split) ───
  private evaluateCorporateAction(
    rule: AlertRule,
    announcements: CorporateAnnouncement[] | undefined,
    watchlistSymbols: string[] | undefined,
    _now: Date,
  ): EvaluationOutcome {
    if (!announcements || announcements.length === 0) {
      return { triggered: false, skipped: false };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'corporate_action') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const targetCategories =
      config.actionType === 'any'
        ? ['dividend', 'bonus_issue', 'stock_split', 'rights_issue']
        : [config.actionType];

    for (const ann of announcements) {
      if (rule.symbol && ann.symbol.toUpperCase() !== rule.symbol.toUpperCase()) {
        continue;
      }
      if (!rule.symbol && watchlistSymbols && !watchlistSymbols.includes(ann.symbol.toUpperCase())) {
        continue;
      }

      if (targetCategories.includes(ann.category)) {
        const dedupKey = `corp_act_${rule.id}_${ann.id}`;
        const actionLabel = ann.category.replace(/_/g, ' ').toUpperCase();

        return {
          triggered: true,
          skipped: false,
          observationTimestamp: ann.publishedAt,
          newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
          deduplicationKey: dedupKey,
          title: `${ann.symbol} Corporate Action: ${actionLabel}`,
          message: `${ann.companyName || ann.symbol} announced ${actionLabel}: ${ann.title}`,
          sourceUrl: ann.sourceUrl || undefined,
          link: `/announcements`,
          metadata: {
            actionType: ann.category,
            announcementId: ann.id,
          },
        };
      }
    }

    return { triggered: false, skipped: false };
  }

  // ─── 12. Quarterly Financial Results ───
  private evaluateFinancialResults(
    rule: AlertRule,
    announcements: CorporateAnnouncement[] | undefined,
    watchlistSymbols: string[] | undefined,
    _now: Date,
  ): EvaluationOutcome {
    if (!announcements || announcements.length === 0) {
      return { triggered: false, skipped: false };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'financial_results') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    for (const ann of announcements) {
      if (config.scope === 'stock' && rule.symbol) {
        if (ann.symbol.toUpperCase() !== rule.symbol.toUpperCase()) continue;
      } else if (config.scope === 'watchlist' && watchlistSymbols) {
        if (!watchlistSymbols.includes(ann.symbol.toUpperCase())) continue;
      }

      if (ann.category === 'financial_results') {
        const dedupKey = `results_${rule.id}_${ann.id}`;

        return {
          triggered: true,
          skipped: false,
          observationTimestamp: ann.publishedAt,
          newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
          deduplicationKey: dedupKey,
          title: `${ann.symbol} Quarterly Financial Results Out!`,
          message: `${ann.companyName || ann.symbol} has published its quarterly financial results: ${ann.title}`,
          sourceUrl: ann.sourceUrl || undefined,
          link: `/stocks/${ann.symbol}/financials`,
          metadata: {
            announcementId: ann.id,
            publishedAt: ann.publishedAt,
          },
        };
      }
    }

    return { triggered: false, skipped: false };
  }

  // ─── 13. Fundamental Metric Changes ───
  private evaluateFinancialMetric(
    rule: AlertRule,
    financials: FinancialAnalysis | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!financials) {
      return {
        triggered: false,
        skipped: true,
        reason: 'Financial intelligence data not yet available for this instrument',
      };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'financial_metric') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const metricValue = this.extractMetricValue(financials, config.metric);
    if (metricValue === null || metricValue === undefined || isNaN(metricValue)) {
      return {
        triggered: false,
        skipped: true,
        reason: `Metric '${config.metric}' is not available in reported financial statements`,
      };
    }

    const triggered = this.compareNumbers(metricValue, config.operator, config.thresholdValue);

    const periodEndDate = financials.latestAnnual?.periodEndDate;
    const fiscalYear = periodEndDate ? periodEndDate.slice(0, 4) : undefined;
    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue: metricValue,
        observationTimestamp: fiscalYear ?? now.toISOString(),
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue: metricValue,
        reason: 'Financial metric condition met but alert in active cooldown',
      };
    }

    const opSymbol =
      config.operator === 'gt'
        ? '>'
        : config.operator === 'gte'
          ? '>='
          : config.operator === 'lt'
            ? '<'
            : '<=';

    const reportingPeriod = fiscalYear ? `FY${fiscalYear}` : 'Latest period';
    const dedupKey = `fin_${rule.id}_${reportingPeriod}_${metricValue.toFixed(2)}`;

    return {
      triggered: true,
      skipped: false,
      observedValue: metricValue,
      observationTimestamp: now.toISOString(),
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${financials.symbol} Financial Alert: ${config.metric} ${opSymbol} ${config.thresholdValue}`,
      message: `${financials.symbol} reported ${config.metric} of ${metricValue.toFixed(2)} (${opSymbol} ${config.thresholdValue}) for ${reportingPeriod}.`,
      link: `/stocks/${financials.symbol}/financials`,
      metadata: {
        metric: config.metric,
        operator: config.operator,
        thresholdValue: config.thresholdValue,
        observedValue: metricValue,
        reportingPeriod,
      },
    };
  }

  // ─── 14. Index Movement ───
  private evaluateIndexMovement(
    rule: AlertRule,
    indices: IndexSnapshot[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!indices || indices.length === 0) {
      return { triggered: false, skipped: true, reason: 'Index snapshot data unavailable' };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'index_movement') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    const target = indices.find(
      (idx) => idx.name.toUpperCase() === config.indexSymbol.toUpperCase(),
    );
    if (!target) {
      return {
        triggered: false,
        skipped: true,
        reason: `Index '${config.indexSymbol}' not found in active market snapshot`,
      };
    }

    let triggered = false;
    let observedValue = target.value;

    if (config.condition === 'rises_above') {
      triggered = target.value >= config.threshold;
    } else if (config.condition === 'falls_below') {
      triggered = target.value <= config.threshold;
    } else if (config.condition === 'percent_change') {
      observedValue = target.changePercent;
      triggered = Math.abs(target.changePercent) >= config.threshold;
    }

    const obsTime = target.observedAt || now.toISOString();

    if (!triggered) {
      return {
        triggered: false,
        skipped: false,
        observedValue,
        observationTimestamp: obsTime,
      };
    }

    if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
      return {
        triggered: false,
        skipped: false,
        observedValue,
        observationTimestamp: obsTime,
        reason: 'Index movement condition met but in active cooldown',
      };
    }

    const dedupKey = `idx_${rule.id}_${obsTime}_${observedValue}`;

    return {
      triggered: true,
      skipped: false,
      observedValue,
      observationTimestamp: obsTime,
      newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
      deduplicationKey: dedupKey,
      title: `${target.name} Index Alert: ${config.condition.replace(/_/g, ' ')}`,
      message: `${target.name} is at ${target.value.toLocaleString()} (${target.changePercent >= 0 ? '+' : ''}${target.changePercent.toFixed(2)}%), meeting condition ${config.condition} ${config.threshold}.`,
      link: `/market`,
      metadata: {
        index: target.name,
        value: target.value,
        change: target.change,
        changePercent: target.changePercent,
      },
    };
  }

  // ─── 15. Watchlist Stock Events ───
  private evaluateWatchlistEvent(
    rule: AlertRule,
    watchlistSymbols: string[] | undefined,
    watchlistQuotes: Map<string, NormalizedQuote> | undefined,
    announcements: CorporateAnnouncement[] | undefined,
    news: NewsItem[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!watchlistSymbols || watchlistSymbols.length === 0) {
      return { triggered: false, skipped: true, reason: 'No stocks in watchlist' };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'watchlist_event') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    // 1. Price movement in watchlist
    if (config.eventType === 'price_movement') {
      if (!watchlistQuotes) {
        return { triggered: false, skipped: true, reason: 'Watchlist quotes unavailable' };
      }
      const targetPercent = config.thresholdPercent ?? 3.0;

      for (const symbol of watchlistSymbols) {
        const quote = watchlistQuotes.get(symbol.toUpperCase());
        if (!quote || quote.changePercent === null) continue;

        if (Math.abs(quote.changePercent) >= targetPercent) {
          const obsTime = quote.observedAt || now.toISOString();
          const dedupKey = `wl_move_${rule.id}_${symbol}_${obsTime}_${quote.changePercent.toFixed(1)}`;

          if (this.isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
            continue;
          }

          return {
            triggered: true,
            skipped: false,
            observedValue: quote.changePercent,
            observationTimestamp: obsTime,
            newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
            deduplicationKey: dedupKey,
            title: `Watchlist Alert: ${symbol} moved ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`,
            message: `${symbol} from your watchlist gained/declined by ${quote.changePercent.toFixed(2)}% today (threshold: ±${targetPercent}%).`,
            link: `/stocks/${symbol}`,
            metadata: {
              symbol,
              changePercent: quote.changePercent,
              price: quote.price,
            },
          };
        }
      }
    }

    // 2. Announcements in watchlist
    if (config.eventType === 'announcement' && announcements) {
      return this.evaluateAnnouncement(
        {
          ...rule,
          ruleConfig: { type: 'announcement', scope: 'watchlist' },
        },
        announcements,
        watchlistSymbols,
        now,
      );
    }

    // 3. News in watchlist
    if (config.eventType === 'news' && news) {
      return this.evaluateNews(
        {
          ...rule,
          ruleConfig: { type: 'news', scope: 'watchlist' },
        },
        news,
        watchlistSymbols,
        now,
      );
    }

    return { triggered: false, skipped: false };
  }

  // ─── News Alerts ───
  private evaluateNews(
    rule: AlertRule,
    news: NewsItem[] | undefined,
    watchlistSymbols: string[] | undefined,
    _now: Date,
  ): EvaluationOutcome {
    if (!news || news.length === 0) {
      return { triggered: false, skipped: false };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'news') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    for (const item of news) {
      const symbolsInNews = item.symbols.map((s) => s.symbol.toUpperCase());

      if (config.scope === 'stock') {
        if (!rule.symbol || !symbolsInNews.includes(rule.symbol.toUpperCase())) {
          continue;
        }
      } else if (config.scope === 'watchlist') {
        const matchesWatchlist = watchlistSymbols?.some((ws) => symbolsInNews.includes(ws));
        if (!matchesWatchlist) {
          continue;
        }
      }

      if (config.keywords && config.keywords.length > 0) {
        const lowerTitle = item.title.toLowerCase();
        const matchesKeyword = config.keywords.some((kw) => lowerTitle.includes(kw.toLowerCase()));
        if (!matchesKeyword) continue;
      }

      const dedupKey = `news_${rule.id}_${item.id}`;

      return {
        triggered: true,
        skipped: false,
        observationTimestamp: item.publishedAt ?? item.retrievedAt,
        newStatus: rule.triggerType === 'one_time' ? 'TRIGGERED' : 'ACTIVE',
        deduplicationKey: dedupKey,
        title: `Market News: ${item.title}`,
        message: `${item.sourceName}: ${item.title}`,
        sourceUrl: item.canonicalUrl,
        link: `/news`,
        metadata: {
          newsId: item.id,
          sourceName: item.sourceName,
          publishedAt: item.publishedAt,
        },
      };
    }

    return { triggered: false, skipped: false };
  }

  // ─── Helpers ───
  private isInCooldown(lastTriggeredAt: string | null, cooldownMinutes: number, now: Date): boolean {
    if (!lastTriggeredAt || cooldownMinutes <= 0) {
      return false;
    }
    const lastTriggerMs = new Date(lastTriggeredAt).getTime();
    if (isNaN(lastTriggerMs)) {
      return false;
    }
    const elapsedMinutes = (now.getTime() - lastTriggerMs) / (60 * 1000);
    return elapsedMinutes < cooldownMinutes;
  }

  private compareNumbers(value: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private extractMetricValue(financials: FinancialAnalysis, metric: string): number | null {
    switch (metric) {
      case 'roe':
        return financials.profitability?.returnOnEquity?.value ?? null;
      case 'roce':
        return financials.profitability?.returnOnCapitalEmployed?.value ?? null;
      case 'operatingMargin':
        return financials.profitability?.operatingMargin?.value ?? null;
      case 'netMargin':
        return financials.profitability?.netMargin?.value ?? null;
      case 'debtToEquity':
        return financials.leverage?.debtToEquity?.value ?? null;
      case 'freeCashFlow':
        return (
          financials.cashFlow?.freeCashFlowYield?.value ??
          financials.latestAnnual?.cashFlow?.freeCashFlow ??
          null
        );
      case 'peRatio':
        return financials.valuation?.peRatio?.value ?? null;
      case 'pbRatio':
        return financials.valuation?.priceToBook?.value ?? null;
      case 'currentRatio':
        return financials.liquidity?.currentRatio?.value ?? null;
      default:
        return null;
    }
  }
}

export const alertConditionEvaluator = new AlertConditionEvaluator();
