import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log:
    process.env.LOG_LEVEL === 'debug'
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
});
