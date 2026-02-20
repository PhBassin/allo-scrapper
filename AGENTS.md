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

**You MUST follow this workflow for every task:**

```
1. ISSUE     → Verify or create a GitHub issue
2. BRANCH    → Create a new feature branch from develop
3. PLAN      → Break down into atomic tasks
4. TDD       → Write tests BEFORE code
5. IMPLEMENT → Minimal code to pass tests
6. DOCKER    → Verify Docker build succeeds
7. COMMIT    → Atomic commits with Conventional Commits format
8. E2E       → Run integration tests (E2E) if frontend changes
9. DOCS      → Update README if API/features change
10. PR       → Open Pull Request referencing the issue
11. REVIEW   → Wait for review/approval before merging
12. CLEANUP  → Switch back to develop and pull latest changes after PR is merged
```

---

## Step 1: Issue First

**CRITICAL: Every PR MUST be linked to an issue. No exceptions.**

Before writing any code:

1. **Search for existing issues** related to the task
2. **Create an issue** if none exists using the appropriate template:
   - `bug_report` - For bugs
   - `feature_request` - For new features
   - `task` - For technical tasks/chores
3. **Note the issue number** - you will need it for commits and the PR

**Command to search issues:**
```bash
gh issue list --state open
gh issue list --state all --search "keyword"
gh issue view <number>
```

**Command to create issue:**
```bash
# Bug
gh issue create --title "fix: description" --body "Details..." --label bug

# Feature
gh issue create --title "feat: description" --body "Details..." --label enhancement

# Task
gh issue create --title "chore: description" --body "Details..." --label task
```

**Important:** Always verify the issue exists before creating a PR. If you reference a non-existent issue, the PR will not be properly linked.

---

## Step 2: Plan

Before implementation:

1. **Break down** the task into atomic, testable units
2. **Identify files** that will be modified
3. **List tests** that need to be written
4. **Consider edge cases** and error scenarios

Document your plan before proceeding.

---

## Step 3: Test-Driven Development (TDD)

**CRITICAL: Write tests BEFORE implementation.**

### TDD Cycle

```
1. RED    → Write a failing test for the expected behavior
2. GREEN  → Write minimal code to make the test pass
3. REFACTOR → Improve code while keeping tests green
4. REPEAT
```

### Test Commands

```bash
cd server

# Watch mode (recommended during development)
npm test

# Single run
npm run test:run

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
# Fetch HTML for a cinema
curl "https://www.example-cinema-site.com/seance/salle_gen_csalle=CXXXX.html" \
  -o server/tests/fixtures/cinema-cxxxx-page.html
```

---

## Step 4: Implement

After tests are written:

1. Write **minimal code** to pass the failing tests
2. Run tests frequently: `npm test`
3. Ensure all tests pass before committing

---

## Step 5: Verify Docker Build

**Before committing, verify the Docker build succeeds.**

```bash
docker compose build
```

If the build fails, fix the issue before proceeding to commit.

---

## Step 7: Atomic Commits

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

### Commit Examples

```bash
# Test commit (do this FIRST)
git commit -m "test(parser): add test for cinema with special characters"

# Implementation commit
git commit -m "feat(parser): handle cinema names with special characters

refs #45"

# Bug fix with issue close
git commit -m "fix(api): return 404 for unknown cinema IDs

closes #42"
```

### Commit Order

For a typical feature:
1. `test(scope): add test for <feature>`
2. `feat(scope): implement <feature>`
3. `docs: update README with <feature>` (if applicable)

---

## Step 8: Integration Testing (E2E)

**When frontend changes are made, run E2E tests to verify end-to-end functionality.**

### What Requires E2E Testing

Run Playwright E2E tests when you modify:
- React components that interact with the backend API
- User workflows (button clicks, form submissions, navigation)
- Real-time features (SSE, WebSockets, live updates)
- Critical user paths (scraping, viewing schedules, reports)

### E2E Test Commands

```bash
# Full integration test (starts Docker, runs tests, cleans up)
./scripts/integration-test.sh

# Or manually:
# 1. Ensure Docker is running
docker compose up --build -d

# 2. Wait for services to be ready
sleep 10

# 3. Run Playwright tests
npx playwright test

# 4. View test report (if failures)
npx playwright show-report
```

### E2E Test Guidelines

1. **Use real scrapes, not mocks** - Integration tests verify actual backend behavior
2. **Run tests sequentially** - Config already set to `workers: 1` to avoid scrape conflicts
3. **Use data-testid selectors** - More stable than text-based selectors
4. **Handle timing** - Scrapes may complete quickly; use appropriate timeouts
5. **Clean state** - Restart Docker between test sessions if needed: `docker compose restart web`

### Known Limitations

- Scrapes complete quickly in Docker, so some timing-sensitive tests may need adjustments
- Tests work best when run individually or after a clean Docker restart
- If tests interfere with each other, restart services: `docker compose restart web`

### Test Locations

```
e2e/                        # Playwright E2E tests
├── scrape-progress.spec.ts # Progress window tests
└── ...                     # Future E2E tests

playwright.config.ts        # Playwright configuration
scripts/integration-test.sh # Automated full-stack test script
```

---

## Step 9: Documentation

### Update README.md When:

- Adding new API endpoints
- Changing environment variables
- Modifying database schema
- Adding user-facing features

### Update DEPLOYMENT.md When:

- Changing Docker configuration
- Modifying deployment process

---

## Step 10: Pull Request

### Create PR

```bash
# Push branch
git push -u origin feature/your-feature

# Create PR
gh pr create --title "feat(scope): description" --body "## Summary
- Change 1
- Change 2

Closes #<issue-number>"
```

### PR Checklist

Before requesting review:
- [ ] All tests pass (`npm run test:run`)
- [ ] Code coverage maintained
- [ ] Conventional Commits used
- [ ] Documentation updated (if applicable)
- [ ] Issue referenced in PR

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
│   │   │   ├── scraper/        # In-process scraping logic (legacy mode)
│   │   │   │   ├── index.ts        # Orchestrator
│   │   │   │   ├── theater-parser.ts   # HTML parsing
│   │   │   │   └── http-client.ts      # HTTP requests
│   │   │   ├── redis-client.ts  # Redis job publisher (USE_REDIS_SCRAPER mode)
│   │   │   ├── scrape-manager.ts# Scrape session management
│   │   │   └── progress-tracker.ts  # SSE event system
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
│   │   ├── types/
│   │   └── utils/
│   │       ├── logger.ts       # Winston logger (service=ics-scraper)
│   │       ├── metrics.ts      # prom-client metrics (port 9091)
│   │       └── tracer.ts       # OpenTelemetry OTLP tracer
│   └── tests/unit/
├── client/                     # React frontend
├── docker/                     # Docker/monitoring configuration
│   ├── grafana/
│   │   ├── datasources/        # Auto-provisioned datasources (Prometheus, Loki, Tempo)
│   │   └── dashboards/         # Auto-provisioned dashboards
│   ├── loki-config.yml
│   ├── promtail-config.yml
│   ├── prometheus.yml
│   └── tempo.yml
├── e2e/                        # Playwright E2E tests
├── .github/                    # GitHub config (issues, workflows)
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
```

### Development

```bash
# Start dev environment
npm run dev

# Run server tests
cd server && npm test

# Run single test file
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
# Build all images
docker compose build

# Start base stack (app + DB + Redis)
docker compose up -d

# Start with scraper microservice
docker compose --profile scraper up -d

# Start with full monitoring (Prometheus, Grafana, Loki, Tempo)
docker compose --profile monitoring up -d

# Start everything
docker compose --profile monitoring --profile scraper up -d
```

### Git

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/your-feature develop

# Amend last commit (before push only)
git commit --amend
```

### GitHub CLI

```bash
# List open issues
gh issue list

# View issue details
gh issue view 42

# Create issue
gh issue create

# Create PR
gh pr create

# View PR checks
gh pr checks
```

---

## Common Patterns

### Adding a New Cinema

1. Add cinema to `server/src/config/cinemas.json`
2. Fetch HTML fixture for tests
3. Write parser tests
4. Verify existing tests still pass
5. Commit: `feat(scraper): add support for <cinema>`

### Fixing a Parser Bug

1. Create failing test that reproduces the bug
2. Fix the parser code
3. Verify test passes
4. Commit: `fix(parser): <description>`

### Adding API Endpoint

1. Write test for expected behavior
2. Add route handler
3. Update README API documentation
4. Commit: `feat(api): add <endpoint>`

---

## Important Reminders

1. **NEVER skip tests** - TDD is mandatory
2. **NEVER mix unrelated changes** in one commit
3. **ALWAYS reference issues** in commits/PRs
4. **ALWAYS update docs** when changing public APIs
5. **ALWAYS run tests** before committing
6. **NEVER push directly to develop** - Always create a feature branch, create a PR, and ask for review

---

## Questions?

If unclear about requirements:
1. Check existing code patterns
2. Review `CONTRIBUTING.md` for detailed guidelines
3. Check `server/tests/README.md` for testing specifics
4. Ask for clarification before proceeding
