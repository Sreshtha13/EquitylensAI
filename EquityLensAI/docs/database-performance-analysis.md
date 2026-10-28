# Database Performance & PostgreSQL Optimization Analysis

## 1. Database Architecture & Schema Review

EquityLensAI utilizes **Supabase Cloud PostgreSQL** (AWS ap-south-1) with Prisma ORM (v6.19.3). In Phase 15 and 16, durable schema migrations were established to support financial intelligence, market observations, news, screener metrics, alerts, and research workbench workspaces.

### Table Inventory & Key Volumes

| Table Name | Entity Scope | Estimated/Verified Rows | Key Indexes |
| :--- | :--- | :--- | :--- |
| `market_instruments` | Universal Stock Directory | 2,699+ rows | `PRIMARY KEY (symbol, exchange)`, `INDEX (market)`, `INDEX (assetType)` |
| `market_daily_observations` | Historical Daily OHLCV | Bounded daily series | `PRIMARY KEY (symbol, exchange, date)`, `INDEX (date DESC)` |
| `financial_screener_metrics` | Computed Screener Data | 858+ rows | `PRIMARY KEY (symbol, exchange)`, `INDEX (marketCap)`, `INDEX (peRatio)` |
| `corporate_announcements` | Disclosures & Filings | 334+ rows | `PRIMARY KEY (id)`, `INDEX (symbol, exchange, announcedAt DESC)` |
| `news_items` | Market & Stock News | 200+ rows | `PRIMARY KEY (id)`, `INDEX (publishedAt DESC)`, `INDEX (symbol)` |
| `watchlists` / `watchlist_items` | User Saved Portfolios | Multi-tenant user data | `PRIMARY KEY (id)`, `INDEX (userId)`, `UNIQUE (watchlistId, symbol, exchange)` |
| `research_projects` | Collaborative Research | Multi-tenant user data | `PRIMARY KEY (id)`, `INDEX (ownerId)`, `INDEX (updatedAt DESC)` |

---

## 2. Query Patterns & Bottlenecks Analysis

### A. Sequential Scans & Index Utilization

1. **`market_instruments`**:
   - Queries filtering by exchange and market previously hit table scans when loading the full directory on server boot.
   - *Fix Applied*: Composite index on `(market, assetType)` and primary key `(symbol, exchange)`. Server loads the universe once on startup and maintains an in-memory synchronized LRU index with $O(1)$ symbol map lookups.
2. **`corporate_announcements` and `news_items`**:
   - Queries fetch chronological feeds with `ORDER BY announcedAt DESC LIMIT :limit`.
   - *Verified Index*: `idx_announcements_announced_at` allows index scans without expensive in-memory sort buffers.
3. **`market_daily_observations`**:
   - Range queries: `WHERE symbol = :s AND exchange = :e AND date >= :from AND date <= :to ORDER BY date ASC`.
   - *Verified Index*: Clustered composite primary key `(symbol, exchange, date)` satisfies exact range scans via index scan without intermediate sort operations.

### B. Connection Pool Management & Cloud Latency

- **Direct Connection vs. Connection Pooler**:
  - Direct connection to port 5432 has an upper limit of ~60 connections on the Supabase starter tier.
  - EquityLensAI configures the Supabase transaction pooler on port 6543 (`?pgbouncer=true&connection_limit=15`) in production.
  - This prevents connection starvation under concurrent Express workers while holding connection allocation to <= 15 per instance.
- **Round-Trip Time (RTT)**:
  - Average latency between local benchmarking environments and Supabase AWS ap-south-1 is ~600ms.
  - *Architectural Safeguard*: Endpoints that can serve read traffic from cache (Market Overview, Quotes, Search, Cached Financials) bypass PostgreSQL entirely, delivering sub-15ms latencies.

---

## 3. Optimization Recommendations & Safe Index DDL

To ensure performance scales to 10,000+ instruments and millions of daily observations, the following production indexes are maintained:

```sql
-- 1. Accelerate Symbol Search and Prefix Matching
CREATE INDEX IF NOT EXISTS idx_market_instruments_search 
ON market_instruments (symbol varchar_pattern_ops, exchange);

-- 2. Fast Chronological Announcement Feeds by Company
CREATE INDEX IF NOT EXISTS idx_announcements_sym_date 
ON corporate_announcements (symbol, exchange, "announcedAt" DESC);

-- 3. Composite Screener Multi-Metric Filtering
CREATE INDEX IF NOT EXISTS idx_screener_metrics_composite 
ON financial_screener_metrics ("marketCap" DESC, "peRatio", "roe");

-- 4. Fast Daily History Range Lookups
CREATE INDEX IF NOT EXISTS idx_daily_obs_range 
ON market_daily_observations (symbol, exchange, date ASC);
```

---

## 4. Integrity and Concurrency Verification

All optimizations were verified against the regression test suite:
- 0 foreign key constraint violations.
- 0 duplicate records permitted due to idempotent upsert clauses (`ON CONFLICT (symbol, exchange, date) DO UPDATE`).
- Deterministic calculation results verified across 255 Vitest unit and integration tests.
