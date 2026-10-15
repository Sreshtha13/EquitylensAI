# EquityLensAI

AI-powered market intelligence and equity research platform.

Phase 1 delivers the production foundation. Phase 2 implements genuine market data infrastructure backed by Angel One SmartAPI and Yahoo Finance with strict data provenance, in-memory caching, instrument search, OHLCV historical candles, and zero simulated or hallucinated financial metrics.

## Architecture

```text
Frontend (Next.js App Router)
   ↓
API Client
   ↓
Express API (`/api/v1`)
   ↓
Controllers
   ↓
Services
   ↓
DB / Market Providers / AI
```

See [docs/architecture.md](docs/architecture.md) for layering rules and design decisions.

## Technology stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, TanStack React Query, Zod
- **Backend:** Node.js, Express, TypeScript, Zod, Pino, Helmet, CORS
- **Shared:** `@equitylensai/shared` API and domain contracts
- **Future data:** Supabase PostgreSQL (boundary only in Phase 1)
- **Future AI:** Gemini (interface only)
- **Future market data:** provider abstraction (Angel One, Yahoo Finance slots; no live calls)

## Repository structure

```text
equitylensai/
├── frontend/             Next.js application
├── backend/              Express API
├── packages/shared/      Shared API/domain types
├── docs/
├── package.json          npm workspaces + root scripts
└── README.md
```

## Prerequisites

- Node.js 20+
- npm 10+

## Environment setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Required Phase 1 variables are documented in [.env.example](.env.example). Integration secrets stay empty until later phases. Never commit `.env` files.

## Installation and commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run format:check
npm run test
npm run build
```

## Servers

| Process     | URL                                 |
| ----------- | ----------------------------------- |
| Frontend    | http://localhost:3000               |
| API         | http://localhost:4000               |
| Health      | http://localhost:4000/api/v1/health |
| Scalar Docs | http://localhost:4000/docs          |
| OpenAPI     | http://localhost:4000/openapi.json  |

The home page verifies frontend/backend connectivity by calling the health endpoint. It does not display sample prices or securities.

## Documentation

- [Architecture](docs/architecture.md)
- [Market Data Infrastructure](docs/market-data.md)
- [Development](docs/development.md)
- [API conventions](docs/api.md)
- [OpenAPI Specification](docs/openapi.json)
