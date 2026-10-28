# Controlled Load Testing Plan

## 1. Objectives & Testing Scope

The primary objective of the load testing program is to establish empirical capacity limits, discover resource saturation points, and verify system stability, data integrity, and security under sustained and bursting traffic.

### Scope of Workloads Tested
1. **Lightweight Probe & Telemetry**: `GET /api/v1/health`, `GET /api/v1/metrics`.
2. **Market Public Reads**: `GET /api/v1/market/overview`, `GET /api/v1/stocks/:sym/quote`.
3. **Interactive Search & Autocomplete**: `GET /api/v1/stocks/search?q=:query`.
4. **Historical Database Range Reads**: `GET /api/v1/stocks/:sym/history`.
5. **Heavy Financial Statement Aggregations**: `GET /api/v1/financial/:sym/analysis`.
6. **Market Intelligence Feeds**: `GET /api/v1/news`, `GET /api/v1/announcements`.
7. **Complex Multi-Company Comparison**: `POST /api/v1/compare`.
8. **Authenticated User Scoped Reads**: `GET /api/v1/watchlists`.

---

## 2. Test Safeguards & Ethical Rules

To comply with Section 3 mandatory rules:
- **No Production Overload**: Load tests run strictly against local/staging test instances and mock/replayed upstream endpoints.
- **Provider Protection**: Never send rapid virtual-user traffic to live Angel One or Yahoo endpoints. Upstream fetches are protected by the Singleflight deduplicator and LRU cache tier.
- **Virtual Client IP Rotation**: Benchmark harness simulates diverse client IPs via `X-Forwarded-For` header round-robin (`10.0.0.1`–`10.0.0.250`) to validate rate-limiter accuracy without causing false IP blocks.
- **Data Isolation**: Benchmark uses dedicated test accounts (`bench_user_*@example.com`) and cleans up created resources.

---

## 3. Test Profiles & Progression (Stages A through G)

| Test Stage | Profile Name | Concurrency (C) | Request Volume (N) | Target / Evaluation Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Stage A** | **Smoke Test** | 2 | 20 | Verify endpoint functionality, headers, and zero errors before high load. |
| **Stage B** | **Baseline Load** | 5 | 100 | Establish typical operational latency and throughput. |
| **Stage C** | **Ramp-Up Test** | 10 -> 20 -> 30 | 100 -> 200 -> 300 | Measure throughput scaling and latency degradation curves as concurrency triples. |
| **Stage D** | **Sustained Load** | 15 | 300 | Maintain steady concurrent traffic to detect memory leaks and event-loop lag. |
| **Stage E** | **Spike Test** | 40 | 200 | Apply immediate 40-concurrent user burst to verify queueing and recovery. |
| **Stage F** | **Post-Spike Recovery** | 2 | 30 | Cool down and verify latency normalizes immediately to sub-5ms levels. |
| **Stage G** | **Bottleneck Isolation**| 5–10 | 50–100 | Individually isolate Cache-heavy, Search/CPU-heavy, and DB-heavy request paths. |

---

## 4. Execution Command & Automation

The entire testing plan is codified in `backend/tests/performance/loadTestSuite.ts` and can be executed reproducibly with:

```bash
cd backend
npx tsx tests/performance/loadTestSuite.ts
```
