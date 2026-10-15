import { Router } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { openApiSpec } from '../docs/openapi.js';

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

docsRouter.use(
  '/',
  apiReference({
    spec: {
      content: openApiSpec,
    },
    pageTitle: 'EquityLensAI API Documentation',
    theme: 'deepSpace',
    darkMode: true,
  }),
);
