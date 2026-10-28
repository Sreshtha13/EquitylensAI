# EquityLensAI — Backup, Disaster Recovery & Business Continuity Plan

## 1. Persistence Scope & Architecture

EquityLensAI stores critical user and institutional financial state in Supabase PostgreSQL:
- **Core Entities:** Users, Auth sessions, Watchlists, Favorites, Portfolio Holdings, Ledger Transactions, Saved Screener Queries, Comparative Peer Groups, Research Projects, Analyst Reports, Report Versions, Research Notes, and Alert Rules.
- **Volatile / Derived Entities:** In-memory quote caches, candle buffers, rate-limiting counters, and session metrics. These do not require persistent database backups because they are reconstructable on-demand from market providers.

---

## 2. Recovery Objectives (Target Benchmarks)

| Metric | Target SLA | Notes |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 1 Hour** | Achieved via Supabase Point-in-Time Recovery (PITR) continuous WAL archiving. |
| **Recovery Time Objective (RTO)** | **< 2 Hours** | Time required to provision replacement instance and replay WAL logs. |

---

## 3. Automated Backup Configuration

1. **Daily Automated Snapshots:** Managed by Supabase infrastructure with 7-day retention on Pro plans (30-day on Enterprise).
2. **Point-in-Time Recovery (PITR):** Continuous Write-Ahead Log (WAL) archiving enabled in production environments, permitting restoration to any individual second in the retention window.
3. **Manual Snapshot Prior to Migrations:** Before running any DDL migration script from `supabase/migrations/`, an on-demand database backup must be captured via the Supabase CLI or management dashboard:
   ```bash
   supabase db dump -f backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
   ```

---

## 4. Disaster Recovery & Restoration Runbook

### Scenario A: Accidental Data Corruption or Unsafe Migration
1. Immediately place backend into maintenance mode or divert traffic to prevent further conflicting writes.
2. Identify the exact corruption timestamp ($T_{corrupt}$).
3. In the Supabase Dashboard, initiate Point-in-Time Recovery to timestamp $T_{corrupt} - 2\text{ minutes}$.
4. Validate ledger invariants:
   - Check user portfolio balances and transaction counts.
   - Verify research project version counts.
5. Point backend `SUPABASE_URL` to restored database and resume user traffic.

### Scenario B: Cache Failure or Restart
- **Behavior:** `MemoryCache` is completely non-persistent. Upon process restart or memory purge, all caches initialize empty.
- **Impact:** Temporary increase in upstream provider queries as quotes and financials are re-fetched.
- **Mitigation:** Rate limiting protects downstream providers; graceful degradation returns cached fallbacks or clear unavailable states. No database records or financial transactions are ever corrupted by cache restarts.

---

## 5. Background Job Recovery & Stale State Cleansing

If the `AlertScheduler` or `newsIngestionJob` fails or stalls:
1. Query `/api/v1/health/dependencies` to inspect scheduler status and consecutive error counters.
2. In case of an unhandled crash or deadlock, restarting the backend container automatically clears the in-memory execution lock (`isEvaluating = false`).
3. Re-run manual ingestion if required via the administrative CLI:
   ```bash
   npm run ingest:instruments -w @equitylensai/backend
   ```
