# Testing Guide

Current test entrypoints by workspace.

## Server

```bash
cd server
npm test
npm run test:run
npm run test:integration
npm run test:coverage
```

Notes:

- `test:integration` runs `src/**/*.integration.test.ts`
- integration tests rely on Testcontainers
- Docker must be available for those tests

## Client

```bash
cd client
npm test
npm run test:run
npm run lint
npm run build
```

## Scraper

```bash
cd scraper
npm test
npm run test:run
npm run test:integration
npm run test:coverage
```

`test:integration` runs `tests/integration`.

## SaaS package

```bash
cd packages/saas
npm test
npm run test:run
npm run test:coverage
```

## Full build / CI parity

```bash
npm run build --workspaces --if-present
```

Current CI then runs:

```bash
cd server && npm run test:run
cd server && npm run test:integration
cd server && npm run test:coverage
```

## Playwright

Root commands:

```bash
npm run e2e
npm run e2e:headed
npm run e2e:ui
```

Important current behavior:

- `playwright.config.ts` does not define a `webServer`
- you must start the app yourself before running Playwright
- default base URL is `http://localhost:5173`
- override with `PLAYWRIGHT_BASE_URL`
- scrape-heavy specs run in the dedicated `chromium-scrape-serial` project
- for a single non-scrape spec, `--project=chromium --no-deps` skips that serial dependency chain

Examples:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run e2e

E2E_ENABLE_ORG_FIXTURE=true npx playwright test e2e/multi-tenant-cinema-isolation.spec.ts --project=chromium --no-deps
```

## SaaS fixture endpoints

These are exposed only when:

- `NODE_ENV=test`, or
- backend runs in `development` with `E2E_ENABLE_ORG_FIXTURE=true`

Endpoints:

- `POST /test/seed-org`
- `DELETE /test/cleanup-org/:id`

Outside those runtimes they intentionally return `404`.

## Related

- [Development Setup](./setup.md)
- [Contributing](./contributing.md)
