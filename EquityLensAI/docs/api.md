# API conventions

All application endpoints are versioned:

```text
/api/v1
```

Unversioned business endpoints are not used.

## Interactive API Documentation (Scalar)

EquityLensAI serves modern, interactive API documentation powered by [Scalar](https://scalar.com) with OpenAPI 3.1:

- **Interactive UI:** [http://localhost:4000/docs](http://localhost:4000/docs) (also mirrored at `/api/v1/docs` and `/reference`)
- **OpenAPI 3.1 Spec (JSON):** [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json) (and `/api/v1/openapi.json`)
- **Static OpenAPI Spec:** [`docs/openapi.json`](openapi.json)

The Scalar reference provides an interactive sandbox for testing endpoints, viewing payload schemas, checking parameter validations, and generating client snippets in multiple languages.

## Health

```http
GET /api/v1/health
```

Successful response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "equitylensai-api",
    "timestamp": "2026-10-08T14:00:00.000Z"
  }
}
```

This endpoint does not call market-data providers, databases, or AI services.

## Success envelope

```json
{
  "success": true,
  "data": {}
}
```

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Validation failures use `VALIDATION_ERROR` and may include a `details` object from Zod. Production responses never include stack traces, API keys, or credentials.

## Request ID

Every response includes:

```text
X-Request-ID
```

If the client sends that header, the value is echoed. Otherwise the API generates a UUID. The same ID is attached to structured logs.

## CORS

The API allows the origin in `FRONTEND_URL`. It does not use `Access-Control-Allow-Origin: *` in this configuration.

## Market Data Endpoints (Implemented in Phase 2)

```text
GET  /api/v1/stocks/search?q={query}&market={market}&limit={limit}
GET  /api/v1/stocks/:symbol/quote?exchange={exchange}
GET  /api/v1/stocks/:symbol/history?exchange={exchange}&interval={interval}&from={from}&to={to}
POST /api/v1/stocks/ingest
GET  /api/v1/stocks/ingest/status
GET  /api/v1/market/overview?market={market}
GET  /api/v1/market/providers
```

Every market quote and overview response adheres to the strict data provenance contract (`source`, `observedAt`, `retrievedAt`, `freshness`, `isStale`). See [docs/market-data.md](market-data.md) for complete details.

## AI Research (Phase 4)

```text
POST /api/v1/ai/research
```

Request body:

```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "question": "Explain the available profitability and financial risk evidence."
}
```

`comparisonInstrument` may be supplied with a symbol and optional exchange. Comparison evidence is only included when reporting date and currency are compatible; the API does not convert currencies or rank companies. Request content is limited to 8 KB, questions to 800 characters, and the IP-based configured rate limit is 5 requests per minute by default. AI-disabled and upstream failures use the standard error envelope; they never return a simulated research answer.

Success payloads contain schema version `1.0`, qualitative interpretation with evidence IDs, trusted evidence items with source/period/freshness, missing-data notes, and a qualitative evidence-coverage level. The backend creates evidence records; the model cannot introduce sources or URLs. See [AI Research](ai-research.md) for data scope and limitations.

## Natural-language Screener (Phase 5 foundation)

```text
GET  /api/v1/ai/screener/metrics
POST /api/v1/ai/screener/interpret
POST /api/v1/ai/screener
```

The metric catalog, Gemini interpretation, persisted-metric ingestion, and bounded execution endpoint are implemented. Deployment requires applying the Supabase migration and running ingestion; execution reports database errors and coverage rather than fabricating results. See [Screener](screener.md) for setup, request/response details, data semantics, and limitations.

```text
GET /api/v1/watchlists
```

## Client usage

The frontend must call the API through `frontend/services/api/client.ts`:

- `apiClient.get`
- `apiClient.post`
- `apiClient.put`
- `apiClient.patch`
- `apiClient.delete`

Failed HTTP responses throw `ApiClientError` with `status` and `code`.
