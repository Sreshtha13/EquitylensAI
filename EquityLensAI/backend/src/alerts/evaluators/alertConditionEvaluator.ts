import type {
  AlertRule,
  NormalizedQuote,
  FinancialAnalysis,
  CorporateAnnouncement,
  NewsItem,
  PriceCondition,
  ComparisonOperator,
} from '@equitylensai/shared';

export interface EvaluationContext {
  quote?: NormalizedQuote | undefined;
  financials?: FinancialAnalysis | undefined;
  announcements?: CorporateAnnouncement[] | undefined;
  news?: NewsItem[] | undefined;
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
  deduplicationKey?: string | undefined;
  title?: string | undefined;
  message?: string | undefined;
  sourceUrl?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class AlertConditionEvaluator {
  /**
   * Evaluates a rule against the provided context.
   */
  evaluate(rule: AlertRule, context: EvaluationContext): EvaluationOutcome {
    const now = context.now ?? new Date();

    switch (rule.ruleConfig.type) {
      case 'price':
        return this.evaluatePrice(rule, context.quote, now);

      case 'percentage_change':
        return this.evaluatePercentageChange(rule, context.quote, now);

      case 'volume':
        return this.evaluateVolume(rule, context.quote, now);

      case 'financial_metric':
        return this.evaluateFinancialMetric(rule, context.financials, now);

      case 'announcement':
        return this.evaluateAnnouncement(rule, context.announcements, context.watchlistSymbols, now);

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

  // ─── Price Alerts ───
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

    // Check cooldown if previously triggered
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
      // Crossing requires having observed a 'below' state previously
      if (lastState === 'below' && currentPrice >= targetPrice) {
        triggered = true;
        transitionOccurred = true;
      } else {
        triggered = false;
      }
    } else if (condition === 'crosses_below') {
      // Crossing requires having observed an 'above' state previously
      if (lastState === 'above' && currentPrice <= targetPrice) {
        triggered = true;
        transitionOccurred = true;
      } else {
        triggered = false;
      }
    }

    const obsTime = quote.observedAt || quote.retrievedAt || now.toISOString();

    // Initial evaluation setup: if no lastState recorded, record it without false crossing
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

    // For persistent conditions ('rises_above', 'falls_below'):
    // If not a fresh transition, require cooldown to expire
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
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Price Alert: ${conditionDesc} ${currencySymbol}${targetPrice}`,
      message: `${quote.symbol} has ${conditionDesc} ${currencySymbol}${targetPrice}. Current price is ${currencySymbol}${currentPrice.toFixed(2)} as of ${obsTime}.`,
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

  // ─── Percentage Change Alerts ───
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

    // Only '1d' intraday/session baseline is supported directly by quote
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
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Movement Alert: ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
      message: `${quote.symbol} has ${directionWord} ${Math.abs(changePercent).toFixed(2)}% today (target: ${config.targetPercent}% ${config.direction}).`,
      metadata: {
        period: config.period,
        targetPercent: config.targetPercent,
        observedPercent: changePercent,
        price: quote.price,
      },
    };
  }

  // ─── Volume Alerts ───
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
      deduplicationKey: dedupKey,
      title: `${quote.symbol} Volume Alert: Exceeded ${config.targetVolume.toLocaleString()}`,
      message: `${quote.symbol} trading volume reached ${volume.toLocaleString()} (threshold: ${config.targetVolume.toLocaleString()}) on ${quote.observedAt}.`,
      metadata: {
        targetVolume: config.targetVolume,
        observedVolume: volume,
      },
    };
  }

  // ─── Financial Metric Alerts ───
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

    // Extract metric value
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
      deduplicationKey: dedupKey,
      title: `${financials.symbol} Financial Alert: ${config.metric} ${opSymbol} ${config.thresholdValue}`,
      message: `${financials.symbol} reported ${config.metric} of ${metricValue.toFixed(2)} (${opSymbol} ${config.thresholdValue}) for ${reportingPeriod}.`,
      metadata: {
        metric: config.metric,
        operator: config.operator,
        thresholdValue: config.thresholdValue,
        observedValue: metricValue,
        reportingPeriod,
      },
    };
  }

  // ─── Announcement Alerts ───
  private evaluateAnnouncement(
    rule: AlertRule,
    announcements: CorporateAnnouncement[] | undefined,
    watchlistSymbols: string[] | undefined,
    now: Date,
  ): EvaluationOutcome {
    if (!announcements || announcements.length === 0) {
      return { triggered: false, skipped: false };
    }

    const config = rule.ruleConfig;
    if (config.type !== 'announcement') {
      return { triggered: false, skipped: true, reason: 'Invalid config type' };
    }

    // Filter announcements matching rule
    for (const ann of announcements) {
      // Check symbol match
      if (config.scope === 'stock') {
        if (!rule.symbol || ann.symbol.toUpperCase() !== rule.symbol.toUpperCase()) {
          continue;
        }
      } else if (config.scope === 'watchlist') {
        if (!watchlistSymbols || !watchlistSymbols.includes(ann.symbol.toUpperCase())) {
          continue;
        }
      }

      // Check category match
      if (config.categories && config.categories.length > 0) {
        if (!config.categories.includes(ann.category)) {
          continue;
        }
      }

      // Found a matching announcement
      const dedupKey = `ann_${rule.id}_${ann.id}`;

      return {
        triggered: true,
        skipped: false,
        observationTimestamp: ann.publishedAt,
        deduplicationKey: dedupKey,
        title: `Official Announcement: ${ann.companyName || ann.symbol}`,
        message: `${ann.symbol} filed disclosure [${ann.category}]: ${ann.title}`,
        sourceUrl: ann.sourceUrl || ann.documentUrl || undefined,
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

      const dedupKey = `news_${rule.id}_${item.id}`;

      return {
        triggered: true,
        skipped: false,
        observationTimestamp: item.publishedAt ?? item.retrievedAt,
        deduplicationKey: dedupKey,
        title: `Market News: ${item.title}`,
        message: `${item.sourceName}: ${item.title}`,
        sourceUrl: item.canonicalUrl,
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
        return financials.cashFlow?.freeCashFlowYield?.value ?? financials.latestAnnual?.cashFlow?.freeCashFlow ?? null;
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
