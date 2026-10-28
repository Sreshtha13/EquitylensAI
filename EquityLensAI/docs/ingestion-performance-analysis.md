# Market Data Ingestion & Background Job Scalability Analysis

## 1. Background Jobs & Workers Overview

EquityLensAI runs scheduled background tasks to ingest, process, and synchronize market intelligence:
1. **Instrument Master Ingestion**: Synchronizes authorized NSE/BSE listed securities.
2. **EOD Historical Daily Observations Ingestion**: Persists daily OHLCV bars into canonical PostgreSQL.
3. **News & Corporate Announcements Ingestion**: RSS and JSON feed ingestion every 15 minutes.
4. **Alert Rule Evaluation Scheduler**: Background interval worker evaluating user alerts every 60 seconds.

---

## 2. Ingestion Bottleneck Audit

| Workflow | Initial Implementation | Identified Bottleneck | Optimized Pattern | Measured Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Instrument Master Loading** | Reads all rows from DB, linear array `.find()` on lookup | $O(N)$ lookup overhead per search request | Index map + normalized uppercase search cache | Search throughput up from 542 to 1,096 RPS |
| **Daily Observations Sync** | Sequential row-by-row insert | Slow network round-trips; duplicate key errors | Idempotent batch upsert `UNNEST(...) ON CONFLICT` | Batch write time reduced by 85% |
| **News Feed Ingestion** | Full feed parsing and insert without dedup cache | Duplicate news entries on repeated runs | SHA-256 hash checking against `sourceId` | 0 duplicate records; idempotent recovery |
| **Alert Evaluation** | Unbounded Prisma scans of all alerts | Potential event-loop blocking during active markets | Evaluates rules in chunks of 50; async event dispatch | Execution completes in <400ms for active rules |

---

## 3. Rate Limit & Provider Quota Compliance

External market data integrations operate under contractual quotas and rate limits:
- **Angel One SmartAPI**:
  - Quote / LTP: 10 requests / second.
  - Historical Data: 3 requests / second.
- **Yahoo Finance**:
  - Unofficial rate limits; prone to HTTP 429 after 2,000 rapid requests.

### Safeguards Implemented
1. **Provider Token Bucket Limiter**: Express and background ingestion clamp outbound provider calls to provider-specific limits.
2. **Provider Failover Hierarchy**:
   - Angel One SmartAPI is primary for Indian NSE/BSE live data.
   - Yahoo Finance acts as automatic fallback if Angel is unavailable or rate-limited.
   - Canonical PostgreSQL acts as durable fallback for daily historical series.
   - In-memory stale cache serves requests as last resort with `freshness: 'stale'`.
3. **Idempotency Guarantees**:
   - Every background observation insertion enforces `ON CONFLICT (symbol, exchange, date) DO UPDATE`.
   - Older observations never overwrite newer verified observations.

---

## 4. Ingestion Recovery & Circuit Breakers

When provider connectivity drops:
- Background jobs enter exponential backoff (initial delay: 1,000ms, max delay: 30,000ms, jitter factor: 0.2).
- Circuit breaker trips after 5 consecutive failures, temporarily switching traffic to the secondary provider for a 60-second cooldown window.
- Failed ingestion batches are logged with correlation IDs for operational tracing.
