import { getEnv } from '../config/index.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import type { DatabaseClient, DatabaseStatus } from './types.js';

class SupabaseBoundaryClient implements DatabaseClient {
  private status: DatabaseStatus = 'unconfigured';

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  }

  getStatus(): DatabaseStatus {
    return this.status;
  }

  async connect(): Promise<void> {
    if (!this.isConfigured()) {
      this.status = 'unconfigured';
      throw new AppError('DATABASE_NOT_CONFIGURED', 'Database credentials are not configured', 503);
    }

    this.status = 'ready';
    logger.info('Database configuration is present; client wiring belongs in a later phase');
  }

  async disconnect(): Promise<void> {
    this.status = 'unconfigured';
  }
}

export const dbClient: DatabaseClient = new SupabaseBoundaryClient();
