# Data Provenance, Freshness & Integrity Specification

**Document:** Data Provenance, Auditability & Freshness Standard  
**Phase:** 15 — System Audit & Hardening  
**Auditor:** Antigravity AI  
**Status:** Mandatory Platform Standard  

---

## 1. Five Cardinal States of Market & Financial Data

Every API response, dashboard card, chart, and exportable research document must explicitly represent the freshness and source provenance of its figures according to these 5 distinct states:

| Data State | Description | Header / UI Flag | Technical Indicator |
| :--- | :--- | :--- | :--- |
| **1. LIVE** | Direct feed received during official market hours (09:15–15:30 IST for NSE/BSE) via authenticated broker integration. | Green indicator badge (`Live Market`) | `freshness: "live"`, `isStale: false`, `ageMs < 15000` |
| **2. DELAYED** | Standard feed sourced from delayed public providers (e.g. Yahoo Finance 15-minute delayed quotes). | Amber indicator badge (`15m Delayed`) | `freshness: "delayed"`, `source: "yahoo"` |
| **3. STALE** | Cached observation whose primary TTL has expired, served temporarily under stale-while-revalidate rules. | Warning banner (`Stale Cache — Revalidating`) | `isStale: true`, `freshness: "stale"`, `ageMs > ttlMs` |
| **4. PARTIAL** | Multi-instrument response (e.g. screener or portfolio) where some symbols or metrics are missing or restated. | Amber warning (`Partial Universe Coverage`) | `coverage.isPartial: true`, `warnings: string[]` |
| **5. UNAVAILABLE** | Upstream provider outage or invalid symbol where neither live nor cached observations exist. | Explicit Error View (`Data Unavailable`) | HTTP 502/503 `AppError`, zero dummy values |

---

## 2. Non-Negotiable Integrity Rules

### Rule 1: Missing Data is NEVER Zero
In financial analysis, an unrecorded metric (such as missing Diluted EPS, unannounced dividends, or zero-denominator ratios) must remain strictly `null`. Substituting `0` corrupts financial models (e.g. treating missing debt as zero debt turns a distressed company into a debt-free company).

### Rule 2: Negative Denominator Safeguards
- **Return on Equity (ROE):** If `StockholdersEquity <= 0`, ROE is mathematically invalid and must return `null`. A company with negative earnings and negative equity cannot have a positive ROE.
- **Price to Book (P/B):** If `BookValuePerShare <= 0`, P/B must return `null`.
- **Price to Earnings (P/E):** If `EPS <= 0`, P/E must return `null` (never negative or zero).

### Rule 3: Distinct Source and Ingestion Timestamps
Every persisted financial statement and daily OHLCV observation preserves two separate timestamps:
- `tradingDate` / `periodEndDate`: The effective economic date established by the exchange or audited corporate filing.
- `ingestedAt` / `retrievedAt`: The local system timestamp recording when the record was received and validated by EquityLensAI.
