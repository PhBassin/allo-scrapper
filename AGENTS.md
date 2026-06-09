# AI Agent Instructions

## Project

**Allo-Scrapper** — theater showtimes aggregator. 3 npm workspaces:

| Workspace | Dir | Purpose |
|---|---|---|
| `allo-scrapper-server` | `server/` | Express.js API (TS), serves React frontend |
| `client` | `client/` | React SPA (Vite + TS) |
| `allo-scrapper-scraper` | `scraper/` | Standalone scraper microservice |

PostgreSQL (`ics-db`) + Redis (`ics-redis`) + web (`ics-web`) + scraper (`ics-scraper`) + cron (`ics-scraper-cron`).

## Mandatory Workflow

```
1. ISSUE   → gh issue create --label bug|enhancement|documentation
2. BRANCH  → git checkout develop && git pull && git checkout -b <type>/<issue>-<desc>
3. RED     → Write failing test, commit: test(scope): add test for <feature>
4. GREEN   → Minimal implementation to pass tests
5. COMMIT  → Conventional Commits: <type>(<scope>): <description>
6. PR      → gh pr create --base develop, reference issue with Closes #<num>
```

Branch types: `feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `refactor/`, `test/`, `perf/`

Commit scopes: `scraper`, `api`, `db`, `parser`, `client`, `docker`, `observability`

**Never push directly to `develop` or `main`.**

**Commits MUST be atomic** — each commit contains exactly one coherent change. Never stage unrelated files (`.fallowrc.json`, lock files, etc.) in the same commit. Use `git status` before committing to verify only intended files are staged.

## Commands

```bash
# Install (MUST be from server/, not root — root install breaks native deps)
cd server && npm install && cd ../client && npm install

# Dev (full Docker stack)
docker compose -f docker-compose.dev.yml up --build

# Build Docker image locally (for testing before pushing)
docker compose -f docker-compose.build.yml build

# Server tests
cd server
npm test                  # watch mode
npm run test:run          # single run
npm run test:coverage     # with coverage
npx vitest run src/path/to/file.test.ts   # single file
npx tsc -b                # type-check only

# Scraper tests
cd scraper && npm run test:run

# E2E tests — DO NOT run in CI or pre-push (hits upstream rate limits)
npm run e2e
```

**Pre-push hook** (`.husky/pre-push`): runs `tsc` (server + scraper), then `test:run` + `test:coverage` (server), then `test:run` (scraper). All must pass.

**Coverage thresholds** (per-file): 80% lines/functions/statements, 65% branches.

## Database Migrations

**CRITICAL: All migrations must be idempotent.** Fresh installs run `docker/init.sql` first (via PostgreSQL entrypoint mount), then the auto-migration runner applies every `.sql` file from `migrations/` in order. If a migration assumes a table/column exists but `init.sql` didn't create it, the server crashes on fresh deploy.

**Every migration must:**
- Check `IF EXISTS` / `IF NOT EXISTS` before any `ALTER`, `DROP`, or `CREATE`
- Have a verify `DO $$` block at the end that `RAISE EXCEPTION` on failure
- Use `BEGIN;` / `COMMIT;` for atomicity

**Test a migration against fresh + existing install:**
```bash
# Fresh: wipe everything, redeploy
docker compose down -v && docker compose up -d

# Existing: apply directly
docker compose exec -T ics-db psql -U postgres -d ics < migrations/XXX_your.sql
```

**Full fresh-install smoke test** (reproduces what Dockge/Coolify does):
```bash
docker compose exec -T ics-db psql -U postgres -c "CREATE DATABASE test_mig;"
docker compose exec -T ics-db psql -U postgres -d test_mig < docker/init.sql
for f in migrations/*.sql; do
  docker compose exec -T ics-db psql -U postgres -d test_mig < "$f" || break
done
```

## Gotchas

### Winston JSON drops error messages
`logger.error('msg:', errorMessage)` — Winston's `json()` formatter only captures the first argument in the `message` field. The actual error text is silently dropped. **Always use template literals:**
```typescript
logger.error(`❌ Database migration failed: ${errorMessage}`);  // correct
```

### npm install from root breaks native deps
Always `cd server && npm install`. Root `npm install` resolves workspace deps differently and breaks `sharp` / `pg` native bindings on Alpine.

### init.sql creates tables with CURRENT names
`docker/init.sql` uses `movies` (not `films`), `theaters` (not `cinemas`), `source_url` (not `allocine_url`). All migrations must handle both old and new names. Migration 023 handles renaming.

### JWT secret is validated at startup
Server refuses to start if `JWT_SECRET` is missing, < 32 chars, or matches a known default. Generate with: `openssl rand -base64 64`

### New permissions appear in UI automatically
No frontend code needed. Just add to `permissions` table via migration with `ON CONFLICT (name) DO NOTHING`. The Role Management UI loads permissions dynamically from `GET /api/roles/permissions`.

### Admin seed happens in JavaScript, not SQL
Migration 007's SQL is just a marker. The actual admin creation is in `server/src/db/migrations.ts` `handleAdminSeed()` — it calls `hashPassword()` (scrypt) and inserts the user. If this fails, the crash message was historically invisible (see Winston gotcha above).

### Docker images
- Production deploy: `ghcr.io/phbassin/allo-scrapper:stable` (pre-built)
- Local build: `docker compose -f docker-compose.build.yml build` (builds from source)
- Images auto-built on PR merge to `main`; `develop` merges do NOT trigger builds
