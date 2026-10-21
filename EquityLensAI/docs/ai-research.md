# AI Research (Phase 4)

## Configuration

The API uses Google's official JavaScript SDK, `@google/genai`, on the backend only.
The implementation follows Google's [JavaScript SDK documentation](https://googleapis.github.io/js-genai/release_docs/index.html) and [structured output guidance](https://ai.google.dev/gemini-api/docs/structured-output). Confirm model availability and structured-output support in Google's [current model list](https://ai.google.dev/gemini-api/docs/models) when changing `GEMINI_MODEL`.

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_OUTPUT_TOKENS=1024
GEMINI_MAX_RETRIES=2
AI_RESEARCH_ENABLED=false
AI_RESEARCH_RATE_LIMIT=5
```

Set `AI_RESEARCH_ENABLED=true` and configure the key in `backend/.env` to enable requests. The key is never exposed to frontend configuration. The default model is `gemini-3.5-flash`, verified with the live structured-output smoke test on 2026-10-20. Deployments can select another Gemini model that supports JSON structured output and is enabled for their API key. The SDK request sets JSON MIME type and a response JSON schema, uses a bounded timeout, and makes a bounded retry only for transient failures. Authentication, model-not-found, request, and rate-limit errors are not retried. A provider 404 is reported as `AI_MODEL_UNAVAILABLE`; verify the selected model is available to the configured API key.

## API

`POST /api/v1/ai/research`

```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "question": "Explain the available profitability and financial risk evidence."
}
```

An optional `comparisonInstrument` has `symbol` and an optional `exchange`. Symbols must resolve against the platform's instrument repository. These example values are illustrative; data availability depends on the configured providers and instrument set.

The endpoint accepts a maximum 8 KB JSON body, questions of 10–800 characters, and 5 requests per client IP per minute by default. `AI_RESEARCH_RATE_LIMIT` may tune the positive integer limit up to 100. The in-memory IP limiter is process-local; multi-instance deployment needs an additional shared rate limit at the gateway.

The assembled prompt is capped at 24 KB. If the applicable evidence context exceeds that bound, the request fails explicitly rather than truncating evidence silently.

## Context and supported scope

Intent classification selects relevant evidence for general financial research, profitability, growth, valuation, liquidity, cash flow, debt, financial risk, historical performance, or comparison. The context builder only uses the instrument repository, market-data services, and deterministic Phase 3 financial analysis. The model has no database connection, tools, SQL, or external retrieval.

Financial statements and calculated metrics retain their source, period, currency/unit, retrieved timestamp, and freshness. A metric unavailable from the calculation service remains `null` and is listed in `missingData`, never converted to zero. Historical performance uses supported daily market candles; where adjusted closes are absent, the result is labelled as unadjusted price change and corporate-action limitations are disclosed. Comparison output is restricted when currencies or reporting dates are incompatible; no conversion, categorical superiority claim, or ranking is provided.

The platform currently does not identify consolidated versus standalone financial reporting scope in the provider contract. News, industry context, company events, and management statements are not verified evidence and are not used. Requests dependent on unsupported information must be answered as a limitation, not as a factual assertion.

## Prompt, schema, and evidence safeguards

- Prompt version: `1.0`; response schema version: `1.0`.
- System instructions mark user text and retrieved context as untrusted data and prohibit prompt overrides, invented facts, URLs, unsupported causal claims, and trading recommendations.
- The Gemini structured JSON response contains qualitative interpretations only. The server rejects numerical claims in model prose so numerical facts remain sourced from the evidence registry.
- The model may only cite evidence IDs supplied by the backend. Unknown IDs, malformed JSON, unsupported enum values, oversized text, URLs, recommendation language, or invalid shapes fail with `AI_INVALID_RESPONSE`.
- The backend attaches evidence objects itself. It never accepts model-generated evidence values, sources, or URLs.
- Confidence is qualitative and derived from non-null evidence coverage and staleness; it is not a calibrated probability.
- Research results are not cached. This avoids serving stale or cross-question context as current research.

The output is informational financial research only. It is not personalized investment advice, a guarantee of future performance, or a buy/sell recommendation.

## Testing and smoke test

```bash
npm test -w @equitylensai/backend
npm run ai:smoke -w @equitylensai/backend
```

The ordinary test suite uses deterministic test doubles and makes no live Gemini request. The optional smoke command requires the backend AI feature to be enabled and makes one real structured-output request. It prints only completion status and model identifier; provider errors are sanitized.

## Known limitations and deferred work

- Provider financial reports do not expose consolidated/standalone scope in the current data contract.
- The AI rate limiter is local to one API process; use a shared gateway limiter for clustered production deployments.
- Evidence completeness and semantic citations are bounded but do not establish factual correctness of every qualitative interpretation.
- News, transcript, earnings-call, industry research, persistent chat history, natural-language screening, watchlists, portfolios, alerts, and trading are out of scope for Phase 4.
