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

## Planned endpoint families (not implemented in Phase 1)

```text
GET  /api/v1/stocks/search
GET  /api/v1/stocks/:ticker
POST /api/v1/ai/research
GET  /api/v1/market
GET  /api/v1/watchlists
```

Those routes will follow the same envelope, validation middleware, and controller/service split.

## Client usage

The frontend must call the API through `frontend/services/api/client.ts`:

- `apiClient.get`
- `apiClient.post`
- `apiClient.put`
- `apiClient.patch`
- `apiClient.delete`

Failed HTTP responses throw `ApiClientError` with `status` and `code`.
