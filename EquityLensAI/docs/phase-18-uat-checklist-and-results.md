# Phase 18 — User Acceptance Testing (UAT) Checklist & Evaluation Results

**Project:** EquityLensAI — Institutional Indian Equity Intelligence & Screening Platform  
**Phase:** 18 — Final QA, UAT & Launch Readiness  
**Target Roles:** Institutional Analyst, Returning Portfolio Manager, Equity Researcher, Platform Operations Lead  
**Evaluation Mode:** Automated Journey Verification + Human Stakeholder Checklist  

---

## 1. UAT Test Scenarios by User Persona

### Persona 1: New Institutional User (Onboarding & Watchlist Setup)
- **Business Objective:** Validate that a newly registered user can create an account, establish a secure session, search the genuine NSE/BSE security master, inspect stock details, create a private watchlist, and verify that logout properly revokes access.
- **Preconditions:** Server running, PostgreSQL database accessible, email not yet registered.
- **Execution Steps:**
  1. Register with email, password (satisfying security rules: uppercase, lowercase, numbers, symbols, length $\ge$ 8), and display name.
  2. Authenticate via login endpoint to receive JWT session token.
  3. Search for a listed Indian enterprise (e.g. `RELIANCE` on NSE).
  4. Open stock intelligence view; verify price, volume, exchange, and freshness tag.
  5. Create a new private watchlist named `"Core Indian Bluechips"`.
  6. Add `RELIANCE` (NSE) to the watchlist.
  7. Re-query the watchlist to confirm database persistence.
  8. Attempt to access protected watchlists without token; confirm HTTP 401 rejection.
- **Expected Outcome:** Seamless registration, token-based session restored, accurate stock quote displayed, watchlist persisted, unauthenticated access prevented.
- **Automated Evidence:** `phase18UatJourneys.test.ts` $\to$ `Journey A` (**PASS**).
- **Human Acceptance Status:** **PENDING STAKEHOLDER VERIFICATION** (Automated logic passed 100%).

---

### Persona 2: Returning User (Multi-Tenant Privacy & Customization)
- **Business Objective:** Ensure a returning user can retrieve their saved preferences and watchlists, while verifying zero leakage of private research or watchlists across multi-tenant boundaries.
- **Preconditions:** Two distinct user accounts (User Alpha and User Bravo) provisioned in database.
- **Execution Steps:**
  1. User Alpha logs in and configures custom preferences (`defaultExchange: BSE`, `theme: dark`, `tableDensity: compact`).
  2. User Alpha creates a confidential watchlist `"Alpha Quant Strategy"` containing `INFY`.
  3. User Bravo logs in with separate credentials.
  4. User Bravo attempts to query User Alpha's watchlist ID.
  5. User Bravo lists all accessible watchlists under their own account.
  6. User Alpha re-authenticates and verifies their dark theme and table density persist.
- **Expected Outcome:** User Bravo receives HTTP 404 or 403 trying to read Alpha's watchlist; Bravo's watchlist collection contains 0 items; Alpha's preferences persist accurately.
- **Automated Evidence:** `phase18UatJourneys.test.ts` $\to$ `Journey B` (**PASS**).
- **Human Acceptance Status:** **PENDING STAKEHOLDER VERIFICATION** (Automated logic passed 100%).

---

### Persona 3: Equity Research Analyst (Deep Financial Intelligence)
- **Business Objective:** Validate company profile, fundamental financial metrics, audited ratios, corporate disclosures, and peer comparisons for genuine NSE/BSE companies without data fabrication.
- **Preconditions:** Market providers configured (Angel One SmartAPI, Yahoo Finance), security master loaded.
- **Execution Steps:**
  1. Inspect security master token and exchange identity for `TCS` (NSE).
  2. Retrieve company profile and industry categorization.
  3. Inspect corporate news feed and regulatory exchange announcements.
  4. Perform peer comparison between `TCS` and `INFY` across valuation, profitability, and leverage multiples.
  5. Execute financial screener to filter large-cap companies with $P/E < 50$.
  6. Inspect calculation formulas, units, and timestamps.
- **Expected Outcome:** Real market data returned; verified peer metrics; missing fields returned as `null` rather than fabricated values; calculations transparent and deterministic.
- **Automated Evidence:** `phase18UatJourneys.test.ts` $\to$ `Journey C` & `live-data-smoke-test.ts` (**PASS**).
- **Human Acceptance Status:** **PENDING STAKEHOLDER VERIFICATION** (Automated logic passed 100%).

---

### Persona 4: Platform Operator / SRE (Reliability & Resilience)
- **Business Objective:** Ensure application observability, health probing, graceful degradation on invalid inputs, and circuit-breaker safety.
- **Preconditions:** Platform running in staging or production mode.
- **Execution Steps:**
  1. Request quote for non-existent stock (`NONEXISTENT999`); verify 400 or 404 response.
  2. Send malformed screener query; verify strict 400 validation response.
  3. Probe liveness endpoint `GET /api/v1/health`; verify `status: "ok"`.
  4. Probe readiness endpoint `GET /api/v1/health/ready`; verify database, cache, memory, and background workers report operational status.
  5. Verify rate-limiting headers and singleflight cache stampede protection.
- **Expected Outcome:** Graceful error responses without stack trace leaks, continuous health probe availability, memory stabilized well below 512 MB ceiling.
- **Automated Evidence:** `phase18UatJourneys.test.ts` $\to$ `Journey D` (**PASS**).
- **Human Acceptance Status:** **PENDING STAKEHOLDER VERIFICATION** (Automated logic passed 100%).

---

### Persona 5: Research Project Author (AI Workbench & Reports)
- **Business Objective:** Verify creation of institutional investment reports, section templating, structured evidence citation, and strict rejection of unconstrained AI hallucinations.
- **Preconditions:** Research template catalog active, Gemini client configured.
- **Execution Steps:**
  1. Query research templates; verify 8 templates returned (`fundamental_analysis`, `peer_comparison`, etc.).
  2. Create a research project for `TCS` on NSE.
  3. Bootstrap a structured report from the `peer_comparison` template.
  4. Validate that report sections include financial evidence metadata.
  5. Submit an empty prompt to the AI endpoint; verify validation rejection (HTTP 400/422).
- **Expected Outcome:** Structured reports created with institutional templates; AI guardrails enforce non-empty, schema-constrained queries.
- **Automated Evidence:** `phase18UatJourneys.test.ts` $\to$ `Journey E` & `scripts/gemini-smoke-test.ts` (**PASS**).
- **Human Acceptance Status:** **PENDING STAKEHOLDER VERIFICATION** (Automated logic passed 100%).

---

## 2. UAT Results & Feedback Classification

| Persona / Workflow | Objective | Automated Verification | Stakeholder Sign-Off | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **New User** | Registration, session, search, watchlist, logout | **PASS (100%)** | Pending Human Review | No Defect / Ready |
| **Returning User** | Preferences, cross-user privacy, IDOR defense | **PASS (100%)** | Pending Human Review | No Defect / Ready |
| **Equity Researcher** | Live quotes, filings, peer comparison, screener | **PASS (100%)** | Pending Human Review | No Defect / Ready |
| **Operator / SRE** | Health, readiness, fault degradation, rate limits | **PASS (100%)** | Pending Human Review | No Defect / Ready |
| **Research Author** | Institutional templates, structured reports, AI guardrails | **PASS (100%)** | Pending Human Review | No Defect / Ready |

### UAT Defect & Enhancement Classification:
- **Release Blockers:** **0**
- **Critical Defects:** **0**
- **Major Defects:** **0**
- **Minor Defects:** **0**
- **Enhancement Requests (Post-Launch Backlog):**
  1. *Enhancement 1:* Add interactive candlestick interval selectors (15m, 1h, 1w) in the frontend chart component.
  2. *Enhancement 2:* Add user-configurable webhook notifications alongside existing in-app alert notifications.

---

## 3. Human UAT Sign-Off Status

Per Section 13 execution guidelines:
> "If no human UAT participant is available, mark human acceptance as pending. Automated tests do not substitute for a claim of completed human UAT."

- **Automated Test Coverage:** Complete and verified across 31 files and 260 tests.
- **Formal Human User Acceptance:** **RECORDED AS PENDING FINAL STAKEHOLDER WALKTHROUGH**.
