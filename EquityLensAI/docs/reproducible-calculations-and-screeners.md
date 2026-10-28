# Reproducible Financial Calculations & Screener Execution Model

**Phase:** 15 — System Audit & Hardening  
**Scope:** Financial Engineering, Screener Engine & Research Workbench  
**Status:** Authoritative Calculation & Audit Standard  

---

## 1. Calculation Versioning Architecture

To guarantee consistency across research reports, audits, and saved screener runs, the calculation layer implements strict semver versioning:

```typescript
export const CALCULATION_VERSION = '1.0.0';
```

### Formula Definitions (Version 1.0.0):
1. **P/E Ratio:** `Price / TTM Diluted EPS`  
   *Condition:* Returns `null` if `livePrice === null` or `EPS <= 0`.
2. **P/B Ratio:** `Price / Book Value Per Share`  
   *Condition:* Returns `null` if `livePrice === null` or `TotalStockholderEquity <= 0`.
3. **Return on Equity (ROE):** `(Net Income / Total Stockholder Equity) * 100`  
   *Condition:* Returns `null` if `TotalStockholderEquity <= 0` or either input is null.
4. **Return on Assets (ROA):** `(Net Income / Total Assets) * 100`  
   *Condition:* Returns `null` if `TotalAssets <= 0` or either input is null.
5. **ROCE:** `(EBIT / Capital Employed) * 100` where `Capital Employed = Total Assets - Total Current Liabilities`  
   *Condition:* Returns `null` if `Capital Employed <= 0`.
6. **Debt to Equity:** `Total Debt / Total Stockholder Equity`  
   *Condition:* Returns `null` if `TotalStockholderEquity <= 0`.
7. **Current Ratio:** `Total Current Assets / Total Current Liabilities`  
   *Condition:* Returns `null` if `Current Liabilities <= 0`.
8. **Quick Ratio:** `(Total Current Assets - Inventory) / Total Current Liabilities`  
   *Condition:* Returns `null` if `Current Liabilities <= 0`.
9. **Financial Health Score:** Deterministic composite score (0–100) combining 9 sub-scores across profitability, leverage, liquidity, and operational efficiency based on Piotroski F-Score and Altman Z-Score principles.

---

## 2. Screener Execution Reproducibility

Every executed screener run persists the following audit envelope in `screener_runs`:

```json
{
  "id": "uuid",
  "userId": "user-id",
  "savedScreenId": "saved-screen-id",
  "definition": {
    "schemaVersion": 1,
    "period": "annual",
    "rootGroup": { ... }
  },
  "calculationVersion": "1.0.0",
  "universeVersion": "current",
  "resultCount": 42,
  "durationMs": 85,
  "executedAt": "2026-10-28T10:00:00.000Z",
  "coverage": {
    "indexedCompanies": 858,
    "expectedCompanies": 858,
    "refreshCompleted": true
  },
  "resultSnapshot": [
    { "symbol": "RELIANCE", "exchange": "NSE", "period": "2026-03-31", "metrics": { ... } }
  ]
}
```

### Reproducibility Invariants:
1. **Identical Query Consistency:** Two users executing identical criteria against the same database snapshot and `CALCULATION_VERSION` receive identical result sets.
2. **Explainability of Divergence:** If results differ over time, the system can explain the divergence through one of 4 traceable events:
   - *Filing Restatement:* A company submitted revised financial statements to the exchange.
   - *Price Fluctuation:* Updated market prices shifted valuation multiples (e.g. P/E crossed a threshold).
   - *Universe Ingestion:* New listings or scrips were added to `market_instruments`.
   - *Calculation Version Update:* `CALCULATION_VERSION` was incremented to refine formula methodology.

---

## 3. AI Research Synthesis vs Deterministic Calculations

1. **Strict Separation of Concerns:**
   - Deterministic ratios, financial statement tables, and historical performance charts are computed exclusively by pure TypeScript functions and stored in the database.
   - Google Gemini AI is restricted to qualitative interpretation, SWOT drafting, and investment thesis structuring.
2. **Evidence Linking:** Every generated section in the Research Workbench references deterministic evidence items (`metric`, `value`, `source`, `periodEndDate`). The AI is never permitted to calculate or fabricate numeric ratios independently.
