# Redis & In-Memory Cache Inventory

**Document:** Platform Cache Inventory & Key Namespace Architecture  
**Phase:** 15 — Audit & Hardening  
**Target Architecture:** Dual-Tier Redis & In-Memory Acceleration  
**Status:** Canonical Reference Specification  

---

## 1. Live Redis Deployment Audit

### Live Connectivity Measurements (Executed October 2026):
- **Port Scan (Local 6379):** Inactive / No TCP connection detected (`Get-NetTCPConnection -LocalPort 6379` returned non-zero).
- **Process Inspection:** No Redis server process (`redis-server.exe`, `redis.exe`) running on the host system.
- **Dependency Inspection:** `backend/package.json` contains no Redis client packages (`ioredis`, `redis`, `upstash`).
- **Live Cache Status:** The platform operates exclusively on an institutional in-memory cache architecture (`MemoryCache` and `CacheManager`), maintaining strict entry bounds (10,000 maximum entries), FIFO/expiration eviction, and Prometheus metrics telemetry.

---

## 2. Standardized Cache Key Namespace Inventory

| Key Pattern | Purpose | Creating Service | Reading Service | Value Type & Size | TTL Policy | Scope | Canonical Source | Impact of Key Loss | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `quote:{EXCH}:{SYM}` | Live & delayed quote snapshot | `marketService.getQuote` | `marketService.getQuote` | JSON (`NormalizedQuote`), ~1.2 KB | Fresh: 15s<br>Stale: 90s | Shared across users | Angel SmartAPI / Yahoo Finance | Zero data loss; transparent re-fetch on miss | Retain in cache tier |
| `history:{EXCH}:{SYM}:{interval}:{from}:{to}` | Historical OHLCV candle response | `marketService.getHistoricalPrices` | `marketService.getHistoricalPrices` | JSON (`HistoricalPrices`), 5 KB–150 KB | Fresh: 60s<br>Stale: 300s | Shared across users | PostgreSQL `market_daily_observations` | Zero data loss; reads from PostgreSQL | Retain in cache tier; backed by PostgreSQL |
| `overview:{market}` | Market indices overview (Nifty, Sensex, etc.) | `marketService.getMarketOverview` | `marketService.getMarketOverview` | JSON (`MarketOverview`), ~2.5 KB | Fresh: 15s<br>Stale: 60s | Shared across users | Angel One / Yahoo Index Feed | Zero data loss; transparent re-fetch on miss | Retain in cache tier |
| `profile:{EXCH}:{SYM}` | Extended company profile, sector, industry | `marketService.getCompanyProfile` | `marketService.getCompanyProfile` | JSON (`CompanyProfile`), ~3.0 KB | Fresh: 24h<br>Stale: 48h | Shared across users | PostgreSQL `market_instruments` / Yahoo Summary | Zero data loss; transparent re-fetch | Retain in cache tier |
| `performance:{EXCH}:{SYM}:v{calcVersion}` | Multi-period return & volatility analytics | `marketService.getStockPerformance` | `marketService.getStockPerformance` | JSON (`StockPerformanceResponse`), ~2.2 KB | Fresh: 1h<br>Stale: 24h | Shared across users | PostgreSQL `market_daily_observations` | Zero data loss; deterministic recomputation | Versioned by `CALCULATION_VERSION` |
| `financial:{EXCH}:{SYM}:v{calcVersion}` | Fundamental statements, ratios & health score | `financialService.getFinancialAnalysis` | `financialService.getFinancialAnalysis` | JSON (`FinancialAnalysis`), ~25 KB | Fresh: 4h<br>Stale: 24h | Shared across users | Yahoo Financial Provider + Canonical DB | Zero data loss; pure deterministic calculation | Versioned by `CALCULATION_VERSION` |
| `user:{userId}:{namespace}:{id}` | User-specific cached entities (portfolios, watchlists) | `portfolioRepository`, `userRepository` | Same repositories on read | JSON (Domain entities), 1 KB–10 KB | Fresh: 60s<br>Stale: 120s | Strictly isolated to `userId` | PostgreSQL (`portfolios`, `watchlists`) | Zero data loss; canonical records reside in PostgreSQL | Maintain user isolation prefix |
| `ratelimit:{ip}` | Sliding window API rate limiting | `rateLimit.ts` middleware | Rate limit middleware | In-memory timestamp array, ~200 B | Sliding 60s | Scoped to Client IP | Transient memory | Counter resets; negligible impact | Retain in volatile tier |

---

## 3. Cache Invalidation & Stampede Safeguards

1. **Stampede Defense:** When a popular quote or chart series expires, the stale-while-revalidate pattern serves the existing cached value with `isStale: true` while an asynchronous background worker repopulates fresh market data.
2. **Deterministic Version Invalidation:** Any modification to calculation rules or ratio definitions increments `CALCULATION_VERSION` (currently `'1.0.0'`), instantaneously isolating subsequent reads from obsolete cached calculations without requiring an expensive global flush.
3. **No Unauthenticated Leaks:** User-specific state is strictly prepended with `user:{userId}:` and validated against JWT session context prior to cache emission.
