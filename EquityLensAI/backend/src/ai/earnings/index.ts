import { AppError } from '../../utils/appError.js';

export function analyzeEarnings(): Promise<never> {
  return Promise.reject(
    new AppError(
      'AI_EARNINGS_NOT_IMPLEMENTED',
      'Earnings analysis is not implemented in Phase 1',
      501,
    ),
  );
}
