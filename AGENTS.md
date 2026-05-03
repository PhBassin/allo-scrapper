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

- Repo conventions in existing docs/templates: create an issue first, branch from `develop`, use Conventional Commits, and reference the issue in the PR.
- Expected flow for changes: issue -> branch from `develop` -> implement/verify -> open PR -> add one version label (`major`/`minor`/`patch`) if it targets `main`.
- PR template expects `Closes #<issue>` and a short list of test commands actually run.
- CI branch patterns are `feat/**`, `fix/**`, `docs/**`, `chore/**`, `ci/**`, `refactor/**`, `test/**`, `perf/**`.
- PRs merged to `main` trigger automated versioning and releases. Add exactly one version label: `major`, `minor`, or `patch`.
- For BMAD tracking in this repository, treat `done` as **already merged into `develop`**, not merely coded locally or pushed to a PR branch.
- BMAD order is strict: `DS -> CR -> GP -> WAIT`.
- After a `CR`, the mandatory next step is `GP` (Generate Plan).
- After `GP`, stop and wait for an explicit new order before any `CS`, `DS`, `push-flow`, or merge-related action.
- Do not auto-advance BMAD work just because a story reached `review` or because a PR exists; only an explicit user order unlocks the next phase.
