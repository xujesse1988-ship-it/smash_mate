# E2E Tests

End-to-end tests for SmashMate using Playwright (Chromium).

## Prerequisites

- Docker running with `docker compose up -d` (PostgreSQL dev + test databases)
- Node.js dependencies installed (`npm install`)
- Prisma client generated (`npm run db:generate`)

## How to run

```bash
# Run all E2E tests (auto-starts servers, resets + seeds test DB)
npm run test:e2e

# Run with Playwright UI for debugging
npm run test:e2e:ui

# Seed the E2E database manually (without running tests)
npm run test:e2e:setup
```

## What happens automatically

When you run `npm run test:e2e`, Playwright handles everything:

1. **Global setup** (`global-setup.ts`):
   - Resets the test database (port 5433) via `prisma db push --force-reset`
   - Seeds base data: 1 city (Beijing), 3 venues, 1 admin user

2. **Server startup** (via `webServer` config):
   - Backend (`npm run dev:server`) on port 3000, pointed at the test DB
   - Frontend SPA (`npm run dev:web`) on port 5173
   - Admin app (`npm run dev:admin`) on port 5174

3. **Test execution**: all `*.e2e.ts` files in this directory

4. **Global teardown** (`global-teardown.ts`): cleanup hook

5. **Server shutdown**: Playwright stops all servers automatically

## Seed data

The E2E seed (`seed-e2e.ts`) creates minimal base data:

| Type  | Data                              |
|-------|-----------------------------------|
| City  | Beijing                           |
| Venue | Chaoyang Badminton Gym (39.93, 116.46)  |
| Venue | Haidian Sports Center (39.99, 116.31)   |
| Venue | Fengtai Badminton Gym (39.86, 116.29)   |
| Admin | Phone 13900000000, nickname "管理员" |

Regular users are registered by each test through the UI using `DEV_VERIFICATION_CODE=123456`.

## Environment

The backend server for E2E uses these env vars (set in `playwright.config.ts`):

- `DATABASE_URL` = test database on port 5433
- `DEV_VERIFICATION_CODE` = "123456"
- `ADMIN_PHONES` = "13900000000,13800000001"
- `LOG_LEVEL` = "warn"
- `JWT_SECRET` = "e2e-test-secret"

## Debugging failing tests

1. Run with `--ui` flag: `npm run test:e2e:ui`
2. Run a single test file: `npx playwright test tests/e2e/auth.e2e.ts`
3. View trace for failed tests: `npx playwright show-trace test-results/.../trace.zip`
4. View the HTML report: `npx playwright show-report`
5. Add `await page.pause()` in a test to open the Playwright inspector
