# Background Schedulers & Ingestion Pipeline Specification

**Document:** Background Workers, Schedulers & Batch Ingestion Operations  
**Version:** 1.0.0  
**Phase:** 16 — Production Deployment & Live NSE/BSE Data Verification  
**Date:** October 2026  
**Status:** Validated & Configured  

---

## 1. Background Jobs Inventory

| Worker / Job Name | Source File | Schedule / Trigger | Purpose | Output Relation / Store | Mutex & Deduplication Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`AlertScheduler`** | `src/alerts/services/alertScheduler.ts` | Periodic timer (`60,000ms`) | Evaluates price, volume, and metric alert conditions for users | `alert_events`, `notifications` | In-memory `isEvaluating` mutex; deduplication key on trigger |
| **`NewsIngestionJob`** | `src/news/services/ingestionManager.ts` | Periodic timer (`300,000ms` / on-demand) | Pulls corporate announcements & news articles | `news_items`, `corporate_announcements` | SHA-256 `content_hash` unique constraint in PostgreSQL |
| **`InstrumentMasterIngestion`** | `src/market/instruments/ingestion.ts` | Daily (06:00 IST / manual CLI) | Downloads Angel One Scrip Master JSON (~35MB) | `data/instruments-cache.json` & `market_instruments` | `isIngesting` atomic flag; `on_conflict(exchange, symbol)` |
| **`EODObservationIngestion`**| `src/market/observations/observationRepository.ts`| Daily (18:30 IST post-market) | Reconciles end-of-day OHLCV Bhavcopy observations | `market_daily_observations` | `on_conflict(exchange, symbol, trading_date)` composite key |

---

## 2. Worker Concurrency & Multi-Replica Safeguards

1. **Idempotent Upsert Guarantee:** All ingestion workers execute database writes utilizing PostgreSQL `ON CONFLICT DO UPDATE` or `ON CONFLICT DO NOTHING`. If multiple backend replicas execute simultaneously, zero duplicate records are created.
2. **Execution Mutex:** In-process locks (`isEvaluating`, `isIngesting`) guard against overlapping execution within a single Node.js instance.
3. **Bounded Processing Windows:** Alert evaluation and news ingestion enforce query timeouts (10s) and batch processing limits to ensure background tasks do not monopolize event loop cycles or degrade API responsiveness.

---

## 3. Operational CLI Commands

Operators can trigger background workflows on-demand using package scripts:

```bash
# Ingest full Indian market security master (NSE + BSE equities and indices):
npm run ingest:instruments -w @equitylensai/backend

# Ingest and recalculate financial screener metrics:
npm run ingest:screener -w @equitylensai/backend

# Trigger news and announcement sync via authenticated admin API:
curl -X POST http://localhost:4000/api/v1/news/ingest \
  -H "Authorization: Bearer <ADMIN_SERVICE_ROLE_KEY>"
```
