# EquityLensAI

AI-powered market intelligence and equity research platform.

Phase 1 delivers the production foundation. Phase 2 implements market-data infrastructure backed by Angel One SmartAPI and Yahoo Finance with data provenance, in-memory caching, instrument search, and OHLCV history. Phase 3 adds financial statements, deterministic metrics, and health scoring. Phase 4 adds an evidence-bounded Gemini research assistant that interprets platform evidence without replacing deterministic calculations. Phase 5 adds the natural-language screener with catalog interpretation and execution.

Phase 6 implements the complete user system: Supabase-backed authentication, session management, user profile & application preferences, persistent favorites for NSE/BSE equities, and multiple named watchlists with coordinated live market quotes and strict cross-user data isolation.

Phase 7 builds the comprehensive Stock Detail & Company Intelligence experience: canonical `/stocks/[exchange]/[symbol]` routing, real-time market headers with data provenance, interactive SVG price & volume charts (1D–MAX), company overview profiles, deterministic historical performance analytics (cumulative return, CAGR, volatility, max drawdown), annual and quarterly financial statements with provider-reported scope limitations, deterministic ratios, transparent valuation intelligence, financial health scoring, evidence-bounded AI company research, and favorites/watchlists integration with strict zero-dummy-data adherence.

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
- **AI research:** Google's official `@google/genai` SDK; server-side only
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

Backend and frontend variables are documented in [.env.example](.env.example). AI research is disabled by default. To enable it, set `GEMINI_API_KEY` and `AI_RESEARCH_ENABLED=true` in `backend/.env`; the key must never use a `NEXT_PUBLIC_` prefix. Never commit `.env` files.

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
- [AI Research](docs/ai-research.md)
- [Natural-language Screener](docs/screener.md)
- [Stock Detail & Company Intelligence](docs/phase7-stock-detail.md)
- [OpenAPI Specification](docs/openapi.json)
