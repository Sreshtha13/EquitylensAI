# EquityLensAI — Data Quality, Freshness & Provenance Standard

## 1. Provenance Architecture

EquityLensAI mandates that all financial statements, real-time quotes, technical candles, and corporate disclosures preserve clear audit trails linking them to their source of origin.

### Provenance Metadata Fields
Every data record returned by backend providers or stored in Supabase encapsulates:
- `source`: Authoritative provider identifier (e.g. `angel_one`, `yahoo_finance`, `bse_announcements`, `nse_announcements`).
- `symbol`: Ticker symbol normalized to uppercase alphanumeric format.
- `exchange`: Listing exchange (`NSE` or `BSE`).
- `asOf`: ISO-8601 timestamp representing the exact market time of the data.
- `fetchedAt`: ISO-8601 timestamp representing when EquityLensAI ingested the record.
- `scope`: Financial reporting scope (`consolidated` or `standalone`).
- `currency`: Reporting currency (default: `INR`).

---

## 2. Freshness States and SLA Matrix

To prevent misleading claims of real-time quotes during off-hours or delayed feeds, the platform supports six distinct freshness states:

| Freshness State | Criteria | Client Presentation |
| :--- | :--- | :--- |
| **Fresh** | Data age within primary provider SLA (e.g., < 15s for quotes during market hours) | Green indicator; "Live Market Data" |
| **Delayed** | Data age > primary SLA but within exchange delay window (15–30 mins) | Amber indicator; "Delayed Feed (~15m)" |
| **Stale** | Data fetched in previous sessions exceeding cache freshness TTL | Warning banner; "Stale Snapshot (as of [timestamp])" |
| **Unavailable** | External provider down or symbol unmapped; no fallback available | Clean error boundary; "Market Feed Temporarily Unavailable" |
| **Partially Available** | Primary quote succeeded but order book or company profile failed | Partial indicators on missing subsections |
| **Not Applicable** | Metric not applicable (e.g., P/E for companies with negative earnings) | "N/A" (never substituted with zero or synthetic numbers) |

### Freshness Thresholds by Data Category
- **Live Quotes:** Fresh < 30 seconds; Stale > 2 minutes.
- **Intraday Candles (1m / 5m):** Fresh < 1 minute; Stale > 10 minutes.
- **Daily / Historical Candles:** Fresh < 24 hours.
- **Quarterly & Annual Financials:** Fresh < 7 days; Stale > 90 days.
- **Corporate News & Announcements:** Ingestion poll cycle every 10 minutes.

---

## 3. Data Validation Rules & Safeguards

Incoming payloads undergo strict schema and value validation prior to caching or database insertion:
1. **Zero-Price Candle Rejection:** In `backend/src/market/providers/yahoo/normalizer.ts`, candles with non-positive (`open <= 0`, `close <= 0`, `high <= 0`, `low <= 0`) or non-finite values are stripped from chart series to prevent chart distortion.
2. **Domain-Aware Negative Values:** Legitimate negative accounting figures (operating losses, negative free cash flow) are strictly preserved and never rejected or clamped to zero.
3. **High/Low Invariant Validation:** Rejects any candle where `low > high` or `open > high` or `close < low`.
4. **Volume Non-Negativity:** Rejects negative trading volume numbers.
5. **No Data Fabrication:** Under no circumstances does the system interpolate fake stock prices or replace null ratios with zeros. Missing data evaluates to `null` or `undefined` and displays as `"N/A"`.

---

## 4. Deterministic Calculations

All derived financial metrics must follow canonical formulas defined in `@equitylensai/backend/src/financial/services`:
- **Division-by-Zero Safety:** Every financial ratio calculator checks denominators against `0` and `Number.EPSILON` before performing division, returning `null` when undefined.
- **Health Score Determinism:** The 0–100 fundamental health score uses fixed weights across liquidity, solvency, profitability, and operational efficiency, logged with component breakdowns for auditability.
