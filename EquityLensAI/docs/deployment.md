# EquityLensAI — Deployment, Configuration & Release Runbook

## 1. Release Architecture & Prerequisites

- **Runtime:** Node.js `>= 20.0.0`
- **Package Manager:** npm `>= 10.0.0`
- **Database:** Supabase PostgreSQL instance (PostgREST API enabled)
- **Containerization:** Docker Engine `>= 24.0` with Docker Compose V2

---

## 2. Environment Variables Configuration

Copy `.env.example` to `backend/.env` and `frontend/.env.local`.

### Essential Production Variables
| Variable | Service | Description | Sample / Constraint |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Both | Environment mode | `production` |
| `PORT` | Backend | Port for backend server | `4000` |
| `FRONTEND_URL` | Backend | Primary frontend origin | `https://app.equitylensai.com` |
| `CORS_ORIGIN` | Backend | Allowed CORS origins | `https://app.equitylensai.com` |
| `SUPABASE_URL` | Both | Supabase instance URL | `https://xxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Frontend | Supabase public key | Client safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase admin key | Server secret only |
| `JWT_SECRET` | Backend | JWT signing secret | 32+ character random secret |
| `NEXT_PUBLIC_API_URL` | Frontend | API base URL | `https://api.equitylensai.com/api/v1` |

---

## 3. Database Migration Deployment Sequence

Migrations reside in `supabase/migrations/` ordered chronologically.

1. Connect to the Supabase project CLI or dashboard SQL editor.
2. Verify migration state against existing tables.
3. Apply unapplied migrations sequentially:
   - `20261026000000_portfolio_tables.sql`
   - `20261026100000_screener_tables.sql`
   - `20261026200000_saved_comparisons.sql`
   - `20261027000000_research_workbench.sql`
4. Confirm Row-Level Security (RLS) policies are active on all public schema tables.

---

## 4. Native Node.js Deployment Steps

### Step 1: Install Dependencies
```bash
npm ci
```

### Step 2: Build Shared Package, Backend & Frontend
```bash
npm run build -w @equitylensai/shared
npm run build -w @equitylensai/backend
npm run build -w @equitylensai/frontend
```

### Step 3: Start Services
```bash
# Start backend
npm run start -w @equitylensai/backend

# Start frontend (in separate process manager or runner)
npm run start -w @equitylensai/frontend
```

---

## 5. Dockerized Deployment

### Multi-Container Deployment via Docker Compose
```bash
# Build and run containers in detached mode
docker compose up -d --build

# Inspect container status
docker compose ps

# View unified logs
docker compose logs -f
```

---

## 6. Post-Deployment Verification & Smoke Tests

Run the following checks immediately after rolling out a new release:

1. **Liveness Verification:**
   ```bash
   curl -I https://api.equitylensai.com/api/v1/health
   # Expected: HTTP 200 OK
   ```

2. **Readiness Verification:**
   ```bash
   curl https://api.equitylensai.com/api/v1/health/ready
   # Expected: {"status":"ready","checks":{"database":"connected",...}}
   ```

3. **Metrics Health Check:**
   ```bash
   curl https://api.equitylensai.com/api/v1/metrics
   # Expected: JSON object with 200 status codes and healthy latency
   ```

4. **Market Quote Smoke Test:**
   ```bash
   curl https://api.equitylensai.com/api/v1/stocks/RELIANCE/quote
   # Expected: HTTP 200 with provenance metadata
   ```

---

## 7. Rollback & Forward-Fix Procedures

- **Container Rollback:** If health checks fail during rollout, re-tag and launch the previous immutable Docker image tag:
  ```bash
  docker compose pull backend:<previous-tag>
  docker compose up -d --no-deps backend
  ```
- **Database Forward-Fix:** Do not drop tables or columns in production. If a migration needs alteration, author a new forward migration script rather than rolling back historical schema files.
