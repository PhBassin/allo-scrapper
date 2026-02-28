# 🧪 Testing Guide

[← Back to README](./README.md)

Comprehensive guide for testing the Allo-Scrapper application.

**Related Documentation:**
- [Setup Guide](./SETUP.md) - Development environment setup
- [Contributing Guide](./CONTRIBUTING.md) - Testing requirements for contributions
- [Troubleshooting](./TROUBLESHOOTING.md) - Test failures

---

## Table of Contents

- [Overview](#overview)
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

**Test-Driven Development (TDD) is mandatory** for all contributions. See [AGENTS.md](./AGENTS.md) for the required TDD workflow.

---

## Unit Tests

### Technology

- **Framework**: [Vitest](https://vitest.dev/) - Fast, modern test runner
- **Assertion Library**: Built-in Vitest assertions
- **Mocking**: Vitest mocks and spies
- **Location**: `server/src/**/*.test.ts`

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

| File | Tests | What it covers |
|------|-------|----------------|
| `theater-json-parser.test.ts` | 34 | JSON-based showtime parsing |
| `theater-parser.test.ts` | 30 | HTML parsing for all cinemas |
| `date.test.ts` | 24 | Date utility functions |
| `cinema-config.test.ts` | 17 | Cinema DB+JSON sync service |
| `queries.test.ts` | 15 | Database query functions |
| `cinemas.test.ts` | 15 | Cinemas API route handler (CRUD) |
| `scraper/utils.test.ts` | 14 | Scraper utility functions |
| `redis-client.test.ts` | 14 | Redis client singleton and pub/sub |
| `film-parser.test.ts` | 6 | Film detail page HTML parsing |
| `scraper.test.ts` | 5 | Scraper route (USE_REDIS_SCRAPER flag) |
| `films.test.ts` | 5 | Films API route handler |
| `cors-config.test.ts` | 4 | CORS configuration |
| `http-client.test.ts` | 3 | HTTP client for the source website |
| `showtimes.test.ts` | 2 | Showtime grouping utilities |
| `benchmark-weekly-programs.test.ts` | 2 | DB upsert performance benchmark |
| `cinemas.security.test.ts` | 1 | Cinema route security/error handling |

**Total**: 191 tests across 16 test files

### Test Fixtures

- **Location**: `server/tests/fixtures/`
- **Content**: Full HTML pages from the source website (~1.6MB)
- **Purpose**: Realistic testing with actual cinema data

**Adding fixtures:**
```bash
# Fetch HTML for a cinema
curl "https://www.example-cinema-site.com/seance/salle_gen_csalle=CXXXX.html" \
  -o server/tests/fixtures/cinema-cxxxx-page.html
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

### Known Limitations

- Scrapes complete quickly in Docker, so some timing-sensitive tests may need adjustments
- Tests work best when run individually or after a clean Docker restart
- If tests interfere with each other, restart services: `docker compose restart ics-web`

### Test Locations

```
e2e/                        # Playwright E2E tests
├── scrape-progress.spec.ts # Progress window tests
└── ...                     # Future E2E tests

playwright.config.ts        # Playwright configuration
scripts/integration-test.sh # Automated full-stack test script
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
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/index.ts',
      ],
    },
  },
});
```

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
├── src/
│   ├── services/
│   │   ├── scraper/
│   │   │   ├── theater-parser.ts          # Implementation
│   │   │   ├── theater-parser.test.ts     # Tests
│   │   │   └── ...
│   └── utils/
│       ├── date.ts                        # Implementation
│       ├── date.test.ts                   # Tests
│       └── ...
└── tests/
    └── fixtures/                          # Test HTML files
        ├── cinema-c0089-page.html
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

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more test-related issues.

---

## Related Documentation

- [Setup Guide](./SETUP.md) - Development environment
- [Contributing Guide](./CONTRIBUTING.md) - Testing requirements
- [AGENTS.md](./AGENTS.md) - TDD workflow for AI agents
- [Troubleshooting](./TROUBLESHOOTING.md) - Test failures

---

[← Back to README](./README.md)
