# Phase 7: Stock Detail & Company Intelligence

## 1. Stock-Detail Route Conventions

- **Canonical Route:** `/stocks/[exchange]/[symbol]`
- **Examples:**
  - `/stocks/NSE/RELIANCE`
  - `/stocks/NSE/TCS`
  - `/stocks/NSE/INFY`
  - `/stocks/NASDAQ/AAPL`
- **Normalization:** The application normalizes `[exchange]` and `[symbol]` to uppercase (`cleanExchange`, `cleanSymbol`), URL-decodes characters, and validates against the verified instrument master via `GET /api/v1/stocks/:symbol/resolve?exchange=:exchange`.
- **Invalid / Unknown Securities:** If an instrument is not found in the master registry, an explicit 404 security-not-found state is rendered with verified stock suggestions rather than silently redirecting or substituting arbitrary tickers.
- **Directory / Search Route:** `/stocks` provides an interactive directory search and instant navigation to any listed stock.

---

## 2. Supported Exchanges and Actual Data Coverage

- **Primary Exchanges:** **NSE** (National Stock Exchange of India) and **BSE** (Bombay Stock Exchange).
- **Secondary Exchanges:** **NASDAQ** and **NYSE** (where verified security instruments and data feeds exist in market providers).
- **Zero Dummy Data Policy:** No synthetic price data, company profiles, financial ratios, or corporate actions are fabricated. Securities without available statements or quote feeds communicate explicit neutral "unavailable" states.

---

## 3. API Endpoints Reused by Page Sections

Each section loads data independently using React Query hooks and centralized API clients:

| Page Section               | Endpoint                                              | Method          | Responsibility                                                                       |
| -------------------------- | ----------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| **Identity Resolution**    | `/api/v1/stocks/:symbol/resolve`                      | GET             | Validates exchange + symbol against instrument master.                               |
| **Market Header & Quote**  | `/api/v1/stocks/:symbol/quote`                        | GET             | Live or latest traded quote, absolute & % change, provenance, freshness.             |
| **Corporate Overview**     | `/api/v1/stocks/:symbol/profile`                      | GET             | Sector, industry, headquarters, employee count, shares outstanding, fiscal year end. |
| **Price Action & Volume**  | `/api/v1/stocks/:symbol/history`                      | GET             | Chronological OHLCV candles across selected intervals (1D to MAX).                   |
| **Performance Analytics**  | `/api/v1/stocks/:symbol/performance`                  | GET             | Cumulative return, CAGR, annualized volatility, max drawdown.                        |
| **Financial Statements**   | `/api/v1/financial/:symbol/statements`                | GET             | Annual & Quarterly Income, Balance Sheet, and Cash Flow statements.                  |
| **Financial Ratios**       | `/api/v1/financial/:symbol/analysis`                  | GET             | Profitability, liquidity, leverage, growth, and cash flow ratios.                    |
| **Valuation Intelligence** | `/api/v1/financial/:symbol/analysis`                  | GET             | P/E, Forward P/E, P/B, P/S, EV/EBITDA, EV/Revenue, Market Cap, EV.                   |
| **Financial Health Score** | `/api/v1/financial/:symbol/analysis`                  | GET             | Health score (0–100), pillars (profitability, liquidity, solvency, efficiency).      |
| **AI Company Research**    | `/api/v1/research/ask`                                | POST            | Evidence-bounded Gemini analysis referencing actual platform figures.                |
| **Favorites Toggle**       | `/api/v1/favorites` & `/api/v1/favorites/:symbol`     | GET/POST/DELETE | Authenticated favorite persistence.                                                  |
| **Watchlist Modal**        | `/api/v1/watchlists` & `/api/v1/watchlists/:id/items` | GET/POST        | Authenticated multi-watchlist membership management.                                 |

---

## 4. Chart Intervals and Price-Adjustment Semantics

- **Supported Range Presets:**
  - `1D` (15-minute candles)
  - `1W`, `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, `MAX` (daily candles)
- **Data Integrity:**
  - Price points are strictly ordered chronologically by `timestamp`.
  - Non-trading days (weekends, exchange holidays) are **never** interpolated or filled with synthetic zero prices.
  - Adjusted close vs. unadjusted close is labeled explicitly based on provider series attributes.
  - Volume bars reflect observed exchange trading volume.
  - `MAX` requests daily history starting in 1900; the returned first/last observations reflect the selected provider's actual coverage. Full-history requests use Yahoo Finance rather than the bounded Angel One history endpoint.

---

## 5. Financial Statement Period and Scope Behavior

- **Statement Types:** Income Statement, Balance Sheet, Cash Flow Statement.
- **Periods:**
  - `Annual` (fiscal year end filings).
  - `Quarterly` (interim filings, when supplied by Yahoo Finance; at most the latest six years are requested).
- **Scope:** The current Yahoo Finance fundamentals feed does not identify whether statements are consolidated or standalone. The UI discloses this provenance limitation instead of offering an unverifiable scope selector. Scope selection is deferred until a verified source provides both variants.
- **Integrity Rule:** Missing statement line items render as unpopulated/unavailable cells. Incompatible accounting periods are never merged.

---

## 6. Metric Units and Calculation Ownership

- **Authoritative Engine:** All ratios, valuation multiples, and growth metrics are computed deterministically on the backend (`@equitylensai/backend`).
- **No Client-side Recalculation:** The frontend strictly formats and displays backend-calculated values (`FinancialMetric`), along with confidence indicators, calculation notes, and source timestamps.
- **Units:**
  - Multiples: `x` (e.g. `18.42x`)
  - Percentages: `%` (e.g. `14.20%`)
  - Currencies: Formatted with standard notation (`Cr`, `B`, `M`, `T`) and localized currency symbol (`₹` for INR, `$` for USD).

---

## 7. Valuation Methodology and Limitations

- **Multiples Calculated:**
  - Price-to-Earnings ($P/E = \text{Price} / \text{EPS}$)
  - Forward P/E (when consensus estimates are provided by feed)
  - Price-to-Book ($P/B = \text{Market Cap} / \text{Equity}$)
  - Price-to-Sales ($P/S = \text{Market Cap} / \text{Revenue}$)
  - EV/EBITDA ($\text{Enterprise Value} / \text{EBITDA}$)
  - EV/Revenue ($\text{Enterprise Value} / \text{Revenue}$)
  - Market Capitalization ($\text{Price} \times \text{Shares Outstanding}$)
  - Enterprise Value ($\text{Market Cap} + \text{Total Debt} - \text{Cash}$)
- **Negative Earnings Handling:** When net income is negative, P/E is mathematically negative and explicitly flagged as not meaningful (`N/M`).
- **No Speculative DCF:** No speculative discount cash flow predictions or target prices are fabricated.

---

## 8. Financial-Health Score Methodology Version

- **Version:** `1.0.0`
- **Scale:** 0 to 100 integer score with 4 weighted pillars:
  1. _Profitability_ (Operating margin, ROE, net margin)
  2. _Liquidity_ (Current ratio, cash ratio)
  3. _Solvency & Leverage_ (Debt-to-equity, interest coverage)
  4. _Operating Efficiency_ (Asset turnover, cash generation)
- **Honest Limitations:** If essential statement metrics are missing for a company, the score indicates confidence degradation or remains uncomputed with explicit reasons.

---

## 9. Historical Performance Methodology

Computed directly from verified candle series (`performanceCalculator.ts`):

- **Cumulative Return:**
  $$\text{Return} = \frac{P_{\text{last}} - P_{\text{first}}}{P_{\text{first}}}$$
- **Compound Annual Growth Rate (CAGR):**
  $$\text{CAGR} = \left(\frac{P_{\text{last}}}{P_{\text{first}}}\right)^{1 / \text{years}} - 1 \quad (\text{for periods} \ge 1 \text{ year})$$
- **Annualized Volatility:**
  $$\sigma_{\text{ann}} = s_{\text{daily}} \times \sqrt{252}$$
  where $s_{\text{daily}}$ is the standard deviation of daily log returns $\ln(P_t / P_{t-1})$.
- **Maximum Drawdown:**
  $$\text{Max Drawdown} = \min_{t} \left(\frac{P_t - \max_{0 \le s \le t} P_s}{\max_{0 \le s \le t} P_s}\right)$$

---

## 10. AI Research Evidence Behavior

- **Backend Assistant:** Powered by Google's Gemini (`@google/genai` SDK) on the server.
- **Evidence Boundary:** The prompt automatically bundles the actual live quote, company profile, financial ratios, health score, and performance stats into evidence blocks with stable IDs (`[EV-QUOTE-1]`, `[EV-FINANCIAL-1]`, `[EV-RATIO-1]`, etc.).
- **Strict Guardrails:** The model is prohibited from inventing citations, estimating future price targets, giving BUY/HOLD/SELL advice, or guessing unprovided figures.

---

## 11. Quote Freshness and Stale-Data Handling

- **DataFreshness States:** `REALTIME`, `DELAYED`, `EOD`, and `STALE`.
- **Provenance Tags:** Every quote displays source provider (e.g., `angelone`, `yahoo`), observation timestamp (`observedAt`), and retrieval timestamp (`retrievedAt`).
- **Independent Failure:** A quote failure or off-market timeout displays an inline notice without preventing financial statements, historical charts, or company overview from rendering.

---

## 12. Known Provider Limitations

1. **Market Hours:** Live tick quotes on NSE/BSE are accessible during Indian market trading hours (09:15 to 15:30 IST); outside market hours, the latest observed closing quote is provided.
2. **Interim Statements:** Some mid/small-cap instruments report interim financial figures with delay; quarterly statements reflect only officially verified filings.
3. **Consensus Estimates:** Forward P/E relies on reported consensus earnings forecasts; when not tracked by institutional consensus feeds, it remains unavailable.

---

## 13. Test Verification and Actual Results

- **Backend Test Suite:**
  ```bash
  npm test -w @equitylensai/backend
  ```
  - **Result:** **20 passed files, 129 passed tests** (including 10 dedicated Phase 7 stock detail tests in `stockDetail.test.ts`).
- **Type Checking:**
  ```bash
  npm run typecheck
  ```
  - **Result:** **0 errors across all 3 workspaces** (`@equitylensai/shared`, `@equitylensai/backend`, `@equitylensai/frontend`).
- **Frontend Production Build:**
  ```bash
  npm run build -w @equitylensai/frontend
  ```
  - **Result:** **18 routes compiled and optimized**, including `/stocks` and `/stocks/[exchange]/[symbol]`.
- **Browser Acceptance:** Verified the stock directory and RELIANCE detail route, provider-backed quarterly table and scope disclosure, unknown-symbol not-found state, unauthenticated watchlist sign-in prompt and favorite redirect. The MAX chart request returned 7,729 Yahoo Finance daily observations from 1996 through 2026 in the acceptance run; actual coverage varies by instrument/provider.
