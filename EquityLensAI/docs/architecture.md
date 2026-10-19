# Architecture

EquityLensAI is a TypeScript monorepo with a Next.js frontend and an Express API. Phase 1 establishes production boundaries so later market-data, research, and authentication work can land without rewriting the scaffold.

## Request flow

```text
Frontend (Next.js App Router)
   ↓
API Client (`frontend/services/api`)
   ↓
Express API (`/api/v1`)
   ↓
Controllers (thin HTTP adapters)
   ↓
Services (orchestration / domain rules)
   ↓
DB / Market Providers / AI
```

Controllers must remain thin: receive the request, rely on validation middleware, call a service, and return a standard response. They must not contain business logic, database access, or provider-specific HTTP calls.

## Packages

| Package           | Role                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `frontend`        | Presentation, client state, and typed API access                                           |
| `backend`         | HTTP API, configuration, logging, and integration boundaries                               |
| `packages/shared` | API envelopes and future-compatible domain contracts (`AssetType`, `Market`, `Pagination`) |

## Backend layers

- **Routes** register versioned endpoints under `/api/v1`.
- **Validation** uses Zod via `validate()` middleware for body, query, and params.
- **Controllers** map HTTP to services and `sendSuccess()`.
- **Services** own orchestration. Financial services compute metrics deterministically. AI research only interprets bounded evidence assembled by backend domain services.
- **DB** (`backend/src/db`) is the only place future Supabase access should live.
- **Market** (`backend/src/market`) defines a `MarketProvider` interface with Angel and Yahoo slots. Providers do not call external APIs in Phase 1.
- **AI** (`backend/src/ai`) centralizes the Gemini SDK client, response validation, prompt, and evidence-grounded research context. Screener and earnings analysis are not in scope for Phase 4.

## Frontend layers

- **App Router** pages are foundation placeholders (`/`, `/login`, `/dashboard`).
- **React Query** is configured through `QueryProvider`.
- **API client** is the only HTTP boundary. Components must not call `fetch` directly.
- Environment access is centralized in `frontend/lib/env.ts`. Application code must not read `process.env` ad hoc.

## Cross-cutting backend concerns

- Central `AppError` + `errorHandler` produce `{ success: false, error: { code, message } }`.
- `X-Request-ID` is generated or echoed and included in logs.
- Structured logging uses Pino with secret redaction.
- Helmet, CORS (origin = `FRONTEND_URL`), body limits, HPP, and prototype-key sanitization are enabled.
- Graceful shutdown handles `SIGTERM` / `SIGINT` and runs registered cleanup tasks (HTTP server, database disconnect, future sockets/subscriptions).

## Phase 4 AI research

`POST /api/v1/ai/research` validates a small request, resolves instruments from the supported instrument repository, and builds a bounded context from Phase 2 market data and Phase 3 deterministic financial services. The Gemini client has no database or tool access. Its structured output contains qualitative claims and evidence IDs; the backend rejects unknown references, unsupported numeric prose, invalid output, and recommendation language, then attaches the trusted evidence registry and coverage metadata. The frontend renders facts separately from model interpretation.

AI research rate limiting is process-local and intended as an application-level guard. Deployments with multiple API instances should also enforce a shared gateway or distributed limit. Research results are not cached; this avoids reuse across questions or changing underlying evidence.

## Domain naming

Core types prefer `Asset`, `Market`, `Exchange`, and `Instrument` over company-only or stock-only names so equities, ETFs, indices, crypto, commodities, and forex can share the same pipeline later.

## Decisions

- **npm workspaces** keep frontend, backend, and shared contracts independent but installable together.
- **`server.ts` lives in `backend/src`** with `app.ts` so TypeScript emits a single `dist` tree and tests can import `createApp()` without listening.
- **Pino** is the structured logger.
- **Phase 1 env vars have safe local defaults** for `NODE_ENV`, `PORT`, `FRONTEND_URL`, and `LOG_LEVEL`. Integration secrets remain optional and empty until later phases.
- **Market/AI modules throw `501` if invoked**; they never return fabricated quotes, research, or prices.
