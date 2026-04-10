import { defineConfig } from 'vitest/config';
import path from 'path';

const sharedResolve = {
  alias: {
    '@server': path.resolve(__dirname, 'server'),
    '@web': path.resolve(__dirname, 'web'),
    '@admin': path.resolve(__dirname, 'admin'),
    '@tests': path.resolve(__dirname, 'tests'),
  },
};

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
    projects: [
      {
        test: {
          name: 'web-app',
          globals: true,
          environment: 'jsdom',
          include: [
            'tests/contracts/web-app/**/*.test.{ts,tsx}',
            'tests/integration/web-app/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['tests/setup-jsdom.ts'],
        },
        resolve: sharedResolve,
      },
      {
        test: {
          name: 'admin-app',
          globals: true,
          environment: 'jsdom',
          include: [
            'tests/contracts/admin/**/*.test.{ts,tsx}',
            'tests/integration/admin/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['tests/setup-jsdom.ts'],
        },
        resolve: sharedResolve,
      },
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          fileParallelism: false,
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: [
            'tests/e2e/**',
            'tests/contracts/web-app/**',
            'tests/contracts/admin/**',
            'tests/integration/web-app/**',
            'tests/integration/admin/**',
          ],
        },
        resolve: sharedResolve,
      },
    ],
  },
  resolve: sharedResolve,
});
