# Data Retention, Licensing, and Governance Policy

## 1. Overview and Scope

EquityLensAI aggregates, processes, and displays Indian equity market data, financial statements, and regulatory disclosures primarily across the National Stock Exchange of India (NSE) and Bombay Stock Exchange (BSE).

This document establishes the official licensing boundaries, permissible storage uses, and retention schedules for all market, fundamental, regulatory, and user-generated data.

---

## 2. Upstream Data Sources and Licensing Constraints

### 2.1 Angel One SmartAPI
- **Role:** Authorized market-data gateway and trading API partner.
- **Data Provided:** Live quotes (LTP, bid/ask), intraday candles, market depth, instrument master file (OpenAPI instrument dump).
- **Terms & Restrictions:**
  - Real-time market feed is authorized for licensed user sessions and analytical display.
  - Raw redistributions or public resale of real-time market feeds to unauthorized third parties is strictly prohibited.
  - Historical daily OHLCV derived from closed market sessions may be stored locally for client analytical workflows.
  - Rate limits must be respected (e.g., 3 requests/sec on quote endpoints).

### 2.2 Yahoo Finance (`finance.yahoo.com`)
- **Role:** Fallback market-data provider for historical daily candles, extended multi-year charts, and global peer benchmarking.
- **Data Provided:** Daily/weekly historical OHLCV, volume, basic quote statistics.
- **Terms & Restrictions:**
  - Data is consumed via public REST endpoints.
  - Suitable for research, internal modeling, and evaluation.
  - No raw data feeds or proprietary redistribution to external platforms.
  - Historical price observations stored in `market_daily_observations` are strictly normalized for internal calculations and authenticated platform users.

### 2.3 Regulatory Filings (NSE / BSE Corporate Disclosures)
- **Role:** Sourced statutory disclosures submitted under SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015.
- **Data Provided:** Corporate announcements, quarterly financial results, shareholding patterns, board meeting outcomes.
- **Terms & Restrictions:**
  - Public statutory records intended for market transparency.
  - Structured extraction of financial statement line items (revenue, net profit, EPS, equity) is permissible and canonicalized.
  - Raw announcement PDFs and external media files are referenced by original exchange URLs rather than scraped and re-hosted indiscriminately.

---

## 3. Data Classification and Permissible Storage Matrix

| Data Category | Upstream Source | Primary Storage | Caching Permitted? | Long-Term Retention | Licensing / Legal Condition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Security Master** | NSE / BSE / Angel One | PostgreSQL (`market_instruments`) | Yes (Memory/Redis) | Permanent | Permissible to store identification codes (ISIN, Symbol, Token, Exchange). |
| **Historical Daily OHLCV** | Angel One / Yahoo | PostgreSQL (`market_daily_observations`) | Yes (`CacheManager`) | Permanent | Daily end-of-day candles retained for historical chart & model backtesting. |
| **Intraday Ticks / Depth** | Angel One WebSocket / HTTP | In-Memory / Transient Cache | Yes (3–5 seconds) | 0–24 hours max | Real-time market depth is ephemeral; raw tick streaming is not persisted indefinitely. |
| **Financial Statements** | Sourced Filings / XBRL | PostgreSQL (`financial_screener_metrics`) | Yes (TTL: 24h) | Permanent | Statutory balance sheets, income statements, and cash flows stored indefinitely for historical analysis. |
| **Calculated Metrics (P/E, ROE)** | Derived In-House | PostgreSQL & `CacheManager` | Yes (Versioned TTL: 24h) | Snapshots retained | Proprietary algorithms; fully owned by EquityLensAI. Versioned by `CALCULATION_VERSION`. |
| **Corporate Announcements** | BSE / NSE RSS / APIs | PostgreSQL (`corporate_announcements`) | Yes (TTL: 1h) | 7 Years | Metadata, timestamps, and categories retained for historical audit trails. |
| **News Headlines** | Authorized RSS / News APIs | PostgreSQL (`news_items`) | Yes (TTL: 15m) | 90 Days | Headlines and summaries retained. Full article text linked to primary publisher. |
| **User Data & Portfolios** | User Input | PostgreSQL (`portfolios`, `transactions`) | Yes (Private keys only) | Account Lifetime | User-owned; protected by Row Level Security (RLS) and purged upon account deletion. |
| **Research Workbench Reports** | In-House / Gemini AI | PostgreSQL (`research_workbench_reports`) | Yes (Private keys only) | User Lifetime | Versioned analysis with full input snapshot reproducibility. |

---

## 4. Retention and Archival Schedules

1. **Security Master Universe:**
   - Active symbols updated daily at 08:30 IST prior to market open.
   - Delisted or suspended symbols are marked `isActive = false` with `delistedDate`; never deleted, preserving portfolio historical cost basis integrity.

2. **Market Observations:**
   - Daily OHLCV records are immutable once closed and reconciled with official exchange Bhavcopy.
   - If an exchange publishes a post-market adjustment or split/bonus corporate action, adjusted prices are updated with `adjustmentFactor` and an audit log entry.

3. **User Accounts and Data Purge (GDPR / Indian DPDP Act Compliance):**
   - When a user requests account termination, all private portfolios, transaction histories, saved screens, alerts, and research reports must be permanently deleted or pseudonymized within 30 calendar days.
   - Aggregated, anonymized execution statistics may be retained for performance telemetry.

---

## 5. Non-Fabrication and Provenance Invariant

- Every displayed market price or financial statement line item must originate from an authenticated provider or legitimate computation.
- Missing values must remain `null` or `undefined`. Synthesizing fake financial values (e.g. converting missing debt or EBITDA to 0) is strictly disallowed under platform data integrity policies.
- Every API endpoint providing market observations or financial metrics must supply provenance metadata: `source`, `sourceTimestamp`, `freshnessStatus` (`live`, `delayed`, `stale`, `unavailable`), and `calculationVersion`.
