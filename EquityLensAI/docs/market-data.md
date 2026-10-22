# Market Data Infrastructure (Phase 2)

EquityLensAI Phase 2 implements a production-grade, genuine market data pipeline with strict provenance, multi-provider fallback, in-memory caching, and zero tolerance for mock, simulated, or fabricated financial values.

---

## 1. Core Principles & Non-Negotiables

1. **Zero Mock or Hallucinated Data in Production**: All stock quotes, indices, volumes, and OHLC candlestick bars represent genuine observations returned by integrated market data providers.
2. **Explicit Data Provenance**: Every response includes:
   - `source`: The provider identifier (`angel` or `yahoo`).
   - `observedAt`: ISO 8601 timestamp of when the price occurred on the exchange feed.
   - `retrievedAt`: ISO 8601 timestamp of when EquityLensAI ingested the data.
   - `freshness`: One of `'live'`, `'delayed'`, `'eod'`, `'historical'`, `'stale'`, or `'unavailable'`.
   - `isStale`: Boolean flag indicating whether the observation exceeds the fresh TTL and was served from the stale window.
3. **No Zero Padding**: Unavailable high, low, open, or close values are returned as `null`, never `0`.
4. **No Misleading Freshness**: Public delayed quotes (e.g. from Yahoo Finance) are explicitly tagged `freshness: 'delayed'`. Live real-time quotes (e.g. from authenticated Angel One SmartAPI) are tagged `freshness: 'live'`.

---

## 2. Architecture & Provider Tiering

```
                     ┌────────────────────────┐
                     │    Client Request      │
                     └───────────┬────────────┘
                                 │
                     ┌───────────▼────────────┐
                     │    MemoryCache (TTL)   │
                     │  Fresh -> return       │
                     │  Miss/Stale -> fetch   │
                     └───────────┬────────────┘
                                 │
                     ┌───────────▼────────────┐
                     │     MarketService      │
                     │      Orchestrator      │
                     └─────┬────────────┬─────┘
                           │            │
            Primary for NSE│            │Secondary / Global
                           ▼            ▼
                 ┌───────────────┐  ┌───────────────┐
                 │   Angel One   │  │ Yahoo Finance │
                 │   SmartAPI    │  │  (Delayed)    │
                 └───────────────┘  └───────────────┘
```

### Supported Providers

| Provider               | Role                     | Authentication                     | Freshness                    | Supported Markets                  |
| :--------------------- | :----------------------- | :--------------------------------- | :--------------------------- | :--------------------------------- |
| **Angel One SmartAPI** | Primary                  | Client ID, Password, TOTP, API Key | `live` (tick / session feed) | `NSE` (Equities & Indices)         |
| **Yahoo Finance**      | Supplementary / Fallback | None (Public HTTP)                 | `delayed` (~15 min delay)    | `US`, `NSE` (`.NS`), `BSE` (`.BO`) |

---

## 3. Instrument Master & Ingestion

Because Supabase database access is established as a boundary in Phase 1, Phase 2 maintains an **in-process, high-performance instrument repository** with disk cache persistence:

- **Ingestion Source**: Downloads Angel One scrip master JSON from `https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json`.
- **Filtering**: Filters for active NSE equities (`-EQ`) and benchmark indices (`AMXIDX`), normalizing them into `InstrumentRecord`.
- **Search Ranking**: In-memory inverted index prioritizing exact symbol matches (100) > prefix symbol (80) > substring symbol (60) > prefix name (40) > substring name (20).
- **Disk Persistence**: Persisted to `backend/data/instruments-cache.json` for instantaneous subsequent backend restarts.

### Running Ingestion CLI

```bash
npm run ingest:instruments --workspace @equitylensai/backend
```

Or via REST API:

```http
POST /api/v1/stocks/ingest
```

---

## 4. API Endpoints

### 4.1 Search Tradable Instruments

```http
GET /api/v1/stocks/search?q={query}&market={market}&limit={limit}
```

**Query Parameters**:

- `q` (required, string 1-50): Search query (e.g. `RELIANCE`, `TCS`, `AAPL`).
- `market` (optional): `nse`, `bse`, `us`, etc.
- `assetType` (optional): `equity`, `etf`, `index`.
- `limit` (optional, default 20): Maximum results to return (1-100).

### 4.2 Stock Quote

```http
GET /api/v1/stocks/{symbol}/quote?exchange={exchange}
```

**Response Format**:

```json
{
  "success": true,
  "data": {
    "symbol": "RELIANCE",
    "name": "Reliance Industries Limited",
    "exchange": "NSE",
    "market": "nse",
    "assetType": "equity",
    "currency": "INR",
    "price": 1174.6,
    "change": 7.9,
    "changePercent": 0.68,
    "open": 1167.0,
    "high": 1188.0,
    "low": 1162.7,
    "previousClose": 1166.7,
    "volume": 10938195,
    "source": "angel",
    "observedAt": "2026-10-14T10:38:11.000Z",
    "retrievedAt": "2026-10-14T10:38:15.120Z",
    "freshness": "live",
    "isStale": false
  }
}
```

### 4.3 Historical OHLCV Candles

```http
GET /api/v1/stocks/{symbol}/history?exchange={exchange}&interval={interval}&from={from}&to={to}
```

**Supported Intervals**:
`ONE_MINUTE`, `THREE_MINUTE`, `FIVE_MINUTE`, `TEN_MINUTE`, `FIFTEEN_MINUTE`, `THIRTY_MINUTE`, `ONE_HOUR`, `ONE_DAY`.

### 4.4 Market Overview

```http
GET /api/v1/market/overview?market={market}
```

Returns benchmark index snapshots (e.g., NIFTY 50, NIFTY Bank, S&P 500) with provenanced values and net changes.

### 4.5 Market Providers Status

```http
GET /api/v1/market/providers
```

Returns list of registered providers and whether credentials are configured.
