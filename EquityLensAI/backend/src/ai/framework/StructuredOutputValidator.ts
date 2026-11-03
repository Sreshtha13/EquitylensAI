import { z } from 'zod';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export class StructuredOutputValidator {
  /**
   * Cleans and extracts raw JSON from an LLM response string.
   */
  static cleanJson(text: string): string {
    let cleaned = text.trim();
    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // Find outermost JSON object or array if extra preamble/postamble exists
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }
    }

    return cleaned;
  }

  /**
   * Safely parses JSON string with error context.
   */
  static parseJson<T = unknown>(text: string, context = 'AI response'): T {
    const cleaned = this.cleanJson(text);
    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      logger.warn({ err, sample: cleaned.slice(0, 200) }, `Failed to parse JSON for ${context}`);
      throw new AppError(
        'AI_INVALID_RESPONSE',
        `The AI provider returned malformed JSON for ${context}.`,
        502,
        { cause: err },
      );
    }
  }

  /**
   * Alias for parseJson
   */
  static extractAndParseJson<T = unknown>(text: string, context = 'AI response'): T {
    return this.parseJson<T>(text, context);
  }

  /**
   * Validates parsed JSON against a Zod schema.
   */
  static validate<T>(data: unknown, schema: z.ZodType<T>, context = 'AI response'): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      logger.warn(
        { errors: result.error.issues, context },
        `Schema validation failed for ${context}`,
      );
      throw new AppError(
        'AI_INVALID_RESPONSE',
        `The AI response failed validation for ${context}: ${result.error.issues.map((i) => i.message).join('; ')}`,
        502,
      );
    }
    return result.data;
  }
}
