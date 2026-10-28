# Supabase PostgreSQL Production Setup & Migration Verification

**Document:** Supabase Infrastructure & Database Operational Manual  
**Version:** 1.0.0  
**Phase:** 16 — Production Deployment & Live NSE/BSE Data Verification  
**Date:** October 2026  
**Status:** Verified Operational on Live Cluster  

---

## 1. Supabase Target Cluster Profile

- **Cluster Hostname:** `ywbgmgszdjiylmzgwjvz.supabase.co`
- **Region:** AWS AP-South-1 (Mumbai, India)
- **Database Engine:** PostgreSQL 15.6 with pgvector, pgcrypto, and uuid-ossp
- **Access Protocol:** PostgREST REST API (`/rest/v1/`) and Supabase Auth (`/auth/v1/`)
- **Transport Security:** TLS 1.3 enforced across all connections

---

## 2. Connection Strategy & Compatibility Evaluation

The application connects to Supabase PostgreSQL via **PostgREST client endpoints** utilizing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Evaluation of Access Modes:

1. **PostgREST HTTP REST API (Current & Selected Production Mode):**
   - **Mechanism:** HTTP/1.1 and HTTP/2 persistent connection reuse over HTTPS.
   - **Connection Pooling:** Managed internally by Supabase PgBouncer / Supavisor on the server side.
   - **Client Overhead:** Zero long-lived open TCP sockets on the backend node, eliminating connection pool starvation under traffic spikes.
   - **Security:** Operates under PostgreSQL Row-Level Security (RLS). Service role requests authenticate system jobs; user JWT tokens scope user data.
   - **Status:** **Verified Operational (HTTP 200/201 across all tables).**

2. **Direct TCP Connection (`db.ywbgmgszdjiylmzgwjvz.supabase.co:5432`):**
   - Subject to potential IPv6 DNS resolution issues in environments lacking native IPv6 routing.
   - Incurred connection overhead during early bootstrapping; not required because all application repositories utilize PostgREST wrappers.

3. **Supavisor Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432` / `6543`):**
   - Available if raw SQL connections via `pg` or Prisma are introduced. For the existing architecture, PostgREST remains the official, supported interface.

---

## 3. Production Migration Audit & Live Table Inventory

All 9 migration scripts have been reviewed and verified on the live Supabase cluster:

| Migration File | Target Relation(s) | Live HTTP Status | Live Measured Rows | Role & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `20260921190551_foundation` | `exchanges`, `sectors`, `industries` | HTTP 200 | 1 exchange, 13 sectors, 24 industries | Economic reference master |
| `20261020213000_financial_screener.sql` | `financial_screener_metrics` | HTTP 206 | **858** | Canonical ratios for Indian listed universe |
| `20261021200000_auth_watchlists_preferences.sql` | `user_profiles`, `watchlists`, `user_preferences` | HTTP 206 | 2 profiles, multi-tenant | RLS isolated by `auth.uid()` |
| `20261022200000_market_news_announcements.sql` | `news_items`, `corporate_announcements` | HTTP 206 | **200** news, **334** announcements | SHA-256 deduplication on content hash |
| `20261023200000_alerts_notifications.sql` | `alert_rules`, `alert_events`, `notifications` | HTTP 200 | Dynamic | Mutex-guarded evaluation rules |
| `20261024200000_portfolio_tracking.sql` | `portfolios`, `portfolio_transactions` | HTTP 200 | Multi-tenant | FIFO accounting ledger |
| `20261025200000_advanced_screener_saved_strategies.sql`| `saved_screens`, `screener_runs` | HTTP 200 | Dynamic | Reproducibility metadata |
| `20261026200000_saved_comparisons.sql` | `saved_comparisons` | HTTP 200 | Multi-tenant | Peer group comparison state |
| `20261027200000_research_workbench_reports.sql` | `research_projects`, `research_reports` | HTTP 200 | 1 active project | Multi-section analyst reports |
| `20261028200000_canonical_instruments_and_history.sql`| `market_instruments`, `market_daily_observations`, `calculation_versions` | HTTP 200 / 206 | **2,699** instruments, verified observations | Canonical security master & OHLCV candles |

---

## 4. Empirical Security & Persistence Evidence

During Phase 16 empirical verification:
1. **Instrument Master Persistence:** `InstrumentRepository.syncToDatabase()` successfully batch-persisted **2,698 instruments** to `market_instruments`. Querying `/rest/v1/market_instruments` confirmed **2,699 total rows** in the live database.
2. **Historical Observations:** `observationRepository.upsertDailyObservations()` persisted daily candles for `RELIANCE` (NSE) and successfully retrieved them via `getDailySeries()` with source attribution `'canonical_db'`.
3. **Multi-Tenant Isolation:** User B was strictly blocked with HTTP 404 when querying User A's private watchlist ID (`4e6269f6-ba4d-494c-94ac-44fd25feed02`), and User B's watchlist index returned 0 records.

---

## 5. Mandatory Production Safety Invariants

- **NEVER execute `prisma migrate reset` or drop table commands against production.**
- All DDL migrations must be executed as additive versioned SQL scripts in `supabase/migrations/`.
- Pre-migration backups must be dumped via `supabase db dump` prior to applying any schema modifications.
