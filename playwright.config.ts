import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration for SmashMate.
 *
 * - globalSetup resets + seeds the test database before each run
 * - webServer starts the backend (on test DB), frontend SPA, and admin app
 * - globalTeardown runs cleanup after all tests
 */

const E2E_DATABASE_URL =
  'postgresql://smashmate:smashmate_test@localhost:5433/smashmate_test?schema=public';

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `DATABASE_URL="${E2E_DATABASE_URL}" DEV_VERIFICATION_CODE="123456" ADMIN_PHONES="13900000000,13800000001" LOG_LEVEL="warn" JWT_SECRET="e2e-test-secret" npm run dev:server`,
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev:admin',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
