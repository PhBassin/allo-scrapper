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
- **E2E tests** — Playwright infrastructure exists (`e2e/`) but E2E tests are currently out of scope

---

## Step 1: Issue First

**CRITICAL: Every PR MUST be linked to an issue. No exceptions.**

Before writing any code:

1. **Search for existing issues** related to the task
2. **Create an issue** if none exists using the appropriate label:
   - `bug` — For bugs
   - `enhancement` — For new features
   - `documentation` — For docs/chores

```bash
# Search issues
gh issue list --state open
gh issue list --state all --search "keyword"
gh issue view <number>

# Create issue
gh issue create --title "feat: description" --body "Details..." --label enhancement
gh issue create --title "fix: description" --body "Details..." --label bug
gh issue create --title "docs: description" --body "Details..." --label documentation
```

**Note the issue number** — you will need it for the branch name, commits, and PR.

---

## Step 2: Branch

**One branch per issue. No exceptions.**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<issue-number>-<short-description>
```

**Examples:**
- `feature/259-add-cinema-modal`
- `feature/42-fix-parser-bug`
- `feature/266-optimize-agents-md`

**Rules:**
- Always branch from `develop`, never from `main` or another feature branch
- One issue = one branch = one PR
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
npx vitest run src/services/scraper/theater-parser.test.ts

# With coverage report
npm run test:coverage
```

### Coverage Targets

- Lines: >= 80%
- Functions: >= 80%
- Statements: >= 80%
- Branches: >= 65%

### Test File Locations

```
server/src/services/scraper/theater-parser.test.ts  # Parser tests
server/src/utils/date.test.ts                       # Utility tests
server/tests/fixtures/                              # HTML fixtures
```

### Adding Test Fixtures

For scraper tests, use real HTML fixtures:

```bash
curl "https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html" \
  -o server/tests/fixtures/cinema-cxxxx-page.html
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
git push -u origin feature/<issue-number>-<short-description>

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
- [ ] Issue referenced in PR body

**After merge:**

Use the cleanup skill for automated post-merge cleanup:
```
Load the cleanup skill and help me clean up my merged branch
```

This will:
- ✅ Verify branch is merged
- ✅ Stash uncommitted changes (if any)
- ✅ Switch to develop and pull latest
- ✅ Update dependencies (if package-lock.json changed)
- ✅ Delete the local feature branch
- ✅ Offer to clean up other merged branches

**Manual alternative:**
```bash
git checkout develop
git pull origin develop
git branch -d feature/<issue-number>-<short-description>
```

---

## Project Structure

```
allo-scrapper/
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── config/             # Configuration (cinemas.json)
│   │   ├── db/                 # Database queries and schema
│   │   ├── routes/             # API route handlers
│   │   ├── services/
│   │   │   ├── scraper/        # In-process scraping logic
│   │   │   │   ├── index.ts            # Orchestrator
│   │   │   │   ├── theater-parser.ts   # HTML parsing
│   │   │   │   └── http-client.ts      # HTTP requests
│   │   │   ├── redis-client.ts         # Redis job publisher
│   │   │   ├── scrape-manager.ts       # Scrape session management
│   │   │   └── progress-tracker.ts     # SSE event system
│   │   ├── middleware/         # Auth, admin, rate-limit middleware
│   │   ├── types/              # TypeScript definitions
│   │   └── utils/
│   │       ├── logger.ts       # Winston structured logger (service=ics-web)
│   │       └── date.ts         # Date utilities
│   └── tests/
│       └── fixtures/           # Test HTML files
├── scraper/                    # Standalone scraper microservice
│   ├── src/
│   │   ├── db/                 # Direct DB access (same schema)
│   │   ├── redis/              # RedisJobConsumer + RedisProgressPublisher
│   │   ├── scraper/            # Scraping logic (mirrors server/services/scraper)
│   │   └── utils/
│   │       ├── logger.ts       # Winston logger (service=ics-scraper)
│   │       ├── metrics.ts      # prom-client metrics (port 9091)
│   │       └── tracer.ts       # OpenTelemetry OTLP tracer
│   └── tests/unit/
├── client/                     # React frontend
├── docker/                     # Docker/monitoring configuration
│   ├── grafana/
│   │   ├── datasources/        # Auto-provisioned datasources
│   │   └── dashboards/         # Auto-provisioned dashboards
│   ├── loki-config.yml
│   ├── promtail-config.yml
│   ├── prometheus.yml
│   └── tempo.yml
├── e2e/                        # Playwright E2E tests (out of scope for now)
├── .github/                    # GitHub config (issues, workflows)
├── WHITE-LABEL.md              # White-label branding system docs
├── MONITORING.md               # Observability stack documentation
├── CONTRIBUTING.md             # Human contributor guide
└── AGENTS.md                   # This file
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

### Docker

```bash
docker compose build                                          # Build all images
docker compose up -d                                         # Base stack (app + DB + Redis)
docker compose --profile scraper up -d                       # With scraper microservice
docker compose --profile monitoring up -d                    # With Prometheus/Grafana/Loki/Tempo
docker compose --profile monitoring --profile scraper up -d  # Everything
```

### Git

```bash
git status
git log --oneline -10
git checkout -b feature/<issue-number>-<short-desc> develop
```

### GitHub CLI

```bash
gh issue list
gh issue view 42
gh issue create
gh pr create
gh pr checks
```

---

## Common Patterns

### Adding a New Cinema

Use the admin UI at `/admin/cinemas`. It handles scraping and DB persistence automatically.

If scripting via API:
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"}'
```

No file commit is needed — Postgres is the source of truth. `cinemas.json` is only a one-time bootstrap seed and is never written to by the application.

For parser changes, write tests first (see Step 3).

### Fixing a Parser Bug

1. Fetch HTML fixture: `curl "..." -o server/tests/fixtures/cinema-cxxxx-page.html`
2. Write failing test reproducing the bug
3. Fix the parser
4. Verify test passes
5. Commit: `fix(parser): <description>`

### Adding an API Endpoint

1. Write test for expected behavior
2. Add route handler
3. Update README.md API section
4. Commit: `test(api): ...` then `feat(api): add <endpoint>`

---

## White-Label System

The white-label branding system supports full customization via an admin panel and REST API.

**Key files:**
- `server/src/db/settings-queries.ts` — Settings CRUD
- `server/src/db/user-queries.ts` — User management
- `server/src/routes/settings.ts` — Settings API (`/api/settings/*`)
- `server/src/routes/users.ts` — Users API (`/api/users/*`)
- `server/src/services/theme-generator.ts` — Dynamic CSS (`/api/theme.css`)
- `client/src/pages/admin/SettingsPage.tsx` — Admin UI
- `client/src/contexts/SettingsContext.tsx` — Frontend state

See [WHITE-LABEL.md](./WHITE-LABEL.md) for full documentation, schema change instructions, and troubleshooting.

---

## Gotchas / Lessons Learned

Hard-won discoveries from previous sessions. Read before starting any task.

### CodeQL: Rate-Limiting False Positives

CodeQL raises `js/missing-rate-limiting` alerts on mutation routes even when `express-rate-limit` middleware is correctly applied via imported named exports. CodeQL cannot trace the middleware through the import chain.

**Action:** Dismiss these alerts via GitHub API with reason `"false positive"` after each push that shifts line numbers:
```bash
gh api repos/PhBassin/allo-scrapper/code-scanning/alerts/<id> \
  -X PATCH -f state=dismissed -f dismissed_reason="false positive" \
  -f dismissed_comment="Rate limiting applied via protectedLimiter middleware"
```

### CodeQL: SSRF (`js/request-forgery`)

CodeQL flags HTTP requests built with string concatenation as SSRF-vulnerable.

**Fix:** Use `new URL(path, base)` to construct URLs, then validate the hostname *after* construction. CodeQL must see the hostname check after the `new URL()` call to recognize it as safe.

### `DELETE` Routes Return 204 — No Body

`DELETE /api/cinemas/:id` returns `204 No Content`. Do NOT access `.data` on the response.

```typescript
// WRONG — throws on 204
const result = await apiClient.delete(`/cinemas/${id}`);
console.log(result.data); // undefined / error

// CORRECT
await apiClient.delete(`/cinemas/${id}`);
```

### Modal Stale State — Use `key` to Force Remount

When reusing a modal component for different items (e.g. editing different cinemas), stale state persists across renders. Fix by setting `key` to the item's ID on the parent to force a full remount:

```tsx
<EditCinemaModal key={selectedCinema.id} cinema={selectedCinema} />
```

### Zero Values — Use `!= null` Not `||`

Avoid `||` for optional numeric fields — it treats `0` as falsy and substitutes the default:

```typescript
// WRONG — shows dash for 0 screens
const count = cinema.screen_count || '—';

// CORRECT
const count = cinema.screen_count != null ? cinema.screen_count : '—';
```

### Name Validation — Always `.trim()`

Reject whitespace-only strings explicitly:

```typescript
if (!name.trim()) throw new Error('Name is required');
```

### Frontend `Cinema` Type — Include `url`

The `Cinema` interface in `client/src/types/index.ts` must include `url?: string`. It's easy to miss when the backend adds fields — keep the frontend type in sync.

### Pre-Push Hook

A git pre-push hook runs `tsc --noEmit` + `vitest run` before every push. Fix all TypeScript errors and test failures before pushing — the hook will block the push otherwise.

### Native Dependencies — `sharp` Package

The `sharp` package is a native binary dependency used for image validation and compression in the white-label branding system (`server/src/utils/image-validator.ts`). It requires platform-specific binaries during installation.

**Problem:** Tests fail with `Error: Cannot find package 'sharp'` if:
- `npm install` was run from the wrong directory (root instead of `server/`)
- Installation was interrupted mid-process
- `node_modules/` was deleted or corrupted

**Affected files:**
- `server/src/routes/settings.ts` — imports `image-validator.ts`
- `server/src/utils/image-validator.ts` — direct import
- `server/src/utils/image-validator.test.ts` — test file

**Solution:** Always run `npm install` from the `server/` directory:

```bash
cd server && npm install
```

If tests still fail after `npm install`:

```bash
cd server
rm -rf node_modules
npm install
```

**Why this happens:** `sharp` downloads native binaries during postinstall scripts. Running `npm install` from the root directory or interrupting the installation can result in incomplete or missing binaries, even though `package.json` and `package-lock.json` are correct.

### CORS LAN Access — Update `ALLOWED_ORIGINS` for Network Access

When accessing the app from another machine on your LAN (e.g., `http://192.168.1.100:3000`), browsers send that IP as the origin, which must be explicitly allowed in CORS configuration.

**Symptom:** Error in logs:
```
Error: CORS blocked request from origin 'http://192.168.1.100:3000'. 
Add this origin to ALLOWED_ORIGINS in your .env file. 
Current ALLOWED_ORIGINS: http://localhost:3000,http://localhost:5173
```

**Fix:** Add the LAN IP to `ALLOWED_ORIGINS` in `.env`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.100:3000
```

Then restart the server:
```bash
docker compose restart web
```

**Important:**
- Each unique origin (protocol + hostname + port) must be listed explicitly
- Don't use wildcards (`*`) in production — security risk
- The error message now shows both the blocked origin and current allowed origins for easier debugging
- See `docs/guides/deployment/networking.md` for comprehensive CORS documentation

---

## Important Reminders

1. **NEVER skip tests** — TDD is mandatory; write tests before code
2. **NEVER mix unrelated changes** in one commit
3. **ALWAYS create one branch per issue** — feature branches from `develop` only
4. **ALWAYS reference issues** in commits and PRs
5. **ALWAYS update docs** when changing public APIs
6. **NEVER push directly to `develop` or `main`** — always use a feature branch and PR

---

## Custom OpenCode Agents

This project includes specialized OpenCode agents to assist with specific tasks.

### docs-writer Agent

**Purpose:** Maintains and writes project documentation following the Divio documentation system.

**Location:** `.opencode/agents/docs-writer.md`

**Capabilities:**
- Creates and updates documentation in `docs/` and root markdown files
- Follows Divio principles (tutorials, guides, reference, troubleshooting)
- Validates markdown syntax using markdownlint
- Checks for broken links automatically
- Verifies code examples against current codebase
- Can research external references (official docs)
- Delegates to explore agent for code understanding

**Usage:**

Direct invocation:
```
@docs-writer Update the API documentation for /api/cinemas endpoint
```

Automatic delegation (when asking about documentation):
```
Can you update the troubleshooting guide for Docker networking?
```

**Configuration:**
- **Mode**: Subagent (invokable, not primary)
- **Temperature**: 0.2 (precise and consistent)
- **Tools**: Full file access, webfetch, task delegation, bash validation
- **Permissions**: 
  - Bash commands require approval (except validation tools)
  - External fetches require approval
  - Can delegate to explore agent automatically

**Best Practices:**
- Use for all documentation updates and creation
- Let it validate links and syntax automatically
- Provide context about feature changes when updating docs
- Trust its adherence to Divio system and project style

### cleanup Skill

**Purpose:** Automates the post-PR merge cleanup workflow with safety checks and dependency updates.

**Location:** `.opencode/skills/cleanup/SKILL.md`

**Capabilities:**
- Verifies branch is merged to develop before deletion
- Safely stashes uncommitted changes with descriptive messages
- Switches to develop and pulls latest changes
- Automatically runs `npm install` if package-lock.json changed
- Deletes local feature branch (uses safe `-d` flag)
- Offers batch cleanup of other merged branches
- Provides clear summaries instead of verbose git output

**Usage:**

After your PR is merged, ask OpenCode to load and use the cleanup skill:
```
Load the cleanup skill and help me clean up my merged branch
```

Or be more specific:
```
My PR was just merged. Use the cleanup skill to switch to develop and clean up the feature branch.
```

The skill will guide you through the cleanup process with clear prompts and confirmations.

**Example output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Post-Merge Cleanup Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Current branch: develop
🔄 Pulled 5 new commits from origin/develop
📦 Dependencies updated (npm install ran)
🗑️  Deleted local branch: feature/324-improve-json-parse-cache

ℹ️  Remote branch still exists: origin/feature/324-improve-json-parse-cache
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Configuration:**
- **Type**: OpenCode Skill (loaded via skill tool)
- **Category**: git workflow
- **License**: MIT
- **Audience**: developers

**Safety Features:**
- Never force-deletes unmerged branches (uses `git branch -d`)
- Verifies branch is in `git branch --merged develop` before deletion
- Stashes uncommitted changes instead of losing them
- Prevents cleanup from develop/main branches
- Gracefully handles errors with actionable guidance

**Best Practices:**
- Use immediately after PR merge confirmation
- Let it handle dependency updates automatically
- Review the summary to confirm everything succeeded
- Use batch cleanup option to remove old merged branches periodically

---

## Questions?

If unclear about requirements:
1. Check existing code patterns in the relevant directory
2. Check `server/tests/README.md` for testing specifics
3. Ask for clarification before proceeding
