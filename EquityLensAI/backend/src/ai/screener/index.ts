import { getEnv } from '../../config/index.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import { GeminiClient } from '../clients/gemini.js';
import type { AiClient } from '../common/types.js';
import {
  getScreenerMetricCatalog,
  SCREENER_METRICS,
  screenerModelJsonSchema,
  screenerFilterSchema,
  screenerInterpretationRequestSchema,
  screenerModelResponseSchema,
  screenerRequestSchema,
  type ScreenerFilter,
  type ScreenerInterpretationRequest,
  type NormalizedScreenerInterpretationRequest,
  type ScreenerModelResponse,
  type ScreenerRequest,
} from './screenerSchema.js';
import { buildScreenerPrompt, SCREENER_SYSTEM_INSTRUCTION } from './screenerPrompt.js';
import { executeScreenerQuery, type ScreenerExecutionResponse } from './screenerRepository.js';

export {
  getScreenerMetricCatalog,
  SCREENER_METRICS,
  screenerFilterSchema,
  screenerInterpretationRequestSchema,
  screenerRequestSchema,
};
export type {
  ScreenerFilter,
  ScreenerInterpretationRequest,
  ScreenerRequest,
  ScreenerExecutionResponse,
};

export type ScreenerInterpretation = {
  querySummary: string;
  filters: ScreenerFilter[];
  logic: 'AND' | 'OR';
  exchange: 'NSE' | 'BSE' | null;
  assetType: 'equity';
  period: 'annual' | 'ttm';
  sort: { field: string | null; direction: 'asc' | 'desc' };
  limit: number;
  clarificationNeeded: boolean;
  warnings: string[];
  executionAvailable: true;
};

function findExplicitPercentageThreshold(query: string, field: keyof typeof SCREENER_METRICS) {
  const metric = SCREENER_METRICS[field];
  const comparators =
    '(?:above|over|greater than|more than|below|under|less than|at least|at most|no more than|>=|<=|>|<|=)';

  for (const alias of metric.aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `\\b${escapedAlias}\\b[\\s\\S]{0,50}?${comparators}\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?:%|percent(?:age)?)`,
      'i',
    );
    const match = query.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return undefined;
}

const qualitativePhrases = [
  /\blow debt\b/i,
  /\bhigh growth\b/i,
  /\bcheap valuation\b/i,
  /\breasonable valuation\b/i,
  /\bstrong financial health\b/i,
  /\bimproving profitability\b/i,
  /\blarge[\s-]?cap\b/i,
];
const unsupportedContextPhrases: Array<{ pattern: RegExp; warning: string }> = [
  {
    pattern: /\b(?:quarterly|quarter|last quarter)\b/i,
    warning: 'Quarterly financial screening is not supported.',
  },
  {
    pattern: /\b(?:consolidated|standalone)\b/i,
    warning: 'Consolidated and standalone statement scope is not reported by the current provider.',
  },
  {
    pattern:
      /\b(?:sector|industry|market capitalization|market cap|market value|large[\s-]?cap)\b/i,
    warning: 'Sector, industry, and market capitalization filters are not supported.',
  },
  {
    pattern: /\b(?:positive free cash flow|positive operating cash flow|profitable companies)\b/i,
    warning:
      'Positive cash-flow and profitability filters are not registered for screening interpretation.',
  },
  {
    pattern: /\b(?:NASDAQ|NYSE|NYSE Arca|LSE|TSE|ETF|ETFs|crypto|cryptocurrency|commodity)\b/i,
    warning:
      'Only NSE and BSE listed equities are supported by the screener interpretation contract.',
  },
];

const injectionPhrases = [
  /\bignore (?:all )?(?:previous|prior|above) instructions\b/i,
  /\breveal (?:the )?(?:system prompt|prompt|secrets?|api key)\b/i,
  /\b(?:execute|run) (?:this )?(?:sql|code|command)\b/i,
  /\bselect\s+\*\s+from\b/i,
  /\b(?:drop|truncate|alter)\s+table\b/i,
];

function parseModelResponse(text: string): ScreenerModelResponse {
  if (Buffer.byteLength(text, 'utf8') > 12000) {
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI response exceeded the supported size limit.',
      502,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('AI_INVALID_RESPONSE', 'The AI provider returned malformed JSON.', 502);
  }

  const result = screenerModelResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { validationIssueCount: result.error.issues.length },
      'ai_screener_response_schema_validation_failed',
    );
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI provider returned a response that failed validation.',
      502,
    );
  }
  return result.data;
}

function validateModelFilters(
  model: ScreenerModelResponse,
  request: NormalizedScreenerInterpretationRequest,
): ScreenerFilter[] {
  if (model.filters.length > 5) {
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI response exceeded the supported filter limit.',
      502,
    );
  }

  return model.filters.map((filter) => {
    const metric = SCREENER_METRICS[filter.field as keyof typeof SCREENER_METRICS];
    if (!metric) {
      throw new AppError(
        'SCREENER_UNSUPPORTED_METRIC',
        `The requested metric "${filter.field}" is not supported.`,
        422,
      );
    }

    if (!metric.periods.includes(request.period)) {
      throw new AppError(
        'SCREENER_UNSUPPORTED_PERIOD',
        `${metric.label} is not available for the ${request.period} period.`,
        422,
      );
    }

    const explicitThreshold =
      metric.unit === 'percent'
        ? findExplicitPercentageThreshold(
            request.query,
            filter.field as keyof typeof SCREENER_METRICS,
          )
        : undefined;
    const validated = screenerFilterSchema.safeParse({
      ...filter,
      value: explicitThreshold ?? filter.value,
    });
    if (!validated.success) {
      throw new AppError(
        'AI_INVALID_RESPONSE',
        'The AI provider returned a filter outside supported value limits.',
        502,
      );
    }
    return validated.data;
  });
}

function hasPromptInjection(query: string): boolean {
  return injectionPhrases.some((pattern) => pattern.test(query));
}

function findQualitativeAmbiguities(query: string): string[] {
  return qualitativePhrases
    .filter((pattern) => pattern.test(query))
    .map((pattern) => {
      const match = query.match(pattern);
      return match?.[0] ?? 'qualitative threshold';
    });
}

function findQueryExchange(query: string): 'NSE' | 'BSE' | null | 'ambiguous' {
  const matches = [
    ...new Set(query.match(/\b(?:NSE|BSE)\b/gi)?.map((value) => value.toUpperCase())),
  ];
  if (matches.length > 1) return 'ambiguous';
  return matches[0] === 'NSE' || matches[0] === 'BSE' ? matches[0] : null;
}

export async function interpretScreenerQuery(
  input: ScreenerInterpretationRequest,
  requestId?: string,
  client: AiClient = new GeminiClient(),
): Promise<ScreenerInterpretation> {
  const request = screenerInterpretationRequestSchema.parse(input);
  if (hasPromptInjection(request.query)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'The query contains instructions that are not valid screening criteria.',
      400,
    );
  }

  const ambiguities = findQualitativeAmbiguities(request.query);
  const unsupportedContext = unsupportedContextPhrases
    .filter(({ pattern }) => pattern.test(request.query))
    .map(({ warning }) => warning);
  const queryPeriodMismatch =
    (/\b(?:ttm|trailing twelve months)\b/i.test(request.query) && request.period !== 'ttm') ||
    (/\bannual(?:ly)?\b/i.test(request.query) && request.period !== 'annual');
  if (queryPeriodMismatch) {
    unsupportedContext.push(
      'The period in the query conflicts with the selected period; select the requested period before interpreting.',
    );
  }
  const queryExchange = findQueryExchange(request.query);
  const exchangeMismatch =
    queryExchange === 'ambiguous' ||
    (request.exchange !== undefined &&
      queryExchange !== null &&
      request.exchange !== queryExchange);
  if (exchangeMismatch) {
    unsupportedContext.push(
      'The exchange selection conflicts with the query; use one exchange consistently.',
    );
  }
  if (ambiguities.length > 0 || unsupportedContext.length > 0) {
    return {
      querySummary: request.query,
      filters: [],
      logic: 'AND',
      exchange: exchangeMismatch ? null : (request.exchange ?? queryExchange),
      assetType: 'equity',
      period: request.period,
      sort: { field: null, direction: 'desc' },
      limit: 25,
      clarificationNeeded: true,
      warnings: [
        ...ambiguities.map(
          (phrase) => `Please provide a numeric threshold for "${phrase}" before screening.`,
        ),
        ...unsupportedContext,
      ].slice(0, 5),
      executionAvailable: true,
    };
  }

  const env = getEnv();
  if (!env.AI_RESEARCH_ENABLED || !env.GEMINI_API_KEY) {
    throw new AppError(
      'AI_NOT_CONFIGURED',
      'AI screening interpretation is disabled. Configure GEMINI_API_KEY and set AI_RESEARCH_ENABLED=true.',
      503,
    );
  }

  const catalog = getScreenerMetricCatalog();
  const output = await client.generate({
    prompt: buildScreenerPrompt(request, catalog),
    systemInstruction: SCREENER_SYSTEM_INSTRUCTION,
    responseJsonSchema: screenerModelJsonSchema,
    requestId,
    intent: 'SCREENER_INTERPRETATION',
  });

  const model = parseModelResponse(output.text);
  const modelExchangeMismatch =
    (request.exchange !== undefined &&
      model.exchange !== null &&
      model.exchange !== request.exchange) ||
    (queryExchange !== null &&
      queryExchange !== 'ambiguous' &&
      model.exchange !== null &&
      model.exchange !== queryExchange);
  const filters =
    model.clarificationNeeded || modelExchangeMismatch ? [] : validateModelFilters(model, request);
  const warnings = [...model.warnings];
  if (modelExchangeMismatch) {
    warnings.push(
      'The interpreted exchange conflicts with the requested exchange; no filters were activated.',
    );
  }

  const response: ScreenerInterpretation = {
    querySummary: request.query,
    filters,
    logic: model.logic,
    exchange: modelExchangeMismatch ? null : (request.exchange ?? model.exchange),
    assetType: 'equity',
    period: request.period,
    sort: model.sort,
    limit: model.limit,
    clarificationNeeded: model.clarificationNeeded || modelExchangeMismatch,
    warnings: warnings.slice(0, 5),
    executionAvailable: true,
  };

  if (
    response.sort.field !== null &&
    response.sort.field !== 'symbol' &&
    !(response.sort.field in SCREENER_METRICS)
  ) {
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI provider returned an unsupported sort field.',
      502,
    );
  }

  logger.info(
    {
      requestId,
      filterCount: response.filters.length,
      period: response.period,
      exchange: response.exchange,
      clarificationNeeded: response.clarificationNeeded,
      model: output.model,
    },
    'ai_screener_interpreted',
  );

  return response;
}

export async function runScreener(_input: ScreenerRequest): Promise<ScreenerExecutionResponse> {
  const request = screenerRequestSchema.parse(_input);
  const result = await executeScreenerQuery(request);
  logger.info(
    {
      exchange: request.exchange,
      filterCount: request.filters.length,
      period: request.period,
      resultCount: result.results.length,
      totalMatches: result.totalMatches,
      isPartial: result.coverage.isPartial,
    },
    'ai_screener_executed',
  );
  return result;
}
