interface BenchmarkConfig {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  totalRequests: number;
  concurrency: number;
}

export interface BenchmarkResult {
  name: string;
  totalRequests: number;
  concurrency: number;
  durationMs: number;
  rps: number;
  minMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  avgMs: number;
  successCount: number;
  errorCount: number;
  errorRatePercent: number;
  statusCodes: Record<number, number>;
}

interface PerformanceLike {
  now(): number;
}

interface ProcessLike {
  stdout: { write(str: string): boolean };
  exit(code?: number): never;
}

const perf: PerformanceLike =
  (globalThis as unknown as { performance?: PerformanceLike }).performance ?? {
    now: () => Date.now(),
  };

const proc: ProcessLike =
  (globalThis as unknown as { process?: ProcessLike }).process ?? {
    stdout: {
      write: (str: string) => {
        console.log(str);
        return true;
      },
    },
    exit: () => {
      throw new Error('Process exited');
    },
  };

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const { name, url, method = 'GET', headers = {}, body, totalRequests, concurrency } = config;
  const latencies: number[] = [];
  const statusCodes: Record<number, number> = {};
  let successCount = 0;
  let errorCount = 0;

  let requestIndex = 0;
  const startTime = perf.now();

  async function worker() {
    while (true) {
      const idx = requestIndex++;
      if (idx >= totalRequests) break;

      const reqStart = perf.now();
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.0.0.${(idx % 250) + 1}`, // Distribute virtual client IPs
            ...headers,
          },
          ...(body ? { body } : {}),
          signal: AbortSignal.timeout(10_000),
        });

        const reqDuration = perf.now() - reqStart;
        latencies.push(reqDuration);

        statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        const reqDuration = perf.now() - reqStart;
        latencies.push(reqDuration);
        errorCount++;
        statusCodes[0] = (statusCodes[0] || 0) + 1; // 0 for network/timeout error
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker());
  await Promise.all(workers);

  const durationMs = perf.now() - startTime;
  latencies.sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    if (latencies.length === 0) return 0;
    const index = Math.ceil((p / 100) * latencies.length) - 1;
    return latencies[Math.max(0, Math.min(index, latencies.length - 1))] ?? 0;
  };

  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avgMs = latencies.length > 0 ? sum / latencies.length : 0;
  const rps = durationMs > 0 ? (latencies.length / durationMs) * 1000 : 0;

  return {
    name,
    totalRequests,
    concurrency,
    durationMs: Math.round(durationMs),
    rps: Math.round(rps * 10) / 10,
    minMs: Math.round((latencies[0] ?? 0) * 10) / 10,
    p50Ms: Math.round(getPercentile(50) * 10) / 10,
    p90Ms: Math.round(getPercentile(90) * 10) / 10,
    p95Ms: Math.round(getPercentile(95) * 10) / 10,
    p99Ms: Math.round(getPercentile(99) * 10) / 10,
    maxMs: Math.round((latencies[latencies.length - 1] ?? 0) * 10) / 10,
    avgMs: Math.round(avgMs * 10) / 10,
    successCount,
    errorCount,
    errorRatePercent: Math.round((errorCount / (latencies.length || 1)) * 1000) / 10,
    statusCodes,
  };
}

async function main() {
  console.log('=== EQUITYLENSAI PERFORMANCE BASELINE BENCHMARK ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Target Server: http://localhost:4000\n');

  // Pre-authenticate a test user to obtain valid JWT for authenticated tests
  let authToken = '';
  try {
    const regRes = await fetch('http://localhost:4000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `bench_user_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Benchmark Runner',
      }),
    });
    const regData = (await regRes.json()) as { data?: { session?: { accessToken?: string } } };
    authToken = regData?.data?.session?.accessToken || '';
    console.log('Pre-authenticated benchmark user session established:', Boolean(authToken));
  } catch (err: unknown) {
    console.warn('Could not pre-authenticate user:', err instanceof Error ? err.message : String(err));
  }

  const testConfigs: BenchmarkConfig[] = [
    // 1. Lightweight Health Probe
    {
      name: '1. Health Liveness (Probe baseline)',
      url: 'http://localhost:4000/api/v1/health',
      totalRequests: 200,
      concurrency: 10,
    },
    // 2. Health Readiness Probe (DB ping + Memory check)
    {
      name: '2. Health Readiness (Supabase DB ping)',
      url: 'http://localhost:4000/api/v1/health/ready',
      totalRequests: 50,
      concurrency: 5,
    },
    // 3. Market Overview
    {
      name: '3. Market Overview (Cached Indices)',
      url: 'http://localhost:4000/api/v1/market/overview',
      totalRequests: 100,
      concurrency: 5,
    },
    // 4. Global Company & Symbol Search (Linear Scan in memory)
    {
      name: '4. Symbol Search ("REL" in 2,798 instruments)',
      url: 'http://localhost:4000/api/v1/stocks/search?q=REL&limit=10',
      totalRequests: 100,
      concurrency: 10,
    },
    // 5. Symbol Search Alternative ("TCS")
    {
      name: '5. Symbol Search ("TCS" in 2,798 instruments)',
      url: 'http://localhost:4000/api/v1/stocks/search?q=TCS&limit=10',
      totalRequests: 100,
      concurrency: 10,
    },
    // 6. Cached Stock Quote
    {
      name: '6. Stock Quote (RELIANCE - Cached 15s)',
      url: 'http://localhost:4000/api/v1/stocks/RELIANCE/quote',
      totalRequests: 100,
      concurrency: 10,
    },
    // 7. Historical OHLCV Daily Series (DB backed)
    {
      name: '7. Stock History (RELIANCE 1-month daily)',
      url: 'http://localhost:4000/api/v1/stocks/RELIANCE/history?from=2026-10-01&to=2026-10-28',
      totalRequests: 50,
      concurrency: 5,
    },
    // 8. Financial Analysis & Valuation
    {
      name: '8. Financial Analysis (RELIANCE statements & ratios)',
      url: 'http://localhost:4000/api/v1/financial/RELIANCE/analysis',
      totalRequests: 50,
      concurrency: 5,
    },
    // 9. Market News Feed
    {
      name: '9. Market News Feed (Limit 10)',
      url: 'http://localhost:4000/api/v1/news?limit=10',
      totalRequests: 50,
      concurrency: 5,
    },
    // 10. Corporate Announcements Feed
    {
      name: '10. Corporate Announcements Feed (Limit 10)',
      url: 'http://localhost:4000/api/v1/announcements?limit=10',
      totalRequests: 50,
      concurrency: 5,
    },
    // 11. Company Comparison
    {
      name: '11. Peer Comparison (TCS vs INFY)',
      url: 'http://localhost:4000/api/v1/compare',
      method: 'POST',
      body: JSON.stringify({
        symbols: [
          { symbol: 'TCS', exchange: 'NSE' },
          { symbol: 'INFY', exchange: 'NSE' },
        ],
      }),
      totalRequests: 30,
      concurrency: 3,
    },
    // 12. Authenticated User Watchlist Read
    ...(authToken
      ? [
          {
            name: '12. Authenticated Watchlist (User scoped)',
            url: 'http://localhost:4000/api/v1/watchlists',
            headers: { Authorization: `Bearer ${authToken}` },
            totalRequests: 50,
            concurrency: 5,
          },
        ]
      : []),
  ];

  const results: BenchmarkResult[] = [];

  for (const config of testConfigs) {
    proc.stdout.write(`Benchmarking: ${config.name} (N=${config.totalRequests}, C=${config.concurrency})... `);
    const res = await runBenchmark(config);
    results.push(res);
    console.log(`Done! p50: ${res.p50Ms}ms | p95: ${res.p95Ms}ms | p99: ${res.p99Ms}ms | RPS: ${res.rps} | Errors: ${res.errorRatePercent}%`);
  }

  console.log('\n=== BASELINE BENCHMARK SUMMARY TABLE ===\n');
  console.log('| Workflow / Endpoint | Req | Conc | RPS | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Status Codes |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    const codes = Object.entries(r.statusCodes).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`| ${r.name} | ${r.totalRequests} | ${r.concurrency} | ${r.rps} | ${r.p50Ms} | ${r.p90Ms} | ${r.p95Ms} | ${r.p99Ms} | ${r.errorRatePercent}% | ${codes} |`);
  }

  // Check metrics from /api/v1/metrics
  try {
    const metRes = await fetch('http://localhost:4000/api/v1/metrics');
    const metText = await metRes.text();
    console.log('\n=== APPLICATION METRICS SNAPSHOT ===');
    const relevantLines = metText.split('\n').filter(l => !l.startsWith('#') && l.trim().length > 0);
    console.log(relevantLines.slice(0, 15).join('\n'));
  } catch {
    // Ignore metrics endpoint read failures during benchmark summary
  }

  console.log('\n=== BASELINE BENCHMARK COMPLETE ===');
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  proc.exit(1);
});
