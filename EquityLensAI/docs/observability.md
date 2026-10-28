# EquityLensAI — Observability, Health Monitoring & Metrics Standard

## 1. Health & Diagnostic Endpoints

The EquityLensAI backend exposes standardized health endpoints adhering to cloud-native orchestrator conventions (Kubernetes, Docker Swarm, AWS ECS):

### 1.1 Liveness Probe
- **Endpoint:** `GET /api/v1/health`
- **Purpose:** Fast ping to verify the Node.js event loop is responsive.
- **Payload Example:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-28T18:00:00.000Z",
    "uptime": 1420.5
  }
  ```
- **SLA / Behavior:** Returns HTTP 200 within 5ms. Does not fail if downstream third-party providers are degraded.

### 1.2 Readiness Probe
- **Endpoint:** `GET /api/v1/health/ready`
- **Purpose:** Verifies that critical internal subsystems (Database, Cache, Memory, Schedulers) are prepared to receive production user traffic.
- **Status Codes:**
  - `200 OK` when status is `ready`.
  - `503 Service Unavailable` when status is `not_ready` (e.g. database unreachable).
- **Payload Example:**
  ```json
  {
    "status": "ready",
    "timestamp": "2026-10-28T18:00:00.000Z",
    "checks": {
      "database": "connected",
      "cache": "operational",
      "memory": "healthy",
      "schedulers": "operational"
    }
  }
  ```

### 1.3 Dependencies Probe
- **Endpoint:** `GET /api/v1/health/dependencies`
- **Purpose:** Provides detailed operational diagnostics of external integrated providers without leaking internal network topologies or API keys.
- **Tracked Dependencies:**
  - `supabase`: Persistence tier status and latency.
  - `angel_one`: SmartAPI connectivity state.
  - `yahoo_finance`: Market data fallback state.
  - `gemini`: AI generation provider status and quota posture.
  - `alert_scheduler`: Active evaluation interval, concurrency lock, and consecutive error count.

---

## 2. Operational Metrics Engine

The `/api/v1/metrics` endpoint provides JSON telemetry for Prometheus or CloudWatch collectors:

```json
{
  "uptimeSeconds": 3600,
  "requests": {
    "total": 14500,
    "statusCodes": { "200": 13900, "201": 200, "400": 350, "404": 40, "500": 10 },
    "latency": {
      "p50Ms": 18,
      "p95Ms": 110,
      "p99Ms": 320
    }
  },
  "cache": {
    "hits": 8900,
    "misses": 1100,
    "hitRatio": 0.89,
    "entries": 3420,
    "maxEntries": 10000
  },
  "providers": {
    "angel_one": { "calls": 4200, "failures": 12, "lastLatencyMs": 85 },
    "yahoo_finance": { "calls": 1800, "failures": 4, "lastLatencyMs": 140 }
  },
  "ai": {
    "totalCalls": 150,
    "totalTokens": 184500,
    "failures": 2
  },
  "schedulers": {
    "alertScheduler": { "runs": 60, "errors": 0, "lastDurationMs": 240 }
  },
  "memory": {
    "heapUsedMb": 68.4,
    "heapTotalMb": 92.1,
    "rssMb": 134.8
  }
}
```

---

## 3. Structured Logging Standard

- **Format:** Structured JSON produced by `pino`.
- **Fields Logged per Request:**
  - `requestId`: Unique UUID passed in `x-request-id` or generated per request.
  - `method` & `url`: HTTP route and query string.
  - `status`: HTTP response status code.
  - `durationMs`: Total server processing latency.
  - `userId`: Masked or hashed user identifier when authenticated.
- **Redaction:** `authorization`, `cookie`, `password`, `token`, `secret`, `apiKey` fields are masked automatically.
- **Development Mode:** Enabled with `pino-pretty` for developer readability. Production mode outputs raw NDJSON for log aggregation (Grafana Loki, Datadog, AWS CloudWatch).
