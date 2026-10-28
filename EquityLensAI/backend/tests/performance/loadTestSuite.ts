import { runBenchmark, type BenchmarkResult } from './baselineBenchmark.js';

interface TestStageResult {
  stage: string;
  concurrency: number;
  totalRequests: number;
  durationMs: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRatePercent: number;
}

export async function runLoadTestSuite() {
  console.log('================================================================');
  console.log('   EQUITYLENSAI CONTROLLED LOAD TESTING SUITE (STAGE 10)       ');
  console.log('================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Safeguards Active: Internal mock/replay on external market APIs, isolated test IPs.');
  console.log('');

  const stages: TestStageResult[] = [];

  // Helper to record stage
  function recordStage(stage: string, res: BenchmarkResult) {
    stages.push({
      stage,
      concurrency: res.concurrency,
      totalRequests: res.totalRequests,
      durationMs: res.durationMs,
      rps: res.rps,
      p50Ms: res.p50Ms,
      p95Ms: res.p95Ms,
      p99Ms: res.p99Ms,
      errorRatePercent: res.errorRatePercent,
    });
  }

  // --- STAGE A: SMOKE TEST ---
  console.log('\n--- [Stage A] Smoke Test (Verification under minimal load C=2) ---');
  const smoke = await runBenchmark({
    name: 'Stage A: Smoke Probe',
    url: 'http://localhost:4000/api/v1/market/overview',
    totalRequests: 20,
    concurrency: 2,
  });
  recordStage('A. Smoke Test', smoke);
  console.log(`Smoke Result: p50=${smoke.p50Ms}ms, p95=${smoke.p95Ms}ms, RPS=${smoke.rps}, Errors=${smoke.errorRatePercent}%`);

  // --- STAGE B: BASELINE LOAD ---
  console.log('\n--- [Stage B] Baseline Load (Mixed Reads C=5) ---');
  const baseline = await runBenchmark({
    name: 'Stage B: Baseline Mixed Reads',
    url: 'http://localhost:4000/api/v1/stocks/search?q=INFY&limit=10',
    totalRequests: 100,
    concurrency: 5,
  });
  recordStage('B. Baseline Load', baseline);
  console.log(`Baseline Result: p50=${baseline.p50Ms}ms, p95=${baseline.p95Ms}ms, RPS=${baseline.rps}, Errors=${baseline.errorRatePercent}%`);

  // --- STAGE C: RAMP-UP TEST ---
  console.log('\n--- [Stage C] Ramp-Up Test (Step 1: C=10, Step 2: C=20, Step 3: C=30) ---');
  for (const c of [10, 20, 30]) {
    process.stdout.write(`Ramping up to Concurrency ${c}... `);
    const ramp = await runBenchmark({
      name: `Stage C: Ramp Concurrency ${c}`,
      url: 'http://localhost:4000/api/v1/stocks/search?q=REL&limit=10',
      totalRequests: c * 10,
      concurrency: c,
    });
    recordStage(`C. Ramp-Up (C=${c})`, ramp);
    console.log(`p50=${ramp.p50Ms}ms, p95=${ramp.p95Ms}ms, RPS=${ramp.rps}, Errors=${ramp.errorRatePercent}%`);
  }

  // --- STAGE D: SUSTAINED LOAD TEST ---
  console.log('\n--- [Stage D] Sustained Load Test (C=15 over 300 requests) ---');
  const sustained = await runBenchmark({
    name: 'Stage D: Sustained Load',
    url: 'http://localhost:4000/api/v1/stocks/RELIANCE/quote',
    totalRequests: 300,
    concurrency: 15,
  });
  recordStage('D. Sustained Load', sustained);
  console.log(`Sustained Result: p50=${sustained.p50Ms}ms, p95=${sustained.p95Ms}ms, RPS=${sustained.rps}, Errors=${sustained.errorRatePercent}%`);

  // --- STAGE E: SPIKE TEST ---
  console.log('\n--- [Stage E] Spike Test (Sudden burst C=40) ---');
  const spike = await runBenchmark({
    name: 'Stage E: Spike Burst',
    url: 'http://localhost:4000/api/v1/market/overview',
    totalRequests: 200,
    concurrency: 40,
  });
  recordStage('E. Spike Burst (C=40)', spike);
  console.log(`Spike Result: p50=${spike.p50Ms}ms, p95=${spike.p95Ms}ms, RPS=${spike.rps}, Errors=${spike.errorRatePercent}%`);

  // --- STAGE F: RECOVERY TEST ---
  console.log('\n--- [Stage F] Recovery Test (Return to low load C=2, verify latency normalization) ---');
  await new Promise((r) => setTimeout(r, 1000)); // 1s cool down
  const recovery = await runBenchmark({
    name: 'Stage F: Post-Spike Recovery',
    url: 'http://localhost:4000/api/v1/market/overview',
    totalRequests: 30,
    concurrency: 2,
  });
  recordStage('F. Post-Spike Recovery', recovery);
  console.log(`Recovery Result: p50=${recovery.p50Ms}ms, p95=${recovery.p95Ms}ms, RPS=${recovery.rps}, Errors=${recovery.errorRatePercent}%`);

  // --- STAGE G: BOTTLENECK ISOLATION ---
  console.log('\n--- [Stage G] Bottleneck Isolation Testing ---');

  // G1: Cache-heavy endpoint
  const cacheHeavy = await runBenchmark({
    name: 'G1. Cache-Heavy (Overview)',
    url: 'http://localhost:4000/api/v1/market/overview',
    totalRequests: 100,
    concurrency: 10,
  });
  recordStage('G1. Cache-Heavy', cacheHeavy);
  console.log(`G1 (Cache-Heavy): p50=${cacheHeavy.p50Ms}ms, p95=${cacheHeavy.p95Ms}ms, RPS=${cacheHeavy.rps}`);

  // G2: In-memory search / CPU-heavy
  const searchHeavy = await runBenchmark({
    name: 'G2. Search-Heavy (Symbol Search)',
    url: 'http://localhost:4000/api/v1/stocks/search?q=BANK&limit=10',
    totalRequests: 100,
    concurrency: 10,
  });
  recordStage('G2. Search-Heavy', searchHeavy);
  console.log(`G2 (Search-Heavy): p50=${searchHeavy.p50Ms}ms, p95=${searchHeavy.p95Ms}ms, RPS=${searchHeavy.rps}`);

  // G3: Database-backed read
  const dbHeavy = await runBenchmark({
    name: 'G3. DB-Heavy (Announcements)',
    url: 'http://localhost:4000/api/v1/announcements?limit=10',
    totalRequests: 50,
    concurrency: 5,
  });
  recordStage('G3. DB-Heavy', dbHeavy);
  console.log(`G3 (DB-Heavy): p50=${dbHeavy.p50Ms}ms, p95=${dbHeavy.p95Ms}ms, RPS=${dbHeavy.rps}`);

  // Output Final Load Test Summary
  console.log('\n================================================================');
  console.log('              LOAD TESTING SUITE RESULTS SUMMARY                 ');
  console.log('================================================================\n');

  console.log('| Stage / Scenario | Concurrency | Total Req | Duration (s) | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Error % |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const s of stages) {
    console.log(
      `| ${s.stage} | ${s.concurrency} | ${s.totalRequests} | ${(s.durationMs / 1000).toFixed(2)}s | ${s.rps} | ${s.p50Ms} | ${s.p95Ms} | ${s.p99Ms} | ${s.errorRatePercent}% |`
    );
  }

  // Memory snapshot
  const mem = process.memoryUsage();
  console.log(`\nFinal Test Runner Memory: Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB | RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log('================================================================\n');
}

// Direct execution
if (process.argv[1]?.endsWith('loadTestSuite.ts') || process.argv[1]?.endsWith('loadTestSuite.js')) {
  runLoadTestSuite().catch((err) => {
    console.error('Load testing suite failed:', err);
    process.exit(1);
  });
}
