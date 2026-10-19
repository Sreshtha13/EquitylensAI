import { getEnv } from '../../config/index.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';
import { GeminiClient } from '../clients/gemini.js';
import type { AiClient } from '../common/types.js';
import { buildResearchContext } from './researchContextBuilder.js';
import {
  buildResearchPrompt,
  RESEARCH_PROMPT_VERSION,
  RESEARCH_SYSTEM_INSTRUCTION,
} from './researchPrompt.js';
import {
  researchIntentSchema,
  researchJsonSchema,
  researchModelResponseSchema,
  researchRequestSchema,
  researchResponseSchema,
  validateModelEvidenceReferences,
  type ResearchEvidence,
  type ResearchIntent,
  type ResearchModelResponse,
  type ResearchRequest,
  type ResearchResponse,
} from './researchSchema.js';

export { researchRequestSchema, researchResponseSchema };
export type { ResearchRequest, ResearchResponse };

export function classifyResearchIntent(question: string, hasComparison = false): ResearchIntent {
  if (hasComparison) {
    return 'COMPARISON';
  }

  const text = question.toLowerCase();
  const matches = (pattern: RegExp) => pattern.test(text);

  if (
    matches(
      /\b(history|historical|historical performance|past year|price return|stock return|share return)\b/,
    )
  ) {
    return 'HISTORICAL_PERFORMANCE';
  }
  if (matches(/\b(compare|comparison|versus|vs\.?)\b/)) {
    return 'COMPARISON';
  }
  if (
    matches(
      /\b(valuation|price.?to.?earnings|p\/?e|p\/?b|p\/?s|multiple|market cap|market price|stock price|share price)\b/,
    )
  ) {
    return 'VALUATION';
  }
  if (matches(/\b(liquidity|current ratio|quick ratio|cash ratio)\b/)) {
    return 'LIQUIDITY';
  }
  if (matches(/\b(cash flow|free cash flow|operating cash flow|capex)\b/)) {
    return 'CASH_FLOW';
  }
  if (matches(/\b(debt|leverage|interest coverage)\b/)) {
    return 'DEBT';
  }
  if (
    matches(
      /\b(profitability|profit|margin|roe|roa|roce|return on equity|return on assets|return on capital employed)\b/,
    )
  ) {
    return 'PROFITABILITY';
  }
  if (matches(/\b(growth|revenue|earnings|eps|cagr)\b/)) {
    return 'GROWTH';
  }
  if (matches(/\b(risk|risks|cash flow|health score)\b/)) {
    return 'RISK';
  }

  return researchIntentSchema.parse('GENERAL');
}

function parseModelResponse(text: string): ResearchModelResponse {
  if (Buffer.byteLength(text, 'utf8') > 20000) {
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

  const result = researchModelResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { validationIssueCount: result.error.issues.length },
      'ai_response_schema_validation_failed',
    );
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI provider returned a response that failed validation.',
      502,
    );
  }

  return result.data;
}

function buildFinalResponse(
  request: ResearchRequest,
  instrument: { symbol: string; exchange: string; name: string },
  comparisonInstrument: { symbol: string; exchange: string; name: string } | undefined,
  intent: ResearchIntent,
  model: ResearchModelResponse,
  evidence: ResearchEvidence[],
  missingData: string[],
  available: number,
  total: number,
  stale: boolean,
): ResearchResponse {
  const ids = new Set(evidence.filter((item) => item.value !== null).map((item) => item.id));
  try {
    validateModelEvidenceReferences(model, ids);
  } catch {
    logger.warn(
      {
        instrument: instrument.symbol,
        intent,
        evidenceCount: evidence.length,
      },
      'ai_evidence_reference_validation_failed',
    );
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The AI response referenced evidence that is not available.',
      502,
    );
  }

  const level =
    total > 0 && available / total >= 0.85 && !stale
      ? 'HIGH'
      : total > 0 && available / total >= 0.6 && !stale
        ? 'MEDIUM'
        : 'LIMITED';

  const result = researchResponseSchema.safeParse({
    schemaVersion: '1.0',
    instrument: {
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      name: instrument.name,
    },
    comparisonInstrument: comparisonInstrument
      ? {
          symbol: comparisonInstrument.symbol,
          exchange: comparisonInstrument.exchange,
          name: comparisonInstrument.name,
        }
      : null,
    question: request.question,
    intent,
    summary: model.summary,
    overallAssessment: model.overallAssessment,
    sections: model.sections,
    strengths: model.strengths,
    riskFactors: model.riskFactors,
    growthSignals: model.growthSignals,
    valuationObservations: model.valuationObservations,
    financialObservations: model.financialObservations,
    missingData: [...new Set(missingData)].slice(0, 20),
    evidence,
    confidence: {
      level,
      explanation: `${available} of ${total} supplied evidence observations contain a value. ${stale ? 'Some financial evidence is stale.' : 'Coverage reflects data availability, not the statistical reliability of the model.'}`,
      availableEvidence: available,
      totalEvidence: total,
    },
    disclaimer:
      'AI-generated financial research based on available platform data. Informational only; not investment advice or a guarantee of future performance.',
  });

  if (!result.success) {
    logger.error(
      { validationIssueCount: result.error.issues.length, instrument: instrument.symbol },
      'ai_final_response_validation_failed',
    );
    throw new AppError(
      'AI_INVALID_RESPONSE',
      'The research response failed final validation.',
      502,
    );
  }

  return result.data;
}

export async function runResearch(
  input: ResearchRequest,
  requestId?: string,
  client: AiClient = new GeminiClient(),
): Promise<ResearchResponse> {
  const request = researchRequestSchema.parse(input);
  const env = getEnv();
  if (!env.AI_RESEARCH_ENABLED || !env.GEMINI_API_KEY) {
    throw new AppError(
      'AI_NOT_CONFIGURED',
      'AI research is disabled. Configure GEMINI_API_KEY and set AI_RESEARCH_ENABLED=true.',
      503,
    );
  }

  const intent = classifyResearchIntent(request.question, Boolean(request.comparisonInstrument));
  const context = await buildResearchContext(request, intent);
  const prompt = buildResearchPrompt(request, intent, context);
  if (Buffer.byteLength(prompt, 'utf8') > 24_000) {
    throw new AppError(
      'AI_CONTEXT_UNAVAILABLE',
      'The evidence context exceeds the supported prompt size.',
      503,
    );
  }
  const startedAt = Date.now();
  const aiOutput = await client.generate({
    prompt,
    systemInstruction: RESEARCH_SYSTEM_INSTRUCTION,
    responseJsonSchema: researchJsonSchema,
    requestId,
    instrument: context.instrument.symbol,
    intent,
  });
  const modelOutput = parseModelResponse(aiOutput.text);
  const { available, total } = context.coverage;
  const missingData = [...context.missingData];

  if (context.analysis.latestAnnual.income.totalRevenue === null) {
    missingData.push('Revenue is not available for the latest aligned annual statement.');
  }

  const result = buildFinalResponse(
    request,
    context.instrument,
    context.comparisonInstrument,
    intent,
    modelOutput,
    context.evidence,
    missingData,
    available,
    total,
    context.coverage.stale,
  );

  logger.info(
    {
      requestId,
      symbol: context.instrument.symbol,
      exchange: context.instrument.exchange,
      intent,
      model: aiOutput.model,
      durationMs: Date.now() - startedAt,
      inputTokens: aiOutput.inputTokens,
      outputTokens: aiOutput.outputTokens,
      evidenceCount: context.evidence.length,
      promptVersion: RESEARCH_PROMPT_VERSION,
      schemaVersion: result.schemaVersion,
    },
    'ai_research_completed',
  );

  return result;
}
