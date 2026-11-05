import { ingestInstruments, type IngestionMode } from './ingestion.js';
import { logger } from '../../utils/logger.js';

export interface SchedulerConfig {
  intervalHours: number;
  retryAttempts: number;
  initialBackoffMs: number;
  enabled: boolean;
}

export class SecurityUniverseScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isJobRunning = false;
  private consecutiveFailures = 0;

  private config: SchedulerConfig = {
    intervalHours: 24, // Daily synchronization
    retryAttempts: 3,
    initialBackoffMs: 5000,
    enabled: true,
  };

  constructor(customConfig?: Partial<SchedulerConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  /**
   * Starts the daily synchronization scheduler.
   */
  start(): void {
    if (this.timer) {
      logger.warn('Security universe scheduler is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Security universe daily scheduler is disabled in config');
      return;
    }

    const intervalMs = this.config.intervalHours * 3600 * 1000;
    logger.info(
      { intervalHours: this.config.intervalHours },
      'Started daily security universe synchronization scheduler',
    );

    this.timer = setInterval(() => {
      void this.executeJobWithRetry('full');
    }, intervalMs);
  }

  /**
   * Stops the daily synchronization scheduler.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped security universe synchronization scheduler');
    }
  }

  /**
   * Executes ingestion with deduplication and exponential backoff retry.
   */
  async executeJobWithRetry(mode: IngestionMode = 'full'): Promise<boolean> {
    if (this.isJobRunning) {
      logger.warn('Job deduplication: Ingestion job already in progress, skipping concurrent trigger');
      return false;
    }

    this.isJobRunning = true;
    let attempt = 0;
    let backoff = this.config.initialBackoffMs;

    while (attempt < this.config.retryAttempts) {
      attempt++;
      try {
        logger.info({ attempt, max: this.config.retryAttempts, mode }, 'Starting scheduled security universe ingestion');
        await ingestInstruments({ mode });
        this.consecutiveFailures = 0;
        this.isJobRunning = false;
        logger.info('Scheduled security universe ingestion succeeded');
        return true;
      } catch (err) {
        logger.error(
          { err, attempt, backoffMs: backoff },
          'Scheduled security universe ingestion failed; evaluating retry',
        );

        if (attempt >= this.config.retryAttempts) {
          this.consecutiveFailures++;
          this.isJobRunning = false;
          logger.error(
            { consecutiveFailures: this.consecutiveFailures },
            'Max retries reached for security universe ingestion; will retry on next cycle',
          );
          return false;
        }

        // Wait with exponential backoff before retry
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff *= 2;
      }
    }

    this.isJobRunning = false;
    return false;
  }
}

export const securityUniverseScheduler = new SecurityUniverseScheduler();
