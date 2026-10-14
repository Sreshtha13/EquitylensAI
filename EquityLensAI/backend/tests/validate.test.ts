import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestId } from '../src/middleware/requestId.js';
import { validate } from '../src/middleware/validate.js';
import { sendSuccess } from '../src/utils/response.js';

describe('validate middleware', () => {
  it('parses a valid body and rejects an invalid body', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestId);
    app.post(
      '/probe',
      validate({
        body: z.object({
          name: z.string().min(1),
        }),
      }),
      (req, res) => {
        sendSuccess(res, req.body);
      },
    );
    app.use(errorHandler);

    const ok = await request(app).post('/probe').send({ name: 'ok' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, data: { name: 'ok' } });

    const bad = await request(app).post('/probe').send({ name: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });
});
