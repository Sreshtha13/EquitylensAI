export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: unknown;
  readonly retryable?: boolean;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    options?: { cause?: unknown; details?: unknown; isOperational?: boolean; retryable?: boolean },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    if (options?.retryable !== undefined) {
      this.retryable = options.retryable;
    }
  }
}
