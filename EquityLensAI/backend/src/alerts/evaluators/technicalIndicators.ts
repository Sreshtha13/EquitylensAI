import type { PriceCandle } from '@equitylensai/shared';

export interface RsiResult {
  currentRsi: number;
  previousRsi: number;
}

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  previousHistogram: number;
}

export interface SmaResult {
  currentSma: number;
  previousSma: number;
}

/**
 * Calculates Wilder's 14-period Relative Strength Index (RSI).
 * Requires at least period + 2 candles to return current and previous values.
 */
export function calculateRsi(candles: PriceCandle[], period = 14): RsiResult | null {
  if (!candles || candles.length < period + 2) {
    return null;
  }

  // Sort candles chronologically ascending
  const sorted = [...candles].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const closes = sorted.map((c) => c.close);
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i]! - closes[i - 1]!);
  }

  if (changes.length < period + 1) {
    return null;
  }

  // Initial average gain/loss over first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const chg = changes[i]!;
    if (chg > 0) avgGain += chg;
    else avgLoss += Math.abs(chg);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiSeries: number[] = [];
  const calcRsi = (gain: number, loss: number) => {
    if (loss === 0) return 100;
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  };

  rsiSeries.push(calcRsi(avgGain, avgLoss));

  // Subsequent smoothed values
  for (let i = period; i < changes.length; i++) {
    const chg = changes[i]!;
    const gain = chg > 0 ? chg : 0;
    const loss = chg < 0 ? Math.abs(chg) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsiSeries.push(calcRsi(avgGain, avgLoss));
  }

  if (rsiSeries.length < 2) {
    return null;
  }

  const currentRsi = Number(rsiSeries[rsiSeries.length - 1]!.toFixed(2));
  const previousRsi = Number(rsiSeries[rsiSeries.length - 2]!.toFixed(2));

  return { currentRsi, previousRsi };
}

/**
 * Calculates MACD (Moving Average Convergence Divergence) with standard (12, 26, 9) defaults.
 */
export function calculateMacd(
  candles: PriceCandle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult | null {
  const minRequired = slowPeriod + signalPeriod + 2;
  if (!candles || candles.length < minRequired) {
    return null;
  }

  const sorted = [...candles].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const closes = sorted.map((c) => c.close);

  const calculateEmaSeries = (data: number[], period: number): number[] => {
    const multiplier = 2 / (period + 1);
    const emaSeries: number[] = [];

    // First value is simple moving average
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i]!;
    }
    let currentEma = sum / period;
    emaSeries.push(currentEma);

    for (let i = period; i < data.length; i++) {
      currentEma = (data[i]! - currentEma) * multiplier + currentEma;
      emaSeries.push(currentEma);
    }
    return emaSeries;
  };

  const fastEma = calculateEmaSeries(closes, fastPeriod);
  const slowEma = calculateEmaSeries(closes, slowPeriod);

  // Align slow and fast series: slowEma starts at index slowPeriod - 1 in closes
  const offset = slowPeriod - fastPeriod;
  const macdLineSeries: number[] = [];
  for (let i = 0; i < slowEma.length; i++) {
    const fastVal = fastEma[i + offset]!;
    const slowVal = slowEma[i]!;
    macdLineSeries.push(fastVal - slowVal);
  }

  if (macdLineSeries.length < signalPeriod + 2) {
    return null;
  }

  const signalLineSeries = calculateEmaSeries(macdLineSeries, signalPeriod);
  const signalOffset = signalPeriod - 1;

  const histogramSeries: number[] = [];
  for (let i = 0; i < signalLineSeries.length; i++) {
    const macdVal = macdLineSeries[i + signalOffset]!;
    const signalVal = signalLineSeries[i]!;
    histogramSeries.push(macdVal - signalVal);
  }

  if (histogramSeries.length < 2) {
    return null;
  }

  const lastSignal = signalLineSeries[signalLineSeries.length - 1]!;
  const lastMacd = macdLineSeries[macdLineSeries.length - 1]!;
  const currentHistogram = Number(histogramSeries[histogramSeries.length - 1]!.toFixed(4));
  const previousHistogram = Number(histogramSeries[histogramSeries.length - 2]!.toFixed(4));

  return {
    macdLine: Number(lastMacd.toFixed(4)),
    signalLine: Number(lastSignal.toFixed(4)),
    histogram: currentHistogram,
    previousHistogram,
  };
}

/**
 * Calculates Simple Moving Average (SMA) for a given period.
 */
export function calculateSma(candles: PriceCandle[], period: number): SmaResult | null {
  if (!candles || candles.length < period + 1) {
    return null;
  }

  const sorted = [...candles].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const closes = sorted.map((c) => c.close);
  const currentSlice = closes.slice(-period);
  const previousSlice = closes.slice(-period - 1, -1);

  const currentSma = currentSlice.reduce((sum, val) => sum + val, 0) / period;
  const previousSma = previousSlice.reduce((sum, val) => sum + val, 0) / period;

  return {
    currentSma: Number(currentSma.toFixed(2)),
    previousSma: Number(previousSma.toFixed(2)),
  };
}
