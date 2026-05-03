# AGENTS.md

## Purpose

Operational guide for contributors and agents in this monorepo. Prefer BMAD workflows for planning, implementation, and review.

## Repo Map

- Workspaces: `client`, `server`, `scraper`, `packages/saas`, `packages/logger`
- Entrypoints: `client/src/main.tsx`, `server/src/index.ts`, `scraper/src/index.ts`
- `server`: API + frontend host, DB init/migrations, Redis scrape progress subscription, dynamic SaaS load when `SAAS_ENABLED=true`
- `scraper`: separate service with `RUN_MODE` = `oneshot|consumer|cron|direct`

## BMAD-First Workflow

- Start with `bmad-help` if scope is unclear
- Do not use `bmad-quick-dev`
- Follow this required flow: `CS -> VS -> DS -> CR -> GP -> WAIT`
- `CS` = Clarify Scope (confirm objective, constraints, and impacted areas)
- `VS` = Validate Scope (check assumptions against repo/docs and acceptance criteria)
- `DS` = Design Solution (propose implementation approach before changing code)
- `CR` = Change Review (self-review diff, risks, and verification coverage)
- `GP` = Git/PR Prep (stage clean changes, write conventional commit, prepare PR context)
- `WAIT` = Stop for user direction before starting the next cycle
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

## CI and Hooks

- Install hooks once: `./scripts/install-hooks.sh`
- Pre-push runs: `cd server && npx tsc --noEmit && npm run test:run`
- CI order: `npm ci --legacy-peer-deps` -> `npm run build --workspaces --if-present` -> server unit -> integration -> coverage
- Server integration tests use Testcontainers (no separate CI Redis provisioning)

## Runtime and Test Gotchas

- `AUTO_MIGRATE=true` by default; server applies pending migrations on startup
- After migrations, server seeds `server/src/config/cinemas.json` if the `cinemas` table is empty
- `playwright.config.ts` does not start app; run app before `npm run e2e`
- Playwright base URL defaults to `http://localhost:5173` (`PLAYWRIGHT_BASE_URL` to override)
- `/test/seed-org` and `/test/cleanup-org/:id` only exist in `NODE_ENV=test` or dev with `E2E_ENABLE_ORG_FIXTURE=true`; otherwise `/test/*` returns `404`

## Current Source of Truth

- Superadmin login is via `/api/auth/login` (not `/api/superadmin/login`)
- `server/src/services/auth-service.ts` adds `scope: 'superadmin'` for system-role admins
- Vite proxies both `/api` and `/test` in local dev
