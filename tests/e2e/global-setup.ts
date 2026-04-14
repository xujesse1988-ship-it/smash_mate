import { execSync } from 'child_process';
import type { FullConfig } from '@playwright/test';

/**
 * Playwright global setup: runs ONCE before all E2E tests.
 *
 * 1. Resets the E2E test database (truncate all tables)
 * 2. Pushes the Prisma schema to the E2E database (applies migrations)
 * 3. Seeds the E2E database with base data (cities, venues, admin user)
 *
 * The backend and frontend servers are started via playwright.config.ts
 * `webServer` configuration, not here. This keeps the setup simpler and
 * lets Playwright manage server lifecycle and readiness checks.
 */

const E2E_DATABASE_URL =
  'postgresql://smashmate:smashmate_test@localhost:5433/smashmate_test?schema=public';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('\n[E2E Global Setup] Starting...');

  const env = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
  };

  // Step 1: Push Prisma schema to test database (creates/syncs tables)
  // Using db push instead of migrate to avoid migration history issues in test DB
  console.log('[E2E Global Setup] Pushing Prisma schema to test database...');
  execSync(
    'npx prisma db push --schema=server/prisma/schema.prisma --force-reset --accept-data-loss',
    {
      env,
      stdio: 'pipe',
      cwd: process.cwd(),
    },
  );

  // Step 2: Seed the E2E database
  console.log('[E2E Global Setup] Seeding E2E database...');
  execSync('npx tsx tests/e2e/seed-e2e.ts', {
    env,
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[E2E Global Setup] Done.\n');
}
