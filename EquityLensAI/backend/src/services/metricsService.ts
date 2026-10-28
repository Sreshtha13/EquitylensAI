export type ProviderMetric = {
  requests: number;
  successes: number;
  failures: number;
  lastLatencyMs: number;
  lastStatus: string;
  lastErrorAt: string | null;
};

export type JobMetric = {
  runs: number;
  successes: number;
  failures: number;
  lastDurationMs: number;
  lastRunAt: string | null;
  lastError: string | null;
};

class MetricsService {
  private readonly startTime = Date.now();
  private totalRequests = 0;
  private statusCodes: { '2xx': number; '3xx': number; '4xx': number; '5xx': number } = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  private activeRequests = 0;
  private readonly recentLatencies: number[] = [];
  private readonly maxLatencies = 1000;

  // External Providers
  private readonly providers = new Map<string, ProviderMetric>();

  // Background Jobs
  private readonly jobs = new Map<string, JobMetric>();

  // AI Telemetry
  private aiRequests = 0;
  private aiSuccesses = 0;
  private aiFailures = 0;
  private aiTotalInputTokens = 0;
  private aiTotalOutputTokens = 0;
  private aiTotalDurationMs = 0;

  // Cache outcomes
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheStaleHits = 0;

  // ─── HTTP Request Tracking ───

  requestStarted(): void {
    this.totalRequests += 1;
    this.activeRequests += 1;
  }

  requestCompleted(statusCode: number, durationMs: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (statusCode >= 200 && statusCode < 300) {
      this.statusCodes['2xx'] += 1;
    } else if (statusCode >= 300 && statusCode < 400) {
      this.statusCodes['3xx'] += 1;
    } else if (statusCode >= 400 && statusCode < 500) {
      this.statusCodes['4xx'] += 1;
    } else {
      this.statusCodes['5xx'] += 1;
    }

    this.recentLatencies.push(durationMs);
    if (this.recentLatencies.length > this.maxLatencies) {
      this.recentLatencies.shift();
    }
  }

  // ─── Provider Tracking ───

  recordProviderCall(provider: string, success: boolean, durationMs: number, status = 'ok'): void {
    let metric = this.providers.get(provider);
    if (!metric) {
      metric = {
        requests: 0,
        successes: 0,
        failures: 0,
        lastLatencyMs: 0,
        lastStatus: 'ok',
        lastErrorAt: null,
      };
      this.providers.set(provider, metric);
    }

    metric.requests += 1;
    metric.lastLatencyMs = durationMs;
    metric.lastStatus = status;

    if (success) {
      metric.successes += 1;
    } else {
      metric.failures += 1;
      metric.lastErrorAt = new Date().toISOString();
    }
  }

  // ─── Cache Tracking ───

  recordCacheHit(isStale = false): void {
    if (isStale) {
      this.cacheStaleHits += 1;
    } else {
      this.cacheHits += 1;
    }
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  // ─── Background Jobs Tracking ───

  recordJobExecution(jobName: string, success: boolean, durationMs: number, errorMsg?: string): void {
    let job = this.jobs.get(jobName);
    if (!job) {
      job = {
        runs: 0,
        successes: 0,
        failures: 0,
        lastDurationMs: 0,
        lastRunAt: null,
        lastError: null,
      };
      this.jobs.set(jobName, job);
    }

    job.runs += 1;
    job.lastDurationMs = durationMs;
    job.lastRunAt = new Date().toISOString();

    if (success) {
      job.successes += 1;
      job.lastError = null;
    } else {
      job.failures += 1;
      job.lastError = errorMsg ? errorMsg.slice(0, 200) : 'unknown error';
    }
  }

  // ─── AI Telemetry Tracking ───

  recordAiCall(success: boolean, durationMs: number, inputTokens = 0, outputTokens = 0): void {
    this.aiRequests += 1;
    if (success) {
      this.aiSuccesses += 1;
      this.aiTotalDurationMs += durationMs;
      this.aiTotalInputTokens += inputTokens;
      this.aiTotalOutputTokens += outputTokens;
    } else {
      this.aiFailures += 1;
    }
  }

  // ─── Report Snapshot ───

  getMetricsSnapshot() {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const sorted = [...this.recentLatencies].sort((a, b) => a - b);
    const count = sorted.length;

    const p50 = count > 0 ? sorted[Math.floor(count * 0.5)] : 0;
    const p95 = count > 0 ? sorted[Math.floor(count * 0.95)] : 0;
    const p99 = count > 0 ? sorted[Math.floor(count * 0.99)] : 0;
    const avg = count > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / count) : 0;
    const max = count > 0 ? sorted[count - 1] : 0;

    const totalCacheAccess = this.cacheHits + this.cacheStaleHits + this.cacheMisses;
    const hitRatio = totalCacheAccess > 0 ? Number(((this.cacheHits + this.cacheStaleHits) / totalCacheAccess).toFixed(4)) : 0;

    const memoryUsage = process.memoryUsage();

    return {
      service: 'equitylensai-api',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      http: {
        totalRequests: this.totalRequests,
        activeRequests: this.activeRequests,
        statusCodes: { ...this.statusCodes },
        latencyMs: {
          sampleCount: count,
          avg,
          p50,
          p95,
          p99,
          max,
        },
      },
      cache: {
        hits: this.cacheHits,
        staleHits: this.cacheStaleHits,
        misses: this.cacheMisses,
        hitRatio,
      },
      providers: Object.fromEntries(this.providers.entries()),
      backgroundJobs: Object.fromEntries(this.jobs.entries()),
      ai: {
        totalRequests: this.aiRequests,
        successes: this.aiSuccesses,
        failures: this.aiFailures,
        totalInputTokens: this.aiTotalInputTokens,
        totalOutputTokens: this.aiTotalOutputTokens,
        avgLatencyMs: this.aiSuccesses > 0 ? Math.round(this.aiTotalDurationMs / this.aiSuccesses) : 0,
      },
      system: {
        heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      },
    };
  }
}

export const metricsService = new MetricsService();
