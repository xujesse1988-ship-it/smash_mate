import type { FullConfig } from '@playwright/test';

/**
 * Playwright global teardown: runs ONCE after all E2E tests.
 *
 * The backend and frontend servers are stopped automatically by
 * Playwright's webServer configuration, so there is nothing to
 * clean up here. This file exists as a hook for future needs
 * (e.g., uploading test artifacts, cleaning temp files).
 */

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log('\n[E2E Global Teardown] Cleanup complete.\n');
}
