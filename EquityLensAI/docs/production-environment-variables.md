# Production Environment Variables & Secrets Reference

**Document:** Environment Variables & Security Matrix  
**Version:** 1.0.0  
**Phase:** 16 — Production Deployment & Live NSE/BSE Data Verification  
**Date:** October 2026  
**Status:** Canonical Reference  

---

## 1. Security & Redaction Principles

1. **Zero Secret Leakage in Client Bundles:** Under no circumstances may server-side keys (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ANGEL_*`, `GEMINI_API_KEY`) be prefixed with `NEXT_PUBLIC_`.
2. **Runtime Configuration Validation:** The backend validates required environment variables at boot via Zod schema in `backend/src/config/env.ts`. If mandatory variables are missing or malformed, the process fails fast with an explanatory fatal error.
3. **Structured Log Redaction:** Pino structured logger redacts authorization headers, passwords, TOTP seeds, and sensitive tokens.

---

## 2. Master Variable Catalog

### 2.1 Backend Server & Network Configuration

| Variable | Required? | Exposure | Allowed Values / Format | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | Server-only | `development`, `test`, `production` | `development` | Operating mode; disables test fixtures and enforces strict security in production. |
| `PORT` | Optional | Server-only | Positive Integer (1–65535) | `4000` | Port on which the Express API server listens. |
| `FRONTEND_URL` | Optional | Server-only | Valid URL (`http://` or `https://`) | `http://localhost:3000` | Canonical origin of the frontend application. |
| `CORS_ORIGIN` | Optional | Server-only | Comma-separated list of origins | `http://localhost:3000,http://127.0.0.1:3000` | Allowed origins permitted to initiate cross-origin requests. |
| `LOG_LEVEL` | Optional | Server-only | `fatal`, `error`, `warn`, `info`, `debug`, `trace` | `info` | Pino logging threshold. In production, `info` or `warn` is recommended. |

### 2.2 Database & Authentication (Supabase PostgreSQL)

| Variable | Required? | Exposure | Format / Notes | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **Mandatory** | Server-only | HTTPS URL (`https://<project-id>.supabase.co`) | None | Supabase project endpoint used for PostgREST queries and Auth verification. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Mandatory** | Server-only | JWT (Secret Bearer Token) | None | High-privilege administrative key used by backend to bypass RLS for system operations. |
| `SUPABASE_ANON_KEY` | Optional | Server-only | JWT (Public Key) | None | Client-tier key used for anonymous or user-scoped authentication requests. |
| `JWT_SECRET` | **Mandatory** | Server-only | String (Min 32 characters) | None | Cryptographic secret used for signing and verifying application session tokens. |

### 2.3 Market Data Providers (NSE / BSE Indian Equities)

| Variable | Required? | Exposure | Format / Notes | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ANGEL_API_KEY` | Optional | Server-only | String | None | Angel One SmartAPI publisher key for real-time market data access. |
| `ANGEL_CLIENT_ID` | Optional | Server-only | String (Client Code) | None | Angel One user account identifier for API login. |
| `ANGEL_PASSWORD` | Optional | Server-only | String (Trading PIN) | None | Account password/PIN required for SmartAPI session generation. |
| `ANGEL_TOTP_SECRET` | Optional | Server-only | Base32 Encoded String | None | Two-factor authentication secret key used to generate RFC 6238 TOTP tokens. |

> *Note:* If Angel One credentials are not configured, the backend automatically and safely falls back to Yahoo Finance for NSE/BSE delayed quotes and candle series.

### 2.4 AI Intelligence (Google Gemini 3.5 Flash)

| Variable | Required? | Exposure | Format / Notes | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AI_RESEARCH_ENABLED` | Optional | Server-only | `true` / `false` | `false` | Master toggle enabling Gemini-grounded investment synthesis and screener parsing. |
| `GEMINI_API_KEY` | Conditional | Server-only | String (Google AI Studio Key) | None | **Mandatory if AI_RESEARCH_ENABLED=true**. Used for Gemini model invocations. |
| `GEMINI_MODEL` | Optional | Server-only | String | `gemini-3.5-flash` | Selected Gemini model family. |
| `GEMINI_TIMEOUT_MS` | Optional | Server-only | Integer (1000–120000) | `30000` | Maximum timeout for LLM inference requests. |
| `GEMINI_MAX_OUTPUT_TOKENS` | Optional | Server-only | Integer (1–4096) | `1024` | Token generation ceiling per request. |
| `GEMINI_MAX_RETRIES` | Optional | Server-only | Integer (0–5) | `2` | Bounded retry attempts with exponential backoff on 429/503. |
| `AI_RESEARCH_RATE_LIMIT`| Optional | Server-only | Integer (1–100) | `5` | Sliding-window maximum AI requests per minute per IP. |

### 2.5 Background Schedulers & Workers

| Variable | Required? | Exposure | Format / Notes | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ALERT_SCHEDULER_ENABLED` | Optional | Server-only | `true` / `false` | `true` | Enables in-process evaluation of user alert rules. |
| `ALERT_EVALUATION_INTERVAL_MS`| Optional | Server-only | Integer (10000–3600000) | `60000` | Background loop execution interval (default: 60s). |
| `ALERT_MAX_RULES_PER_USER` | Optional | Server-only | Integer (1–500) | `50` | Maximum active alert rules permitted per individual user. |

### 2.6 Frontend Next.js Configuration

| Variable | Required? | Exposure | Format / Notes | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Mandatory** | **Client-Safe** | Public URL (`http://` or `https://`) | `http://localhost:4000/api/v1` | Public API base URL used by browser fetch requests. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | **Client-Safe** | HTTPS URL | None | Public Supabase project URL for direct auth client helpers. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | **Client-Safe** | Public JWT (anon key) | None | Public anonymous key for client-side Supabase interactions. |
