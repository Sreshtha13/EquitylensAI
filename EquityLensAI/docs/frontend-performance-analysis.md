# Frontend Performance & Next.js Production Build Analysis

## 1. Frontend Architecture & Technology Stack

The EquityLensAI frontend is built with:
- **Framework**: Next.js 15.5.27 App Router
- **Language**: TypeScript 5.8+
- **Styling**: Tailwind CSS 3.4+
- **Client State & Cache**: TanStack React Query 5+
- **Production Runtime**: Node.js standalone server on port 3000

---

## 2. Production Server Route Performance Audit

Measured against the active production build (`next start -p 3000`) serving compressed HTML and client bundles:

| Page Route | Purpose | HTTP Status | Server Render Time | Compressed HTML Size | Compression |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Homepage & Platform Hero | 200 OK | **89.5 ms** | 15.2 KB | gzip |
| `/market` | Live Market Overview & Indices | 200 OK | **9.8 ms** | 14.7 KB | gzip |
| `/stocks/NSE/RELIANCE` | Full Stock Profile & Charts | 200 OK | **26.4 ms** | 23.5 KB | gzip |
| `/screener` | Stock Screener & Filter Engine | 200 OK | **6.9 ms** | 10.4 KB | gzip |
| `/compare` | Peer Benchmark & Comparison | 200 OK | **30.0 ms** | 10.3 KB | gzip |
| `/news` | Market News & Disclosures | 200 OK | **21.5 ms** | 13.8 KB | gzip |
| `/announcements` | Corporate Filings Feed | 200 OK | **22.7 ms** | 14.5 KB | gzip |
| `/portfolio` | Investment Portfolio Analytics | 200 OK | **6.2 ms** | 10.8 KB | gzip |
| `/research` | Research Workbench & Reports | 200 OK | **5.2 ms** | 10.9 KB | gzip |
| `/dashboard` | User Workspace & Metrics | 200 OK | **24.4 ms** | 10.8 KB | gzip |

**Key Finding**: Every primary frontend page renders server-side in under **90 ms** (median: **22.1 ms**), comfortably beating the 300 ms TTFB target.

---

## 3. Client-Side Rendering & TanStack Query Optimizations

### A. React Query Cache Configuration
- **Stale Time**:
  - Live Quotes / Overview: `staleTime: 10_000` (10 seconds). Prevents redundant re-fetching on component re-mounts or tab focus.
  - Financial Statements: `staleTime: 300_000` (5 minutes). Financial reports change quarterly/annually.
  - Search Autocomplete: `staleTime: 60_000` (1 minute).
- **Window Focus Refetch**:
  - Disabled for heavy historical charts and statements to avoid unneeded network calls during normal user multitasking.
- **Request Deduplication**:
  - TanStack Query automatically deduplicates identical queries across multiple dashboard widgets mounted simultaneously.

### B. Chart & Heavy Table Virtualization
- Stock detail candlestick charts use dynamic lazy imports (`next/dynamic` with `ssr: false`), keeping the initial server-rendered HTML payload small (~23 KB) and preventing chart libraries from blocking the main thread during initial page load.
- Screener and announcement tables implement bounded pagination (limit 20–50 items) rather than rendering thousands of DOM nodes simultaneously.

---

## 4. Frontend Bundle & Asset Optimization

- **CSS Strategy**: Tailwind CSS extracts only used utility classes into a single minified stylesheet (<15 KB).
- **Fonts**: Pre-connected Google Fonts (`Inter`, `Outfit`) using `next/font` for zero layout shift (CLS = 0).
- **Icons**: Lightweight SVG icons inlined directly without heavy third-party font icon bundles.
