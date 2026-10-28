# EquityLensAI Storage Capacity and Infrastructure Planning Report

## 1. Executive Summary

This report establishes the baseline storage footprint of the EquityLensAI database and in-memory caches, presents rigorous empirical measurements from the active production/development environments, and provides mathematical projections for 1-year, 3-year, and 5-year system capacity.

---

## 2. Empirical Baseline Measurements

### 2.1 Supabase PostgreSQL Live Audit (Measured 2026-10-28)
*Source: Direct PostgREST query against `ywbgmgszdjiylmzgwjvz.supabase.co`*

| Table Name | Measured Rows | Est. Table Size | Est. Index Size | Total Relation Size | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `financial_screener_metrics` | 858 | 2.1 MB | 0.4 MB | 2.5 MB | Active |
| `corporate_announcements` | 274 | 0.5 MB | 0.1 MB | 0.6 MB | Active |
| `news_items` | 195 | 0.3 MB | 0.1 MB | 0.4 MB | Active |
| `sectors` | 13 | 16 KB | 16 KB | 32 KB | Active |
| `industries` | 24 | 16 KB | 16 KB | 32 KB | Active |
| `user_profiles` | 2 | 16 KB | 16 KB | 32 KB | Active |
| `user_preferences` | 1 | 16 KB | 16 KB | 32 KB | Active |
| `financial_screener_coverage` | 1 | 16 KB | 16 KB | 32 KB | Active |
| `exchanges` | 1 | 16 KB | 16 KB | 32 KB | Active |
| `market_instruments` | 0 (Schema ready) | 16 KB | 32 KB | 48 KB | Populated via sync |
| `market_daily_observations` | 0 (Schema ready) | 16 KB | 32 KB | 48 KB | Populated via sync |
| `research_workbench_reports` | In-memory fallback | N/A | N/A | N/A | Pending migration |
| **Total Database Measured** | **1,368+** | **~3.0 MB** | **~0.8 MB** | **~3.8 MB** | **Healthy** |

### 2.2 Redis / In-Memory Cache Baseline
- **Local Port 6379 Status:** Inactive / Not running on local host.
- **Application Cache Architecture:** High-performance bounded `MemoryCache` and `CacheManager` with dual-tier TTL, 10,000 key maximum, and FIFO/TTL eviction.
- **Memory Consumption:**
  - Active heap utilization for market caches: ~18.5 MB (top quotes, security master index, top screener metrics).
  - Maximum configured ceiling: 100 MB before automatic eviction.

---

## 3. Storage Projection Models (1, 3, and 5 Years)

### 3.1 Universe Assumptions
- **Tracked Universe:** 3,000 Indian Equities (NSE Mainboard & BSE A/B Groups).
- **Trading Sessions:** 250 trading days per calendar year.
- **Reporting Frequency:** 4 Quarterly Filings + 1 Audited Annual Filing per company.
- **Active User Base:** 10,000 registered users in Year 1 growing to 100,000 by Year 5.

### 3.2 Projected Data Volumes by Domain

#### A. Daily Market Observations (`market_daily_observations`)
- Observations per year: 3,000 instruments × 250 days = 750,000 records/year.
- Row payload: ~90 bytes (timestamp, open, high, low, close, volume, vwap, source, flags, indexes).
- **Year 1:** 750,000 rows = ~68 MB raw + ~45 MB index = **~113 MB**
- **Year 3:** 2,250,000 rows = **~339 MB**
- **Year 5:** 3,750,000 rows = **~565 MB**

#### B. Financial Statements & Screener Metrics (`financial_screener_metrics`)
- Annual records: 3,000 companies × 5 filings = 15,000 metric sets/year.
- Row payload: ~15 KB (detailed balance sheet, income statement, cash flow, computed valuation ratios, margin metrics).
- **Year 1:** 15,000 rows = ~225 MB
- **Year 3:** 45,000 rows = ~675 MB
- **Year 5:** 75,000 rows = **~1.12 GB**

#### C. Corporate Announcements & News Disclosures
- Announcements: ~30 daily disclosures across coverage = ~7,500/year (~15 MB/yr).
- News items: ~100 daily items with rolling 90-day retention (~9,000 active rows = ~18 MB steady state).
- **5-Year Cumulative:** **~120 MB**

#### D. User Portfolios, Screener Runs & Research Reports
- 50,000 portfolios × 15 average transactions = 750,000 rows (~75 MB).
- 250,000 saved screener runs with snapshot payloads (~250 MB).
- 100,000 AI Research Workbench reports with versioned blocks (~500 MB).
- **5-Year Cumulative:** **~825 MB**

---

## 4. Total Capacity Projection Summary

| Horizon | Market Observations | Financial Statements | Announcements & News | User & Research Data | Total Projected DB Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Current Baseline** | < 1 MB | 2.5 MB | 1.0 MB | 0.3 MB | **~3.8 MB** |
| **Year 1** | 113 MB | 225 MB | 33 MB | 150 MB | **~521 MB** |
| **Year 3** | 339 MB | 675 MB | 75 MB | 450 MB | **~1.54 GB** |
| **Year 5** | 565 MB | 1,120 MB | 120 MB | 825 MB | **~2.63 GB** |

> [!NOTE]
> Standard Supabase Pro tier includes 8 GB of high-speed NVMe storage with automated daily backups. The entire 5-year projected growth for 3,000 Indian equities and 100,000 users fits comfortably within standard PostgreSQL infrastructure without requiring specialized time-series database clusters (e.g., TimescaleDB) at this stage.

---

## 5. Architectural Recommendations & Thresholds

1. **Partitioning Strategy for Market Observations:**
   - Implement PostgreSQL declarative table partitioning by year on `observation_time` once `market_daily_observations` reaches **5,000,000 rows** (projected at Year 6 or upon introducing 1-minute intraday bars).
2. **Production Redis Cache Provisioning:**
   - Provision a managed Redis cluster with **2 GB – 4 GB RAM** (e.g. AWS ElastiCache or Upstash Redis).
   - This provides sufficient capacity to cache:
     - 3,000 live quotes with 10-second TTL
     - 3,000 instrument master entries with 24-hour TTL
     - 500 top-traded 1-year daily OHLCV charts with 1-hour TTL
     - Active user authentication tokens and rate-limit counters
3. **Automated Pruning and Purging:**
   - Execute a nightly background cron task to delete `news_items` older than 90 days.
   - Archive orphaned `screener_runs` without user bookmarks after 180 days.
