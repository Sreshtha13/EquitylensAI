# Production Health Probes, Metrics & Observability

**Document:** Health Checks, Observability & Telemetry Reference  
**Version:** 1.0.0  
**Phase:** 16 — Production Deployment & Live NSE/BSE Data Verification  
**Date:** October 2026  
**Status:** Verified Operational  

---

## 1. Multi-Tier Health Check Endpoints

The backend exposes three specialized health endpoints conforming to Kubernetes and cloud container orchestration standards:

### 1.1 Liveness Probe (`GET /api/v1/health`)
- **Purpose:** Verifies that the Node.js process is active, responding to HTTP traffic, and not deadlocked.
- **Success Criteria:** HTTP 200 OK.
- **Sample Verified Response:**
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "equitylensai-api",
      "timestamp": "2026-10-28T15:48:31.991Z",
      "uptimeSeconds": 63
    }
  }
  ```

### 1.2 Readiness Probe (`GET /api/v1/health/ready`)
- **Purpose:** Verifies that the backend can actively serve production traffic without degradation.
- **Sub-checks Evaluated:**
  - `database`: Executes authenticated ping to Supabase PostgREST endpoint within a 3s timeout.
  - `cache`: Verifies `MemoryCache` entry count is below 50,000 threshold.
  - `memory`: Verifies Node.js `heapUsed` is under 1,024 MB (1 GB).
  - `backgroundWorkers`: Verifies `AlertScheduler` status.
- **Sample Verified Response:**
  ```json
  {
    "success": true,
    "data": {
      "ready": true,
      "status": "ready",
      "service": "equitylensai-api",
      "timestamp": "2026-10-28T15:48:33.167Z",
      "checks": {
        "database": { "status": "ok", "message": "Supabase PostgreSQL connected" },
        "cache": { "status": "ok", "message": "Market memory cache operational" },
        "memory": { "status": "ok", "message": "Heap usage within safe threshold" },
        "backgroundWorkers": { "status": "ok", "message": "Background worker schedulers initialized" }
      }
    }
  }
  ```

### 1.3 Dependency Inspection Probe (`GET /api/v1/health/dependencies`)
- **Purpose:** Provides deep operational telemetry into individual upstream dependencies.
- **Dependencies Audited:**
  - `database`: Supabase PostgreSQL (PostgREST + RLS) — **operational**
  - `marketDataPrimary`: Angel One SmartAPI — **operational**
  - `marketDataFallback`: Yahoo Finance — **operational**
  - `geminiAi`: Google Gemini (`gemini-3.5-flash`) — **operational**
  - `alertWorker`: In-process Alert Engine — **operational**
  - `newsWorker`: Market News & Filings Ingestion — **operational**

---

## 2. Telemetry, Structured Logs & Metrics

### 2.1 Prometheus Metrics (`GET /api/v1/metrics`)
Exposes real-time quantitative metrics:
- `http_requests_total`: Counter partitioned by method, route, and status code.
- `http_request_duration_seconds`: Histogram of API latency.
- `cache_hits_total` / `cache_misses_total`: Read acceleration efficiency.
- `database_queries_total`: Database request frequency.

### 2.2 Structured Logging Standards
- All logs emitted as structured JSON via **Pino**.
- Every incoming HTTP request is assigned a unique `requestId` (UUID v4) propagated across database queries and external provider calls.
- Sensitive headers (`authorization`, `cookie`, `apikey`) and credentials are automatically redacted before stream output.
