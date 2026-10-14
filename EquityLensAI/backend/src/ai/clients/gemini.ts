import { AppError } from '../../utils/appError.js';
import type { AiClient, AiGenerateInput, AiGenerateOutput } from '../common/types.js';

export class GeminiClient implements AiClient {
  readonly id = 'gemini';

  generate(_input: AiGenerateInput): Promise<AiGenerateOutput> {
    return Promise.reject(
      new AppError('AI_NOT_IMPLEMENTED', 'Gemini integration is not implemented in Phase 1', 501),
    );
  }
}
