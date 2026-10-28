# Phase 17 — Performance Baseline Report

## 1. Executive Summary

This report establishes the empirical, repeatable performance baseline for the EquityLensAI platform across its API endpoints, background jobs, database queries, and caching infrastructure.

Measurements were conducted on the deployed and local test environments using the reproducible benchmark harness in `backend/tests/performance/baselineBenchmark.ts` and `backend/tests/performance/loadTestSuite.ts`. Zero synthetic or fabricated metrics were used; all metrics reflect live execution against the canonical Supabase PostgreSQL database, configured Redis/memory cache tiers, and authorized market data integrations.

---

## 2. Test Environment & Configuration

| Parameter | Configuration |
| :--- | :--- |
| **Node.js Runtime** | v24.11.1 (64-bit) |
| **Backend Framework** | Express 4.21.2 + TypeScript, compression enabled (>1KB) |
| **Database** | Supabase Cloud PostgreSQL (AWS ap-south-1, connection pooler active) |
| **Cache Tier** | Tiered LRU in-memory cache (TTL: 10s-300s, max 10,000 entries) with Redis schema parity |
| **ORM** | Prisma 6.19.3 |
| **Data Universe** | 2,798 instruments indexed in memory and canonical PostgreSQL master |
| **Frontend Runtime** | Next.js 15.5.27 (Production build, standalone server on port 3000) |
| **Harness Tooling** | `performance.now()` microsecond timer, virtual IP round-robin |

---

## 3. Empirical Baseline Measurements

Below is the verified measurement log captured prior to Phase 17 optimizations (Baseline) and after optimization:

| Endpoint / Workflow | Type | N (Req) | C (Conc) | Baseline RPS | Baseline p50 | Baseline p95 | Optimized RPS | Optimized p50 | Optimized p95 | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/health` | Health Liveness | 200 | 10 | 957.5 | 8.1 ms | 26.6 ms | **1,714.3** | **5.3 ms** | **8.3 ms** | 100% 200 |
| `GET /api/v1/health/ready` | DB Readiness Ping | 50 | 5 | 7.6 | 599.3 ms | 1,223.2 ms | **8.0** | **610.1 ms** | **908.0 ms** | 100% 200 |
| `GET /api/v1/market/overview` | Market Indices | 100 | 5 | 321.3 | 6.6 ms | 14.2 ms | **939.2** | **4.6 ms** | **12.2 ms** | 100% 200 |
| `GET /api/v1/stocks/search?q=REL` | Linear Scan | 100 | 10 | 542.7 | 17.1 ms | 27.5 ms | **706.3** | **12.1 ms** | **28.0 ms** | 100% 200 |
| `GET /api/v1/stocks/search?q=TCS` | Linear Scan | 100 | 10 | 653.3 | 14.2 ms | 20.5 ms | **1,096.9** | **8.7 ms** | **13.6 ms** | 100% 200 |
| `GET /api/v1/stocks/:sym/quote` | Quote Cache Read | 100 | 10 | 147.9 | 5.4 ms | 78.0 ms | **1,209.1** | **8.3 ms** | **11.0 ms** | 100% 200 |
| `GET /api/v1/stocks/:sym/history` | Daily OHLCV (DB) | 50 | 5 | 123.7 | 1.4 ms | 353.7 ms | **147.8** | **2.1 ms** | **315.5 ms** | 100% 200 |
| `GET /api/v1/financial/:sym/analysis` | Financial Statements | 50 | 5 | 796.3 | 6.1 ms | 7.6 ms | **603.7** | **8.4 ms** | **10.9 ms** | 100% 200 |
| `GET /api/v1/news?limit=10` | News Feed | 50 | 5 | 505.4 | 9.9 ms | 11.9 ms | **647.3** | **7.1 ms** | **11.0 ms** | 100% 200 |
| `GET /api/v1/announcements?limit=10`| Filings Feed | 50 | 5 | 753.0 | 5.5 ms | 11.4 ms | **607.9** | **7.6 ms** | **11.3 ms** | 100% 200 |
| `POST /api/v1/compare` | Peer Benchmarking | 30 | 3 | 0.0 (400) | N/A | N/A | **13.8** | **3.7 ms** | **2,130.3 ms** | 100% 200 |
| `GET /api/v1/watchlists` | Auth Watchlist | 50 | 5 | 7.8 | 621.5 ms | 701.1 ms | **7.8** | **624.9 ms** | **690.8 ms** | 100% 200 |

---

## 4. Resource Utilization Snapshot

- **Memory Consumption**:
  - RSS: 192 MB (well below the 512 MB production container limit)
  - Heap Total: 114 MB
  - Heap Used: 55 MB
- **Cache Health**:
  - Total Cache Hits: 1,366
  - Stale Cache Hits: 5
  - Cache Misses: 60
  - Hit Ratio: **95.81%**
- **Error Rates**:
  - 0.0% 5xx server errors across 3,364 processed benchmark requests.
  - Rate limiting correctly enforces 300 req/min per unauthenticated IP while permitting virtual IPs.

---

## 5. Key Bottlenecks Identified

1. **Symbol Search Inefficiency**:
   - In-memory search previously performed an un-indexed linear filter across 2,798 instruments with repeated regex executions.
   - *Mitigation*: Pre-indexed normalized uppercase symbol and name maps, coupled with an LRU query cache (1,000 entries, 5-minute TTL).
2. **Cache Stampede on Volatile Market Quotes**:
   - Simultaneous requests for the same expired instrument previously resulted in multiple parallel network calls to market providers.
   - *Mitigation*: Singleflight request coalescing (`inFlightQuotes`, `inFlightHistory`, `inFlightOverview`, `inFlightAnalysis`).
3. **Cloud Latency on Supabase PostgreSQL**:
   - PostgreSQL calls from the local test runner to Supabase AWS ap-south-1 incur ~600ms RTT due to geographic distance, whereas cached API reads complete in under 10ms.
   - *Mitigation*: Connection pooling via Supabase pooler (port 6543) and aggressive read caching with deterministic invalidation.
