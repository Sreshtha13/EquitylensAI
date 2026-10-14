import { AppError } from '../../utils/appError.js';

export function runScreener(): Promise<never> {
  return Promise.reject(
    new AppError(
      'AI_SCREENER_NOT_IMPLEMENTED',
      'Natural-language screening is not implemented in Phase 1',
      501,
    ),
  );
}
