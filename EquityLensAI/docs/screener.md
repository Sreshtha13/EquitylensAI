# Natural-language stock screener

## Implementation status

The screener implements Gemini filter interpretation, editable criteria, a persisted financial-metrics index, bounded database-side filtering, and paginated results. Deployment still requires applying the migration and running financial ingestion; if the database or index is unavailable, the endpoint returns an explicit error rather than fabricated matches. Coverage is reported against the current instrument-master snapshot, not a claim of complete exchange-wide coverage.

## API

### Metric catalog

`GET /api/v1/ai/screener/metrics` returns the single backend metric catalog used to render the metric editor. Supported metrics are indexed from the existing deterministic financial analysis; missing values are excluded rather than treated as zero.

### Interpret a query

`POST /api/v1/ai/screener/interpret` accepts an 8 KB maximum JSON body:

```json
{
  "query": "Find NSE companies with ROE above 15%, revenue growth above 10%, and debt-to-equity below 0.5",
  "exchange": "NSE",
  "period": "annual"
}
```

Supported exchange values are `NSE` and `BSE`; the supported asset type is listed equity. Period choices are `annual` and `ttm`. Quarterly data and reporting scope selection are unsupported; the current financial provider does not distinguish consolidated from standalone statements. Query text is limited to 500 characters, at most five filters are returned, and result page size is bounded to 100 for the future executor.

An interpretation response contains `querySummary`, `filters`, `logic`, `exchange`, `assetType`, `period`, `sort`, `limit`, `clarificationNeeded`, `warnings`, and `executionAvailable`. It never contains company results or match counts. An uncertain qualitative request such as “low debt” is returned with clarification required and no active filters. Natural-language percentages use percentage points (`15` means `15%`); ratios are decimal (`0.5` means `0.5`); financial-health scores use the existing 0–100 scale.

### Execute a screen

`POST /api/v1/ai/screener` accepts the same query and context plus validated `filters`, `logic`, and optional `offset`. The allowlist, operator, numeric bounds, filter count, period availability, sort, and pagination are validated before execution. Success responses include matching companies, matched metric values, reporting period, provider provenance, retrieval time, stale status, total matches, pagination, and coverage metadata. Unsupported fields, operators, scopes, periods, or malformed values are rejected.

## Deploy and ingest

1. Configure `SUPABASE_URL` and a valid `SUPABASE_SERVICE_ROLE_KEY` in the backend environment.
2. Apply `supabase/migrations/20261020213000_financial_screener.sql` to the target Supabase project (for example, with the Supabase CLI `db push` workflow).
3. Populate the instrument master with `npm run ingest:instruments -w @equitylensai/backend`.
4. Run `npm run ingest:screener -w @equitylensai/backend` to ingest NSE and BSE equities. Use `-- --exchange=NSE --limit=20` for a bounded trial; omitting `--limit` selects the full cached instrument universe. A bounded run is explicitly marked incomplete.

The ingester retrieves provider statements per instrument and upserts annual and available TTM metrics in batches. Provider failures are counted and cause incomplete coverage; a successful API call does not imply full exchange coverage. Coverage is compared with the currently cached instrument master. Metrics older than 180 days are returned as stale; missing metrics never match a filter. The screener returns stale matches with a warning rather than silently discarding them.

## Current metric catalog

Every entry maps to an implemented Phase 3 financial-analysis value. Screening availability depends on the deployed index and its coverage metadata.

| Field                    | Unit    | Existing financial-analysis path        | Periods     |
| ------------------------ | ------- | --------------------------------------- | ----------- |
| `roe`                    | percent | `profitability.returnOnEquity`          | annual, TTM |
| `roa`                    | percent | `profitability.returnOnAssets`          | annual, TTM |
| `roce`                   | percent | `profitability.returnOnCapitalEmployed` | annual, TTM |
| `net_margin`             | percent | `profitability.netMargin`               | annual, TTM |
| `debt_to_equity`         | ratio   | `leverage.debtToEquity`                 | annual, TTM |
| `revenue_growth`         | percent | `growth.revenueGrowthYoY`               | annual      |
| `net_income_growth`      | percent | `growth.netIncomeGrowthYoY`             | annual      |
| `free_cash_flow_margin`  | percent | `cashFlow.freeCashFlowMargin`           | annual, TTM |
| `current_ratio`          | ratio   | `liquidity.currentRatio`                | annual, TTM |
| `pe_ratio`               | ratio   | `valuation.peRatio`                     | annual, TTM |
| `price_to_book`          | ratio   | `valuation.priceToBook`                 | annual, TTM |
| `financial_health_score` | score   | `healthScore.overallScore`              | annual, TTM |

All numeric filters support `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, and `between`. Only the `AND` and `OR` combinators are accepted. There are no text-field or arbitrary-expression filters. Metric-specific numeric bounds and supported periods live in the backend registry and are validated again after Gemini returns.

## Data semantics, safety, and limitations

- The existing calculator returns null when required source values are missing; missing metrics are excluded from matching.
- Indexed rows carry Yahoo Finance provenance, retrieval time, statement period, and stale status. Coverage is measured against the current local instrument-master snapshot.
- The current provider does not provide consolidated/standalone scope in the financial contract. No scope is inferred.
- Gemini receives only the query and allowlisted metric metadata. It has no database, tools, SQL execution, or result-generation capability.
- Model JSON is bounded and schema-validated; every field, operator, unit scale, period, value range, and sort field is independently checked by the backend.
- The endpoint uses the existing AI rate limiter and centralized error envelope. Raw queries are not logged.
- Request validation, interpretation, and execution are separate. Execution failures use non-2xx HTTP responses.
- The financial statement provider does not identify consolidated versus standalone statements; no scope is inferred or selectable.
- Data ingestion is an external provider workload. Use a bounded trial first and monitor rate limits, failures, and coverage before a full run.

## Verification

The targeted backend tests are `npm test -w @equitylensai/backend -- screener.test.ts`. Test doubles are confined to automated tests; the optional Gemini smoke test is not run as part of the suite.
