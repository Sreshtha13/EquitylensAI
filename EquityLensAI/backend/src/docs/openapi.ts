import { ASSET_TYPES, MARKETS } from '@equitylensai/shared';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'EquityLensAI API',
    version: '0.1.0',
    description:
      'AI-powered market intelligence and equity research platform API.\n\n' +
      'Delivers low-latency health monitoring, market indices, asset quotes, AI research generation with Gemini, and user watchlists. Built with production-grade TypeScript, Express, Zod validation, and structured observability.',
    contact: {
      name: 'EquityLensAI Engineering',
      url: 'https://github.com/Sreshtha13/EquitylensAI',
    },
    license: {
      name: 'Proprietary / Private',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
    {
      url: '/',
      description: 'Current host root',
    },
  ],
  tags: [
    {
      name: 'System',
      description: 'Health checks, root metadata, and operational status endpoints',
    },
    {
      name: 'Instruments',
      description:
        'Global equity, ETF, index, crypto, and commodity security information and search',
    },
    {
      name: 'Market Intelligence',
      description: 'Broad market indices, breadth metrics, and sector performance',
    },
    {
      name: 'AI Research',
      description:
        'Automated equity research, fundamental synthesis, and earnings review powered by Gemini',
    },
    {
      name: 'Watchlists',
      description: 'User-managed instrument watchlists and tracking',
    },
    {
      name: 'Financial Intelligence',
      description:
        'Deterministic fundamental analysis, financial statement ingestion, ratio computation, and automated health scores',
    },
  ],
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'Root service discovery',
        description:
          'Returns service identity, version, status, and navigation links to health and API documentation.',
        responses: {
          '200': {
            description: 'Service operational metadata',
            headers: {
              'X-Request-ID': {
                $ref: '#/components/headers/X-Request-ID',
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RootServiceResponse',
                },
                example: {
                  success: true,
                  data: {
                    service: 'equitylensai-api',
                    status: 'ok',
                    version: 'v1',
                    health: '/api/v1/health',
                    docs: '/docs',
                    openapi: '/openapi.json',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1': {
      get: {
        tags: ['System'],
        summary: 'API v1 index and discovery',
        description: 'Returns versioned router metadata and registered endpoint links.',
        responses: {
          '200': {
            description: 'API v1 directory',
            headers: {
              'X-Request-ID': {
                $ref: '#/components/headers/X-Request-ID',
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/V1IndexResponse',
                },
                example: {
                  success: true,
                  data: {
                    service: 'equitylensai-api',
                    status: 'ok',
                    version: 'v1',
                    endpoints: {
                      health: '/api/v1/health',
                      docs: '/docs',
                      openapi: '/api/v1/openapi.json',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['System'],
        summary: 'Health check probe',
        description:
          'Verifies backend process liveness. Does not call third-party market data providers, databases, or AI models, making it safe for container orchestrators and readiness probes.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
        ],
        responses: {
          '200': {
            description: 'Service is healthy and responding to requests',
            headers: {
              'X-Request-ID': {
                $ref: '#/components/headers/X-Request-ID',
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
                example: {
                  success: true,
                  data: {
                    status: 'ok',
                    service: 'equitylensai-api',
                    timestamp: '2026-10-14T13:45:00.000Z',
                  },
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/stocks/search': {
      get: {
        tags: ['Instruments'],
        summary: 'Search instruments and equities',
        description:
          'Search for stocks, ETFs, indices, and financial instruments across supported exchanges with symbol or name autocomplete and pagination.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'q',
            in: 'query',
            required: true,
            description:
              'Search keyword, ticker symbol, or company name (e.g., "RELIANCE", "Apple", "TCS")',
            schema: {
              type: 'string',
              minLength: 1,
            },
            example: 'RELIANCE',
          },
          {
            name: 'market',
            in: 'query',
            required: false,
            description: 'Filter by market jurisdiction',
            schema: {
              $ref: '#/components/schemas/Market',
            },
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            description: 'Filter by instrument asset type',
            schema: {
              $ref: '#/components/schemas/AssetType',
            },
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'Pagination page number (1-based)',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
          },
          {
            name: 'pageSize',
            in: 'query',
            required: false,
            description: 'Number of results per page',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InstrumentSearchResponse',
                },
                example: {
                  success: true,
                  data: {
                    items: [
                      {
                        symbol: 'RELIANCE',
                        name: 'Reliance Industries Ltd.',
                        type: 'equity',
                        market: 'nse',
                        exchange: 'NSE',
                        currency: 'INR',
                      },
                    ],
                    pagination: {
                      page: 1,
                      pageSize: 20,
                      total: 1,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (e.g. invalid query or pagination parameter)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError',
                },
              },
            },
          },
          '501': {
            description: 'Not yet implemented in Phase 1 (foundation boundary active)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/stocks/{ticker}': {
      get: {
        tags: ['Instruments'],
        summary: 'Get instrument quote and profile',
        description:
          'Retrieves comprehensive overview, price quotation, and fundamental profile for a specific instrument ticker symbol.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'ticker',
            in: 'path',
            required: true,
            description: 'Security ticker symbol (e.g., "AAPL", "RELIANCE.NS", "INFY")',
            schema: {
              type: 'string',
            },
            example: 'AAPL',
          },
        ],
        responses: {
          '200': {
            description: 'Instrument details and pricing overview',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InstrumentDetailResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/market': {
      get: {
        tags: ['Market Intelligence'],
        summary: 'Get market overview and indices',
        description:
          'Fetch snapshot of benchmark index levels, market breadth (advances/declines), and sector performance.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'market',
            in: 'query',
            required: false,
            description: 'Target market jurisdiction',
            schema: {
              $ref: '#/components/schemas/Market',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Market overview snapshot',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MarketOverviewResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/stocks/{symbol}/quote': {
      get: {
        tags: ['Instruments'],
        summary: 'Get live or delayed stock quote',
        description:
          'Retrieves genuine, normalized price quotation from supported market data providers (Angel One SmartAPI primary for NSE, Yahoo Finance fallback). Includes explicit data provenance (source, observed timestamp, retrieved timestamp, freshness level, staleness flag).',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Ticker symbol (e.g. RELIANCE, TCS, AAPL, MSFT)',
            schema: {
              type: 'string',
            },
            example: 'RELIANCE',
          },
          {
            name: 'exchange',
            in: 'query',
            required: false,
            description: 'Exchange code (NSE, BSE, NASDAQ, NYSE)',
            schema: {
              type: 'string',
            },
            example: 'NSE',
          },
        ],
        responses: {
          '200': {
            description: 'Normalized quote with data provenance',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NormalizedQuoteResponse',
                },
              },
            },
          },
          '404': {
            description: 'Quote not found for the requested symbol',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/stocks/{symbol}/history': {
      get: {
        tags: ['Instruments'],
        summary: 'Get historical price candles',
        description:
          'Retrieves genuine OHLCV candlestick historical data with specified candle interval.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Ticker symbol (e.g. RELIANCE, AAPL)',
            schema: {
              type: 'string',
            },
            example: 'RELIANCE',
          },
          {
            name: 'exchange',
            in: 'query',
            required: false,
            description: 'Exchange code (NSE, BSE, NASDAQ)',
            schema: {
              type: 'string',
            },
            example: 'NSE',
          },
          {
            name: 'interval',
            in: 'query',
            required: false,
            description: 'Candle interval',
            schema: {
              type: 'string',
              enum: [
                'ONE_MINUTE',
                'THREE_MINUTE',
                'FIVE_MINUTE',
                'TEN_MINUTE',
                'FIFTEEN_MINUTE',
                'THIRTY_MINUTE',
                'ONE_HOUR',
                'ONE_DAY',
              ],
              default: 'ONE_DAY',
            },
          },
          {
            name: 'from',
            in: 'query',
            required: false,
            description: 'Start date / timestamp',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            description: 'End date / timestamp',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Historical OHLCV prices',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HistoricalPricesResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/stocks/ingest': {
      post: {
        tags: ['Instruments'],
        summary: 'Trigger instrument master ingestion',
        description:
          'Downloads latest Angel One scrip master, normalizes active equities and indices, and updates local cache.',
        responses: {
          '200': {
            description: 'Ingestion result',
          },
        },
      },
    },
    '/api/v1/stocks/ingest/status': {
      get: {
        tags: ['Instruments'],
        summary: 'Get instrument ingestion status',
        description:
          'Returns progress, last ingested timestamp, total instruments count, and errors.',
        responses: {
          '200': {
            description: 'Ingestion status',
          },
        },
      },
    },
    '/api/v1/market/overview': {
      get: {
        tags: ['Market Intelligence'],
        summary: 'Get market overview and indices',
        description:
          'Fetch snapshot of benchmark index levels with verified market data provenance.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
          {
            name: 'market',
            in: 'query',
            required: false,
            description: 'Target market jurisdiction',
            schema: {
              $ref: '#/components/schemas/Market',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Market overview snapshot',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MarketOverviewResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/market/providers': {
      get: {
        tags: ['Market Intelligence'],
        summary: 'List market data providers',
        description: 'Returns configured market data providers and availability status.',
        responses: {
          '200': {
            description: 'Provider list',
          },
        },
      },
    },
    '/api/v1/ai/research': {
      post: {
        tags: ['AI Research'],
        summary: 'Generate evidence-grounded financial research',
        description:
          'Uses Gemini to interpret a bounded context assembled from verified market data and deterministic financial metrics. Model claims cite backend evidence IDs. Does not provide investment recommendations, news, or earnings-call analysis.',
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AiResearchRequest',
              },
              example: {
                symbol: 'RELIANCE',
                exchange: 'NSE',
                question: 'Explain the available profitability and financial risk evidence.',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Validated research and backend-owned evidence registry',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AiResearchResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request body or validation failure',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError',
                },
              },
            },
          },
          '429': {
            description: 'AI research request or provider rate limit reached',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
          '413': {
            description: 'Research request body exceeds the AI endpoint size limit',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          '504': { description: 'Gemini request timed out' },
          '404': { description: 'Instrument was not found in the supported instrument repository' },
          '502': { description: 'Provider unavailable or invalid structured model output' },
          '503': { description: 'AI disabled or verified financial context unavailable' },
        },
      },
    },
    '/api/v1/ai/screener/metrics': {
      get: {
        tags: ['AI Research'],
        summary: 'List screener interpretation metrics',
        description:
          'Returns the backend-owned allowlist of real metrics from individual-company financial analysis. Catalog metrics are not available for universe-wide execution until a queryable financial data index exists.',
        responses: {
          '200': { description: 'Metric catalog with units, periods, and execution availability' },
        },
      },
    },
    '/api/v1/ai/screener/interpret': {
      post: {
        tags: ['AI Research'],
        summary: 'Interpret natural-language screening criteria',
        description:
          'Uses Gemini structured output to interpret criteria only. It returns validated filters, not company results or match counts. The AI has no database or SQL execution access.',
        parameters: [{ $ref: '#/components/parameters/RequestIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string', minLength: 1, maxLength: 500 },
                  exchange: { type: 'string', enum: ['NSE', 'BSE'] },
                  period: { type: 'string', enum: ['annual', 'ttm'], default: 'annual' },
                },
                required: ['query'],
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          '200': { description: 'Validated filter interpretation without screening results' },
          '400': { description: 'Invalid or unsafe query' },
          '422': { description: 'Unsupported metric or reporting period' },
          '429': { description: 'AI request rate limit reached' },
          '502': { description: 'Provider unavailable or invalid structured output' },
          '503': { description: 'AI is disabled or unavailable' },
        },
      },
    },
    '/api/v1/ai/screener': {
      post: {
        tags: ['AI Research'],
        summary: 'Execute a validated screener request',
        description:
          'Validates an allowlisted filter set and queries the persisted financial-metrics index. Success responses include paginated matches, provenance, freshness, and coverage. The index must be migrated and ingested; database errors are returned explicitly.',
        parameters: [{ $ref: '#/components/parameters/RequestIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string', minLength: 1, maxLength: 500 },
                  exchange: { type: 'string', enum: ['NSE', 'BSE'] },
                  assetType: { type: 'string', enum: ['equity'], default: 'equity' },
                  period: { type: 'string', enum: ['annual', 'ttm'], default: 'annual' },
                  filters: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 5,
                    items: {
                      type: 'object',
                      properties: {
                        field: {
                          type: 'string',
                          enum: [
                            'roe',
                            'roa',
                            'roce',
                            'net_margin',
                            'debt_to_equity',
                            'revenue_growth',
                            'net_income_growth',
                            'free_cash_flow_margin',
                            'current_ratio',
                            'pe_ratio',
                            'price_to_book',
                            'financial_health_score',
                          ],
                        },
                        operator: {
                          type: 'string',
                          enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
                        },
                        value: { type: 'number' },
                        upperValue: { type: 'number', nullable: true },
                      },
                      required: ['field', 'operator', 'value'],
                      additionalProperties: false,
                    },
                  },
                  logic: { type: 'string', enum: ['AND', 'OR'] },
                  sort: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        enum: [
                          'roe',
                          'roa',
                          'roce',
                          'net_margin',
                          'debt_to_equity',
                          'revenue_growth',
                          'net_income_growth',
                          'free_cash_flow_margin',
                          'current_ratio',
                          'pe_ratio',
                          'price_to_book',
                          'financial_health_score',
                          'symbol',
                        ],
                        nullable: true,
                      },
                      direction: { type: 'string', enum: ['asc', 'desc'] },
                    },
                    required: ['field', 'direction'],
                    additionalProperties: false,
                  },
                  limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
                  offset: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
                },
                required: ['query', 'filters', 'logic'],
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Screen results with pagination, provenance, freshness, and coverage',
          },
          '400': { description: 'Invalid or unsupported filter definition' },
          '429': { description: 'Request rate limit reached' },
          '502': { description: 'Financial-metrics database returned an invalid response' },
          '503': { description: 'Financial-metrics database is unavailable or not configured' },
        },
      },
    },
    '/api/v1/watchlists': {
      get: {
        tags: ['Watchlists'],
        summary: 'Get user watchlists',
        description: 'Retrieves watchlists created by the authenticated user.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            $ref: '#/components/parameters/RequestIdHeader',
          },
        ],
        responses: {
          '200': {
            description: 'List of user watchlists',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WatchlistsResponse',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid Bearer token',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
          '501': {
            description: 'Not yet implemented in Phase 1 (foundation boundary active)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/financial/{symbol}/analysis': {
      get: {
        tags: ['Financial Intelligence'],
        summary: 'Full financial analysis and metrics',
        description:
          'Retrieves normalized annual and TTM financial statements, deterministic financial ratios (profitability, liquidity, leverage, cash flow, growth, valuation), and the composite Financial Health Score (0-100).',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Ticker symbol (e.g., RELIANCE, AAPL, TCS, INFY)',
            schema: { type: 'string', example: 'RELIANCE' },
          },
          {
            name: 'exchange',
            in: 'query',
            required: false,
            description: 'Optional exchange code (e.g., NSE, BSE, NASDAQ, NYSE)',
            schema: { type: 'string', example: 'NSE' },
          },
          {
            name: 'periods',
            in: 'query',
            required: false,
            description: 'Number of annual historical periods to retrieve (1-8, default 4)',
            schema: { type: 'integer', default: 4, example: 4 },
          },
        ],
        responses: {
          '200': {
            description:
              'Comprehensive financial analysis payload with statement history and calculated metrics',
          },
          '400': {
            description: 'Validation error: invalid symbol or period parameter',
          },
          '502': {
            description: 'Financial provider upstream failure or no statements available',
          },
        },
      },
    },
    '/api/v1/financial/{symbol}/statements': {
      get: {
        tags: ['Financial Intelligence'],
        summary: 'Raw financial statements',
        description:
          'Retrieves multi-period income statements, balance sheets, and cash flow statements without calculated ratios.',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Ticker symbol',
            schema: { type: 'string', example: 'TCS' },
          },
          {
            name: 'exchange',
            in: 'query',
            required: false,
            schema: { type: 'string', example: 'NSE' },
          },
          {
            name: 'periods',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 4 },
          },
        ],
        responses: {
          '200': { description: 'Statement history across reported periods' },
          '400': { description: 'Validation error' },
          '502': { description: 'Provider error' },
        },
      },
    },
    '/api/v1/financial/{symbol}/health-score': {
      get: {
        tags: ['Financial Intelligence'],
        summary: 'Financial Health Score (0-100)',
        description:
          'Lightweight endpoint providing 0-100 composite financial health score, letter grade (A+ through F), dimension breakdown (profitability, liquidity, leverage, cash flow, growth), and transparent evaluation summary.',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'INFY' },
          },
          {
            name: 'exchange',
            in: 'query',
            required: false,
            schema: { type: 'string', example: 'NSE' },
          },
        ],
        responses: {
          '200': { description: 'Financial Health Score and dimension evaluations' },
          '400': { description: 'Validation error' },
          '502': { description: 'Data unavailable' },
        },
      },
    },
    '/api/v1/financial/cache-stats': {
      get: {
        tags: ['Financial Intelligence'],
        summary: 'Financial cache statistics',
        description:
          'Returns in-memory cache operational telemetry (size, hits, misses, stale hits) for financial datasets.',
        responses: {
          '200': { description: 'Cache statistics' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT authorization token (obtained via Supabase auth)',
      },
    },
    headers: {
      'X-Request-ID': {
        description: 'Unique UUID correlation identifier for tracing and structured logs',
        schema: {
          type: 'string',
          format: 'uuid',
          example: '8df9a8b1-3450-4847-a859-f9c1b4b1a456',
        },
      },
    },
    parameters: {
      RequestIdHeader: {
        name: 'X-Request-ID',
        in: 'header',
        required: false,
        description:
          'Optional caller-supplied request correlation ID. If omitted, the API generates a new UUID.',
        schema: {
          type: 'string',
        },
      },
    },
    schemas: {
      AssetType: {
        type: 'string',
        enum: ASSET_TYPES,
        description: 'Supported financial instrument asset classifications',
        example: 'equity',
      },
      Market: {
        type: 'string',
        enum: MARKETS,
        description: 'Supported market jurisdictions and asset exchanges',
        example: 'nse',
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            example: 1,
          },
          pageSize: {
            type: 'integer',
            example: 20,
          },
          total: {
            type: 'integer',
            example: 154,
          },
        },
        required: ['page', 'pageSize', 'total'],
      },
      ApiError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [false],
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'NOT_FOUND',
              },
              message: {
                type: 'string',
                example: 'Requested resource was not found',
              },
              details: {
                type: 'object',
                description: 'Optional error details or validation breakdowns',
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [false],
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: ['VALIDATION_ERROR'],
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid request data',
              },
              details: {
                type: 'object',
                description: 'Zod validation issue breakdown grouped by target field',
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      RootServiceResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                example: 'equitylensai-api',
              },
              status: {
                type: 'string',
                example: 'ok',
              },
              version: {
                type: 'string',
                example: 'v1',
              },
              health: {
                type: 'string',
                example: '/api/v1/health',
              },
              docs: {
                type: 'string',
                example: '/docs',
              },
              openapi: {
                type: 'string',
                example: '/openapi.json',
              },
            },
            required: ['service', 'status', 'version', 'health', 'docs', 'openapi'],
          },
        },
        required: ['success', 'data'],
      },
      V1IndexResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                example: 'equitylensai-api',
              },
              status: {
                type: 'string',
                example: 'ok',
              },
              version: {
                type: 'string',
                example: 'v1',
              },
              endpoints: {
                type: 'object',
                properties: {
                  health: {
                    type: 'string',
                    example: '/api/v1/health',
                  },
                  docs: {
                    type: 'string',
                    example: '/docs',
                  },
                  openapi: {
                    type: 'string',
                    example: '/api/v1/openapi.json',
                  },
                },
                required: ['health', 'docs', 'openapi'],
              },
            },
            required: ['service', 'status', 'version', 'endpoints'],
          },
        },
        required: ['success', 'data'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                example: 'ok',
              },
              service: {
                type: 'string',
                example: 'equitylensai-api',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2026-10-14T13:45:00.000Z',
              },
            },
            required: ['status', 'service', 'timestamp'],
          },
        },
        required: ['success', 'data'],
      },
      Instrument: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            example: 'RELIANCE',
          },
          name: {
            type: 'string',
            example: 'Reliance Industries Ltd.',
          },
          type: {
            $ref: '#/components/schemas/AssetType',
          },
          market: {
            $ref: '#/components/schemas/Market',
          },
          exchange: {
            type: 'string',
            example: 'NSE',
          },
          currency: {
            type: 'string',
            example: 'INR',
          },
        },
        required: ['symbol', 'name', 'type', 'market', 'exchange', 'currency'],
      },
      InstrumentSearchResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Instrument',
                },
              },
              pagination: {
                $ref: '#/components/schemas/Pagination',
              },
            },
            required: ['items', 'pagination'],
          },
        },
        required: ['success', 'data'],
      },
      InstrumentDetailResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                example: 'AAPL',
              },
              name: {
                type: 'string',
                example: 'Apple Inc.',
              },
              price: {
                type: 'number',
                example: 228.45,
              },
              change: {
                type: 'number',
                example: 1.25,
              },
              changePercent: {
                type: 'number',
                example: 0.55,
              },
              currency: {
                type: 'string',
                example: 'USD',
              },
              marketCap: {
                type: 'number',
                example: 3480000000000,
              },
              peRatio: {
                type: 'number',
                example: 34.2,
              },
            },
            required: ['symbol', 'name', 'price', 'change', 'changePercent', 'currency'],
          },
        },
        required: ['success', 'data'],
      },
      NormalizedQuoteResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              symbol: { type: 'string', example: 'RELIANCE' },
              name: { type: 'string', example: 'Reliance Industries Ltd' },
              exchange: { type: 'string', example: 'NSE' },
              market: { type: 'string', example: 'nse' },
              assetType: { type: 'string', example: 'equity' },
              currency: { type: 'string', example: 'INR' },
              price: { type: 'number', nullable: true, example: 1174.6 },
              change: { type: 'number', nullable: true, example: 7.9 },
              changePercent: { type: 'number', nullable: true, example: 0.68 },
              open: { type: 'number', nullable: true, example: 1167.0 },
              high: { type: 'number', nullable: true, example: 1188.0 },
              low: { type: 'number', nullable: true, example: 1162.7 },
              previousClose: { type: 'number', nullable: true, example: 1166.7 },
              volume: { type: 'number', nullable: true, example: 10938195 },
              source: { type: 'string', example: 'angel' },
              observedAt: { type: 'string', format: 'date-time' },
              retrievedAt: { type: 'string', format: 'date-time' },
              freshness: {
                type: 'string',
                enum: ['live', 'delayed', 'eod', 'historical', 'stale', 'unavailable'],
              },
              isStale: { type: 'boolean', example: false },
            },
            required: [
              'symbol',
              'name',
              'exchange',
              'market',
              'currency',
              'source',
              'observedAt',
              'retrievedAt',
              'freshness',
              'isStale',
            ],
          },
        },
        required: ['success', 'data'],
      },
      HistoricalPricesResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              symbol: { type: 'string', example: 'RELIANCE' },
              exchange: { type: 'string', example: 'NSE' },
              interval: { type: 'string', example: 'ONE_DAY' },
              fromDate: { type: 'string' },
              toDate: { type: 'string' },
              source: { type: 'string', example: 'angel' },
              retrievedAt: { type: 'string', format: 'date-time' },
              candles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    open: { type: 'number' },
                    high: { type: 'number' },
                    low: { type: 'number' },
                    close: { type: 'number' },
                    volume: { type: 'number', nullable: true },
                    adjustedClose: { type: 'number', nullable: true },
                  },
                  required: ['timestamp', 'open', 'high', 'low', 'close'],
                },
              },
            },
            required: [
              'symbol',
              'exchange',
              'interval',
              'fromDate',
              'toDate',
              'candles',
              'source',
              'retrievedAt',
            ],
          },
        },
        required: ['success', 'data'],
      },
      AiResearchRequest: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            maxLength: 30,
            example: 'RELIANCE',
            description: 'Supported instrument ticker symbol',
          },
          exchange: {
            type: 'string',
            maxLength: 10,
            description: 'Exchange code; required if symbol resolves ambiguously',
          },
          question: {
            type: 'string',
            minLength: 10,
            maxLength: 800,
            example: 'Explain the available profitability and financial risk evidence.',
          },
          comparisonInstrument: {
            type: 'object',
            properties: {
              symbol: { type: 'string', maxLength: 30 },
              exchange: { type: 'string', maxLength: 10 },
            },
            required: ['symbol'],
          },
        },
        required: ['symbol', 'question'],
        additionalProperties: false,
      },
      AiResearchResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              schemaVersion: { type: 'string', enum: ['1.0'] },
              instrument: { $ref: '#/components/schemas/AiResearchInstrument' },
              comparisonInstrument: {
                $ref: '#/components/schemas/AiResearchInstrument',
                nullable: true,
              },
              question: { type: 'string' },
              intent: {
                type: 'string',
                enum: [
                  'GENERAL',
                  'PROFITABILITY',
                  'GROWTH',
                  'VALUATION',
                  'LIQUIDITY',
                  'CASH_FLOW',
                  'DEBT',
                  'RISK',
                  'HISTORICAL_PERFORMANCE',
                  'COMPARISON',
                ],
              },
              summary: { $ref: '#/components/schemas/AiResearchClaim' },
              overallAssessment: { $ref: '#/components/schemas/AiResearchAssessment' },
              sections: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchSection' },
              },
              strengths: { type: 'array', items: { $ref: '#/components/schemas/AiResearchClaim' } },
              riskFactors: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchClaim' },
              },
              growthSignals: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchClaim' },
              },
              valuationObservations: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchClaim' },
              },
              financialObservations: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchClaim' },
              },
              missingData: { type: 'array', items: { type: 'string' } },
              evidence: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiResearchEvidence' },
              },
              confidence: { $ref: '#/components/schemas/AiResearchConfidence' },
              disclaimer: { type: 'string' },
            },
            required: [
              'schemaVersion',
              'instrument',
              'comparisonInstrument',
              'question',
              'intent',
              'summary',
              'overallAssessment',
              'sections',
              'strengths',
              'riskFactors',
              'growthSignals',
              'valuationObservations',
              'financialObservations',
              'missingData',
              'evidence',
              'confidence',
              'disclaimer',
            ],
          },
        },
        required: ['success', 'data'],
      },
      AiResearchInstrument: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          exchange: { type: 'string' },
          name: { type: 'string', nullable: true },
        },
        required: ['symbol', 'exchange', 'name'],
      },
      AiResearchClaim: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'evidenceIds'],
      },
      AiResearchAssessment: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: ['POSITIVE', 'NEGATIVE', 'MIXED', 'INSUFFICIENT_DATA'],
          },
          explanation: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'explanation', 'evidenceIds'],
      },
      AiResearchSection: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          analysis: { $ref: '#/components/schemas/AiResearchClaim' },
          risks: {
            type: 'array',
            items: { $ref: '#/components/schemas/AiResearchClaim' },
          },
          limitations: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'analysis', 'risks', 'limitations'],
      },
      AiResearchConfidence: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LIMITED', 'LOW'] },
          explanation: { type: 'string' },
          availableEvidence: { type: 'integer', minimum: 0 },
          totalEvidence: { type: 'integer', minimum: 1 },
        },
        required: ['level', 'explanation', 'availableEvidence', 'totalEvidence'],
      },
      AiResearchEvidence: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['statement', 'metric', 'health_score', 'market_quote', 'market_history'],
          },
          metric: { type: 'string' },
          value: { nullable: true, oneOf: [{ type: 'number' }, { type: 'string' }] },
          unit: { type: 'string', nullable: true },
          period: { type: 'string', nullable: true },
          periodType: { type: 'string', enum: ['annual', 'quarterly', 'ttm'] },
          source: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time', nullable: true },
          calculationVersion: { type: 'string' },
          freshness: { type: 'string' },
          stale: { type: 'boolean' },
        },
        required: ['id', 'type', 'metric', 'value', 'unit', 'period', 'source', 'timestamp'],
      },
      MarketOverviewResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              market: {
                $ref: '#/components/schemas/Market',
              },
              indices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      example: 'NIFTY 50',
                    },
                    value: {
                      type: 'number',
                      example: 25120.35,
                    },
                    change: {
                      type: 'number',
                      example: 84.5,
                    },
                    changePercent: {
                      type: 'number',
                      example: 0.34,
                    },
                  },
                  required: ['name', 'value', 'change', 'changePercent'],
                },
              },
              marketBreadth: {
                type: 'object',
                properties: {
                  advances: {
                    type: 'integer',
                    example: 1420,
                  },
                  declines: {
                    type: 'integer',
                    example: 980,
                  },
                  unchanged: {
                    type: 'integer',
                    example: 110,
                  },
                },
                required: ['advances', 'declines', 'unchanged'],
              },
            },
            required: ['market', 'indices', 'marketBreadth'],
          },
        },
        required: ['success', 'data'],
      },
      Watchlist: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: 'c6a4e321-4f2b-426b-88a4-0e782e4f0a21',
          },
          name: {
            type: 'string',
            example: 'Semiconductor Leaders',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Instrument',
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['id', 'name', 'items', 'createdAt'],
      },
      WatchlistsResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [true],
          },
          data: {
            type: 'object',
            properties: {
              watchlists: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Watchlist',
                },
              },
            },
            required: ['watchlists'],
          },
        },
        required: ['success', 'data'],
      },
    },
  },
} as const;
