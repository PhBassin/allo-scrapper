# AGENTS.md

## Repo Shape

- npm workspaces: `client`, `server`, `scraper`, `packages/saas`, `packages/logger`.
- Real entrypoints: `client/src/main.tsx`, `server/src/index.ts`, `scraper/src/index.ts`.
- `server` is the API/frontend host. It always initializes the DB, subscribes to Redis scrape progress, and loads `@allo-scrapper/saas` dynamically when `SAAS_ENABLED=true`.
- `scraper` is a separate service. `RUN_MODE` supports `oneshot`, `consumer`, `cron`, and `direct`; production compose runs separate `consumer` and `cron` containers.

## Commands That Matter

- Node/tooling: repo requires Node `>=24` and npm `>=10`.
- Root `npm run dev` uses `docker-compose.dev.yml`. It starts `db`, `redis`, `server`, and `client` only.
- `docker-compose.dev.yml` does **not** start the scraper worker. For end-to-end scraping in local dev, run `cd scraper && npm run dev` separately.
- Full CI-like workspace build/typecheck: `npm run build --workspaces --if-present`.
- Root `npm run build` is narrower: it builds only `server` and `client`.
- There is no root lint/typecheck script. Only `client` has `npm run lint`.

## Focused Verification

- Server unit tests: `cd server && npm run test:run`
- Server Redis integration tests: `cd server && npm run test:integration`
- Server coverage: `cd server && npm run test:coverage`
- Client: `cd client && npm run lint && npm run test:run && npm run build`
- Scraper: `cd scraper && npm run test:run`
- SaaS package: `cd packages/saas && npm run test:run`

## CI And Hooks

- Install hooks once with `./scripts/install-hooks.sh`.
- The pre-push hook runs only `cd server && npx tsc --noEmit && npm run test:run`.
- CI runs, in order: `npm ci --legacy-peer-deps`, `npm run build --workspaces --if-present`, `cd server && npm run test:run`, `cd server && npm run test:integration`, `cd server && npm run test:coverage`.
- `server` integration tests rely on Testcontainers; CI does not provision Redis separately for them.

## Testing Quirks

- `playwright.config.ts` does not start a web server. Start the app yourself before `npm run e2e`.
- Playwright defaults to `http://localhost:3000`; override with `PLAYWRIGHT_BASE_URL`.
- Scrape-heavy Playwright specs run in a dedicated serial project. For a single spec, `--project=chromium --no-deps` skips that dependency chain.
- SaaS fixture endpoints `/test/seed-org` and `/test/cleanup-org/:id` exist only when `NODE_ENV=test`, or when the backend runs in `development` with `E2E_ENABLE_ORG_FIXTURE=true`. Outside that runtime, `/test/*` intentionally returns `404`.

## Runtime Gotchas

- `AUTO_MIGRATE` defaults to true. Server startup runs pending migrations automatically.
- After migrations, the server seeds `server/src/config/cinemas.json` if the `cinemas` table is empty.
- CI and Docker install dependencies from the repo root. If a local non-Docker install breaks on `sharp`, reinstall from `server/`.

## Workflow Conventions

- Repo conventions in existing docs/templates: create an issue first, branch from `develop`, use Conventional Commits, and reference the issue in the PR.
- Expected flow for changes: issue -> branch from `develop` -> implement/verify -> open PR -> add one version label (`major`/`minor`/`patch`) if it targets `main`.
- PR template expects `Closes #<issue>` and a short list of test commands actually run.
- CI branch patterns are `feat/**`, `fix/**`, `docs/**`, `chore/**`, `ci/**`, `refactor/**`, `test/**`, `perf/**`.
- PRs merged to `main` trigger automated versioning and releases. Add exactly one version label: `major`, `minor`, or `patch`.

## Current Behavior Worth Trusting Over Older Docs

- Do not use the removed `/api/superadmin/login` flow. System admins authenticate through `/api/auth/login`; `server/src/services/auth-service.ts` adds `scope: 'superadmin'` automatically for system-role admins.
- Vite proxies both `/api` and `/test` to the backend in local dev.
