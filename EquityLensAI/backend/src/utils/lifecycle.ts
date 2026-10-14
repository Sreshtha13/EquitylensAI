import { logger } from './logger.js';

type CleanupTask = {
  name: string;
  run: () => Promise<void> | void;
};

const tasks: CleanupTask[] = [];

export function registerShutdownTask(name: string, run: () => Promise<void> | void): void {
  tasks.push({ name, run });
}

export async function runShutdownTasks(): Promise<void> {
  for (const task of [...tasks].reverse()) {
    try {
      await task.run();
      logger.info({ task: task.name }, 'Shutdown task completed');
    } catch (error) {
      logger.error({ task: task.name, error }, 'Shutdown task failed');
    }
  }
}
