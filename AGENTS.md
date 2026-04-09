# AGENTS.md

## Setup And Commands
- This repo is a single root `package.json` setup, not a workspace monorepo. Run all `npm` commands from the repo root.
- Required local setup order: `cp .env.example .env` -> `docker compose up -d` -> `npm run db:generate` -> `npm run db:migrate`.
- `server/infra/config.ts` loads `.env` eagerly and throws if `JWT_SECRET` is missing, so server code and many tests will fail before running if `.env` is not present.
- Frontend dev servers proxy `/api` to `http://localhost:3000`: `npm run dev:web` serves `web/` on `5173`, `npm run dev:admin` serves `admin/` on `5174`, and `npm run dev:server` serves the API on `3000`.
- There is no standalone typecheck script. Repo-wide verification is `npm run lint`, targeted `vitest` runs, and `npm run build`.

## Entry Points And Side Effects
- Real entrypoints are `server/app.ts`, `web/main.tsx`, and `admin/main.tsx`.
- `server/app.ts` calls `app.listen(...)` at module top level. Importing `@server/app.js` starts the HTTP server immediately.
- `createActivityController()` and `createCoachingController()` call `service.registerScheduledTasks()`. Importing the app also registers cron jobs via `server/infra/scheduler.ts`.

## Testing Gotchas
- Vitest is split into named projects: `server` runs in Node; `web-app` and `admin-app` run in jsdom.
- Use project-qualified focused test commands so frontend tests get jsdom: `npx vitest run tests/integration/user/auth.test.ts --project server`, `npx vitest run tests/integration/web-app/activity/activity-pages.test.tsx --project web-app`, `npx vitest run tests/integration/admin/admin-pages.test.tsx --project admin-app`.
- `tests/setup-jsdom.ts` polyfills `ResizeObserver` and `matchMedia` for Ant Design. Do not remove it when adjusting frontend test config.
- Playwright is configured to auto-start only `npm run dev:web`. If an E2E flow needs the real API, start `npm run dev:server` separately.
- Prisma is wired to `env("DATABASE_URL")` only. `.env.example` contains `DATABASE_URL_TEST`, but tests and fixtures create plain `PrismaClient()` instances and do not switch automatically. If you want integration/contract tests to hit the test DB on `5433`, run them with `DATABASE_URL` pointed at that database.

## Codebase Boundaries
- Backend modules are wired directly in `server/app.ts` under `/api`; keep server layering `controller -> service -> repository`.
- The dependency rule from `CLAUDE.md` matters: base modules (`user`, `venue`, `notification`) may be used by middle modules (`activity`, `coaching`), and upper modules (`match-record`, `review`) may call lower ones, not the reverse.
- Frontend code is split by app (`web/`, `admin/`) and then by feature. In `web/`, API calls belong in feature `api/` modules; components should not fetch directly.
- Root TS/Vitest aliases are `@server/*`, `@web/*`, `@admin/*`, and `@tests/*`. The `@/*` alias exists only inside `web/` and `admin/` Vite/TS configs.

## Repo-Specific Constraints
- Server lint forbids `console.log`; use `server/infra/logger.ts`.
- `CLAUDE.md` adds a non-obvious escalation rule: if a task requires changing `server/infra/`, shared types, or shared tools, stop and document the need with `gh issue comment` before making the change.
- No repo-local `.github/workflows`, Husky, or pre-commit config is present. Do not assume local hooks or CI will catch mistakes for you.
