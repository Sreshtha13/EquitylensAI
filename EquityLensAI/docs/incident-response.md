# EquityLensAI — Incident Response & Operational Triage Runbook

## 1. Severity Classification

| Severity | Definition | Target Response | Target Resolution |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core API down, authentication failure, database unreachable, or data corruption in user portfolios. | < 15 minutes | < 2 hours |
| **SEV-2 (High)** | Primary market data provider offline; AI research unavailable; alert scheduler failing repeatedly. | < 30 minutes | < 4 hours |
| **SEV-3 (Medium)** | Minor UI rendering defect; delayed news feed; elevated cache miss rates. | < 4 hours | < 24 hours |

---

## 2. Fast Incident Triage Workflow

When an alert triggers or an operational anomaly is detected, execute this diagnostic sequence:

```bash
# Step 1: Check Liveness
curl -I https://api.equitylensai.com/api/v1/health

# Step 2: Check Readiness (Database, Memory, Schedulers)
curl https://api.equitylensai.com/api/v1/health/ready

# Step 3: Check External Provider Dependencies
curl https://api.equitylensai.com/api/v1/health/dependencies

# Step 4: Check Operational Telemetry & Error Distribution
curl https://api.equitylensai.com/api/v1/metrics
```

---

## 3. Provider Degradation Playbooks

### Playbook A: Angel One SmartAPI Outage
- **Symptoms:** High latency or non-200 responses logged by `angel_one` in `/api/v1/metrics`.
- **System Behavior:** Backend automatically switches to Yahoo Finance fallback for NSE/BSE quotes and charts.
- **Action Required:**
  1. Verify SmartAPI token expiration or TOTP synchronization.
  2. If Angel One service is undergoing exchange maintenance, leave fallback active; frontend will show `"Yahoo Finance"` provenance badges.

### Playbook B: Gemini AI Service Outage / Rate Limit
- **Symptoms:** `/api/v1/research/:id/draft` or AI screening returns HTTP 503 with `"AI service temporarily unavailable"`.
- **System Behavior:** Deterministic financial ratios, health scores, statement tables, and report editing remain 100% operational.
- **Action Required:**
  1. Do not disable the entire application.
  2. Inspect `/api/v1/health/dependencies` for Gemini quota exhaustion.
  3. Increase `GEMINI_TIMEOUT_MS` or adjust `AI_RESEARCH_RATE_LIMIT` if requests are timing out under heavy concurrency.

### Playbook C: Alert Scheduler Deadlock or Excessive Concurrency
- **Symptoms:** Alert rules stop evaluating; consecutive failure count increases in `/api/v1/health/dependencies`.
- **System Behavior:** The `isEvaluating` mutex prevents job duplication.
- **Action Required:**
  1. Check backend logs for unhandled rule evaluation errors.
  2. Restart the backend process/container to reset the in-memory execution lock safely without data loss.

---

## 4. Emergency Rollback Playbook

If a new deployment causes critical regressions:
1. Identify the prior known-good Docker image or commit SHA.
2. In Docker environments, restart the previous image tag:
   ```bash
   docker compose down
   docker compose up -d --build
   ```
3. Run post-deployment smoke tests (`/api/v1/health` and `/api/v1/health/ready`).
4. Announce incident resolution and document root-cause analysis (RCA).
