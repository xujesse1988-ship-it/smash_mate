import cron from 'node-cron';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('scheduler');

interface ScheduledTask {
  name: string;
  cronExpression: string;
  task: cron.ScheduledTask;
}

const tasks: ScheduledTask[] = [];

export function registerTask(name: string, cronExpression: string, fn: () => Promise<void>): void {
  const task = cron.schedule(cronExpression, async () => {
    logger.info({ task: name }, `Running scheduled task: ${name}`);
    try {
      await fn();
      logger.info({ task: name }, `Scheduled task completed: ${name}`);
    } catch (error) {
      logger.error({ task: name, error }, `Scheduled task failed: ${name}`);
    }
  });

  tasks.push({ name, cronExpression, task });
  logger.info({ task: name, cron: cronExpression }, `Registered scheduled task: ${name}`);
}

export function stopAllTasks(): void {
  for (const { name, task } of tasks) {
    task.stop();
    logger.info({ task: name }, `Stopped scheduled task: ${name}`);
  }
}
