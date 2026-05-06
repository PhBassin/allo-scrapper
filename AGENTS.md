# AGENTS.md

## Purpose

Operational guide for contributors and agents in this monorepo. Prefer BMAD workflows for planning, implementation, and review.

## Repo Map

- Workspaces: `client`, `server`, `scraper`, `packages/saas`, `packages/logger`
- Entrypoints: `client/src/main.tsx`, `server/src/index.ts`, `scraper/src/index.ts`
- `server`: API + frontend host, DB init/migrations, Redis scrape progress subscription, dynamic SaaS load when `SAAS_ENABLED=true`
- `scraper`: separate service; `RUN_MODE` env controls behavior:
  - `oneshot` (default): pop one job from Redis queue, execute, exit
  - `consumer`: long-running process that polls Redis queue continuously
  - `cron`: run scraper on a schedule via `CRON_SCHEDULE` env (no Redis)
  - `direct`: run scraper immediately once and exit (local dev / manual use)

## BMAD-First Workflow

- Start with `bmad-help` if scope is unclear
- Do not use `bmad-quick-dev` — it bypasses the required `CS -> VS -> DS -> CR -> GP -> WAIT` discipline
- Follow this required flow: `CS -> VS -> DS -> CR -> GP -> WAIT`
- `CS` = Clarify Scope (confirm objective, constraints, and impacted areas)
- `VS` = Validate Story (check story spec, assumptions, acceptance criteria against repo/docs)
- `DS` = Design Solution (propose implementation approach before changing code)
- `CR` = Change Review (self-review diff, risks, and verification coverage)
- `GP` = Git/PR Prep (stage clean changes, write conventional commit, prepare PR context)
- `WAIT` = Stop and wait for an explicit user message in the chat before starting the next cycle
- Use specialized BMAD skills only when the current step explicitly matches (PRD, architecture, test strategy, code review, etc.)
- Standard delivery flow: issue -> branch from `develop` -> implement + verify -> PR with `Closes #<issue>`
- Use Conventional Commits; if PR targets `main`, add exactly one label: `major|minor|patch`

## Commands

- Requirements: Node `>=24`, npm `>=10`
- Dev stack: `npm run dev` (starts `db`, `redis`, `server`, `client`)
- Scraper local dev: `cd scraper && npm run dev` (not started by `docker-compose.dev.yml`)
- CI-like workspace build: `npm run build --workspaces --if-present`
- Root build (narrow): `npm run build` (`server` + `client`)

## Verification

- Server unit: `cd server && npm run test:run`
- Server integration: `cd server && npm run test:integration`
- Server coverage: `cd server && npm run test:coverage`
- Client: `cd client && npm run lint && npm run test:run && npm run build`
- Scraper: `cd scraper && npm run test:run`
- SaaS: `cd packages/saas && npm run test:run`
- Logger: `cd packages/logger && npm run test:run`

## CI and Hooks

- Install hooks once: `./scripts/install-hooks.sh`
- Pre-push runs: `cd server && npx tsc --noEmit && npm run test:run`
- CI order: `npm ci --legacy-peer-deps` -> `npm run build --workspaces --if-present` -> server unit -> integration -> coverage
- Server integration tests use Testcontainers (no separate CI Redis provisioning)

## Runtime and Test Gotchas

- `playwright.config.ts` does **not** start the app. Start the stack yourself before `npm run e2e`.
- Playwright base URL defaults to `http://localhost:5173`; override with `PLAYWRIGHT_BASE_URL`.
- Scrape-heavy specs run in project `chromium-scrape-serial`.
- Explicit test selection disables that dependency chain; for one spec, `--project=chromium --no-deps` skips it.
- Vite dev proxy forwards both `/api` and `/test` to the backend.
- `/test/seed-org` and `/test/cleanup-org/:id` exist only when `NODE_ENV=test`, or when backend runs in `development` with `E2E_ENABLE_ORG_FIXTURE=true`.
- Outside those runtimes, `/test/*` is intentionally gated and returns `404`.

## Runtime Truths That Drift Easily

- Dev compose sets `AUTO_MIGRATE=true` by default unless overridden.
- After migrations, the server seeds `server/src/config/cinemas.json` when the `cinemas` table is empty.
- Dev compose sets `SAAS_ENABLED=false` and `E2E_ENABLE_ORG_FIXTURE=false` by default unless overridden.
- Do not use any old `/api/superadmin/login` assumption. Login goes through `/api/auth/login`.
- JWT gets `scope: 'superadmin'` only for system-role admins with no `org_slug`.
- CI and Docker install from the repo root; if a non-Docker local install breaks on `sharp`, reinstall from `server/`.

## Workflow Gates

- Repo flow stays issue-first: create or confirm the issue, branch from `develop`, implement/verify locally, then open a PR only when that step is explicitly requested or clearly in scope.
- Branch names should use CI-visible prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `refactor/`, `test/`, or `perf/` — not generic `feature/`.
- For BMAD-tracked work, the GitHub issue is the visible cockpit and the repo artifacts stay the execution truth: keep one active issue per story/task, then link `_bmad-output/...`, `.hermes/plans/...`, commits, and PRs back to that issue.
- BMAD issues should carry `bmad`, exactly one phase label among `phase:gp`, `phase:ds`, `phase:cr`, `phase:wait`, `phase:done`, and `type:story` when the issue maps to a BMAD story. Use `blocked` only when waiting on an external dependency or decision.
- Update the BMAD issue at each checkpoint: GP delivered, DS implemented, CR verdict returned, GP-after-CR delivered, and merge to `develop`.
- Use Conventional Commits and keep the issue linked in commits/PR text.
- PR body should include `Closes #<issue>` plus the test commands actually run.
- If a PR targets `main`, add exactly one version label: `major`, `minor`, or `patch`.
- BMAD order is strict: `DS -> CR -> GP -> WAIT`.
- After `CR`, the mandatory next step is `GP`.
- After `GP`, stop and wait for an explicit new order before any `CS`, `DS`, `push-flow`, or merge-related action.
- Do not auto-advance because a task is in review or because a PR exists.
- In this repo, `done` means **merged into `develop`**, not merely coded, pushed, or opened in PR.

## Source-of-Truth Pointers

- Commands, workspaces, engine constraints: `package.json`
- Dev topology and default dev env flags: `docker-compose.dev.yml`
- E2E runtime behavior and project dependency rules: `playwright.config.ts`
- Hook installation: `scripts/install-hooks.sh`
- Actual pre-push checks: `scripts/hooks/pre-push`
- Dev proxy for `/api` and `/test`: `client/vite.config.ts`
- Auth and superadmin scope truth: `server/src/services/auth-service.ts`
- DB init + one-time cinema bootstrap seed: `server/src/db/schema.ts`

## Gotcha: `app_settings` Row Requirement

### Problem

The homepage becomes inaccessible when the `app_settings` table exists but the required singleton row (`id = 1`) is missing. Symptoms:

- `GET /api/settings/public` returns `404`
- Frontend `SettingsProvider` sets `publicSettings = null`
- UI components crash or render without theme data

### Root Cause

Migration `004_add_app_settings.sql` creates the table and inserts the default row with `ON CONFLICT (id) DO NOTHING`. The INSERT can fail silently in edge cases (transaction rollbacks, race conditions during multi-migration runs), leaving an empty table.

### Diagnostics

```sql
-- Check if the row exists
SELECT * FROM app_settings WHERE id = 1;
```

If the query returns 0 rows, the row is missing.

### Immediate Fix

```sql
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

All columns will fall back to their `DEFAULT` values (matching the migration schema). No need to specify all 20+ columns manually.

### Prevention (Implemented)

1. **Startup guard** (`server/src/db/schema.ts`): `seedSettingsIfEmpty()` runs on every server startup, checking for and repairing the missing row.
2. **Frontend fallback** (`client/src/contexts/SettingsProvider.tsx`): `DEFAULT_PUBLIC_SETTINGS` provides sane defaults when the backend returns nothing.
3. **AGENTS.md** (this section): Documents the gotcha for future contributors.

### Verification

1. **Backend guard**: `docker compose exec -T ics-db psql -U postgres -d ics -c "DELETE FROM app_settings WHERE id = 1"` then restart — server logs should show `Seeded missing app_settings row`.
2. **Frontend fallback**: Stop the backend, load the frontend — site name should show "Allo-Scrapper" with default theme instead of crashing.

## Automated Versioning / Releases

- PRs merged to `main` feed the version/release workflow in `.github/workflows/version-tag.yml`.
- If a PR targets `main`, add exactly one version label: `major`, `minor`, or `patch`.
