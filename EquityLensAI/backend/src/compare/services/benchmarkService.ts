import type {
  ComparisonCompanyTarget,
  BenchmarkMetricStat,
  PeerBenchmarkResponse,
  SupportedPeriod,
} from '../types.js';
import { comparisonService } from './comparisonService.js';
import { AppError } from '../../utils/appError.js';

export class BenchmarkService {
  async calculateBenchmarks(
    targets: ComparisonCompanyTarget[],
    period: SupportedPeriod = 'annual',
    metrics?: string[],
  ): Promise<PeerBenchmarkResponse> {
    if (!targets || targets.length < 2) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least two companies are required for benchmark statistics.',
        400,
      );
    }

    const comparison = await comparisonService.compareCompanies({
      symbols: targets,
      period,
      metrics,
    });

    const symbols = comparison.companies.map((c) => c.symbol);
    const warnings: string[] = [...comparison.warnings];

    const benchmarks: BenchmarkMetricStat[] = comparison.metricsRows.map((row) => {
      // Collect valid non-null entries
      const validEntries: Array<{ symbol: string; value: number }> = [];
      for (const [sym, val] of Object.entries(row.values)) {
        if (val !== null && Number.isFinite(val)) {
          validEntries.push({ symbol: sym, value: val });
        }
      }

      const sampleSize = validEntries.length;

      if (sampleSize === 0) {
        const ranks: BenchmarkMetricStat['ranks'] = {};
        for (const s of symbols) {
          ranks[s] = {
            value: null,
            rank: null,
            percentile: null,
            diffFromMedian: null,
            diffFromMean: null,
          };
        }
        return {
          metricId: row.metricId,
          label: row.label,
          unit: row.unit,
          sampleSize: 0,
          mean: null,
          median: null,
          min: null,
          max: null,
          ranks,
        };
      }

      // Calculate Mean
      const sum = validEntries.reduce((acc, curr) => acc + curr.value, 0);
      const mean = Math.round((sum / sampleSize) * 100) / 100;

      // Calculate Median, Min, Max
      const sortedValues = [...validEntries.map((e) => e.value)].sort((a, b) => a - b);
      const min = sortedValues[0]!;
      const max = sortedValues[sortedValues.length - 1]!;

      let median: number;
      const mid = Math.floor(sortedValues.length / 2);
      if (sortedValues.length % 2 === 0) {
        median = Math.round(((sortedValues[mid - 1]! + sortedValues[mid]!) / 2) * 100) / 100;
      } else {
        median = sortedValues[mid]!;
      }

      // Rank & Percentile (higher is rank 1, standard descending rank)
      const rankedEntries = [...validEntries].sort((a, b) => b.value - a.value);

      const ranks: BenchmarkMetricStat['ranks'] = {};

      for (const s of symbols) {
        const val = row.values[s];
        if (val === null || val === undefined || !Number.isFinite(val)) {
          ranks[s] = {
            value: null,
            rank: null,
            percentile: null,
            diffFromMedian: null,
            diffFromMean: null,
          };
          continue;
        }

        const diffFromMedian = Math.round((val - median) * 100) / 100;
        const diffFromMean = Math.round((val - mean) * 100) / 100;

        // Rank only if sampleSize >= 2
        let rank: number | null = null;
        let percentile: number | null = null;

        if (sampleSize >= 2) {
          // 1-indexed rank with tie-handling
          const index = rankedEntries.findIndex((e) => e.symbol === s);
          rank = index >= 0 ? index + 1 : null;

          // Standard percentile: percentage of values strictly below + half of ties
          const countBelow = validEntries.filter((e) => e.value < val).length;
          const countEqual = validEntries.filter((e) => e.value === val).length;
          percentile = Math.round(((countBelow + 0.5 * countEqual) / sampleSize) * 100);
        }

        ranks[s] = {
          value: val,
          rank,
          percentile,
          diffFromMedian,
          diffFromMean,
        };
      }

      return {
        metricId: row.metricId,
        label: row.label,
        unit: row.unit,
        sampleSize,
        mean,
        median,
        min,
        max,
        ranks,
      };
    });

    return {
      symbols,
      period,
      benchmarks,
      calculatedAt: new Date().toISOString(),
      warnings,
    };
  }
}

export const benchmarkService = new BenchmarkService();
