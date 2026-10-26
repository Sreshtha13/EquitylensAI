import { alertEvaluationService } from './alertEvaluationService.js';
import { registerShutdownTask } from '../../utils/lifecycle.js';
import { logger } from '../../utils/logger.js';
import type { EvaluationJobSummary } from '../types.js';

class AlertScheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 60_000; // 60 seconds evaluation cadence
  private isRunning = false;
  private lastSummary: EvaluationJobSummary | null = null;
  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;

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
    logger.info('AlertScheduler stopped');
  }

  async runEvaluation(): Promise<EvaluationJobSummary> {
    this.lastRunAt = new Date().toISOString();
    try {
      const summary = await alertEvaluationService.evaluateAll();
      this.lastSummary = summary;
      this.lastSuccessAt = new Date().toISOString();
      return summary;
    } catch (err) {
      logger.error({ err }, 'Alert evaluation worker error');
      throw err;
    }
  }

  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastSummary: EvaluationJobSummary | null;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastSummary: this.lastSummary,
    };
  }
}

export const alertScheduler = new AlertScheduler();
