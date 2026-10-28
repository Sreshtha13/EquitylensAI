# Redis & In-Memory Cache Production Configuration

**Document:** Caching Infrastructure & High-Performance Read Acceleration  
**Version:** 1.0.0  
**Phase:** 16 — Production Deployment & Live NSE/BSE Data Verification  
**Date:** October 2026  
**Status:** Canonical Reference Specification  

---

## 1. Architectural Role & Boundary Rules

In accordance with the **Phase 15 Persistence Policy**, the caching tier (in-memory `MemoryCache` and optional remote Redis) is strictly classified as an **ephemeral read accelerator**.

### Mandatory Invariants:
1. **Zero Data Loss on Cache Eviction or Flush:** Cache loss must NEVER cause loss of user data, transactions, reports, watchlists, or financial records. All canonical entities reside in Supabase PostgreSQL.
2. **Prohibited Stores:** Redis and MemoryCache must NEVER be the sole persistent store for:
   - User portfolios, transactions, or tax lots
   - User watchlists and favorites
   - Saved screener strategy definitions
   - Investment research workbench reports or analyst notes
   - Audited financial statements or canonical daily market observations
3. **Graceful Degradation:** When Redis is unconfigured or experiencing network partitions, the application falls back transparently to the bounded in-memory cache and canonical PostgreSQL without serving errors to users.

---

## 2. Standardized Cache Namespaces & TTL Policies

| Key Pattern | Data Category | Fresh TTL | Stale TTL | Eviction Policy | Canonical Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `quote:{EXCH}:{SYM}` | Live & delayed quote snapshot | 15s | 90s | FIFO / TTL Expiry | Angel One SmartAPI / Yahoo Finance |
| `history:{EXCH}:{SYM}:{interval}:{from}:{to}` | Historical OHLCV candle series | 60s | 300s | FIFO / TTL Expiry | PostgreSQL `market_daily_observations` |
| `overview:{market}` | Market indices overview (Nifty 50, Sensex) | 15s | 60s | FIFO / TTL Expiry | Angel One / Yahoo Index Feed |
| `profile:{EXCH}:{SYM}` | Company profile & industry classification | 24h | 48h | FIFO / TTL Expiry | PostgreSQL `market_instruments` |
| `performance:{EXCH}:{SYM}:v{calcVersion}` | Stock return & volatility analytics | 1h | 24h | FIFO / TTL Expiry | PostgreSQL `market_daily_observations` |
| `financial:{EXCH}:{SYM}:v{calcVersion}` | Fundamental statements, ratios & health | 4h | 24h | FIFO / TTL Expiry | Yahoo Finance + PostgreSQL |
| `user:{userId}:{namespace}:{id}` | Isolated user cache (watchlists, alerts) | 60s | 120s | FIFO / TTL Expiry | PostgreSQL (`watchlists`, `portfolios`) |
| `ratelimit:{ip}` | Sliding-window API rate limiting | 60s | N/A | Sliding Window | Reset counter in memory |

---

## 3. In-Memory Cache Hardening

The current backend implementation provides institutional-grade in-memory acceleration via `CacheManager` and `MemoryCache`:
- **Max Entries:** Strictly bounded to **10,000 entries** to prevent Node.js heap exhaustion.
- **Eviction Strategy:** First-In, First-Out (FIFO) eviction upon reaching capacity, coupled with active TTL expiration checks.
- **Stale-While-Revalidate:** When an entry passes its `freshTtlSeconds` but remains within `staleTtlSeconds`, the cache serves the stale value marked with `isStale: true` while refreshing data asynchronously, mitigating cache stampedes on market spikes.
- **Telemetry:** Exposes real-time hit counts, miss counts, size, and eviction counts via `GET /api/v1/metrics`.

---

## 4. Production Redis Deployment Guide (Optional Tier)

For horizontally scaled deployments across multiple backend container replicas, a centralized Redis cluster can be attached:

1. **Recommended Managed Providers:**
   - **Upstash Redis (Serverless):** Native TLS, zero idle cost, per-request pricing, ideal for bursty research traffic.
   - **AWS ElastiCache (Redis):** Node-based cluster in `ap-south-1` (Mumbai) for ultra-low latency co-located with Supabase.
2. **Configuration in `.env`:**
   ```bash
   REDIS_URL=rediss://default:your-token@your-cluster.upstash.io:6379
   ```
3. **Connection Security:**
   - Always enforce TLS (`rediss://` scheme).
   - Require strong password authentication (`AUTH`).
   - Restrict network security groups to backend container egress IPs only.
