import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from './logger.js';

const prismaLogger = createModuleLogger('prisma');

export const prisma = new PrismaClient({
  log:
    process.env.LOG_LEVEL === 'debug'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
});

prisma.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
  prismaLogger.debug({ query: e.query, params: e.params, duration: e.duration }, 'prisma query');
});

prisma.$on('info' as never, (e: { message: string }) => {
  prismaLogger.info(e.message);
});

prisma.$on('warn' as never, (e: { message: string }) => {
  prismaLogger.warn(e.message);
});

prisma.$on('error' as never, (e: { message: string }) => {
  prismaLogger.error(e.message);
});
