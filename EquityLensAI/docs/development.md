# Development

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Install

```bash
npm install
```

## Environment

1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env.local`.

Phase 1 required values:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Optional future variables (`SUPABASE_*`, `GEMINI_API_KEY`, `ANGEL_*`) may stay empty. Do not commit `.env` or `.env.local`.

Backend code must read configuration through `getEnv()` / `loadEnv()`, not `process.env`. Frontend public configuration must go through `getFrontendEnv()`.

## Commands

From the repository root:

```bash
npm run dev          # frontend :3000 and backend :4000
npm run lint
npm run typecheck
npm run format
npm run format:check
npm run test
npm run build
```

Workspace-specific:

```bash
npm run dev:frontend
npm run dev:backend
npm run test -w @equitylensai/backend
```

## Servers

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:4000](http://localhost:4000)
- Health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
- Scalar API Reference: [http://localhost:4000/docs](http://localhost:4000/docs)
- OpenAPI 3.1 Spec: [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json)

## Code quality

- TypeScript is strict in every package (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`).
- ESLint runs per workspace.
- Prettier is configured at the repository root.

## Testing

Backend Vitest coverage in Phase 1:

- `GET /api/v1/health`
- `GET /docs`, `/api/v1/docs`, `/reference` (Scalar API reference)
- `GET /openapi.json`, `/api/v1/openapi.json` (OpenAPI specification)
- environment schema validation
- Zod `validate` middleware
- centralized error mapping (including unknown errors)

## Local connectivity check

With both processes running, open `/`. The home page calls `GET /api/v1/health` through the API client and React Query. That is a live connectivity check, not sample market data.
