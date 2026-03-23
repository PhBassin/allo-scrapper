# AI Agent Instructions

This document provides instructions for AI coding agents (Claude, GitHub Copilot, Cursor, etc.) working on this project.

---

## Project Overview

**Allo-Scrapper** is a cinema showtimes aggregator that:
- Scrapes movie screening schedules from external cinema websites
- Stores data in PostgreSQL
- Exposes a REST API (Express.js + TypeScript)
- Provides a React frontend

---

## MANDATORY Workflow

**You MUST follow this workflow for every task, in order:**

```
1. ISSUE   → Verify or create a GitHub issue
2. BRANCH  → Create a dedicated feature branch from develop for this issue
3. RED     → Write failing tests first (commit before implementing)
4. GREEN   → Write minimal code to make tests pass
5. DOCS    → Update README.md / AGENTS.md if API or behaviour changed
6. COMMIT  → Atomic commits with Conventional Commits format
7. PR      → Open Pull Request referencing the issue, wait for review
             → After merge: use cleanup skill or manually switch back to develop, pull latest
```

**Conditional steps (not always required):**
- **Docker build** — run `docker compose build` before pushing if Dockerfile or dependencies changed
- **E2E tests** — Run Playwright integration tests (`npm run e2e`) when modifying frontend workflows, API interactions, or real-time features

---

## Step 1: Issue First

**CRITICAL: Every PR MUST be linked to an issue. No exceptions.**

Before writing any code:

1. **Create an issue** if none exists using the appropriate label:
   - `bug` — For bugs
   - `enhancement` — For new features
   - `documentation` — For docs/chores

```bash
# Create issue
gh issue create --title "feat: description" --body "Details..." --label enhancement
gh issue create --title "fix: description" --body "Details..." --label bug
gh issue create --title "docs: description" --body "Details..." --label documentation
```

**Note the issue number** — you will need it for the branch name, commits, and PR.

---

## Step 2: Branch

**One branch per issue. No exceptions.**

Branch naming follows conventional commit types:

```bash
git checkout develop
git pull origin develop
git checkout -b <type>/<issue-number>-<short-description>
```

### Branch Types

| Type | When to use | Version bump |
|------|-------------|--------------|
| `feat/` | New features | minor |
| `fix/` | Bug fixes | patch |
| `docs/` | Documentation only | patch |
| `chore/` | Maintenance (deps, config) | patch |
| `ci/` | CI/CD changes | patch |
| `refactor/` | Code refactoring | patch |
| `test/` | Adding/updating tests | patch |
| `perf/` | Performance improvements | patch |

**Examples:**
- `feat/259-add-cinema-modal` — new feature (minor bump)
- `fix/42-fix-parser-bug` — bug fix (patch bump)
- `docs/266-update-agents-md` — documentation (patch bump)
- `chore/100-update-deps` — dependency updates (patch bump)
- `ci/150-add-workflow` — CI/CD change (patch bump)

**Rules:**
- Always branch from `develop`, never from `main` or another feature branch
- One issue = one branch = one PR
- Branch type should match your PR title prefix
- NEVER push directly to `develop` or `main`

---

## Step 3: RED — Write Failing Tests First

**CRITICAL: Write tests BEFORE implementation.**

Write the test, run it, confirm it fails, then commit:

```bash
cd server
npm run test:run   # confirm test fails (RED)

git commit -m "test(scope): add test for <feature>"
```

### Test Commands

```bash
cd server

# Watch mode (recommended during development)
npm test

# Single run
npm run test:run

# Single file
npx vitest run src/utils/url.test.ts

# With coverage report
npm run test:coverage
```

For scraper microservice tests:

```bash
cd scraper

# Watch mode
npm test

# Single run
npm run test:run
```

### Coverage Targets

- Lines: >= 80%
- Functions: >= 80%
- Statements: >= 80%
- Branches: >= 65%

### Test File Locations

```
scraper/src/scraper/theater-parser.test.ts  # Parser tests (scraper microservice)
server/src/utils/date.test.ts               # Server utility tests
server/src/utils/url.test.ts                # URL utility tests
scraper/tests/unit/                         # Scraper unit tests
```

### Adding Test Fixtures

For scraper parser tests, use real HTML fixtures in the scraper package:

```bash
curl "https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html" \
  -o scraper/tests/fixtures/cinema-cxxxx-page.html
```

---

## Step 4: GREEN — Implement

After the failing test is committed:

1. Write **minimal code** to pass the failing tests
2. Run tests frequently: `npm test`
3. Ensure all tests pass before committing

```bash
cd server && npm run test:run   # all green
```

---

## Step 5: DOCS — Update Documentation

Before committing, update documentation if any of the following changed:

- **Public API** — new or modified endpoints → update `README.md` API section
- **Behaviour change** — changed defaults, config, env vars → update `README.md`
- **Agent workflow** — new gotchas, lessons learned, or workflow changes → update `AGENTS.md`
- **White-label / settings schema** — update `WHITE-LABEL.md`

If nothing changed for external consumers or future agents, skip this step.

---

## Step 6: Atomic Commits

**Each commit = one logical, self-contained change.**

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer: refs #123]
```

### Commit Types

| Type | Use Case |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding/updating tests |
| `chore` | Maintenance (deps, config) |
| `refactor` | Code refactoring |
| `style` | Formatting changes |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `build` | Build system changes |

### Scopes

| Scope | Area |
|-------|------|
| `scraper` | Scraping service |
| `api` | REST API |
| `db` | Database |
| `parser` | HTML parsing |
| `client` | React frontend |
| `docker` | Docker/deployment |
| `observability` | Logging, metrics, tracing |

### Commit Order

For a typical feature:

```bash
git commit -m "test(scope): add test for <feature>"       # RED — always first
git commit -m "feat(scope): implement <feature>

refs #<issue>"                                             # GREEN
git commit -m "docs: update README with <feature>"        # DOCS — if applicable
```

---

## Step 7: Pull Request

```bash
# Push branch
git push -u origin <type>/<issue-number>-<short-description>

# Create PR
gh pr create --title "feat(scope): description" --body "## Summary
- Change 1
- Change 2

Closes #<issue-number>"
```

**Before requesting review:**
- [ ] All tests pass (`npm run test:run`)
- [ ] Code coverage maintained
- [ ] Conventional Commits used
- [ ] Documentation updated (if applicable)
- [ ] Version label added (`patch`, `minor`, or `major`)
- [ ] Issue referenced in PR body

**After merge:**

Use the cleanup skill for automated post-merge cleanup:
```

---

## Automated Versioning & Releases

When PRs are merged to `main`, an automated workflow creates version tags and GitHub releases.

### Version Label System

**Add ONE of these labels to your PR** before merging to `main`:

| Label | Version Bump | Example |
|-------|-------------|---------|
| `major` | Breaking changes | 4.0.1 → 5.0.0 |
| `minor` | New features | 4.0.1 → 4.1.0 |
| `patch` | Bug fixes | 4.0.1 → 4.0.2 |

```bash
# Example: Add minor label for new feature
gh pr edit <pr-number> --add-label minor

# Or set label when creating PR
gh pr create --title "feat: new endpoint" --label minor
```

**Default Behavior**: If no label is present, defaults to `patch` bump.

### Fallback: PR Title Patterns

If no version label is found, the workflow checks PR title:

- `BREAKING CHANGE:` or `[major]` → major bump
- `feat:` or `feat(` → minor bump  
- `fix:` or `fix(` → patch bump

### What Happens Automatically

1. **On PR merge to main**:
   - Docker Build & Push workflow runs
   
2. **After successful Docker build**:
   - Version Tag workflow triggers automatically
   - Reads last git tag (e.g., `v4.0.1`)
   - Determines bump type from PR label/title
   - Calculates new version (e.g., `v4.0.2`)
   
3. **Changelog generation**:
   - Parses all commits since last tag
   - Groups by type: Added, Fixed, Changed, etc.
   - Updates `CHANGELOG.md` with new entry
   
4. **Version bump commit**:
   - Updates `package.json` version field
   - Commits changes: `chore(release): bump version to vX.Y.Z [skip ci]`
   - Creates annotated git tag `vX.Y.Z`
   - Pushes to main
   
5. **GitHub release**:
   - Creates release with generated changelog
   - Docker build triggers again for the new tag
   - Images tagged with version numbers

### Example Workflow

```bash
# Developer workflow
git checkout develop
git checkout -b feat/123-new-api

# ... make changes, tests, commits ...

gh pr create --base main --head feat/123-new-api \
  --title "feat(api): add batch operations endpoint" \
  --label minor \
  --body "Closes #123"

# After PR is reviewed and merged:
# ✅ Docker images build for main branch
# ✅ Version bumped: v4.0.1 → v4.1.0
# ✅ CHANGELOG.md updated
# ✅ Git tag v4.1.0 created
# ✅ GitHub release created
# ✅ Docker images rebuilt with tags: v4.1.0, v4.1, v4, stable, latest
```

### Important Notes

- **Only affects `main` branch** — merges to `develop` do not trigger versioning
- **Requires successful Docker build** — version tag only created if builds pass
- **Conventional commits recommended** — helps generate meaningful changelogs
- **Manual rollback if needed**:
  ```bash
  # Delete tag if something went wrong
  git tag -d v4.0.2
  git push origin :refs/tags/v4.0.2
  gh release delete v4.0.2
  ```

---

## Useful Commands

### Setup (run once after cloning)

```bash
# Install git hooks (pre-push: tsc + tests)
./scripts/install-hooks.sh

# Install dependencies (CRITICAL: run from server/ directory)
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

**⚠️ Always run `npm install` from `server/` directory, not root.** See "Native Dependencies" gotcha below.

### Development

```bash
# Start dev environment
npm run dev

# Run server tests
cd server && npm test

# Single test file
cd server && npx vitest run src/services/scraper/theater-parser.test.ts

# Check test coverage
cd server && npm run test:coverage

# Manual pre-push check (same as the hook)
cd server && npx tsc --noEmit && npm run test:run

# Run scraper microservice tests
cd scraper && npm test
```

---

## Important Reminders

1. **NEVER skip tests** — TDD is mandatory; write tests before code
2. **NEVER mix unrelated changes** in one commit
3. **ALWAYS create one branch per issue** — feature branches from `develop` only
4. **ALWAYS reference issues** in commits and PRs
5. **ALWAYS update docs** when changing public APIs
6. **NEVER push directly to `develop` or `main`** — always use a feature branch and PR

---

## Database Migration Best Practices

**CRITICAL: All database migrations must be idempotent** to avoid failures when starting fresh installations.

### The Problem

Schema drift can occur between:
- `docker/init.sql` (used for fresh database initialization)
- `migrations/*.sql` (used for incremental updates)

If both sources create the same column/table/index, migrations will fail on fresh installs.

### The Solution: Idempotent Migrations

**Always check if a schema element exists before creating it.**

#### Example: Adding a Column (Idempotent)

```sql
-- Migration: Add source column to cinemas table
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='cinemas' AND column_name='source'
    ) THEN
        ALTER TABLE cinemas ADD COLUMN source VARCHAR(50) DEFAULT 'allocine';
        RAISE NOTICE 'Column cinemas.source added successfully';
    ELSE
        RAISE NOTICE 'Column cinemas.source already exists, skipping';
    END IF;
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='cinemas' AND column_name='source'
    ) THEN
        RAISE NOTICE 'Migration successful: cinemas.source exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: cinemas.source does not exist';
    END IF;
END $$;

COMMIT;
```

#### Example: Creating a Table (Idempotent)

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
```

#### Example: Renaming a Column (Idempotent)

See `migrations/001_neutralize_references.sql` for a complete example.

### Migration Checklist

Before committing a new migration:

- [ ] Migration checks if schema element exists before modifying
- [ ] Migration includes verification step at the end
- [ ] Migration uses `BEGIN;` and `COMMIT;` for atomicity
- [ ] Migration has clear NOTICE messages for success/skip cases
- [ ] Migration tested manually on both fresh DB and existing DB

### Testing Migrations

```bash
# Test on fresh database
docker compose down -v
docker compose up -d ics-db
docker compose exec -T ics-db psql -U postgres -d ics < migrations/XXX_your_migration.sql

# Test on database with existing schema element
# (column/table already exists from init.sql or previous migration)
docker compose exec -T ics-db psql -U postgres -d ics < migrations/XXX_your_migration.sql
```

Both commands should succeed without errors.

---

## JWT Secret Security

**CRITICAL: All deployments MUST use cryptographically secure JWT secrets.**

### The Problem

Weak or default JWT secrets allow attackers to forge authentication tokens and bypass security entirely.

### Required Validation

The application **will refuse to start** if:
- `JWT_SECRET` is not set
- `JWT_SECRET` is shorter than 32 characters
- `JWT_SECRET` matches any forbidden default value

**Forbidden defaults:**
- `dev-secret-key-change-in-prod`
- `your-super-secret-key-change-this-in-production`
- `change-me`
- `secret`
- `test-secret`
- `jwt-secret`

### The Solution: Generate Secure Secrets

**Always generate a unique secret for each environment:**

```bash
# Generate a 64-character base64-encoded secret (recommended)
openssl rand -base64 64

# Alternative: 48 bytes (still secure)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**For testing environments:**
```typescript
// In test files only (e.g., server/src/routes/auth.test.ts)
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-minimum-32-chars-required-for-validation';
});
```

### Testing JWT Secret Validation

```bash
# Test validator directly
cd server
npx vitest run src/utils/jwt-secret-validator.test.ts

# Test that server refuses to start with invalid secret
JWT_SECRET="" npm run dev
# Expected: ❌ Server refuses to start with helpful error

# Test server starts with valid secret
JWT_SECRET="$(openssl rand -base64 64)" npm run dev
# Expected: ✅ Server starts successfully
```

### Security Checklist

Before deploying:
- [ ] Generated unique JWT_SECRET for this environment
- [ ] JWT_SECRET is at least 32 characters (64+ recommended)
- [ ] JWT_SECRET is NOT a default/example value
- [ ] JWT_SECRET is stored securely (not in version control)
- [ ] Different secrets used for dev/staging/production

---

## Health Check Endpoint Security

**IMPORTANT: The `/api/health` endpoint is protected against resource exhaustion attacks.**

### Security Measures

The health check endpoint implements multiple layers of protection:

1. **Rate Limiting**: 10 requests per minute per IP address
2. **Response Caching**: Health status cached for 5 seconds to reduce database load
3. **Localhost Exemption**: Internal IPs (127.0.0.1, ::1) exempt for Docker/Kubernetes probes
4. **Database Connectivity Check**: Queries database to verify full system health

### Configuration

```bash
# .env configuration
RATE_LIMIT_HEALTH_MAX=10  # Max requests per minute per IP (default: 10)
```

### Why This Matters

Without rate limiting, the health check endpoint can be abused for:
- **Database connection pool exhaustion**: Flood health checks to consume all DB connections
- **Reconnaissance**: Probe database availability and response times
- **DDoS amplification**: Use as part of larger attack

### Health Check Behavior

**Successful Response** (200 OK):
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-23T19:30:00.000Z",
  "cached": false
}
```

**Cached Response** (200 OK, within 5 seconds):
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-23T19:30:05.000Z",
  "cached": true
}
```

**Database Failure** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "timestamp": "2026-03-23T19:30:00.000Z",
  "cached": false
}
```

**Rate Limited** (429 Too Many Requests):
```json
{
  "success": false,
  "error": "Too many health check requests"
}
```

### For Monitoring Tools

**Kubernetes/Docker Health Probes:**
- Localhost requests are automatically exempted from rate limiting
- Use `/api/health` for both liveness and readiness probes
- Example probe configuration:
  ```yaml
  livenessProbe:
    httpGet:
      path: /api/health
      port: 3000
    initialDelaySeconds: 30
    periodSeconds: 10
  ```

**External Monitoring (Uptime Kuma, Datadog, etc.):**
- Rate limited to 10 req/min per IP
- Check every 60 seconds or less frequently
- Monitor for 503 status (database down) or 429 (rate limited)

### Testing

```bash
# Test health check endpoint
curl http://localhost:3000/api/health

# Test rate limiting (should get 429 after 10 requests)
for i in {1..11}; do curl http://localhost:3000/api/health; done

# Test from localhost (should never be rate limited)
for i in {1..20}; do curl http://127.0.0.1:3000/api/health; done
```

---



If unclear about requirements:
1. Check existing code patterns in the relevant directory
2. Check `server/tests/README.md` for testing specifics
3. Ask for clarification before proceeding
