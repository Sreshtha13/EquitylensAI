# Performance Targets & SLA Specifications

## 1. Overview & Objective

This document defines measurable, workload-specific performance targets and Service Level Agreements (SLAs) for the EquityLensAI platform. Targets are anchored in empirical baseline data captured during Phase 17 testing across Supabase PostgreSQL, Redis caching, Node.js Express backend, and the Next.js 15 frontend.

---

## 2. API & Backend Target Specifications

| Request Category | Example Endpoints | Workload / Conditions | Target p50 | Target p95 | Target p99 | Max Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lightweight Cached API Reads** | `GET /api/v1/health`, `GET /api/v1/market/overview`, `GET /api/v1/stocks/:sym/quote` | In-memory / Redis cache hit; concurrency 10–50 | < 10 ms | < 50 ms | < 100 ms | < 0.1% |
| **Symbol & Global Search** | `GET /api/v1/stocks/search?q=:query` | 2,798 instruments in-memory index; concurrency 10–30 | < 15 ms | < 35 ms | < 50 ms | < 0.1% |
| **Database-Backed Reads (Local/Co-located)** | `GET /api/v1/announcements`, `GET /api/v1/news`, `GET /api/v1/stocks/:sym/history` | Indexed queries via Supabase Pooler; limit 10–50 | < 30 ms | < 100 ms | < 250 ms | < 0.5% |
| **Cross-Region Database Reads** | `GET /api/v1/health/ready`, `GET /api/v1/watchlists` | Cross-cloud RTT (Client -> Supabase ap-south-1) | < 650 ms | < 900 ms | < 1,200 ms | < 1.0% |
| **Analytical Calculations & Peer Benchmarking** | `POST /api/v1/compare`, `GET /api/v1/financial/:sym/analysis` | Multi-company financial statement aggregation & ratio derivation | < 50 ms (cached)<br>< 2.5 s (provider miss) | < 200 ms (cached)<br>< 3.5 s (miss) | < 500 ms (cached)<br>< 5.0 s (miss) | < 1.0% |
| **Stock Screener Execution** | `POST /api/v1/screener/run` | Multi-filter metric scans over 2,000+ instruments | < 100 ms (cached)<br>< 800 ms (db query) | < 250 ms (cached)<br>< 1.5 s (db) | < 500 ms (cached)<br>< 2.5 s (db) | < 1.0% |
| **AI Research & Synthesis** | `POST /api/v1/research/projects/:id/ai/summarize` | Gemini 3.5 Flash / 2.5 Flash streaming invocation | < 2.0 s (first token)<br>< 6.0 s (completion) | < 4.0 s (first token)<br>< 10.0 s (completion) | < 15.0 s | < 2.0% |

---

## 3. Frontend Web Performance Targets (Core Web Vitals)

Targeted against production builds rendered by Next.js 15 App Router:

| Metric | Target | Method / Tooling |
| :--- | :--- | :--- |
| **Largest Contentful Paint (LCP)** | < 2.5 seconds | Lighthouse / Chrome DevTools Performance |
| **Interaction to Next Paint (INP)** | < 200 ms | PerformanceObserver API on client interactions |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Layout shift tracking on dynamic charts & tables |
| **Initial Server Response (TTFB)** | < 150 ms (co-located)<br>< 300 ms (remote) | Next.js server-rendered route response |
| **JavaScript Client Bundle** | < 250 KB (initial load) | Webpack / Next bundle analyzer chunk splitting |

---

## 4. Ingestion & Background Job Targets

| Job Type | Target Execution Window | Throughput Target | Idempotency / Error Target |
| :--- | :--- | :--- | :--- |
| **Daily Market EOD Observation Sync** | Nightly 18:30 IST (window: 30 min) | > 50 instruments / sec | 0 duplicate records; batch upsert idempotency |
| **Corporate Filings / News Ingestion** | Every 15 minutes | < 45 seconds total duration | Deduplication on `sourceId` and URL hashes |
| **Alert Rule Evaluation Scheduler** | Every 60 seconds | < 1,000 ms per run (for 500 rules) | Zero false triggers, state persisted in PostgreSQL |
| **Redis Cache Eviction & Cleanup** | Continuous LRU / TTL | Zero memory exhaustion (>80% RAM alert) | Deterministic invalidation on upsert |

---

## 5. Security & Isolation SLAs Under Load

1. **Multi-Tenant Data Isolation**: 0.0% cross-user leakage under any concurrency level (enforced by `userId` scoping in all Prisma queries and row-level authorization middleware).
2. **Rate Limiting Resilience**: 300 requests/minute per client IP enforced with 429 Retry-After headers without crashing or memory accumulation.
3. **Graceful Degradation**: When third-party providers (Angel One / Yahoo) fail or rate-limit, the application serves stale cached data with `isStale: true` and `freshness: 'stale'` rather than throwing 500 errors.
