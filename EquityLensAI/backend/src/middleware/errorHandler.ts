import type { ApiError } from '@equitylensai/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { getEnv } from '../config/index.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

function toPublicError(error: unknown): {
  statusCode: number;
  body: ApiError;
  logLevel: 'warn' | 'error';
} {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      logLevel: error.statusCode >= 500 ? 'error' : 'warn',
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      logLevel: 'warn',
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.flatten(),
        },
      },
    };
  }

  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    return {
      statusCode: 413,
      logLevel: 'warn',
      body: {
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request body exceeds the supported size limit.',
        },
      },
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 400 &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    return {
      statusCode: 400,
      logLevel: 'warn',
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must contain valid JSON.',
        },
      },
    };
  }

  return {
    statusCode: 500,
    logLevel: 'error',
    body: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const mapped = toPublicError(error);
  const env = getEnv();

  logger[mapped.logLevel](
    {
      requestId: req.requestId,
      statusCode: mapped.statusCode,
      code: mapped.body.error.code,
      error:
        env.NODE_ENV === 'production'
          ? { message: error instanceof Error ? error.message : 'unknown' }
          : error,
    },
    'request_failed',
  );

  res.status(mapped.statusCode).json(mapped.body);
}
