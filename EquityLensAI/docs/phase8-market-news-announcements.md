# Phase 8: Market News, Corporate Announcements & Event Intelligence

## 1. Executive Summary & Objective

Phase 8 introduces a production-grade market intelligence engine that collects, normalizes, deduplicates, stores, and displays genuine market news and official exchange disclosures for supported listed equities across NSE and BSE.

### Strict Non-Negotiable: Zero Fabricated News

- **No Synthetic Headlines:** The platform never invents headlines, filing contents, analyst ratings, announcement dates, or source URLs.
- **Provider-Verified Only:** Content is sourced exclusively through active, verified exchange endpoints and authorized news feeds.
- **Transparent Unavailable States:** When a provider is degraded, rate-limited, or unavailable, the UI renders an honest, informative unavailable state rather than filling feeds with dummy data.

---

## 2. Data Sources & Provider Architecture

### A. Supported Providers

| Provider Identifier | Source Type         | Category                        | Primary URL / Endpoint                                                | Verification Status                                                                                                        |
| :------------------ | :------------------ | :------------------------------ | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `nse_official`      | Official Exchange   | Corporate Disclosures & Filings | `https://www.nseindia.com/api/corporate-announcements?index=equities` | **Verified Live** (Returns JSON filings with sequence IDs, ISINs, and PDF attachment links)                                |
| `google_news_rss`   | Authorized News RSS | Market News & Equity Coverage   | `https://news.google.com/rss/search?q=...`                            | **Verified Live** (Sanitized XML parsing for publisher articles from Livemint, Economic Times, Business Standard, Reuters) |
| `bse_official`      | Official Exchange   | Corporate Filings (BSE)         | `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w`    | **Verified Degradation-Safe** (Structured provider adapter with graceful fallback)                                         |

### B. Provider Contracts (`NewsProvider` & `AnnouncementsProvider`)

Both provider interfaces enforce strict typing and metadata provenance:

```typescript
interface RawNewsItem {
  providerId: string;
  externalId?: string;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: 'official_exchange' | 'news_publisher' | 'investor_relations';
  publishedAt?: string;
  retrievedAt: string;
  language?: string;
  contentExcerpt?: string;
  symbols?: string[];
  category?: string;
}

interface RawAnnouncementItem {
  providerId: string;
  externalId?: string;
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE';
  title: string;
  category: AnnouncementCategory;
  description?: string;
  publishedAt: string;
  receivedAt?: string;
  sourceUrl: string;
  documentUrl?: string;
  isin?: string;
  retrievedAt: string;
}
```

---

## 3. Normalization, Deduplication & Reliable Company Matching

### A. Protocol-Safe Normalization

- All canonical URLs and document links are checked against allowed protocols (`http:`, `https:`).
- Dangerous protocols (e.g. `javascript:`, `data:`, `file:`) are strictly rejected.
- HTML entities and script tags in headlines, summaries, and excerpts are sanitized before storage or display.

### B. SHA-256 Content Hashing & Deduplication

To prevent duplicate records from repeated provider polls or syndication across multiple feed channels:

- News hashes: `SHA-256(cleaned_url + "||" + normalized_title)`. URL tracking parameters (`utm_*`, `oc`, `ref`) are stripped prior to hashing.
- Announcement hashes: `SHA-256(exchange + "||" + symbol + "||" + external_id_or_title + "||" + published_date)`.
- Database storage leverages unique indexes (`content_hash`) with `ON CONFLICT DO NOTHING` for idempotent ingestion.

### C. Reliable Identifier-First Company Matching (`CompanyMatcher`)

Matching links articles and announcements to instrument records without creating false associations:

1. **ISIN Matching (Highest Confidence):** Resolves securities by exact 12-character ISIN code (e.g., `INE002A01018` for Reliance).
2. **Exchange + Symbol Matching:** Resolves exact uppercase tickers within the specified exchange.
3. **Exact Symbol Word Matching:** Uses word-boundary regular expressions (`\bSYMBOL\b`) against headlines to avoid false positives (e.g., matching the word "ALL" to the symbol "ALL").
4. **Normalized Company Name Matching:** Matches cleaned company names with ambiguity suppression.
5. **Unlinked Fallback:** Items without a confident company association remain unlinked; they are never arbitrarily attached to a random ticker.

---

## 4. Database Schema & Data Lifecycle

Defined in migration `supabase/migrations/20261022200000_market_news_announcements.sql`:

```sql
-- 1. Market news items
CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    external_id TEXT,
    title TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    language TEXT DEFAULT 'en',
    content_excerpt TEXT,
    content_hash TEXT UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Join table for company associations
CREATE TABLE company_news_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_item_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    association_method TEXT NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(news_item_id, symbol, exchange)
);

-- 3. Corporate exchange announcements
CREATE TABLE corporate_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    external_id TEXT,
    symbol TEXT NOT NULL,
    company_name TEXT NOT NULL,
    exchange TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ,
    source_url TEXT NOT NULL,
    document_url TEXT,
    isin TEXT,
    content_hash TEXT UNIQUE NOT NULL,
    ai_summary JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ingestion audit log & telemetry
CREATE TABLE news_ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL,
    items_fetched INT NOT NULL DEFAULT 0,
    items_stored INT NOT NULL DEFAULT 0,
    duplicates_skipped INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL
);
```

_Note: For testing and local offline development, a transparent in-memory repository store (`MemoryNewsStore`) functions identically when Supabase credentials are not configured._

---

## 5. API Endpoints Reference

All endpoints adhere to the `/api/v1` prefix, with centralized error handling and request tracking (`X-Request-ID`):

| Endpoint                                | Method |      Auth      | Description                                                                                                                               |
| :-------------------------------------- | :----: | :------------: | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/news`                          |  GET   |     Public     | Paginated market news feed with optional filters (`symbol`, `exchange`, `category`, `limit`, `offset`).                                   |
| `/api/v1/stocks/:symbol/news`           |  GET   |     Public     | Company-specific news feed with data provenance and company associations.                                                                 |
| `/api/v1/announcements`                 |  GET   |     Public     | Official corporate disclosures feed with category and exchange filters (`NSE`, `BSE`).                                                    |
| `/api/v1/announcements/:announcementId` |  GET   |     Public     | Detailed filing view with external source link, filing timestamp, and document download URL.                                              |
| `/api/v1/stocks/:symbol/announcements`  |  GET   |     Public     | Official exchange disclosures filed by a specific company ticker.                                                                         |
| `/api/v1/users/me/watchlist-news`       |  GET   | **Bearer JWT** | Private watchlist intelligence; returns deduplicated news for companies watched by the authenticated user. Multi-user isolation enforced. |
| `/api/v1/news/status`                   |  GET   |     Public     | Operational telemetry, provider health statuses, and last ingestion metrics.                                                              |
| `/api/v1/news/ingest`                   |  POST  | Admin/Internal | Manually triggers an idempotent ingestion pass across registered news and announcement providers.                                         |

---

## 6. Frontend Screens & Integrations

1. **Market News Feed (`/news`):**
   - Live stream of verified news articles with publisher badges, publication times, and external source buttons.
   - Filterable by topic pills (All, Financial Results, Corporate Actions, Markets).
   - Ingestion telemetry banner showing data freshness and provider operational status.
2. **Corporate Disclosures Feed (`/announcements`):**
   - Dedicated exchange disclosure feed with distinctive official badges (`NSE Filings`, `BSE Filings`).
   - Category filtering (Financial Results, Board Meetings, Dividends, Stock Splits, Rights Issues, Governance).
   - Direct PDF attachment download buttons when provided by exchange disclosures.
3. **Announcement Detail Page (`/announcements/[id]`):**
   - Deep filing inspection including sequence numbers, ISIN, filing timestamp, and source links.
   - Optional grounded AI summarization with strict disclaimers.
4. **Stock Detail Page (`/stocks/[exchange]/[symbol]`):**
   - Integrated **News** and **Announcements** tabs alongside Overview, Financials, Valuation, and Health Score.
   - Isolated failure handling: missing news or filings does not break chart or quote rendering.
5. **Watchlists Page (`/watchlists`):**
   - **Watchlist News Intelligence** module showing relevant updates across all symbols in the user's active watchlists.
   - Deduplicated across companies with privacy-safe endpoint calls.
6. **Navigation Header (`SiteHeader`):**
   - Added direct links to `News` and `Announcements`.

---

## 7. Grounded AI Summarization with Gemini

AI summarization is strictly an optional interpretation layer and **never** a source of news:

- **Evidence-Bounded:** Summaries must be derived purely from the retrieved headline and excerpt text.
- **Headline-Only Disclosure:** When only a headline or brief snippet is available, the summary explicitly states: _"Summary based solely on published headline and brief disclosure excerpt; complete filing was not ingested."_
- **No BUY/SELL Advice:** The AI engine is hardcoded to refuse price predictions, recommendation calls, or causal stock-impact claims.
- **Schema Enforced:** Validated with Zod schemas including `summary`, `keyTakeaways`, `confidence`, and `disclaimer`.

---

## 8. Test Verification & Results

All 21 backend test suites and 151 unit/integration tests passed cleanly:

```bash
Test Files  21 passed (21)
     Tests  151 passed (151)
  Duration  37.59s
```

### Phase 8 Test Suite Breakdown (`backend/tests/phase8News.test.ts`):

1. **Deduplication & Content Hashing:** Verifies deterministic SHA-256 hashes ignoring URL tracking parameters.
2. **Company Matcher & Identification:** Tests ISIN matching, symbol + exchange matching, and word-boundary false-positive rejection.
3. **Normalization & Sanitization:** Rejects `javascript:` schemes, sanitizes `<script>` tags, and enforces HTTPS.
4. **Provider Health & Degradation:** Verifies provider status reporting, category mapping, and non-throwing network failure handling.
5. **Repository & Idempotency:** Verifies duplicate insertion safety and category/symbol queries.
6. **API Endpoints:** Validates responses, pagination, provenance headers, and status codes for all 7 routes.
7. **Watchlist Security & Isolation:** Rejects unauthenticated requests with `401 UNAUTHORIZED` and verifies private user news filtering.

### Frontend Production Build:

Next.js production build (`npm run build`) succeeded with 20/20 routes statically and dynamically generated without warnings.
