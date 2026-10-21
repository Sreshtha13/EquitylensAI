import { z } from 'zod';

const referenceIds = z.array(z.string().min(1).max(100)).max(12);
const qualitativeText = (maxLength = 1200) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine(
      (text) =>
        !/[\d$€£₹%]/u.test(text) &&
        !/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|percent|percentage|basis points)\b/i.test(
          text,
        ),
      'Model prose must not contain unverified numeric claims',
    )
    .refine(
      (text) => !/(https?:\/\/|www\.)/i.test(text),
      'Model-generated URLs are not trusted evidence',
    )
    .refine(
      (text) => !/\b(buy|sell|strong buy|strong sell|price target|guaranteed return)\b/i.test(text),
      'Direct investment recommendations are not supported',
    );

export const researchIntentSchema = z.enum([
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
]);

export const researchRequestSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(
        /^[A-Za-z0-9._-]+$/,
        'Symbol must contain only alphanumeric characters, dots, hyphens, or underscores',
      ),
    exchange: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    question: z.string().trim().min(10).max(800),
    comparisonInstrument: z
      .object({
        symbol: z
          .string()
          .trim()
          .min(1)
          .max(30)
          .regex(/^[A-Za-z0-9._-]+$/),
        exchange: z
          .string()
          .trim()
          .min(1)
          .max(10)
          .regex(/^[A-Za-z0-9_-]+$/)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchIntent = z.infer<typeof researchIntentSchema>;

const modelClaimSchema = z
  .object({
    text: qualitativeText(),
    evidenceIds: referenceIds,
  })
  .strict();
const sectionTitleSchema = qualitativeText(100);
const limitationSchema = qualitativeText(300);

export const researchModelResponseSchema = z
  .object({
    summary: modelClaimSchema,
    overallAssessment: z
      .object({
        label: z.enum(['POSITIVE', 'NEGATIVE', 'MIXED', 'INSUFFICIENT_DATA']),
        explanation: qualitativeText(),
        evidenceIds: referenceIds,
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            title: sectionTitleSchema,
            analysis: modelClaimSchema,
            risks: z.array(modelClaimSchema).max(5),
            limitations: z.array(limitationSchema).max(5),
          })
          .strict(),
      )
      .max(6),
    strengths: z.array(modelClaimSchema).max(8),
    riskFactors: z.array(modelClaimSchema).max(8),
    growthSignals: z.array(modelClaimSchema).max(8),
    valuationObservations: z.array(modelClaimSchema).max(8),
    financialObservations: z.array(modelClaimSchema).max(8),
  })
  .strict();

export type ResearchModelResponse = z.infer<typeof researchModelResponseSchema>;

export const researchJsonSchema = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING' },
        evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['text', 'evidenceIds'],
    },
    overallAssessment: {
      type: 'OBJECT',
      properties: {
        label: { type: 'STRING', enum: ['POSITIVE', 'NEGATIVE', 'MIXED', 'INSUFFICIENT_DATA'] },
        explanation: { type: 'STRING' },
        evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['label', 'explanation', 'evidenceIds'],
    },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          analysis: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING' },
              evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['text', 'evidenceIds'],
          },
          risks: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['text', 'evidenceIds'],
            },
          },
          limitations: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'analysis', 'risks', 'limitations'],
      },
    },
    strengths: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['text', 'evidenceIds'],
      },
    },
    riskFactors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['text', 'evidenceIds'],
      },
    },
    growthSignals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['text', 'evidenceIds'],
      },
    },
    valuationObservations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['text', 'evidenceIds'],
      },
    },
    financialObservations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['text', 'evidenceIds'],
      },
    },
  },
  required: [
    'summary',
    'overallAssessment',
    'sections',
    'strengths',
    'riskFactors',
    'growthSignals',
    'valuationObservations',
    'financialObservations',
  ],
} as const;

export const evidenceSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(['statement', 'metric', 'health_score', 'market_quote', 'market_history']),
    metric: z.string().min(1).max(100),
    value: z.union([z.number().finite(), z.string().max(100), z.null()]),
    unit: z.string().max(30).nullable(),
    period: z.string().max(50).nullable(),
    periodType: z.enum(['annual', 'quarterly', 'ttm']).optional(),
    source: z.string().min(1).max(100),
    timestamp: z.string().datetime().nullable(),
    calculationVersion: z.string().max(50).optional(),
    freshness: z
      .enum(['live', 'delayed', 'eod', 'historical', 'stale', 'periodic', 'unavailable'])
      .optional(),
    stale: z.boolean().optional(),
  })
  .strict();

export type ResearchEvidence = z.infer<typeof evidenceSchema>;

export const researchResponseSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    instrument: z
      .object({
        symbol: z.string().min(1).max(30),
        exchange: z.string().min(1).max(10),
        name: z.string().max(200).nullable(),
      })
      .strict(),
    comparisonInstrument: z
      .object({
        symbol: z.string().min(1).max(30),
        exchange: z.string().min(1).max(10),
        name: z.string().max(200).nullable(),
      })
      .strict()
      .nullable(),
    question: z.string().max(800),
    intent: researchIntentSchema,
    summary: modelClaimSchema,
    overallAssessment: z
      .object({
        label: z.enum(['POSITIVE', 'NEGATIVE', 'MIXED', 'INSUFFICIENT_DATA']),
        explanation: qualitativeText(),
        evidenceIds: referenceIds,
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            title: sectionTitleSchema,
            analysis: modelClaimSchema,
            risks: z.array(modelClaimSchema).max(5),
            limitations: z.array(limitationSchema).max(5),
          })
          .strict(),
      )
      .max(6),
    strengths: z.array(modelClaimSchema).max(8),
    riskFactors: z.array(modelClaimSchema).max(8),
    growthSignals: z.array(modelClaimSchema).max(8),
    valuationObservations: z.array(modelClaimSchema).max(8),
    financialObservations: z.array(modelClaimSchema).max(8),
    missingData: z.array(z.string().max(300)).max(20),
    evidence: z.array(evidenceSchema).max(60),
    confidence: z
      .object({
        level: z.enum(['HIGH', 'MEDIUM', 'LIMITED', 'LOW']),
        explanation: z.string().max(500),
        availableEvidence: z.number().int().nonnegative(),
        totalEvidence: z.number().int().positive(),
      })
      .strict(),
    disclaimer: z.string().max(300),
  })
  .strict();

export type ResearchResponse = z.infer<typeof researchResponseSchema>;

export function validateModelEvidenceReferences(
  output: ResearchModelResponse,
  evidenceIds: ReadonlySet<string>,
): void {
  const claims: Array<{ evidenceIds: string[] }> = [
    output.summary,
    output.overallAssessment,
    ...output.sections.flatMap((section) => [section.analysis, ...section.risks]),
    ...output.strengths,
    ...output.riskFactors,
    ...output.growthSignals,
    ...output.valuationObservations,
    ...output.financialObservations,
  ];

  for (const claim of claims) {
    if (evidenceIds.size > 0 && claim.evidenceIds.length === 0) {
      throw new Error('A model claim was returned without evidence references');
    }

    if (claim.evidenceIds.some((id) => !evidenceIds.has(id))) {
      throw new Error('The model returned an unknown evidence reference');
    }
  }
}
