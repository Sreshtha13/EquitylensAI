import type {
  HistoricalPerformancePeriod,
  PerformancePeriodCode,
  PriceCandle,
  StockPerformanceResponse,
} from '@equitylensai/shared';

const PERIOD_CONFIGS: Array<{
  period: PerformancePeriodCode;
  label: string;
  days: number;
  minObservations: number;
  allowAnnualized: boolean;
}> = [
  { period: '1M', label: '1 Month', days: 30, minObservations: 15, allowAnnualized: false },
  { period: '3M', label: '3 Months', days: 90, minObservations: 45, allowAnnualized: false },
  { period: '6M', label: '6 Months', days: 180, minObservations: 90, allowAnnualized: false },
  { period: '1Y', label: '1 Year', days: 365, minObservations: 180, allowAnnualized: true },
  { period: '3Y', label: '3 Years', days: 3 * 365, minObservations: 500, allowAnnualized: true },
  { period: '5Y', label: '5 Years', days: 5 * 365, minObservations: 800, allowAnnualized: true },
  { period: 'MAX', label: 'All History', days: 0, minObservations: 20, allowAnnualized: true },
];

/**
 * Calculates deterministic historical performance metrics from genuine candle data.
 * Zero fabricated or interpolated observations.
 */
export function calculateStockPerformance(
  symbol: string,
  exchange: string,
  candles: PriceCandle[],
  source: string,
): StockPerformanceResponse {
  const sorted = [...candles]
    .filter((c) => Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const retrievedAt = new Date().toISOString();

  if (sorted.length === 0) {
    return {
      symbol,
      exchange,
      source,
      retrievedAt,
      periods: [],
      methodology: {
        cumulativeReturn: '((EndPrice - StartPrice) / StartPrice) * 100',
        annualizedReturn:
          '((EndPrice / StartPrice) ^ (365.25 / ActualDays) - 1) * 100 (periods >= 1 year)',
        volatility: 'Standard deviation of daily log returns * sqrt(252) * 100',
        maxDrawdown: 'Maximum peak-to-trough decline (negative percent) across the period',
        disclaimer:
          'Historical price performance is based on observed market closing prices. Does not include dividend reinvestment unless adjusted series is explicitly indicated. Past performance does not guarantee future results.',
      },
    };
  }

  const latestCandle = sorted[sorted.length - 1]!;
  const latestTime = new Date(latestCandle.timestamp).getTime();

  const periods: HistoricalPerformancePeriod[] = [];

  for (const cfg of PERIOD_CONFIGS) {
    let windowCandles: PriceCandle[];

    if (cfg.period === 'MAX') {
      windowCandles = sorted;
    } else {
      const cutoffTime = latestTime - cfg.days * 24 * 60 * 60 * 1000;
      windowCandles = sorted.filter((c) => new Date(c.timestamp).getTime() >= cutoffTime);
    }

    if (windowCandles.length < 2) {
      continue;
    }

    const first = windowCandles[0]!;
    const last = windowCandles[windowCandles.length - 1]!;

    const firstTime = new Date(first.timestamp).getTime();
    const lastTime = new Date(last.timestamp).getTime();
    const elapsedDays = Math.max(1, (lastTime - firstTime) / (1000 * 60 * 60 * 24));

    // Check if adjusted close is available for all candles in this window
    const hasAdjusted = windowCandles.every(
      (c) => typeof c.adjustedClose === 'number' && c.adjustedClose > 0,
    );
    const priceType = hasAdjusted ? ('adjusted' as const) : ('unadjusted' as const);

    const startPrice = hasAdjusted ? first.adjustedClose! : first.close;
    const endPrice = hasAdjusted ? last.adjustedClose! : last.close;

    if (!startPrice || startPrice <= 0 || !endPrice || endPrice <= 0) {
      continue;
    }

    const cumulativeReturnPercent = ((endPrice - startPrice) / startPrice) * 100;

    // Annualized return (CAGR) only for periods >= 300 days and when allowed
    let annualizedReturnPercent: number | null = null;
    if (cfg.allowAnnualized && elapsedDays >= 300) {
      const years = elapsedDays / 365.25;
      if (years > 0) {
        annualizedReturnPercent = (Math.pow(endPrice / startPrice, 1 / years) - 1) * 100;
      }
    }

    // High and Low over the window
    let high = -Infinity;
    let low = Infinity;
    for (const c of windowCandles) {
      const h = c.high ?? c.close;
      const l = c.low ?? c.close;
      if (h > high) high = h;
      if (l < low) low = l;
    }
    if (!Number.isFinite(high)) high = Math.max(startPrice, endPrice);
    if (!Number.isFinite(low)) low = Math.min(startPrice, endPrice);

    // Volatility: standard deviation of daily log returns * sqrt(252)
    let annualizedVolatilityPercent: number | null = null;
    if (windowCandles.length >= 5) {
      const logReturns: number[] = [];
      for (let i = 1; i < windowCandles.length; i++) {
        const prev = hasAdjusted
          ? windowCandles[i - 1]!.adjustedClose!
          : windowCandles[i - 1]!.close;
        const curr = hasAdjusted ? windowCandles[i]!.adjustedClose! : windowCandles[i]!.close;
        if (prev > 0 && curr > 0) {
          logReturns.push(Math.log(curr / prev));
        }
      }

      if (logReturns.length >= 4) {
        const mean = logReturns.reduce((acc, v) => acc + v, 0) / logReturns.length;
        const variance =
          logReturns.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (logReturns.length - 1);
        const dailyStdDev = Math.sqrt(variance);
        annualizedVolatilityPercent = dailyStdDev * Math.sqrt(252) * 100;
      }
    }

    // Maximum Drawdown: peak to trough decline
    let maxDrawdownPercent: number | null = null;
    if (windowCandles.length >= 2) {
      let peak = -Infinity;
      let maxDd = 0; // negative or 0

      for (const c of windowCandles) {
        const p = hasAdjusted ? c.adjustedClose! : c.close;
        if (p > peak) {
          peak = p;
        }
        if (peak > 0) {
          const dd = ((p - peak) / peak) * 100;
          if (dd < maxDd) {
            maxDd = dd;
          }
        }
      }
      maxDrawdownPercent = maxDd;
    }

    const isSufficient = windowCandles.length >= cfg.minObservations;

    periods.push({
      period: cfg.period,
      label: cfg.label,
      startDate: first.timestamp.split('T')[0]!,
      endDate: last.timestamp.split('T')[0]!,
      startPrice,
      endPrice,
      cumulativeReturnPercent,
      annualizedReturnPercent,
      annualizedVolatilityPercent,
      maxDrawdownPercent,
      high,
      low,
      observations: windowCandles.length,
      priceType,
      isSufficient,
    });
  }

  return {
    symbol,
    exchange,
    source,
    retrievedAt,
    periods,
    methodology: {
      cumulativeReturn: '((EndPrice - StartPrice) / StartPrice) * 100',
      annualizedReturn:
        '((EndPrice / StartPrice) ^ (365.25 / ActualDays) - 1) * 100 (periods >= 1 year)',
      volatility: 'Standard deviation of daily log returns * sqrt(252) * 100',
      maxDrawdown: 'Maximum peak-to-trough decline (negative percent) across the period',
      disclaimer:
        'Historical price performance is based on observed market closing prices. Does not include dividend reinvestment unless adjusted series is explicitly indicated. Past performance does not guarantee future results.',
    },
  };
}
