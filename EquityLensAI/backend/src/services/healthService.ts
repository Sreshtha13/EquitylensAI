import { getEnv } from '../config/index.js';
import { dbClient } from '../db/index.js';
import { marketCache } from '../market/cache/memoryCache.js';
import { angelProvider } from '../market/providers/angel/index.js';
import { alertScheduler } from '../alerts/services/alertScheduler.js';
import { ingestionManager } from '../news/jobs/ingestionJob.js';

export type LivenessStatus = {
  status: 'ok';
  service: 'equitylensai-api';
  timestamp: string;
  uptimeSeconds: number;
};

export type ReadinessCheck = {
  status: 'ok' | 'degraded' | 'error';
  message: string;
};

export type ReadinessStatus = {
  ready: boolean;
  status: 'ready' | 'degraded' | 'not_ready';
  service: 'equitylensai-api';
  timestamp: string;
  checks: {
    database: ReadinessCheck;
    cache: ReadinessCheck;
    memory: ReadinessCheck;
    backgroundWorkers: ReadinessCheck;
  };
};

export type DependencyDetail = {
  configured: boolean;
  type: string;
  status: 'operational' | 'unconfigured' | 'degraded' | 'offline';
  description: string;
};

export type DependenciesStatus = {
  service: 'equitylensai-api';
  timestamp: string;
  dependencies: {
    database: DependencyDetail;
    marketDataPrimary: DependencyDetail;
    marketDataFallback: DependencyDetail;
    geminiAi: DependencyDetail;
    alertWorker: DependencyDetail;
    newsWorker: DependencyDetail;
  };
};

const serviceStartTime = Date.now();

export function getHealthStatus(): LivenessStatus {
  return {
    status: 'ok',
    service: 'equitylensai-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - serviceStartTime) / 1000),
  };
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const env = getEnv();
  const checks: ReadinessStatus['checks'] = {
    database: { status: 'ok', message: 'In-memory multi-tenant store active' },
    cache: { status: 'ok', message: 'Market memory cache operational' },
    memory: { status: 'ok', message: 'Heap usage within safe threshold' },
    backgroundWorkers: { status: 'ok', message: 'Background worker schedulers initialized' },
  };

  // 1. Database readiness check
  if (dbClient.isConfigured() && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const pingUrl = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/`;
      const res = await fetch(pingUrl, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok || res.status === 200 || res.status === 404) {
        checks.database = { status: 'ok', message: 'Supabase PostgreSQL connected' };
      } else {
        checks.database = { status: 'degraded', message: `Supabase returned HTTP ${res.status}` };
      }
    } catch {
      checks.database = {
        status: 'degraded',
        message: 'Supabase unreachable within 3s timeout; operating on local fallback',
      };
    }
  }

  // 2. Memory check
  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / (1024 * 1024);
  if (heapUsedMb > 1024) {
    checks.memory = { status: 'degraded', message: `High heap usage: ${Math.round(heapUsedMb)}MB` };
  }

  // 3. Cache check
  const cacheStats = marketCache.getStats();
  if (cacheStats.size > 50_000) {
    checks.cache = { status: 'degraded', message: `High cache entry volume: ${cacheStats.size}` };
  }

  // 4. Background workers
  const alertStatus = alertScheduler.getStatus();
  if (!alertStatus.isRunning && env.NODE_ENV === 'production') {
    checks.backgroundWorkers = { status: 'degraded', message: 'Alert scheduler is not running' };
  }

  const anyError = Object.values(checks).some((c) => c.status === 'error');
  const anyDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  return {
    ready: !anyError,
    status: anyError ? 'not_ready' : anyDegraded ? 'degraded' : 'ready',
    service: 'equitylensai-api',
    timestamp: new Date().toISOString(),
    checks,
  };
}

export async function getDependenciesStatus(): Promise<DependenciesStatus> {
  const env = getEnv();
  const alertStatus = alertScheduler.getStatus();
  const newsStatus = await ingestionManager.getStatus();

  return {
    service: 'equitylensai-api',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        type: 'Supabase PostgreSQL (PostgREST + RLS)',
        status: env.SUPABASE_URL ? 'operational' : 'unconfigured',
        description: env.SUPABASE_URL
          ? 'Cloud PostgreSQL managed via Supabase PostgREST'
          : 'Local in-memory fallback active for development/testing',
      },
      marketDataPrimary: {
        configured: angelProvider.isConfigured(),
        type: 'Angel One SmartAPI',
        status: angelProvider.isConfigured() ? 'operational' : 'unconfigured',
        description: 'Real-time Indian equity and index market quotes',
      },
      marketDataFallback: {
        configured: true,
        type: 'Yahoo Finance (Public REST)',
        status: 'operational',
        description: 'End-of-day quotes, candle charts, statements, and financial ratios',
      },
      geminiAi: {
        configured: Boolean(env.GEMINI_API_KEY && env.AI_RESEARCH_ENABLED),
        type: `Google Gemini (${env.GEMINI_MODEL})`,
        status: env.AI_RESEARCH_ENABLED ? 'operational' : 'unconfigured',
        description: 'AI-grounded company synthesis, ratio interpretation, and screening DSL',
      },
      alertWorker: {
        configured: true,
        type: 'In-process Alert Evaluation Engine',
        status: alertStatus.isRunning ? 'operational' : 'offline',
        description: `Interval: ${alertStatus.intervalMs}ms, Last Run: ${alertStatus.lastRunAt ?? 'none'}`,
      },
      newsWorker: {
        configured: true,
        type: 'Market News & Corporate Filings Ingestion',
        status: newsStatus.status === 'running' ? 'operational' : 'operational',
        description: `Last Ingestion: ${newsStatus.lastSuccessAt ?? 'none'}`,
      },
    },
  };
}
