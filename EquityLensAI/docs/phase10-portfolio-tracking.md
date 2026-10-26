# Phase 10: Portfolio Tracking & Investment Performance Analytics

## 1. Overview

Phase 10 introduces investment portfolio tracking and performance analytics to EquityLensAI. Authenticated users can create multiple portfolios, record investment and cash transactions into an auditable ledger, monitor live portfolio market value, evaluate asset and sector diversification, and analyze investment returns against broad-market benchmarks (NIFTY 50 and S&P 500).

All authoritative portfolio accounting is deterministic, testable, and backed by genuine provider market data with zero fabricated prices, transactions, or returns.

---

## 2. Supported Transaction Types

The transaction ledger is the sole authoritative source of truth for user positions and cash balances. The engine supports the following deterministic transaction types:

| Type | Classification | Required Fields | Accounting Behavior |
| :--- | :--- | :--- | :--- |
| `BUY` | Investment Trade | Symbol, Exchange, Quantity (>0), Price (>=0), Currency | Increases share quantity; adds purchase cost `(qty × price) + fees + taxes` to cost basis; updates weighted average cost; decreases cash balance. |
| `SELL` | Investment Trade | Symbol, Exchange, Quantity (>0), Price (>=0), Currency | Decreases share quantity; reduces cost basis proportionally `(soldQty / totalQty) × costBasis`; records realized P&L `netProceeds - soldCostBasis`; increases cash balance. **Short selling is strictly prohibited**; sales exceeding available holdings are rejected. |
| `DIVIDEND` | Investment Income | Quantity (or 0), Price/Amount, Currency | Records cash dividend income linked to the security; increases portfolio cash balance. Does not alter share quantity or stock cost basis. |
| `SPLIT` | Corporate Action | Symbol, Exchange, Split Ratio (>0) | Multiplies share count by split ratio (e.g. 2 for 2:1 split); recalculates average buy price `oldPrice / ratio`; total cost basis remains unchanged. Zero cash impact. |
| `DEPOSIT` | Cash Flow | Amount/Price (>0), Currency | Increases portfolio cash balance and net invested capital. |
| `WITHDRAWAL` | Cash Flow | Amount/Price (>0), Currency | Decreases portfolio cash balance and net invested capital. |
| `FEE` | Expense | Fees/Amount (>0), Currency | Standalone management, custody, or transaction fee; decreases cash balance and records portfolio expense. |

---

## 3. Cost-Basis & P&L Methodology

### Weighted-Average Cost Basis

All security holdings use the **Weighted-Average Cost Basis** method:

1. **Initial Purchase (BUY):**
   $$\text{Total Cost Basis} = (\text{Quantity} \times \text{Price}) + \text{Fees} + \text{Taxes}$$
   $$\text{Average Buy Price} = \frac{\text{Total Cost Basis}}{\text{Quantity}}$$

2. **Subsequent Purchases (BUY):**
   $$\text{New Cost Basis} = \text{Old Cost Basis} + [(\text{New Quantity} \times \text{New Price}) + \text{Fees} + \text{Taxes}]$$
   $$\text{New Quantity} = \text{Old Quantity} + \text{New Quantity}$$
   $$\text{New Average Price} = \frac{\text{New Cost Basis}}{\text{New Quantity}}$$

3. **Partial or Full Sales (SELL):**
   $$\text{Cost Basis of Sold Shares} = \text{Sold Quantity} \times \text{Average Buy Price}$$
   $$\text{Net Sale Proceeds} = (\text{Sold Quantity} \times \text{Execution Price}) - \text{Fees} - \text{Taxes}$$
   $$\text{Realized P\&L on Trade} = \text{Net Sale Proceeds} - \text{Cost Basis of Sold Shares}$$
   $$\text{Remaining Cost Basis} = \text{Old Cost Basis} - \text{Cost Basis of Sold Shares}$$
   $$\text{Remaining Quantity} = \text{Old Quantity} - \text{Sold Quantity}$$

4. **Stock Splits (SPLIT):**
   $$\text{New Quantity} = \text{Old Quantity} \times \text{Split Ratio}$$
   $$\text{New Average Price} = \frac{\text{Cost Basis}}{\text{New Quantity}} = \frac{\text{Old Average Price}}{\text{Split Ratio}}$$
   $$\text{Total Cost Basis is unchanged.}$$

### Valuation and Return Metrics

- **Current Market Value:**
  $$\text{Holding Market Value} = \text{Quantity} \times \text{Current Market Price (converted to base currency)}$$
- **Unrealized P&L:**
  $$\text{Unrealized P\&L} = \text{Holding Market Value} - \text{Holding Cost Basis}$$
  $$\text{Unrealized Return \%} = \frac{\text{Unrealized P\&L}}{\text{Holding Cost Basis}} \times 100 \quad (\text{null if Cost Basis } \le 0)$$
- **Total Portfolio Return:**
  $$\text{Total Return} = \text{Realized P\&L} + \text{Unrealized P\&L} + \text{Dividend Income} - \text{Standalone Fees}$$
  $$\text{Total Return \%} = \frac{\text{Total Return}}{\text{Cost Basis} + \max(0, \text{Net Deposits})} \times 100$$

---

## 4. Cash Ledger Model

The portfolio cash balance is reconstructed deterministically from transactions:

$$\text{Cash Balance} = \sum \text{Deposits} - \sum \text{Withdrawals} - \sum \text{Buy Outflows} + \sum \text{Sell Net Proceeds} + \sum \text{Dividends} - \sum \text{Fees}$$

The cash balance cannot be edited arbitrarily; all adjustments must be recorded as explicit `DEPOSIT`, `WITHDRAWAL`, or `FEE` transactions for full auditability.

---

## 5. Multi-Currency Valuation & Exchange Rates

- **Base Currency:** Portfolios support `INR` (default for NSE/BSE securities) and `USD`.
- **Cross-Currency Holdings:** When an instrument is denominated in a currency different from the portfolio base currency (e.g. an American ADR or US stock held in an INR portfolio), values are converted using genuine market FX rates from Yahoo Finance (`USDINR=X`).
- **Data Freshness:** Each exchange rate observation records `source`, `observedAt`, and `isStale` flags. Hardcoded or invented conversion rates are never used.

---

## 6. Valuation Coverage & Missing Data States

If one or more holdings lack a fresh market quote:
- The holding quantity and cost basis are preserved.
- The holding is marked as `unpriced: true`, and market value is displayed as unavailable.
- Portfolio summary metrics report `valuationStatus` (`complete`, `partial`, `empty`, or `unavailable`) and an exact `valuationCoveragePercent`.
- Missing prices are never silently converted to zero.

---

## 7. Performance & Benchmark Analytics

- **Historical Reconstruction:** Daily portfolio values are reconstructed by replaying the transaction ledger against actual daily historical closing prices (`getHistoricalPrices`).
- **Benchmark Comparison:**
  - INR portfolios are compared against **NIFTY 50** (`^NSEI`).
  - USD portfolios are compared against **S&P 500** (`^GSPC`).
- **Alpha:** Calculated as $\text{Portfolio Return \%} - \text{Benchmark Return \%}$ over the matching time range (`1M`, `3M`, `6M`, `1Y`, `3Y`, `ALL`).

---

## 8. CSV Import & Export

- **Export:** `GET /api/v1/portfolios/:portfolioId/transactions/export` generates a clean CSV with spreadsheet formula injection protection (values starting with `=`, `+`, `-`, or `@` are safely prepended with `'`).
- **Import Preview:** `POST /api/v1/portfolios/:portfolioId/import/preview` parses uploaded CSV text, validates symbols against the instrument master, checks for short sell violations, and returns a preview list of valid and invalid rows.
- **Import Confirm:** `POST /api/v1/portfolios/:portfolioId/import/confirm` commits verified rows in a single batch with a unique `batchId` external reference.

---

## 9. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/portfolios` | List authenticated user's portfolios |
| `POST` | `/api/v1/portfolios` | Create a new portfolio |
| `GET` | `/api/v1/portfolios/:id` | Get portfolio details |
| `PATCH` | `/api/v1/portfolios/:id` | Update portfolio name/description/currency |
| `DELETE` | `/api/v1/portfolios/:id` | Delete portfolio and associated transactions |
| `GET` | `/api/v1/portfolios/:id/holdings` | Current derived positions and live quotes |
| `GET` | `/api/v1/portfolios/:id/summary` | Summary metrics (cost, value, P&L, return, cash) |
| `GET` | `/api/v1/portfolios/:id/allocation` | Asset class and sector allocations |
| `GET` | `/api/v1/portfolios/:id/performance` | Historical series & benchmark comparison |
| `GET` | `/api/v1/portfolios/:id/transactions` | Paginated, filterable transaction ledger |
| `POST` | `/api/v1/portfolios/:id/transactions` | Record a new validated transaction |
| `GET` | `/api/v1/portfolios/:id/transactions/:txId` | Get transaction detail |
| `PATCH` | `/api/v1/portfolios/:id/transactions/:txId` | Edit transaction with ledger re-validation |
| `DELETE` | `/api/v1/portfolios/:id/transactions/:txId` | Delete transaction with short sell check |
| `GET` | `/api/v1/portfolios/:id/transactions/export` | Download CSV transaction ledger |
| `POST` | `/api/v1/portfolios/:id/import/preview` | Preview & validate CSV rows |
| `POST` | `/api/v1/portfolios/:id/import/confirm` | Commit confirmed batch import |

---

## 10. Database Schema (Migration: `20261024200000_portfolio_tracking.sql`)

- `public.portfolios`: Portfolio records with `user_id`, `base_currency`, unique constraints, and RLS policies.
- `public.portfolio_transactions`: Ledger entries with `type`, `symbol`, `exchange`, `quantity`, `price`, `fees`, `taxes`, `total_amount`, and RLS policies.
- `public.portfolio_snapshots`: Daily valuation snapshots for historical performance caching and audit trails.

---

## 11. Security & Disclaimers

1. **User Isolation:** All operations enforce strict user verification (`req.user.id`). User A cannot view, mutate, or export User B's portfolios or transactions.
2. **Financial Disclaimer:** Portfolio metrics are informational calculations based on user-entered ledger records and available market provider observations. They do not constitute official brokerage tax statements or guaranteed valuations.
