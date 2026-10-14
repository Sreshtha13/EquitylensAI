import { AppError } from '../../utils/appError.js';

export function runResearch(): Promise<never> {
  return Promise.reject(
    new AppError('AI_RESEARCH_NOT_IMPLEMENTED', 'AI research is not implemented in Phase 1', 501),
  );
}
