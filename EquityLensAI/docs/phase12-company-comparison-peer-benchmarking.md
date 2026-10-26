# Phase 12: Advanced Analytics, Comparative Company Analysis & Peer Benchmarking

## 1. Overview and Objective
Phase 12 implements comparative company analytics and peer benchmarking for equities listed on Indian stock exchanges (NSE and BSE). It empowers investors and financial analysts to compare 2 to 5 companies side-by-side using authoritative, verified financial statements, valuation multiples, profitability, growth, leverage, liquidity, cash flows, and overall fundamental health scores.

### Core Tenets
1. **Zero Dummy/Fabricated Data**: All company metadata, quotes, statement line items, multiples, and historical prices come from deterministic backend services and verified market data providers.
2. **Missing Data is Preserved as Missing**: Unavailable metrics render as `null` / `—` and are never coerced to zero.
3. **Deterministic Aggregations**: Percentiles, peer medians, means, and ranks are calculated deterministically on the backend with strict sample size safeguards ($N \ge 2$).
4. **Evidence-Grounded AI Synthesis**: LLM synthesis references validated backend metric values and citations rather than hallucinating financial claims.

---

## 2. Comparison Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Next.js App Router                     │
│  /compare (Workbench)  •  /compare/saved (Saved Sets Dashboard)        │
│  - CompanySelector (Autocomplete + Peer Discovery Modal)               │
│  - ComparisonTable (Categorized side-by-side metrics with tooltips)    │
│  - PeerBenchmarkCards (Median, Mean, Range, Ranks, Percentiles)        │
│  - HistoricalCompareChart (Normalized Price SVG & Financial Trends)    │
│  - AiComparisonPanel (Grounded narrative synthesis + evidence tags)   │
│  - SaveComparisonModal (Config persistence & duplication)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Backend Express / TypeScript                     │
│  /api/v1/compare (Comparison Engine)                                   │
│  /api/v1/compare/peers/:symbol (Verified Peer Discovery)               │
│  /api/v1/compare/benchmarks (Deterministic Benchmark Statistics)       │
│  /api/v1/compare/history (Multi-Company Normalized & Financial Trends)  │
│  /api/v1/compare/saved (CRUD, Duplication, User Isolation)             │
│  /api/v1/ai/comparison-analysis (Grounded Gemini Narrative)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Shared Layer & Domain Services                      │
│  - @equitylensai/shared domain models & types                          │
│  - MarketService & InstrumentRepository (Phase 2 & 7)                  │
│  - FinancialService & RatioCalculators (Phase 3)                       │
│  - HealthScoreEngine (Phase 3 fundamental health scores)               │
│  - GeminiClient (Phase 4 AI structured JSON generation)                │
│  - Supabase PostgreSQL / In-Memory Repository (Saved Comparisons)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported Comparative Metrics

Comparative metrics are categorized into six fundamental dimensions:

| Category | Metric | ID | Unit | Formula / Basis |
| :--- | :--- | :--- | :--- | :--- |
| **Valuation** | P/E Ratio | `pe_ratio` | ratio | Current Price / Diluted EPS |
| | Price to Book | `price_to_book` | ratio | Market Price / Book Value Per Share |
| | Price to Sales | `price_to_sales` | ratio | Market Cap / Total Revenue |
| | EV / EBITDA | `ev_to_ebitda` | ratio | Enterprise Value / EBITDA |
| | Dividend Yield | `dividend_yield` | percent | Annual Dividend / Current Price |
| **Profitability** | Gross Margin | `gross_margin` | percent | Gross Profit / Total Revenue × 100 |
| | Operating Margin | `operating_margin` | percent | Operating Income / Total Revenue × 100 |
| | Net Margin | `net_margin` | percent | Net Income / Total Revenue × 100 |
| | Return on Equity (ROE) | `roe` | percent | Net Income / Total Stockholder Equity × 100 |
| | Return on Capital Employed | `roce` | percent | EBIT / (Total Assets − Current Liabilities) × 100 |
| **Growth** | Revenue Growth YoY | `revenue_growth_yoy` | percent | $(Rev_t - Rev_{t-1}) / Rev_{t-1} \times 100$ |
| | Net Income Growth YoY | `net_income_growth_yoy` | percent | $(NI_t - NI_{t-1}) / NI_{t-1} \times 100$ |
| | EPS Growth YoY | `eps_growth_yoy` | percent | $(EPS_t - EPS_{t-1}) / EPS_{t-1} \times 100$ |
| **Financial Strength** | Debt to Equity | `debt_to_equity` | ratio | Total Debt / Total Stockholder Equity |
| | Current Ratio | `current_ratio` | ratio | Current Assets / Current Liabilities |
| | Quick Ratio | `quick_ratio` | ratio | Liquid Assets / Current Liabilities |
| | Interest Coverage | `interest_coverage` | ratio | Operating Income / Finance Costs |
| **Cash Flow** | Free Cash Flow Margin | `free_cash_flow_margin`| percent | FCF / Total Revenue × 100 |
| **Health Score** | Financial Health Score | `financial_health_score`| score | Deterministic fundamental health (0–100) |

---

## 4. Peer Discovery Methodology

1. **Resolution**: Resolves target symbol to company profile and market quote.
2. **Metadata Verification**:
   - Matches candidate instruments strictly on verified `sector` and `industry` metadata.
   - If no verified sector or industry exists for the target, peer discovery returns an explicit message and does not fabricate classifications.
3. **Scoring Hierarchy**:
   - Exact Industry match: Base score = 85 (`Same Industry: <Industry>`).
   - Same Sector match: Base score = 65 (`Same Sector: <Sector>`).
   - Market Cap Proximity: If market cap ratio $\ge 0.5$, adds +10 points (`Comparable Market Cap`).
4. **Self-Exclusion**: Target company is always excluded from its own peer list.
5. **Deduplication**: Multi-listed instruments across NSE/BSE are reconciled to prevent duplicate representation.

---

## 5. Benchmark Statistics & Percentile Methodology

For each metric in a peer comparison set:
- **Valid Observation Count ($N$)**: The count of non-null, valid numerical values.
- **Mean**: $\frac{1}{N} \sum_{i=1}^N x_i$.
- **Median**: Middle value of sorted valid observations (or average of two middle values if $N$ is even).
- **Min / Max**: Extremum boundaries of the observed sample.
- **Rank**: 1-based index when sorted by value.
- **Percentile**: Calculated as:
  $$\text{Percentile} = \text{round}\left(\frac{\text{Rank} - 1}{N - 1} \times 100\right)$$
- **Sample Size Safeguards**:
  - If $N < 2$, ranks and percentiles are returned as `null` with a clear status notice: `"Minimum 2 valid observations required to compute peer ranking"`.
  - Raw company values are always preserved even when aggregate ranks are withheld.

---

## 6. Historical Time-Series Comparison

1. **Normalized Stock Performance**:
   - Supports intervals: `1M`, `3M`, `6M`, `1Y`, `5Y`.
   - Normalization formula:
     $$\text{Index}_t = \text{round}\left(\frac{P_t}{P_0} \times 100, 2\right)$$
     where $P_0$ is the company's first valid close price in the selected window.
   - Preserves actual trading calendar dates; does not fabricate or interpolate prices.
2. **Financial Statement Trends**:
   - Multi-period annual historical observations extracted from verified income statements, balance sheets, and cash flow statements across up to 4 fiscal periods.

---

## 7. Evidence-Grounded AI Analysis

`POST /api/v1/ai/comparison-analysis`
- **Context Grounding**: Structured verified facts (market caps, P/E ratios, margins, leverage, health scores, and peer rankings) are prepared by the backend.
- **Prompt Injection Defense**: Company descriptions and external inputs are sanitized.
- **Evidence IDs**: Every analytical claim references verified evidence tags (e.g. `pe_ratio:TCS`, `roe:INFY`).
- **Deterministic Fallback**: If LLM provider is disabled, unconfigured, or times out, the backend generates a deterministic comparative fundamental summary.

---

## 8. Saved Comparisons Persistence & Security

- **Database Table**: `public.saved_comparisons` with UUID primary keys and RLS policies.
- **User Isolation**:
  ```sql
  CREATE POLICY "Users can only view their own saved comparisons"
    ON public.saved_comparisons FOR SELECT
    USING (auth.uid() = user_id);
  ```
- **Fallback Store**: In-memory repository with tenant isolation for local offline testing.
- **Configuration Schema**: Stores lightweight configuration metadata (`symbols`, `period`, `scope`, `metrics`), ensuring reopened comparisons always evaluate against current market data.

---

## 9. API Reference

| Endpoint | Method | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `/api/v1/compare` | `POST` | Multi-company side-by-side comparison | Optional |
| `/api/v1/compare/peers/:symbol` | `GET` | Verified peer group discovery | Optional |
| `/api/v1/compare/benchmarks` | `POST` | Peer group median, mean, and ranks | Optional |
| `/api/v1/compare/history` | `POST` | Normalized prices and statement trends | Optional |
| `/api/v1/ai/comparison-analysis` | `POST` | Grounded AI comparative synthesis | Optional |
| `/api/v1/compare/saved` | `GET` | List saved comparisons for current user | Required |
| `/api/v1/compare/saved` | `POST` | Create a saved comparison set | Required |
| `/api/v1/compare/saved/:id` | `GET` | Get saved comparison by ID | Required |
| `/api/v1/compare/saved/:id` | `PATCH` | Update saved comparison | Required |
| `/api/v1/compare/saved/:id` | `DELETE` | Delete saved comparison | Required |
| `/api/v1/compare/saved/:id/duplicate`| `POST` | Duplicate saved comparison | Required |
