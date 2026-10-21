import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../config/index.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const env = getEnv();

  // Test environment bypass hook for automated test suites
  if (env.NODE_ENV === 'test') {
    const testUserId = req.headers['x-test-user-id'] as string | undefined;
    const testUserEmail = (req.headers['x-test-user-email'] as string | undefined) ?? 'test@equitylensai.com';
    if (testUserId) {
      req.user = {
        id: testUserId,
        email: testUserEmail,
      };
      return next();
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid authorization header', 401));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new AppError('UNAUTHORIZED', 'Missing authentication token', 401));
  }

  // If in test mode with mock token
  if (env.NODE_ENV === 'test' && token.startsWith('mock-token-')) {
    const userId = token.replace('mock-token-', '');
    const { userRepository } = await import('../db/userRepository.js');
    const profile = await userRepository.getProfile(userId);
    req.user = {
      id: userId,
      email: profile?.email || `${userId}@equitylensai.com`,
    };
    return next();
  }


  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (env.NODE_ENV === 'test') {
      return next(new AppError('UNAUTHORIZED', 'Invalid or expired session token', 401));
    }
    return next(
      new AppError(
        'DATABASE_NOT_CONFIGURED',
        'Authentication service is not configured on the server',
        503,
      ),
    );
  }


  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Supabase auth token verification rejected');
      return next(new AppError('UNAUTHORIZED', 'Invalid or expired session token', 401));
    }

    const userData = (await response.json()) as { id: string; email?: string; role?: string };
    if (!userData || !userData.id) {
      return next(new AppError('UNAUTHORIZED', 'Failed to retrieve user identity from token', 401));
    }

    req.user = {
      id: userData.id,
      email: userData.email ?? '',
      role: userData.role,
    };

    return next();
  } catch (error) {
    logger.error({ error }, 'Error during server-side authentication verification');
    return next(new AppError('UNAUTHORIZED', 'Authentication service unavailable or timed out', 401));
  }
}

