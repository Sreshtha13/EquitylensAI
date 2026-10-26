# Phase 9: Alerts & Notifications System Documentation

## 1. Overview and Architecture

Phase 9 implements a production-grade, deterministic alerting and notification system for EquityLensAI. The system enables authenticated users to configure monitoring rules across real market data, financial metrics, corporate disclosures, and company news, delivering verified, evidence-grounded notifications while strictly preventing duplicates and false triggers.

### Architectural Components

```
User (Browser / Next.js Frontend)
  │
  ├──► REST API (`/api/v1/alerts`, `/api/v1/notifications`)
  │      │
  │      ▼
  │    AlertsController / NotificationsController
  │      │ (Zod Validation & Auth Verification)
  │      ▼
  │    AlertRuleService / NotificationService
  │      │
  │      ├──► AlertRepository / NotificationRepository
  │      │      (PostgreSQL via Supabase RLS / In-Memory Test Store)
  │      │
  │      └──► AlertConditionEvaluator (Deterministic Engine)
  │
  └──► Background Scheduler (`alertScheduler`)
         │ (Runs every 60s outside user request path + Graceful Shutdown)
         ▼
       AlertEvaluationService
         │
         ├── Quotes Batcher (MarketService -> Live/Delayed Provider Data)
         ├── Financials Batcher (FinancialService -> Verified statements & metrics)
         ├── News & Corporate Disclosures (Phase 8 Ingestion Pipeline Event Hook)
         ▼
       Idempotent AlertEvent & AppNotification Persistence
```

---

## 2. Supported Alert Types and Evaluation Rules

### A. Price Threshold & Crossing Alerts
- **Supported Conditions:**
  - `rises_above`: Evaluates true when `quote.price >= targetPrice`.
  - `falls_below`: Evaluates true when `quote.price <= targetPrice`.
  - `crosses_above`: Detects a genuine transition from below to above.
    - Baseline initialization: On first evaluation, records `lastState = 'below'` (if `quote.price < targetPrice`) or `'above'` (if `quote.price >= targetPrice`) without firing a false event.
    - Trigger condition: Evaluates true only when `lastState === 'below'` AND `quote.price >= targetPrice`.
  - `crosses_below`: Detects a genuine transition from above to below.
    - Baseline initialization: Records initial state without false triggers.
    - Trigger condition: Evaluates true only when `lastState === 'above'` AND `quote.price <= targetPrice`.
- **Data Provenance & Freshness:**
  - Evaluated against provider-supplied `NormalizedQuote` (e.g., Angel One / Yahoo Finance).
  - Quotes marked as `isStale: true` or quotes missing price data are safely skipped with operational telemetry; no false events or notifications are ever emitted.
- **Cooldown & Deduplication:**
  - Configurable cooldown window (default: 60 minutes) prevents re-triggering while a condition remains continuously satisfied.
  - Crossing alerts automatically transition `lastState` and require a state reversal before crossing again.

### B. Percentage-Change Movement Alerts
- **Supported Periods:** `1d` (intraday trading session movement from previous close).
- **Supported Directions:** `up`, `down`, `either`.
- **Requirements:**
  - Computed strictly from `quote.changePercent` supplied by provider observations.
  - Requires valid, non-stale session quote data.
  - Cooldown prevents redundant notifications within the same session.

### C. Volume Alerts
- **Supported Conditions:** `exceeds`.
- **Requirements:**
  - Triggered only when reliable cumulative trading volume (`quote.volume`) exceeds user's configured `targetVolume`.
  - Skipped safely if the instrument does not report volume (e.g., benchmark indices).

### D. Financial Metric Alerts
- **Supported Metrics:**
  - `roe` (Return on Equity)
  - `roce` (Return on Capital Employed)
  - `operatingMargin` (Operating Margin %)
  - `netMargin` (Net Margin %)
  - `debtToEquity` (Debt-to-Equity ratio)
  - `freeCashFlow` (Free cash flow)
  - `peRatio` (Price-to-Earnings ratio)
  - `pbRatio` (Price-to-Book ratio)
  - `currentRatio` (Current Ratio)
- **Supported Comparison Operators:** `>`, `>=`, `<`, `<=`.
- **Deterministic Guarantees:**
  - Uses verified `FinancialAnalysis` statements from earlier phases.
  - Missing metrics (`null` or `undefined`) are never treated as zero; evaluations are skipped with a clear reason.
  - Notifications display the audited reporting fiscal period (e.g. `FY2025`).

### E. Corporate Announcement Alerts
- **Integration:** Directly wired into the Phase 8 official disclosure ingestion pipeline (`newsRepository`).
- **Scopes:**
  - `stock`: Monitors specific symbol (e.g. `TCS`, `RELIANCE`).
  - `watchlist`: Automatically monitors all symbols across the authenticated user's watchlists.
- **Filter Categories:** `financial_results`, `dividend`, `board_meetings`, `bonus_issue`, `stock_split`, `rights_issue`, `fundraising`, `mergers_acquisitions`, `shareholding_pattern`, `management_changes`, `insider_trading`, `agm_egm`, `credit_ratings`, `regulatory`, `general`.
- **Idempotency:** Stable keys based on `ann_{ruleId}_{announcementId}` ensure each announcement is notified at most once.

### F. Company News Alerts
- **Scopes:** `stock` or `watchlist`.
- **Sources:** Genuine ingested Google News RSS items; untrusted publisher content is safely escaped.

---

## 3. Database Schema and Security (Supabase PostgreSQL)

Migration file: `supabase/migrations/20261023200000_alerts_notifications.sql`

### Models:
1. `alert_rules`:
   - `id UUID PRIMARY KEY`, `user_id UUID NOT NULL` (references `auth.users`), `alert_type`, `symbol`, `exchange`, `rule_config JSONB NOT NULL`, `enabled BOOLEAN`, `cooldown_minutes INT`, `last_evaluated_at`, `last_observation_at`, `last_observed_value`, `last_triggered_at`, `last_state`.
   - Constraints: Foreign key cascade to `auth.users`, check on `alert_type`.
2. `alert_events`:
   - `id UUID PRIMARY KEY`, `rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE`, `user_id UUID NOT NULL`, `trigger_timestamp`, `observed_value`, `threshold_context JSONB`, `source`, `deduplication_key TEXT UNIQUE`, `status`.
   - Constraints: `UNIQUE (deduplication_key)` prevents double execution even under concurrent worker execution.
3. `notifications`:
   - `id UUID PRIMARY KEY`, `user_id UUID NOT NULL`, `alert_event_id UUID REFERENCES alert_events(id) ON DELETE SET NULL`, `category`, `title`, `message`, `is_read BOOLEAN`, `read_at`, `symbol`, `exchange`, `source_url`, `metadata JSONB`.
4. `notification_deliveries`:
   - Tracks delivery lifecycle per channel (`in_app`, `email`), retry attempts, next retry, and error messages.
5. `user_alert_preferences`:
   - Per-user preferences: `in_app_enabled`, `email_enabled`, `email_address`, `price_alerts`, `percentage_alerts`, `volume_alerts`, `financial_alerts`, `announcement_alerts`, `news_alerts`, `digest_frequency`.

### Multi-User Security & Row-Level Security (RLS)
- Strict RLS policies on all 5 tables enforce `auth.uid() = user_id`.
- Users cannot access, modify, preview, or delete other users' rules, events, or notifications.
- Rule quota enforcement: Maximum 50 active alert rules per user (`ALERT_MAX_RULES_PER_USER`).

---

## 4. REST API Reference

All alert and notification endpoints are authenticated under `/api/v1`.

### Alert Rules:
- `GET /api/v1/alerts`: List user's rules (filters: `alertType`, `enabled`, `symbol`, pagination: `limit`, `offset`).
- `POST /api/v1/alerts`: Create a rule with validated type-specific config.
- `GET /api/v1/alerts/:alertId`: Retrieve single rule.
- `PATCH /api/v1/alerts/:alertId`: Update rule parameters. Resets crossing baseline state if threshold or type changes.
- `DELETE /api/v1/alerts/:alertId`: Delete rule and cascade events.
- `POST /api/v1/alerts/:alertId/enable`: Enable evaluation.
- `POST /api/v1/alerts/:alertId/disable`: Disable evaluation.
- `GET /api/v1/alerts/:alertId/events`: Fetch event trigger history for this rule.
- `POST /api/v1/alerts/preview`: Validate proposed rule config against live quote or financial statements without saving or sending notifications.
- `GET /api/v1/alerts/status`: Operational worker health status and telemetry.

### Notifications:
- `GET /api/v1/notifications`: List notifications (filters: `unreadOnly`, `category`, pagination).
- `GET /api/v1/notifications/unread-count`: Get accurate unread count.
- `PATCH /api/v1/notifications/:notificationId/read`: Mark notification as read.
- `PATCH /api/v1/notifications/read-all`: Mark all unread notifications as read.
- `DELETE /api/v1/notifications/:notificationId`: Delete notification.
- `GET /api/v1/notifications/preferences`: Get delivery preferences.
- `PATCH /api/v1/notifications/preferences`: Update delivery preferences.

---

## 5. Background Scheduler & Operational Worker

- **Scheduler:** `AlertScheduler` in `backend/src/alerts/services/alertScheduler.ts`.
- **Interval:** Runs every 60 seconds (configurable via `ALERT_EVALUATION_INTERVAL_MS`).
- **Batching:** Collects distinct symbols across all enabled rules, fetches market quotes and financial statements in batches, and evaluates rules with bounded concurrency.
- **Event-Driven Hook:** Phase 8's `ingestionJob` triggers `alertEvaluationService.evaluateAll()` immediately upon ingestion of new exchange filings.
- **Graceful Shutdown:** Registered in `backend/src/utils/lifecycle.ts`; safely terminates intervals on `SIGTERM`/`SIGINT`.

---

## 6. Verification and Testing

Run test suite:
```bash
npm test
```

Verification results:
- **Backend Tests:** 22 test files, 171 tests all passing.
- **Phase 9 Test File:** `backend/tests/phase9AlertsNotifications.test.ts` (20 tests passing).
- **TypeScript Typecheck:** Clean across `backend`, `frontend`, and `packages/shared`.
- **Frontend Production Build:** Successfully compiled with Next.js 15 App Router, generating static `/alerts` and `/notifications` routes without warnings.
