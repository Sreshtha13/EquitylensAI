# Capacity Planning & Production Scaling Analysis

## 1. Executive Summary

This capacity planning assessment evaluates the scaling boundaries of EquityLensAI based on empirical stress test measurements across our multi-tier architecture (Next.js 15 frontend, Express backend, Supabase PostgreSQL pooler, and tiered LRU/Redis caching).

---

## 2. Tested Capacity & Measured Limits

| Component | Tested Workload | Measured Ceiling / Saturation Point | Primary Bottleneck Factor |
| :--- | :--- | :--- | :--- |
| **Node.js Express Backend** | 1,040–2,142 RPS sustained; 40 concurrent clients | Single-node CPU saturation at ~1,800–2,200 RPS | Single-threaded Node.js event-loop |
| **In-Memory Search Dictionary** | 2,798 instruments; query length 2–10 chars | 706–1,096 RPS (p95 < 29.5 ms) | Substring regex matching over 2,798 entries |
| **Supabase PostgreSQL Pooler** | Port 6543, pool limit: 15 connections | ~40–50 concurrent queries | Remote geographic round-trip latency (~600ms RTT) |
| **Angel One SmartAPI Quota** | Bounded quote & LTP fetches | 10 req / sec contractual limit | Third-party provider rate ceiling |
| **Next.js 15 Frontend Server** | 10 core pages SSR render | 800+ requests / sec (p50 < 30 ms) | Node.js React SSR execution |

---

## 3. Bottleneck Analysis & Saturation Curve

```
Throughput (RPS)
   ^
   |                     *---* (1,342 RPS @ C=20)
   |                 *           * (1,270 RPS @ C=30 - Event-loop saturates)
   |             *
   |         * (1,103 RPS @ C=10)
   |     *
   |  * (1,038 RPS @ C=5)
   +--------------------------------------------------> Concurrency (Virtual Users)
```

1. **First Observed Saturation**: Node.js single-thread CPU saturation occurs between 30 and 40 concurrent workers under continuous search filtering.
2. **Postgres Connection Isolation**: The Supabase transaction pooler on port 6543 successfully isolated Postgres from connection storms, maintaining zero connection rejections during 40-concurrency bursts.
3. **Cache Efficiency Shield**: Because 95.8% of read traffic was absorbed by the caching layer and Singleflight coalescer, third-party provider quotas (Angel One / Yahoo) remained completely protected from traffic bursts.

---

## 4. Scaling Roadmap & Growth Recommendations

### Phase A: 0 to 10,000 Active Users (Current Deployment)
- **Architecture**: Single Docker container (1 vCPU, 512 MB RAM) + Supabase Starter tier + LRU in-process cache + Supabase pooler.
- **Estimated Headroom**: Sufficient for current workload. Verified capable of delivering 1,000+ RPS sustained.

### Phase B: 10,000 to 100,000 Active Users
- **Backend**: Scale Express API horizontally to 3–5 cluster worker instances behind an AWS ALB or Cloudflare Load Balancer.
- **Cache**: Transition Tier-1 memory cache to Upstash / ElastiCache Redis cluster so all worker processes share a single unified cache universe.
- **Search**: For universes expanding past 10,000 global instruments, migrate symbol search from in-process array scanning to PostgreSQL Trigram search (`pg_trgm`) or MeiliSearch / Typesense.

### Phase C: 100,000+ Active Users (Enterprise Scale)
- **Read Replicas**: Provision a dedicated read replica on Supabase PostgreSQL for analytical queries and screener filters.
- **Streaming WebSockets**: Introduce dedicated WebSocket micro-workers for live tick streaming, decoupling push connections from the Express REST API.
