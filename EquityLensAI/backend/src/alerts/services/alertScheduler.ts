import { alertEvaluationService } from './alertEvaluationService.js';
import { registerShutdownTask } from '../../utils/lifecycle.js';
import { logger } from '../../utils/logger.js';
import { metricsService } from '../../services/metricsService.js';
import type { EvaluationJobSummary } from '../types.js';

class AlertScheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 60_000;
  private isRunning = false;
  private isEvaluating = false;
  private lastSummary: EvaluationJobSummary | null = null;
  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveFailures = 0;
  private lastError: string | null = null;
  private totalEvaluations = 0;

  start(intervalMs = 60_000): void {
    if (this.isRunning) {
      return;
    }

    this.intervalMs = intervalMs;
    this.isRunning = true;
    logger.info({ intervalMs: this.intervalMs }, 'AlertScheduler started');

    registerShutdownTask('alert-scheduler', async () => {
      this.stop();
    });

    this.timer = setInterval(() => {
      void this.runEvaluation();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.isEvaluating = false;
    logger.info('AlertScheduler stopped');
  }

  async runEvaluation(): Promise<EvaluationJobSummary> {
    if (this.isEvaluating) {
      logger.warn('Previous alert evaluation still in progress; skipping duplicate run');
      if (this.lastSummary) {
        return this.lastSummary;
      }
      return {
        evaluatedCount: 0,
        triggeredCount: 0,
        skippedCount: 0,
        duplicatesPrevented: 0,
        errorsCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isEvaluating = true;
    const executionId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = Date.now();
    this.lastRunAt = new Date().toISOString();
    this.totalEvaluations += 1;

    try {
      logger.info({ executionId, intervalMs: this.intervalMs }, 'Starting scheduled alert evaluation');
      const summary = await alertEvaluationService.evaluateAll();
      const durationMs = Date.now() - startedAt;

      this.lastSummary = summary;
      this.lastSuccessAt = new Date().toISOString();
      this.consecutiveFailures = 0;
      this.lastError = null;

      metricsService.recordJobExecution('alertScheduler', true, durationMs);
      logger.info(
        {
          executionId,
          durationMs,
          evaluatedCount: summary.evaluatedCount,
          triggeredCount: summary.triggeredCount,
        },
        'Alert evaluation run completed successfully',
      );

      return summary;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      this.consecutiveFailures += 1;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errorMsg;

      metricsService.recordJobExecution('alertScheduler', false, durationMs, errorMsg);
      logger.error(
        {
          executionId,
          err,
          consecutiveFailures: this.consecutiveFailures,
          durationMs,
        },
        'Alert evaluation worker error',
      );
      throw err;
    } finally {
      this.isEvaluating = false;
    }
  }

  getStatus(): {
    isRunning: boolean;
    isEvaluating: boolean;
    intervalMs: number;
    totalEvaluations: number;
    consecutiveFailures: number;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastSummary: EvaluationJobSummary | null;
  } {
    return {
      isRunning: this.isRunning,
      isEvaluating: this.isEvaluating,
      intervalMs: this.intervalMs,
      totalEvaluations: this.totalEvaluations,
      consecutiveFailures: this.consecutiveFailures,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      lastSummary: this.lastSummary,
    };
  }
}

export const alertScheduler = new AlertScheduler();
