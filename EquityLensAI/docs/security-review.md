# EquityLensAI — Security Architecture & Vulnerability Review

## 1. Authentication & Session Security

- **Token-Based Authentication:** Authenticated requests pass a standard Bearer JWT token in the `Authorization` header.
- **Payload Integrity:** Tokens are signed using HMAC-SHA256 with `JWT_SECRET`. Secrets must be at least 32 characters in production.
- **Context Injection:** `authMiddleware.ts` extracts and verifies the claims, injecting a typed `req.user: { id: string; email: string }` into the request context.
- **Test-User Isolation:** Integration test environments utilize controlled header authentication (`x-test-user-id`) only active when `NODE_ENV === 'test'`. In `production`, this bypass is completely disabled.

---

## 2. Authorization & Multi-Tenant IDOR Defense

Insecure Direct Object Reference (IDOR) attacks are prevented by enforcing server-side ownership verification across all private resources:

1. **Watchlists & Favorites:** Queries scope every retrieval, update, and deletion strictly with `user_id = req.user.id`.
2. **Alert Rules & Events:** Alert configurations and trigger events are strictly bound to the authenticated creator. Attempting to fetch or toggle another user's alert yields HTTP 404 or 403.
3. **Investment Portfolios:** All portfolio holdings, transactions, and performance metrics require `portfolio.userId === req.user.id`.
4. **Saved Screener Strategies:** Users cannot read or overwrite private screening filters created by other accounts.
5. **Research Workspaces, Reports, Notes & Versions:** Every report creation, section edit, version snapshot, and PDF/CSV export verifies project ownership before executing writes. Cross-user attempts return HTTP 404/403.

**Verification:** Validated by automated test suite in `backend/tests/securityCrossUser.test.ts`.

---

## 3. Rate Limiting & Abuse Prevention

To mitigate brute-force attacks and resource exhaustion, `backend/src/middleware/rateLimit.ts` provides multi-tier rate limiting:

- **General API Limiter:** Limits requests to **300 requests per minute per IP** across all `/api/v1/*` routes.
- **Authentication Limiter:** Stricter threshold of **30 requests per minute per IP** across sensitive credential endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`).
- **Standardized Headers:** Every rate-limited response includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Exceeding limits yields HTTP 429 (`TOO_MANY_REQUESTS`).

---

## 4. Input Validation & Injection Defenses

- **Zod Strict Schemas:** All incoming route parameters, query strings, and request bodies are validated through strict Zod schemas before reaching business logic. Unknown or malicious properties are rejected.
- **SQL Injection Defense:** All Supabase database queries utilize parameterized PostgREST operations and parameterized SQL statements. Arbitrary client SQL is never executed.
- **Formula Injection Defense in Exports:** In `backend/src/research/services/exportService.ts`, all exported CSV cells starting with sensitive formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are sanitized by prepending a single quote (`'`), neutralizing spreadsheet formula execution.
- **XSS & HTTP Header Protections:** `helmet` is enabled across all backend responses, setting `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and restrictive referrer policies.
- **Cross-Origin Resource Sharing (CORS):** Multi-origin CORS checks configured origins against an allowlist, rejecting unauthorized domains.

---

## 5. Secret & Credential Hygiene

- **Zero Committed Secrets:** Repository has been scanned; no real credentials, private keys, or API tokens exist in version control.
- **Template Completeness:** `.env.example` provides descriptive placeholders without disclosing production values.
- **Client/Server Separation:** Server secrets (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ANGEL_*`) are never prefixed with `NEXT_PUBLIC_` and never transmitted to client browsers.
- **Log Redaction:** `pino` logger redacts `Authorization`, `cookie`, `password`, `token`, and `key` headers automatically.
