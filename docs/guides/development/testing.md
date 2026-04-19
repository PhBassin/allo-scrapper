# 🧪 Testing Guide

Comprehensive guide for testing the Allo-Scrapper application.

**Last updated:** March 4, 2026

**Related Documentation:**
- [Installation Guide](../../getting-started/installation.md) - Development environment setup
- [Contributing Guide](./contributing.md) - Testing requirements for contributions
- [Troubleshooting Guide](../../troubleshooting/common-issues.md) - Test failures

---

## Table of Contents

- [Overview](#overview)
- [Testing Multiple Packages](#testing-multiple-packages)
- [Unit Tests](#unit-tests)
- [Integration Tests (E2E)](#integration-tests-e2e)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)

---

## Overview

The project uses a comprehensive testing strategy:
- **Unit Tests** (Vitest) - Fast, isolated tests for functions and modules
- **Integration Tests** (Playwright) - End-to-end tests for full-stack workflows
- **Coverage Tracking** - Code coverage targets enforced

**Test-Driven Development (TDD) is mandatory** for all contributions. See [Contributing Guide](./contributing.md) for the required TDD workflow.

---

## Testing Multiple Packages

This project has test suites in three packages with different testing frameworks and purposes:

### Server Tests (Vitest)
```bash
cd server
npm test                # Watch mode
npm run test:run        # Single run
npm run test:coverage   # With coverage
```

### Scraper Microservice Tests (Vitest)
```bash
cd scraper
npm test                # Watch mode
npm run test:run        # Single run
```

### Client Tests (Vitest + React Testing Library)
```bash
cd client
npm test                # Run client tests
```

### Run All Tests
```bash
# Check current test counts across all packages
cd server && npm run test:run
cd ../scraper && npm run test:run
cd ../client && npm test
```

**Current Test Status:**
- **Server**: ~569 passing tests + 13 skipped = 582 tests across 35 test files
- **Scraper**: ~32 passing tests across 5 test files
- **Client**: ~168 passing tests across 17 test files
- **E2E**: 12 comprehensive Playwright test spec files
- **Total**: ~769 tests across 69+ test files (all packages combined)

> **Note**: Test counts change frequently as the codebase evolves. Use the commands above to check current counts.

---

## Unit Tests

### Technology

- **Framework**: [Vitest](https://vitest.dev/) - Fast, modern test runner
- **Assertion Library**: Built-in Vitest assertions
- **Mocking**: Vitest mocks and spies
- **Location**: `server/src/**/*.test.ts` (co-located) + `server/tests/` (dedicated test directory)

### Running Unit Tests

```bash
cd server

# Watch mode (recommended for development)
npm test

# Single run
npm run test:run

# With coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Test Files

The server package contains comprehensive test coverage across multiple areas:

**Key Test Categories:**
- **API Routes**: Authentication, cinemas, films, users, settings, reports
- **Database**: Queries, migrations, benchmarks, user management, settings
- **Scraping**: HTML parsing, JSON parsing, HTTP client, utilities
- **Services**: Theme generation, system info, Redis client
- **Middleware**: Admin authorization, rate limiting
- **Utilities**: Date functions, image validation, HTML decoding, CORS config

**Current Test Count:**
```bash
# Check current server test count
cd server && npm run test:run
# Shows: ~569 passing + 13 skipped = 582 tests across 35 test files
```

**Major Test Files Include:**
- `theater-json-parser.test.ts` - JSON-based showtime parsing (51 tests)
- `users.test.ts` - User management API (54 tests)
- `theater-parser.test.ts` - HTML parsing for cinemas (30 tests)
- `user-queries.test.ts` - Database user operations (30 tests)
- `queries.test.ts` - Core database queries (28 tests)
- `date.test.ts` - Date utility functions (24 tests)
- `html-decode.test.ts` - HTML entity decoding (23 tests)
- `migrations.test.ts` - Database schema migrations (22 tests)
- And many more...

### Test Fixtures

- **Location**: `server/tests/fixtures/`
- **Content**: 4 fixture files totaling ~1.6MB
  - `cinema-c0072-page.html` - Cinéma Épée de Bois
  - `cinema-c0089-page.html` - Cinéma Example
  - `cinema-w7504-page.html` - Club de l'Étoile
  - `film-page.html` - Film detail page
- **Purpose**: Realistic testing with actual cinema data from Allociné

**Adding fixtures:**
```bash
# Fetch HTML for a cinema (replace CXXXX with actual cinema ID)
curl "https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html" \
  -o server/tests/fixtures/cinema-cxxxx-page.html

# Example: Fetch Club de l'Étoile cinema page
curl "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html" \
  -o server/tests/fixtures/cinema-w7504-page.html
```

### Example Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { calculateWeekStart } from '../utils/date';

describe('calculateWeekStart', () => {
  it('should return last Wednesday for any day of week', () => {
    const result = calculateWeekStart(new Date('2024-02-15'));
    expect(result).toBe('2024-02-14'); // Last Wednesday
  });

  it('should return same date if input is Wednesday', () => {
    const result = calculateWeekStart(new Date('2024-02-14'));
    expect(result).toBe('2024-02-14');
  });
});
```

---

## Integration Tests (E2E)

### Technology

- **Framework**: [Playwright](https://playwright.dev/) - Modern E2E testing
- **Browsers**: Chromium, Firefox, WebKit (configurable)
- **Location**: `e2e/**/*.spec.ts`
- **Config**: `playwright.config.ts`

### When to Run E2E Tests

Run Playwright E2E tests when you modify:
- React components that interact with the backend API
- User workflows (button clicks, form submissions, navigation)
- Real-time features (SSE, WebSockets, live updates)
- Critical user paths (scraping, viewing schedules, reports)

### Running E2E Tests

```bash
# Full integration test (recommended)
./scripts/integration-test.sh

# Or run manually:
# 1. Ensure Docker is running
docker compose up --build -d

# 2. Wait for services to be ready
sleep 10

# 3. Run Playwright tests
npx playwright test

# 4. View test report (if failures)
npx playwright show-report

# 5. Run specific test
npx playwright test --grep "test name"

# 6. Debug mode
npx playwright test --headed --debug
```

### E2E Test Guidelines

1. **Use real scrapes, not mocks** - Integration tests verify actual backend behavior
2. **Run tests sequentially** - Config already set to `workers: 1` to avoid scrape conflicts
3. **Use data-testid selectors** - More stable than text-based selectors
4. **Handle timing** - Scrapes may complete quickly; use appropriate timeouts
5. **Clean state** - Restart Docker between test sessions if needed: `docker compose restart ics-web`

### Redis Integration Tests (Testcontainers)

Server integration tests can start Redis automatically with Testcontainers; no manual `docker compose up redis` is required.

```bash
# Run server integration tests using Testcontainers-managed Redis
npm run test:integration --workspace=allo-scrapper-server
```

What this covers:
- real Redis connectivity using runtime host/port mapping
- queue write/depth behavior
- Redis pub/sub event flow

Troubleshooting:
- If Docker is not running, start Docker Desktop/daemon and rerun
- If Testcontainers cannot pull images, verify network access to Docker registry
- On test failure, integration tests print Redis diagnostics including effective `REDIS_URL`

### Playwright Auto-Cleanup Utilities (Org Fixtures)

Parallel Playwright runs can create tenant org test data via fixture API. Use the shared org fixture layer to ensure deterministic cleanup.

```ts
import { test, expect } from './fixtures/org-fixture';

test('example with seeded org', async ({ seedTestOrg, page }) => {
  const org = await seedTestOrg();
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
});
```

Behavior:
- `seedTestOrg()` creates an org with deterministic `e2e-test-*` slug markers
- per-test `afterEach` cleanup removes tracked orgs for current test id/worker
- global teardown performs orphan cleanup fallback using strict eligibility rules

Enable fixture-backed seeding in migrated specs:

```bash
E2E_ENABLE_ORG_FIXTURE=true npx playwright test
```

Run the dedicated multi-tenant cinema isolation scenario:

```bash
E2E_ENABLE_ORG_FIXTURE=true npx playwright test e2e/multi-tenant-cinema-isolation.spec.ts --project=chromium --no-deps
```

Troubleshooting:
- If teardown reports failures, inspect logs with `org_id`, `test_id`, `worker_id`
- Repeated cleanup is idempotent; `404` on already-deleted orgs is treated as skipped
- Global cleanup only targets test-prefixed and recent org records to avoid unsafe deletions

### Multi-Tenant Fixture API (SaaS test runtime)

When running SaaS tests in `NODE_ENV=test`, the plugin exposes fixture endpoints for deterministic org setup/teardown:

- `POST /test/seed-org`
- `DELETE /test/cleanup-org/:id`

Example:

```bash
# Seed one org fixture
curl -X POST http://localhost:3000/test/seed-org \
  -H "Content-Type: application/json" \
  -d '{"slug":"e2e-demo","name":"E2E Demo Org"}'

# Cleanup the same org
curl -X DELETE http://localhost:3000/test/cleanup-org/41
```

Behavior and safety:
- Endpoints are intended for tests only and return `404` outside test runtime.
- Seeding returns `org_id`, `org_slug`, `schema_name`, and admin credentials shape used by Playwright fixtures.
- Cleanup drops the tenant schema and removes the org row to prevent orphaned artifacts.
- Parallel test runs should use unique slugs per worker/test to avoid collisions.

Troubleshooting:
- If `/test/*` returns `404` in local dev, verify you are running with `NODE_ENV=test`.
- If cleanup fails, inspect logs for `org_id`, status, and SQL error context.
- Repeated cleanup calls for already-deleted orgs are treated as safe/expected skips by fixture tooling.

### Known Limitations

- Scrapes complete quickly in Docker, so some timing-sensitive tests may need adjustments
- Tests work best when run individually or after a clean Docker restart
- If tests interfere with each other, restart services: `docker compose restart ics-web`

### Test Locations

```
e2e/                              # Playwright E2E tests (12 comprehensive specs)
├── admin-system.spec.ts          # Admin system information dashboard
├── auth-flow.spec.ts             # Authentication workflows
├── change-password.spec.ts       # Password change functionality
├── cinema-scrape.spec.ts         # Cinema scraping operations
├── database-schema.spec.ts       # Database schema validation
├── day-filter.spec.ts            # Day filtering functionality
├── film-search.spec.ts           # Film search features
├── reports-navigation.spec.ts    # Reports page navigation
├── scrape-progress.spec.ts       # Scrape progress monitoring
├── showtime-buttons.spec.ts      # Showtime button interactions
├── theme-application.spec.ts     # Theme customization
├── user-management.spec.ts       # User CRUD operations
└── multi-tenant-cinema-isolation.spec.ts  # Cross-tenant cinema isolation checks

playwright.config.ts              # Playwright configuration
scripts/integration-test.sh       # Automated full-stack test script
```

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test';

test('should display cinemas list', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for cinemas to load
  await expect(page.getByTestId('cinema-list')).toBeVisible();
  
  // Verify at least one cinema is displayed
  const cinemas = page.getByTestId('cinema-card');
  await expect(cinemas).toHaveCount({ min: 1 });
});
```

---

## Test Coverage

### Coverage Targets

The project enforces minimum code coverage thresholds:

| Metric | Target | Description |
|--------|--------|-------------|
| **Lines** | ≥ 80% | Percentage of code lines executed |
| **Functions** | ≥ 80% | Percentage of functions called |
| **Statements** | ≥ 80% | Percentage of statements executed |
| **Branches** | ≥ 65% | Percentage of conditional branches taken |

### Viewing Coverage

```bash
cd server

# Generate coverage report
npm run test:coverage

# Reports are generated in:
# - Terminal (summary)
# - coverage/index.html (detailed HTML report)

# Open HTML report
open coverage/index.html
```

### Coverage Configuration

Located in `server/vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 65,
      statements: 80,
      // Apply thresholds per file, not globally
      perFile: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        // Extensive exclusion list - see vitest.config.ts for full list
        'src/app.ts',
        'src/index.ts',
        'src/db/**',
        'src/routes/**',
        'src/middleware/**',
        'src/utils/**',
        // ... and more
      ],
    },
  },
});
```

> **Note**: Coverage thresholds are enforced per file (`perFile: true`), but many files are excluded from coverage requirements (routes, db, middleware, utils). See `server/vitest.config.ts` for the complete exclusion list.

### Coverage Reporting

- **CI/CD**: Coverage is enforced in GitHub Actions workflows
- **Pull Requests**: Coverage must not decrease
- **Failing Coverage**: Blocks pre-push hook and CI builds

---

## Writing Tests

### TDD Workflow (Mandatory)

**CRITICAL: Write tests BEFORE implementation.**

#### TDD Cycle

```
1. RED    → Write a failing test for the expected behavior
2. GREEN  → Write minimal code to make the test pass
3. REFACTOR → Improve code while keeping tests green
4. REPEAT
```

#### Example TDD Session

```bash
# 1. Write failing test
# server/src/services/scraper/theater-parser.test.ts

describe('parseTheaterPage', () => {
  it('should extract cinema name from HTML', () => {
    const html = '<h1 class="cinema-name">Épée de Bois</h1>';
    const result = parseTheaterPage(html);
    expect(result.name).toBe('Épée de Bois');
  });
});

# 2. Run test (should FAIL)
npm test

# 3. Implement minimal code to pass
# server/src/services/scraper/theater-parser.ts

export function parseTheaterPage(html: string) {
  const $ = cheerio.load(html);
  const name = $('.cinema-name').text();
  return { name };
}

# 4. Run test (should PASS)
npm test

# 5. Refactor if needed
# 6. Repeat for next feature
```

### Test Organization

```
server/
├── src/                                   # Co-located tests
│   ├── services/
│   │   ├── scraper/
│   │   │   ├── theater-parser.ts          # Implementation
│   │   │   ├── theater-parser.test.ts     # Tests
│   │   │   └── ...
│   ├── routes/
│   │   ├── auth.ts                        # Implementation
│   │   ├── auth.test.ts                   # Tests
│   │   └── ...
│   └── utils/
│       ├── date.ts                        # Implementation
│       ├── date.test.ts                   # Tests
│       └── ...
└── tests/                                 # Dedicated test directory
    ├── services/
    │   └── redis-client.test.ts           # Integration tests
    └── fixtures/                          # Test HTML files
        ├── cinema-c0072-page.html
        ├── cinema-c0089-page.html
        ├── cinema-w7504-page.html
        └── film-page.html

scraper/
└── tests/unit/                            # Scraper microservice tests
    ├── logger.test.ts
    ├── metrics.test.ts
    ├── redis-client.test.ts
    ├── tracer.test.ts
    └── scraper/
        └── utils.test.ts

client/
└── src/                                   # React component tests
    ├── components/
    │   ├── ScrapeButton.test.tsx
    │   └── ...
    ├── pages/
    │   ├── HomePage.test.tsx
    │   └── ...
    └── utils/
        ├── date.test.ts
        └── ...
```

### Best Practices

#### Unit Tests

```typescript
// ✅ Good - Isolated, fast, focused
describe('calculateWeekStart', () => {
  it('should return last Wednesday for Friday', () => {
    const result = calculateWeekStart(new Date('2024-02-16'));
    expect(result).toBe('2024-02-14');
  });
});

// ❌ Bad - Testing multiple concerns
it('should do everything', () => {
  const result = complexFunction();
  expect(result.field1).toBe('value');
  expect(result.field2).toBe(42);
  expect(result.field3).toEqual([]);
  // Too many assertions = hard to debug
});
```

#### E2E Tests

```typescript
// ✅ Good - Uses data-testid selectors
await page.getByTestId('cinema-list').click();

// ❌ Bad - Fragile text-based selectors
await page.getByText('Cinemas').click(); // Breaks if text changes
```

#### Test Names

```typescript
// ✅ Good - Descriptive, behavior-focused
it('should return 404 when cinema does not exist', () => {});

// ❌ Bad - Implementation-focused
it('should call database query', () => {});
```

### Mocking

```typescript
import { vi } from 'vitest';
import * as db from '../db/queries';

// Mock database queries
vi.spyOn(db, 'getCinemaById').mockResolvedValue({
  id: 'W7504',
  name: 'Épée de Bois',
});

// Test code that uses getCinemaById
```

### Testing Async Code

```typescript
it('should fetch cinema data', async () => {
  const result = await fetchCinema('W7504');
  expect(result).toEqual({
    id: 'W7504',
    name: 'Épée de Bois',
  });
});
```

---

## Git Hooks

The project includes a pre-push hook that automatically runs:

```bash
# Install hooks (run once after cloning)
./scripts/install-hooks.sh
```

**Pre-push hook runs:**
1. TypeScript type checking (`tsc --noEmit`)
2. Unit tests (`npm run test:run`)

**If either fails, the push is blocked** until issues are resolved.

---

## Continuous Integration

Tests run automatically on every push via GitHub Actions:

```yaml
# .github/workflows/docker-build-push.yml
- name: Run tests
  run: |
    cd server
    npm ci
    npm run test:run
```

**CI Requirements:**
- All tests must pass
- Coverage targets must be met
- TypeScript must compile without errors

---

## Troubleshooting Tests

### Common Issues

#### Tests fail with "Cannot find module"
```bash
# Install dependencies
cd server && npm ci
```

#### Tests timeout
```bash
# Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000, // 10 seconds
  },
});
```

#### E2E tests fail with "Connection refused"
```bash
# Ensure Docker services are running
docker compose up -d
sleep 10 # Wait for services to start
npx playwright test
```

#### Coverage below threshold
```bash
# View coverage report to find untested code
npm run test:coverage
open coverage/index.html

# Write tests for uncovered code
```

See [Troubleshooting Guide](../../troubleshooting/common-issues.md) for more test-related issues.

---

## Related Documentation

- [Installation Guide](../../getting-started/installation.md) - Development environment
- [Contributing Guide](./contributing.md) - Testing requirements
- [CI/CD Guide](./cicd.md) - Continuous integration workflows
- [Troubleshooting Guide](../../troubleshooting/common-issues.md) - Test failures

---

[← Back to Development Guides](./README.md) | [Back to Documentation](../../README.md)
