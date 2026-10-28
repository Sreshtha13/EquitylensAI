import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { notFoundHandler } from '../src/middleware/notFoundHandler.js';
import { requestId } from '../src/middleware/requestId.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { AppError } from '../src/utils/appError.js';

describe('error handling', () => {
  it('maps AppError to the public error envelope', async () => {
    const app = express();
    app.use(requestId);
    app.get('/boom', () => {
      throw new AppError('VALIDATION_ERROR', 'Invalid request', 400);
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        requestId: expect.any(String),
        retryable: false,
      },
    });
    expect(response.body.error.stack).toBeUndefined();
  });

  it('maps unknown errors to an internal error without leaking details', async () => {
    const app = express();
    app.use(requestId);
    app.get('/secret', () => {
      throw new Error('super secret internals');
    });
    app.use(errorHandler);

    const response = await request(app).get('/secret');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId: expect.any(String),
        retryable: true,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('super secret internals');
  });

  it('returns not found for unmatched routes', async () => {
    const app = express();
    app.use(requestId);
    app.use(asyncHandler(notFoundHandler));
    app.use(errorHandler);

    const response = await request(app).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
