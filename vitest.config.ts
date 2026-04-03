import { defineConfig } from 'vitest/config';
import path from 'path';

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
    environmentMatchGlobs: [['tests/integration/web-app/**', 'jsdom']],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server'),
      '@web': path.resolve(__dirname, 'web'),
      '@admin': path.resolve(__dirname, 'admin'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
});
