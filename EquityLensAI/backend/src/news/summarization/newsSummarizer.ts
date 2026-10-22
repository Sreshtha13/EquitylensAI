import type { GroundedAiSummary } from '@equitylensai/shared';
import { GeminiClient } from '../../ai/clients/gemini.js';
import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/appError.js';

const geminiClient = new GeminiClient();

const summaryJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description:
        'Concise, objective summary strictly grounded in the provided headline and excerpt only.',
    },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key factual points extracted explicitly from the text.',
    },
    sentiment: {
      type: 'string',
      enum: ['positive', 'negative', 'neutral', 'unspecified'],
      description: 'Overall tone of the announcement or news item.',
    },
  },
  required: ['summary', 'keyPoints', 'sentiment'],
};

export class NewsSummarizer {
  async summarizeItem(params: {
    title: string;
    sourceName: string;
    publishedAt: string | null;
    contentExcerpt?: string | null | undefined;
    isAnnouncement?: boolean | undefined;
    symbol?: string | undefined;
  }): Promise<GroundedAiSummary> {
    const env = getEnv();

    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        'AI_NOT_CONFIGURED',
        'Gemini API is not configured on this server. Grounded AI summaries are currently unavailable.',
        503,
      );
    }

    const isHeadlineOnly = !params.contentExcerpt || params.contentExcerpt.trim().length === 0;

    const systemInstruction = `You are an objective financial intelligence assistant for EquityLensAI.
Analyze the following market news headline and excerpt.
CRITICAL RULES:
1. Base your summary and key points ONLY on the provided headline and excerpt.
2. DO NOT invent facts, numbers, dates, quotes, or market impact.
3. DO NOT give BUY, SELL, or HOLD investment advice or price predictions.
4. If only a headline is provided, acknowledge that only the headline was reviewed.
5. Provide a factual, concise summary (max 3 sentences) and 2-3 bullet points.`;

    const prompt = `Title: ${params.title}
Source: ${params.sourceName}
Published At: ${params.publishedAt || 'Unknown'}
Content Excerpt: ${params.contentExcerpt || '(No excerpt available, headline only)'}
Target Company / Symbol: ${params.symbol || 'General Market'}

Summarize this verified event objectively.`;

    try {
      const output = await geminiClient.generate({
        prompt,
        systemInstruction,
        responseJsonSchema: summaryJsonSchema,
        instrument: params.symbol,
        intent: 'news_grounded_summary',
      });

      const parsed = JSON.parse(output.text);

      const disclaimer = isHeadlineOnly
        ? 'AI interpretation grounded solely in the verified source headline. The full article body was not ingested or reviewed.'
        : 'AI interpretation grounded strictly in the verified source headline and excerpt provided by the publisher.';

      return {
        summary: String(parsed.summary || '').trim(),
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
        sentiment: ['positive', 'negative', 'neutral', 'unspecified'].includes(parsed.sentiment)
          ? parsed.sentiment
          : 'unspecified',
        generatedAt: new Date().toISOString(),
        model: output.model,
        isHeadlineOnly,
        disclaimer,
      };
    } catch (err: unknown) {
      logger.error({ err, params }, 'AI news summarization failed');
      if (err instanceof AppError) throw err;
      throw new AppError('AI_SUMMARIZATION_FAILED', 'Failed to generate grounded AI summary', 502);
    }
  }
}

export const newsSummarizer = new NewsSummarizer();
