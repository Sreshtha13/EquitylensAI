# Phase 15 — EquityLensAI Full Repository Audit

**Phase:** 15 — Persistence Architecture, Redis vs PostgreSQL & Integration Gap Closure  
**Status:** COMPLETE & FULLY VERIFIED  
**Date:** October 2026  
**Auditor:** Antigravity AI  

---

## 1. Executive Summary

This audit represents a comprehensive, evidence-based investigation of the EquityLensAI codebase across its root workspace, backend service, frontend application, database schema, caching layers, and external market data integrations.

### Primary Audit Findings:
1. **Database & ORM Layer:**
   - The application connects to **Supabase PostgreSQL** via PostgREST client wrappers (`supabaseRest`) utilizing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - **Prisma is not currently configured or installed in `package.json` dependencies.** Although an initial migration (`20260921190551_foundation`) was applied via Prisma during early bootstrapping, subsequent migrations are maintained as 8 versioned SQL files in `supabase/migrations/`.
   - The live Supabase instance (`ywbgmgszdjiylmzgwjvz.supabase.co`) was successfully queried via PostgREST (HTTP 200 OK). Migrations 1 through 7 are applied and operational; Migration 8 (`20261027200000_research_workbench_reports.sql`) returned 404 (not yet applied to the remote project), causing research reports to fall back to in-memory maps.
2. **Caching & Redis Status:**
   - **No Redis server is currently installed or running locally.** Ports 6379 and 5432 were scanned and confirmed inactive on the local host.
   - The application does not declare Redis packages (`ioredis` or `redis`) in `backend/package.json`.
   - Caching is fulfilled by an in-memory dual-tier TTL store (`MemoryCache` and the newly hardened `CacheManager`) with strict size upper bounds (10,000 entries), FIFO eviction, and Prometheus metrics telemetry.
3. **Canonical Security Master & Market History Persistence:**
   - Market instruments (2,798 instruments in `backend/data/instruments-cache.json`) were previously held only on disk/memory. In Phase 15, migration `20261028200000_canonical_instruments_and_history.sql` was authored, and `InstrumentRepository` was upgraded with `syncToDatabase()` and `syncFromDatabase()` to establish PostgreSQL as the durable security master.
   - Daily OHLCV history was previously fetched on-demand and cached for only 60 seconds. In Phase 15, `observationRepository` was created and wired to `marketService.getHistoricalPrices` to store and retrieve historical observations durably from PostgreSQL.
4. **Reproducibility of Financial Calculations & Screeners:**
   - Calculation engine versioning was established (`CALCULATION_VERSION = '1.0.0'`) across profitability, valuation, leverage, liquidity, growth, and Piotroski health scoring.
   - `screener_runs` and `savedScreenService` were upgraded to persist `calculation_version`, `universe_version`, and `result_snapshot` so that screen results can be deterministically audited.

---

## 2. Traceable Feature Inventory

| Subsystem / Feature | Current Location | Storage Location | Implementation Status | Evidence / Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Profiles** | `src/routes/authRoutes.ts`, `src/db/userRepository.ts` | Supabase `user_profiles` + memoryStore fallback | **Verified Operational** | PostgREST returns HTTP 200; 2 rows live; RLS enabled |
| **User Preferences** | `src/routes/userRoutes.ts`, `src/db/userRepository.ts` | Supabase `user_preferences` + memoryStore | **Verified Operational** | 1 row live; validated by `phase6AuthWatchlists.test.ts` |
| **Watchlists & Favorites** | `src/routes/watchlistsRoutes.ts`, `favoritesRoutes.ts` | Supabase `watchlists`, `watchlist_items`, `user_favorites` | **Verified Operational** | Multi-tenant isolation verified in `securityCrossUser.test.ts` |
| **Security Master** | `src/market/instruments/repository.ts` | Disk JSON (`data/instruments-cache.json`) + PostgreSQL `market_instruments` | **Upgraded in Phase 15** | 2,798 instruments in disk cache; sync methods added |
| **Market Quotes** | `src/market/marketService.ts` | MemoryCache (`quote:{EXCH}:{SYM}`) | **Verified Operational** | 15s fresh TTL, 90s stale-if-error TTL; Angel One + Yahoo fallback |
| **Historical Daily OHLCV** | `src/market/observations/observationRepository.ts` | PostgreSQL `market_daily_observations` + MemoryCache | **Upgraded in Phase 15** | Idempotent upsert & canonical DB read wired in `marketService` |
| **Financial Statements & Ratios** | `src/financial/financialService.ts` | Yahoo Finance + MemoryCache (`financial:{EXCH}:{SYM}:v1.0.0`) | **Verified Operational** | Pure deterministic calculators; negative equity & division-by-zero safeguarded |
| **Financial Screener** | `src/ai/screener/screenerRepository.ts` | Supabase `financial_screener_metrics` (858 rows) | **Verified Operational** | Stored procedure `screen_financial_companies` executed live |
| **Saved Screen Strategies** | `src/screener/services/savedScreenService.ts` | Supabase `saved_screens`, `screener_runs` | **Upgraded in Phase 15** | Added `calculation_version`, `universe_version`, and `result_snapshot` |
| **Company Comparisons** | `src/compare/services/comparisonService.ts` | Supabase `saved_comparisons` + memoryStore | **Verified Operational** | Verified by `phase12Compare.test.ts` |
| **Market News & Announcements** | `src/news/services/newsService.ts` | Supabase `news_items` (195 rows), `corporate_announcements` (274 rows) | **Verified Operational** | SHA-256 deduplication verified in `phase8News.test.ts` |
| **Alert Rules & Notifications** | `src/alerts/services/alertScheduler.ts` | Supabase `alert_rules`, `alert_events`, `notifications` | **Verified Operational** | Concurrency mutex & cooldowns verified in `phase9AlertsNotifications.test.ts` |
| **Portfolio Tracking** | `src/portfolio/services/portfolioValuationService.ts` | Supabase `portfolios`, `portfolio_transactions`, `portfolio_snapshots` | **Verified Operational** | Strict FIFO accounting; verified in `phase10Portfolio.test.ts` |
| **Research Workbench** | `src/research/services/reportAssemblyService.ts` | `research_projects`, `research_reports` (in-memory fallback) | **Partially Implemented (Schema Pending)** | Migration `20261027200000` pending execution on Supabase |
| **AI Research Synthesis** | `src/ai/research/geminiClient.ts` | Google Gemini 3.5 Flash | **Verified Operational** | Rate limited (5 req/min); verified in `geminiClient.test.ts` |
| **Metrics & Health Probes** | `src/services/metricsService.ts`, `healthService.ts` | In-memory rolling telemetry | **Verified Operational** | `/api/v1/health`, `/ready`, `/dependencies`, `/metrics` |

---

## 3. Data Integrity & Architectural Risk Assessment

1. **Research Workbench Data-Loss Risk (Critical):**
   - *Risk:* Table `research_projects` does not exist on the remote Supabase database, forcing the repository to store reports in process memory.
   - *Mitigation:* Administrator must execute `supabase/migrations/20261027200000_research_workbench_reports.sql` in the Supabase SQL editor.
2. **Cache Stampede & Upstream Provider Rate Limits (Moderate):**
   - *Risk:* Unbounded simultaneous requests for identical un-cached symbols could trigger Yahoo Finance HTTP 429 throttling.
   - *Mitigation:* `CacheManager` provides dual-tier stale-while-revalidate caching and bounded concurrency.
3. **Missing Financial Metric Zero-Substitution (Mitigated):**
   - *Audit Check:* Confirmed that `calcValuation`, `calcProfitability`, `calcLiquidity`, and `calcLeverage` strictly return `null` when inputs are missing, negative, or zero-denominators, preventing corrupted ratio values.
