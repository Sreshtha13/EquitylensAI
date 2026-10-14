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
      url: '/api/v1',
      description: 'API version 1 base path',
    },
  ],
  tags: [
    {
      name: 'System',
      description: 'Health checks, root metadata, and operational status endpoints',
    },
    {
      name: 'Instruments',
      description: 'Global equity, ETF, index, crypto, and commodity security information and search',
    },
    {
      name: 'Market Intelligence',
      description: 'Broad market indices, breadth metrics, and sector performance',
    },
    {
      name: 'AI Research',
      description: 'Automated equity research, fundamental synthesis, and earnings review powered by Gemini',
    },
    {
      name: 'Watchlists',
      description: 'User-managed instrument watchlists and tracking',
    },
  ],
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'Root service discovery',
        description: 'Returns service identity, version, status, and navigation links to health and API documentation.',
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
            description: 'Search keyword, ticker symbol, or company name (e.g., "RELIANCE", "Apple", "TCS")',
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
        description: 'Retrieves comprehensive overview, price quotation, and fundamental profile for a specific instrument ticker symbol.',
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
          '404': {
            description: 'Instrument not found',
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
    '/api/v1/market': {
      get: {
        tags: ['Market Intelligence'],
        summary: 'Get market overview and indices',
        description: 'Fetch snapshot of benchmark index levels, market breadth (advances/declines), and sector performance.',
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
    '/api/v1/ai/research': {
      post: {
        tags: ['AI Research'],
        summary: 'Generate AI investment research',
        description:
          'Submits an equity analysis request to the Gemini AI research pipeline. Returns synthesis of investment thesis, valuation analysis, key competitive risks, and recent earnings review.',
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
                ticker: 'NVDA',
                query: 'Evaluate next quarter data center demand and margins in light of new architecture ramp',
                depth: 'deep_dive',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Generated AI research dossier',
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
        description: 'Optional caller-supplied request correlation ID. If omitted, the API generates a new UUID.',
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
      AiResearchRequest: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            example: 'NVDA',
            description: 'Instrument ticker symbol to research',
          },
          query: {
            type: 'string',
            example: 'Analyze margin durability in data centers over next 12 months',
            description: 'Optional natural language research question or theme',
          },
          depth: {
            type: 'string',
            enum: ['summary', 'deep_dive', 'earnings_review'],
            default: 'summary',
            description: 'Analysis thoroughness',
          },
        },
        required: ['ticker'],
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
              ticker: {
                type: 'string',
                example: 'NVDA',
              },
              summary: {
                type: 'string',
                example: 'Strong demand trajectory driven by enterprise AI deployments...',
              },
              bullCase: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              bearCase: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              keyRisks: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              model: {
                type: 'string',
                example: 'gemini-1.5-pro',
              },
              generatedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['ticker', 'summary', 'bullCase', 'bearCase', 'keyRisks', 'generatedAt'],
          },
        },
        required: ['success', 'data'],
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
