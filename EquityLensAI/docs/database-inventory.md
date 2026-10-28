# Supabase PostgreSQL Database Inventory

**Phase:** 15 — Persistence Architecture Audit  
**Date:** October 2026  
**Target Cluster:** Supabase PostgreSQL (`ywbgmgszdjiylmzgwjvz.supabase.co`)  
**Access Mechanism:** PostgREST API with Service Role Key  

---

## 1. Verified Live Migration Status

| Migration ID | File Name | Description | Status in Live Cluster | Applied Date |
| :--- | :--- | :--- | :--- | :--- |
| `foundation` | `20260921190551_foundation` | Initial schema (companies, listings, exchanges) | **Applied** | 2026-09-21 |
| `20261020213000` | `20261020213000_financial_screener.sql` | Financial screener metrics & stored procedures | **Applied & Operational** | October 2026 |
| `20261021200000` | `20261021200000_auth_watchlists_preferences.sql` | Profiles, preferences, watchlists & favorites | **Applied & Operational** | October 2026 |
| `20261022200000` | `20261022200000_market_news_announcements.sql` | Market news, corporate disclosures & deduplication | **Applied & Operational** | October 2026 |
| `20261023200000` | `20261023200000_alerts_notifications.sql` | Alert rules, trigger events & notification deliveries | **Applied & Operational** | October 2026 |
| `20261024200000` | `20261024200000_portfolio_tracking.sql` | Portfolios, transactions & daily valuation snapshots | **Applied & Operational** | October 2026 |
| `20261025200000` | `20261025200000_advanced_screener_saved_strategies.sql` | Saved screener strategies & execution runs | **Applied & Operational** | October 2026 |
| `20261026200000` | `20261026200000_saved_comparisons.sql` | Saved multi-company comparison workspaces | **Applied & Operational** | October 2026 |
| `20261027200000` | `20261027200000_research_workbench_reports.sql` | Research projects, reports, versions & notes | **Pending Execution (404)** | Not Yet Applied |
| `20261028200000` | `20261028200000_canonical_instruments_and_history.sql` | Security master, daily observations & calc versions | **Authored in Phase 15** | Ready for Application |

---

## 2. Live Measured Row Counts (Exact Measurements)

Measurements executed via authenticated PostgREST `HEAD` requests with `Prefer: count=exact`:

| Table Name | Measured Rows | Primary Key | Key Indexes & Constraints | Current Data Role |
| :--- | :--- | :--- | :--- | :--- |
| `financial_screener_metrics` | **858** | `(symbol, exchange, period_type)` | `exchange_period_idx` | Canonical financial ratio data for Indian equities |
| `corporate_announcements` | **274** | `id` (uuid) | Unique `(provider_id, external_id)`, `content_hash` | Corporate regulatory disclosures from BSE/NSE |
| `news_items` | **195** | `id` (uuid) | Unique `canonical_url`, `content_hash` | Financial news articles & market intelligence |
| `industries` | **24** | `id` (text) | Foreign key to `sectors(id)` | Master sector-industry hierarchy |
| `sectors` | **13** | `id` (text) | Primary key | Master economic sector classifications |
| `user_profiles` | **2** | `id` (uuid) | Unique `auth_user_id` | Authenticated user identity metadata |
| `user_preferences` | **1** | `user_id` (text) | Primary key | UI theme, density, default exchange/currency |
| `financial_screener_coverage`| **1** | `exchange` (text) | Check constraint `('NSE', 'BSE')` | Ingestion status & expected count tracking |
| `exchanges` | **1** | `id` (text) | Unique `code` | Exchange reference records (NSE) |
| `_prisma_migrations` | **1** | `id` (text) | Primary key | Legacy initial migration tracking |
| `watchlists` | **0** | `id` (uuid) | Index on `(user_id, updated_at)` | User-created stock watchlists |
| `watchlist_items` | **0** | `id` (uuid) | Unique `(watchlist_id, symbol, exchange)` | Symbols added to user watchlists |
| `user_favorites` | **0** | `id` (uuid) | Unique `(user_id, symbol, exchange)` | User quick-favorite stock symbols |
| `portfolios` | **0** | `id` (uuid) | Index on `(user_id, updated_at)` | User investment portfolios |
| `portfolio_transactions` | **0** | `id` (uuid) | Index on `(portfolio_id, trade_date)` | Buy/Sell/Dividend trade ledger |
| `portfolio_snapshots` | **0** | `id` (uuid) | Unique `(portfolio_id, valuation_date)` | Daily mark-to-market performance history |
| `alert_rules` | **0** | `id` (uuid) | Index on `(user_id, enabled)` | User alert conditions & triggers |
| `alert_events` | **0** | `id` (uuid) | Unique `deduplication_key` | Generated alert notification triggers |
| `notifications` | **0** | `id` (uuid) | Index on `(user_id, read, created_at)` | In-app user notifications |
| `saved_screens` | **0** | `id` (uuid) | Index on `(user_id, updated_at)` | Saved screener filter definitions |
| `screener_runs` | **0** | `id` (uuid) | Index on `(user_id, executed_at)` | Historical execution audits |
| `saved_comparisons` | **0** | `id` (uuid) | Index on `(user_id, updated_at)` | Saved peer comparison workspaces |
| `research_projects` | **404 (Pending)**| `id` (uuid) | Index on `(user_id, updated_at)` | Multi-section equity research projects |

---

## 3. Database Integrity & Gap Closure Summary

1. **Research Workbench Migration Pending:**
   - *Issue:* Table `research_projects` returned 404.
   - *Action Required:* Execute `supabase/migrations/20261027200000_research_workbench_reports.sql` in the Supabase project dashboard.
2. **Security Master & Daily Observation Tables Authored:**
   - *Addition:* Migration `20261028200000_canonical_instruments_and_history.sql` adds `market_instruments`, `market_daily_observations`, and `calculation_versions` tables with strict unique constraints and RLS policies.
