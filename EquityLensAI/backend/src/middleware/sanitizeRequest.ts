import type { NextFunction, Request, Response } from 'express';
import { sanitizePlainObject } from '../utils/sanitize.js';

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  req.body = sanitizePlainObject(req.body);
  req.query = sanitizePlainObject(req.query) as Request['query'];
  req.params = sanitizePlainObject(req.params) as Request['params'];
  next();
}
