import { loadEnv } from './config/index.js';
import { createApp } from './app.js';
import { dbClient } from './db/index.js';
import { logger } from './utils/logger.js';
import { registerShutdownTask, runShutdownTasks } from './utils/lifecycle.js';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      frontendUrl: env.FRONTEND_URL,
    },
    'EquityLensAI API listening',
  );
});

registerShutdownTask('http-server', () => {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

registerShutdownTask('database', () => dbClient.disconnect());

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  try {
    await runShutdownTasks();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Graceful shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  void shutdown('uncaughtException');
});
