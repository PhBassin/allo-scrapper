---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-15'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/project-context.md'
  - 'README.md'
  - 'package.json'
  - 'playwright.config.ts'
---

# Test Design for QA: Allo-Scrapper System

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-04-15
**Author:** BMad TEA Agent
**Status:** Ready for Implementation
**Project:** Allo-Scrapper v4.6.7

**Related:** See Architecture doc (test-design-architecture.md) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** System-level test coverage for Allo-Scrapper cinema aggregator including multi-tenant isolation, Redis job queue reliability, SSE stability, rate limiting, database migrations, and observability.

**Risk Summary:**

- Total Risks: 9 (4 high-priority score ≥6, 3 medium score 4-5, 2 low score 1-3)
- Critical Categories: SEC (1 BLOCKER), OPS (2 HIGH), PERF (1 HIGH), BUS (1 HIGH)

**Coverage Summary:**

- P0 tests: ~11 (multi-tenant isolation - BLOCKER)
- P1 tests: ~24 (Redis, SSE, rate limiting, migrations)
- P2 tests: ~6 (concurrency, observability)
- P3 tests: ~4 (theme, email formatting)
- **Total**: ~45 new tests (~80-136 hours with 1 QA, 3-4 sprints)

**Existing Coverage:**
- 104 unit tests (Vitest)
- 10+ E2E tests (Playwright)
- Coverage: 80%+ lines/functions, 65%+ branches

---

## Not in Scope

**Components or systems explicitly excluded from this test plan:**

| Item                            | Reasoning                                   | Mitigation                                                |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| **Scraper HTML parsing logic**  | Already covered by 10+ existing unit tests  | Maintain existing test coverage in `scraper/src/**/*.test.ts` |
| **Authentication flows**        | Already covered by E2E `auth-flow.spec.ts`  | Regression validation in Nightly pipeline                 |
| **Basic CRUD operations**       | Already covered by existing E2E tests       | Regression validation in PR pipeline                      |
| **Docker build process**        | DevOps responsibility                       | Manual validation in staging deployment                   |
| **Grafana dashboard config**    | Observability team responsibility           | Manual validation post-deployment                         |

**Note:** Items listed here have been reviewed and accepted as out-of-scope by QA, Dev, and PM.

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans

1. **Multi-tenant test fixture** - Backend team - Sprint 0 (BLOCKER)
   - API endpoints: `POST /test/seed-org`, `DELETE /test/cleanup-org`
   - Why it blocks testing: Cannot test cross-tenant isolation (RISK-001, P0 BLOCKER)

2. **Dead-letter queue for scraper jobs** - Backend team - Sprint +1
   - Redis DLQ implementation with retry logic
   - Why it blocks testing: Cannot validate job failure handling (RISK-002)

3. **SSE heartbeat mechanism** - Backend team - Sprint +1
   - Server sends ping event every 30s on `/api/scraper/progress`
   - Why it blocks testing: Cannot test long-running SSE connections (RISK-003)

4. **Rate limit documentation** - Backend team - Sprint +2
   - Document per-endpoint rate limit windows in README
   - Why it blocks testing: Cannot write accurate rate limit tests (RISK-004)

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** - QA - Sprint 0
   - Multi-tenant organization factory (2+ orgs with isolated data)
   - Cinema/schedule factory with org_id scope
   - Auto-cleanup fixtures for parallel safety

2. **Test Environments** - QA + DevOps - Sprint 0
   - Local: Docker Compose with Redis + PostgreSQL
   - CI/CD: GitHub Actions with Testcontainers Redis
   - Staging: Full stack with observability (Prometheus, Grafana, Loki)

3. **Redis Mock/Container** - QA + DevOps - Sprint +1
   - Testcontainers Redis for integration tests
   - Mock utilities for timeout/OOM simulation

4. **SSE Test Client** - QA - Sprint +1
   - Playwright fixture for SSE connections
   - Utilities: reconnection validation, heartbeat monitoring, event replay

**Example factory pattern:**

```typescript
import { test } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Multi-tenant organization factory
export function createOrg() {
  return {
    slug: `org-${faker.string.alphanumeric(8)}`,
    name: faker.company.name(),
    settings: {},
  };
}

// Cinema factory with org scope
export function createCinema(orgId: string) {
  return {
    name: faker.company.name(),
    allocine_id: `C${faker.number.int({ min: 1000, max: 9999 })}`,
    org_id: orgId,
  };
}

// Test with auto-cleanup
test('multi-tenant isolation @p0', async ({ request }) => {
  const orgA = await request.post('/test/seed-org', { data: createOrg() });
  const orgB = await request.post('/test/seed-org', { data: createOrg() });

  // Test cross-tenant access forbidden
  // ...

  // Auto-cleanup
  await request.delete(`/test/cleanup-org/${orgA.data.id}`);
  await request.delete(`/test/cleanup-org/${orgB.data.id}`);
});
```

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score ≥6)

| Risk ID        | Category | Description                                   | Score | QA Test Coverage                                              |
| -------------- | -------- | --------------------------------------------- | ----- | ------------------------------------------------------------- |
| **RISK-001**   | SEC      | Multi-tenant data leakage in SaaS mode        | **9** | 9 tests (3 E2E UI isolation + 4 API cross-tenant + 2 Unit)   |
| **RISK-002**   | OPS      | Redis job queue corruption under load         | **6** | 8 tests (5 Integration load/failure + 2 Unit + 1 E2E)        |
| **RISK-003**   | PERF     | SSE connections abandoned during long scrapes | **6** | 6 tests (3 E2E stability + 2 Integration heartbeat + 1 Unit) |
| **RISK-004**   | BUS      | Rate limiting false positives                 | **6** | 7 tests (4 E2E burst scenarios + 2 Integration + 1 Unit)     |

### Medium/Low-Priority Risks

| Risk ID      | Category | Description                                  | Score | QA Test Coverage                                  |
| ------------ | -------- | -------------------------------------------- | ----- | ------------------------------------------------- |
| **RISK-005** | TECH     | Playwright workers=1 masks concurrency bugs  | 4     | 3 tests (2 Integration API concurrency + 1 E2E)  |
| **RISK-006** | DATA     | Non-idempotent migrations cause schema drift | 4     | 4 Integration tests (fresh DB + re-run + column) |
| **RISK-007** | OPS      | Observability gaps for multi-tenant tracing  | 4     | 4 tests (3 Integration metrics + 1 E2E optional) |
| **RISK-008** | BUS      | Theme CSS conflicts in white-label           | 2     | 2 E2E tests (already covered in existing suite)  |
| **RISK-009** | BUS      | Email notification formatting                | 2     | 2 Integration tests (template + HTML validation) |

---

## Entry Criteria

**QA testing cannot begin until ALL of the following are met:**

- [ ] All requirements and assumptions agreed upon by QA, Dev, PM
- [ ] Test environments provisioned and accessible (local, CI, staging)
- [ ] Test data factories ready (multi-tenant org, cinema, schedule)
- [ ] Pre-implementation blockers resolved:
  - [ ] Multi-tenant test fixture API endpoints deployed
  - [ ] Redis Testcontainers setup in CI
  - [ ] Dead-letter queue implemented (for Sprint +1 tests)
  - [ ] SSE heartbeat mechanism implemented (for Sprint +1 tests)
- [ ] Feature deployed to test environment (SaaS mode enabled)
- [ ] Coverage baseline recorded (80%+ lines/functions, 65%+ branches)

## Exit Criteria

**Testing phase is complete when ALL of the following are met:**

- [ ] All P0 tests passing (11 tests, 100% pass rate)
- [ ] All P1 tests passing or failures triaged and accepted (24 tests, ≥95% pass rate)
- [ ] No open P0/P1 bugs (BLOCKER or HIGH severity)
- [ ] Test coverage ≥85% lines/functions, ≥75% branches (agreed by QA + Dev Lead)
- [ ] Performance baselines met:
  - [ ] Scraper <100ms per page
  - [ ] 50+ concurrent SSE connections stable
  - [ ] 100+ Redis jobs processed without loss
- [ ] SaaS multi-tenant isolation validated (RISK-001 tests all passing)
- [ ] High-priority risk mitigations complete (RISK-001 through RISK-004)

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical) - RISK-001: Multi-Tenant Data Leakage

**Criteria:** Blocks SaaS release + Security BLOCKER (score 9) + No workaround + Affects all SaaS customers

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK001-E2E-001** | User org A cannot view cinemas from org B via UI     | E2E         | RISK-001   | Full UI navigation + API interception    |
| **RISK001-E2E-002** | User org A cannot edit users from org B via UI       | E2E         | RISK-001   | User management isolation                |
| **RISK001-E2E-003** | User org A cannot view schedules from org B via UI   | E2E         | RISK-001   | Schedule data isolation                  |
| **RISK001-API-001** | GET /api/cinemas?org_id=B with org A token → 403     | Integration | RISK-001   | API-level tenant isolation               |
| **RISK001-API-002** | PUT /api/users/:id (org B user) with org A token → 403 | Integration | RISK-001   | API write operation isolation            |
| **RISK001-API-003** | GET /api/schedules with org A token returns ONLY org A data | Integration | RISK-001 | Implicit org_id filtering                |
| **RISK001-API-004** | POST /api/cinemas with manipulated org_id → 403      | Integration | RISK-001   | Prevent org_id injection attacks         |
| **RISK001-UNIT-001** | Middleware filters queries by JWT org_id claim       | Unit        | RISK-001   | Core authorization logic                 |
| **RISK001-UNIT-002** | Permission checker validates org_id match            | Unit        | RISK-001   | Permission boundary validation           |

**Total P0:** 9 tests (~25-40 hours, Sprint 0)

---

### P1 (High) - RISK-002: Redis Job Queue Corruption

**Criteria:** Critical operations + HIGH risk (score 6) + Impacts scraper reliability

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK002-INT-001** | Enqueue 100 jobs simultaneously → all processed       | Integration | RISK-002   | Redis queue load test                    |
| **RISK002-INT-002** | Redis connection timeout during enqueue → retry succeeds | Integration | RISK-002 | Transient failure recovery               |
| **RISK002-INT-003** | Dequeue job fails midway → job marked failed in Redis | Integration | RISK-002   | Failure tracking mechanism               |
| **RISK002-INT-004** | Redis crashes during job processing → jobs resumed after reconnection | Integration | RISK-002 | Crash recovery validation |
| **RISK002-INT-005** | Dead-letter queue receives jobs after 3 failures    | Integration | RISK-002   | DLQ functionality                        |
| **RISK002-UNIT-001** | Job processor respects p-limit concurrency (max 5)   | Unit        | RISK-002   | Bounded concurrency logic                |
| **RISK002-UNIT-002** | Retry with exponential backoff calculates delays correctly | Unit      | RISK-002   | Retry logic correctness                  |
| **RISK002-E2E-001** | Trigger 10 scrapes simultaneously → progress updates for all | E2E      | RISK-002   | Full workflow with SSE progress          |

**Total:** 8 tests (~12-18 hours, Sprint +1)

---

### P1 (High) - RISK-003: SSE Connection Abandonment

**Criteria:** User-facing performance issue + HIGH risk (score 6) + Long-running operations

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK003-E2E-001** | SSE connection maintained during 10min scrape         | E2E         | RISK-003   | Long-running operation validation        |
| **RISK003-E2E-002** | Client reconnects automatically after network interruption | E2E      | RISK-003   | Reconnection logic validation            |
| **RISK003-E2E-003** | 50 simultaneous SSE connections → all receive events  | E2E         | RISK-003   | Concurrent SSE load test                 |
| **RISK003-INT-001** | SSE endpoint sends heartbeat every 30s                | Integration | RISK-003   | Keep-alive mechanism validation          |
| **RISK003-INT-002** | SSE connection closed after 15min inactivity          | Integration | RISK-003   | Resource cleanup validation              |
| **RISK003-UNIT-001** | SSE event formatter serializes progress correctly     | Unit        | RISK-003   | Event payload correctness                |

**Total:** 6 tests (~10-15 hours, Sprint +1)

---

### P1 (High) - RISK-004: Rate Limiting False Positives

**Criteria:** Business impact + HIGH risk (score 6) + Affects legitimate users

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK004-E2E-001** | 3 successful logins in 10s → all succeed (not rate limited) | E2E      | RISK-004   | Legitimate burst behavior                |
| **RISK004-E2E-002** | User refreshes page 5x → not rate limited            | E2E         | RISK-004   | Legitimate user behavior                 |
| **RISK004-E2E-003** | 11th request in burst window → 429 Too Many Requests | E2E         | RISK-004   | Rate limit enforcement                   |
| **RISK004-E2E-004** | After 60s wait, rate limit resets and requests succeed | E2E        | RISK-004   | Rate limit window expiration             |
| **RISK004-INT-001** | Localhost requests exempt from /api/health rate limiting | Integration | RISK-004 | Docker health probe exemption            |
| **RISK004-INT-002** | Different IPs have independent rate limit counters   | Integration | RISK-004   | Per-IP rate limiting isolation           |
| **RISK004-UNIT-001** | Rate limiter calculates time windows correctly       | Unit        | RISK-004   | Time window logic correctness            |

**Total:** 7 tests (~8-12 hours, Sprint +2)

---

### P1 (High) - RISK-006: Database Migration Idempotency

**Criteria:** Data integrity + MEDIUM risk (score 4 → escalated to P1 due to criticality)

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK006-INT-001** | Run all migrations on fresh DB → success             | Integration | RISK-006   | Fresh install validation                 |
| **RISK006-INT-002** | Re-run all migrations on populated DB → no errors (idempotent) | Integration | RISK-006 | Idempotency validation |
| **RISK006-INT-003** | Migration adds column if not exists → no duplicate columns | Integration | RISK-006 | Column creation idempotency |
| **RISK006-INT-004** | Migration output includes expected NOTICE messages   | Integration | RISK-006   | Migration logging validation             |

**Total:** 4 tests (~5-8 hours, Sprint +2)

---

### P2 (Medium) - RISK-005, RISK-007

**Criteria:** Secondary features + MEDIUM risk (score 4) + Edge cases

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK005-INT-001** | 3 parallel API requests to POST /api/cinemas → no race conditions | Integration | RISK-005 | DB transaction isolation |
| **RISK005-INT-002** | 5 parallel scrape triggers → all enqueued without duplicates | Integration | RISK-005 | Redis job queue concurrency |
| **RISK005-E2E-001** | Run E2E suite with workers=3 → no test failures      | E2E         | RISK-005   | Playwright parallel execution            |
| **RISK007-INT-001** | Prometheus /metrics endpoint includes scraper metrics | Integration | RISK-007   | Metrics availability validation          |
| **RISK007-INT-002** | OpenTelemetry traces include org_id for SaaS mode    | Integration | RISK-007   | Multi-tenant observability               |
| **RISK007-INT-003** | Error logs include correlation IDs for tracing       | Integration | RISK-007   | Distributed tracing correlation          |

**Total P2:** 6 tests (~12-20 hours, Sprint +2-3)

---

### P3 (Low) - RISK-008, RISK-009

**Criteria:** Nice-to-have + LOW risk (score 1-2) + Exploratory

| Test ID          | Requirement                                          | Test Level  | Risk Link  | Notes                                    |
| ---------------- | ---------------------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| **RISK008-E2E-001** | Apply custom theme → verify CSS variables applied    | E2E         | RISK-008   | White-label customization (existing)     |
| **RISK008-E2E-002** | Switch between themes → no CSS artifacts persist     | E2E         | RISK-008   | Theme switching cleanup (existing)       |
| **RISK009-INT-001** | Email template renders with correct variables        | Integration | RISK-009   | Email templating validation              |
| **RISK009-INT-002** | Email HTML validates (no broken tags)                | Integration | RISK-009   | Email markup validation                  |

**Total P3:** 4 tests (~3-6 hours, Backlog)

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with parallelization is extremely fast (100s of tests in ~10-15 min).

**Organized by TIMING:**

### Every PR: Functional Tests (~12-15 min)

**All P0 + P1 tests** (35 tests):

- Unit tests: 6 tests (~1-2 min)
- Integration tests: 19 tests (~3-5 min)
- E2E tests: 11 tests (~7-10 min)
- Existing tests: 104 unit + 10 E2E (~5 min)

**Parallelization:**
- Unit/Integration: `vitest --run` (default parallel)
- E2E: `playwright test --workers=1` (sequential, change to 3 after RISK-005 mitigation)

**Why run in PRs:** Fast feedback, no expensive infrastructure, catch regressions early

**Gate decision:**
- P0 pass rate = 100% → PASS (merge allowed)
- P0 pass rate < 100% → **BLOCK MERGE**
- P1 pass rate < 95% → **CONCERNS** (review required before merge)

---

### Nightly: Load Tests & P2 (~30-45 min)

**Additional tests beyond PR:**

- All P2 tests (6 tests, ~5-10 min)
- Load tests:
  - 50+ SSE connections simultaneous (RISK003-E2E-003)
  - 100+ Redis jobs simultaneous (RISK002-INT-001)
  - 3+ parallel API requests (RISK005-INT-001/002)
- Migration tests (RISK006 full suite, ~5 min)

**Why defer to nightly:** Infrastructure-intensive (Redis load, SSE concurrency), longer runtime

**Gate decision:**
- P0 + P1 pass rate >= 95% → PASS
- P2 pass rate >= 80% → PASS
- Failures → **Create issues** (doesn't block deployment, but tracked for next sprint)

---

### Weekly: Full Regression & P3 (~60-90 min)

**Additional tests beyond Nightly:**

- All P3 tests (4 tests, ~5-10 min)
- Observability stack validation:
  - RISK007-E2E-001: Trace appears in Tempo (requires full observability stack)
- Performance benchmarks:
  - API latency under 1000 req/s load
  - Scraper with 50+ cinemas simultaneously
- Theme switching edge cases (RISK-008)
- Email rendering in 3+ clients (manual, documented)

**Why defer to weekly:** Very long-running, expensive infrastructure, infrequent validation sufficient

**Gate decision:**
- Generate weekly regression report
- P3 failures → **Document only** (no blocking)
- Performance degradation > 20% → **Create performance issue**

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps, Backend, Data Eng, Finance work):

| Priority  | Count | Effort Range          | Notes                                             |
| --------- | ----- | --------------------- | ------------------------------------------------- |
| P0        | 9     | ~25-40 hours (1-2w)   | Complex setup (multi-tenant fixture, cross-tenant tests) |
| P1        | 24    | ~40-70 hours (2-3.5w) | Standard coverage (Redis, SSE, rate limiting, migrations) |
| P2        | 6     | ~12-20 hours (1.5-2.5w) | Edge cases (concurrency, observability)         |
| P3        | 4     | ~3-6 hours (0.5-1w)   | Exploratory (theme, email)                        |
| **Total** | **45**| **~80-136 hours**     | **3-4 sprints, 1 QA engineer full-time**          |

**Breakdown by sprint:**

- **Sprint 0** (current): P0 tests (25-40h) — BLOCKER for SaaS release
- **Sprint +1** (2 weeks): P1 tests part 1 (20-35h) — Redis + SSE
- **Sprint +2** (2 weeks): P1 tests part 2 (20-35h) — Rate limiting + Migrations
- **Sprint +3** (2 weeks): P2 tests (12-20h)
- **Backlog**: P3 tests (3-6h, time permitting)

**Assumptions:**

- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort post-implementation)
- Assumes test infrastructure ready (factories, fixtures, Redis mock)
- 1 QA engineer full-time, supported by Backend (fixtures) + DevOps (CI setup)

**Dependencies from other teams:**

- **Backend team**: Multi-tenant fixture API (Sprint 0), DLQ implementation (Sprint +1), SSE heartbeat (Sprint +1)
- **DevOps team**: Redis Testcontainers in CI (Sprint 0), staging environment with observability (Sprint +1)
- **Frontend team**: SSE client reconnection logic (Sprint +1, optional)

---

## Implementation Planning Handoff

**Use this to inform implementation planning; if no dedicated QA, assign to Dev owners.**

| Work Item                                   | Owner       | Target Milestone | Dependencies/Notes                                      |
| ------------------------------------------- | ----------- | ---------------- | ------------------------------------------------------- |
| Multi-tenant test fixture API               | Backend     | Sprint 0         | BLOCKER for P0 tests                                    |
| Multi-tenant organization factory           | QA          | Sprint 0         | Depends on fixture API                                  |
| Redis Testcontainers setup                  | QA + DevOps | Sprint 0         | Required for P1 Redis tests (Sprint +1)                 |
| Implement P0 tests (RISK-001)               | QA          | Sprint 0         | 9 tests, 25-40h                                         |
| Dead-letter queue implementation            | Backend     | Sprint +1        | Required for RISK-002 tests                             |
| SSE heartbeat mechanism                     | Backend     | Sprint +1        | Required for RISK-003 tests                             |
| SSE test client fixture                     | QA          | Sprint +1        | Playwright SSE utilities                                |
| Implement P1 tests (RISK-002, RISK-003)     | QA          | Sprint +1        | 14 tests, 22-33h                                        |
| Rate limit documentation                    | Backend     | Sprint +2        | README.md update                                        |
| Implement P1 tests (RISK-004, RISK-006)     | QA          | Sprint +2        | 11 tests, 13-20h                                        |
| Implement P2 tests (RISK-005, RISK-007)     | QA          | Sprint +3        | 6 tests, 12-20h                                         |
| Playwright workers=3 configuration          | QA          | Sprint +3        | After RISK-005 mitigation                               |
| Implement P3 tests (RISK-008, RISK-009)     | QA          | Backlog          | 4 tests, 3-6h (time permitting)                         |

---

## Tooling & Access

| Tool or Service       | Purpose                                  | Access Required                | Status  |
| --------------------- | ---------------------------------------- | ------------------------------ | ------- |
| Playwright            | E2E and integration testing              | npm install (already available)| Ready   |
| Vitest                | Unit testing                             | npm install (already available)| Ready   |
| Testcontainers        | Redis container for integration tests    | Docker daemon access           | Pending |
| @faker-js/faker       | Test data generation                     | npm install                    | Ready   |
| Redis mock library    | Redis failure simulation                 | npm install (ioredis-mock)     | Pending |
| Staging environment   | Full stack with observability            | VPN + SSH access               | Pending |
| GitHub Actions runner | CI pipeline for PR tests                 | Write access to .github/workflows | Ready |

**Access requests needed (if any):**

- [ ] Docker daemon access for Testcontainers (QA engineer local machine + CI runner)
- [ ] Staging environment VPN + SSH access (QA engineer)
- [ ] GitHub repository write access for CI workflow updates (QA engineer)

---

## Interworking & Regression

**Services and components impacted by this feature:**

| Service/Component      | Impact                                    | Regression Scope                                | Validation Steps                         |
| ---------------------- | ----------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| **Scraper microservice** | Redis job queue changes, bounded concurrency | Existing scraper tests must pass (10+ tests)    | Run `cd scraper && npm test`             |
| **Server API**         | Multi-tenant isolation, rate limiting changes | Existing API tests must pass (94+ tests)        | Run `cd server && npm run test:run`      |
| **Client UI**          | SSE reconnection logic, theme switching   | Existing E2E tests must pass (10+ tests)        | Run `npx playwright test`                |
| **Database migrations** | Idempotency enforcement                   | Existing migration tests must pass              | Run `cd server && npm run test:run src/db/system-queries.test.ts` |

**Regression test strategy:**

- **PR pipeline:** All existing tests (104 unit + 10 E2E) must pass before merge
- **Nightly pipeline:** Full regression suite including new tests (45 + 114 existing)
- **Cross-team coordination:** Backend team validates scraper job queue changes don't break existing scraper logic

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// P0 multi-tenant isolation test
test('@P0 @Security @MultiTenant user org A cannot view org B cinemas', async ({ request, page }) => {
  // Seed two isolated organizations
  const orgA = await request.post('/test/seed-org', {
    data: { slug: `org-a-${faker.string.alphanumeric(8)}`, name: 'Org A' },
  });
  const orgB = await request.post('/test/seed-org', {
    data: { slug: `org-b-${faker.string.alphanumeric(8)}`, name: 'Org B' },
  });

  const cinemaB = await request.post('/api/cinemas', {
    data: { name: 'Cinema B', allocine_id: 'C1234', org_id: orgB.data.id },
  });

  // Login as org A user
  await page.goto('/login');
  await page.fill('[data-testid="username"]', 'user-org-a');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');

  // Navigate to cinemas page
  await page.goto('/cinemas');

  // Assert: Cinema B not visible to org A user
  await expect(page.getByText('Cinema B')).not.toBeVisible();

  // Cleanup
  await request.delete(`/test/cleanup-org/${orgA.data.id}`);
  await request.delete(`/test/cleanup-org/${orgB.data.id}`);
});

// P1 Redis job queue load test
test('@P1 @Integration @Redis enqueue 100 jobs simultaneously', async ({ request }) => {
  const jobs = Array.from({ length: 100 }, (_, i) => ({
    cinemaId: `C${1000 + i}`,
    priority: 'normal',
  }));

  // Enqueue all jobs in parallel
  const results = await Promise.all(
    jobs.map(job =>
      request.post('/api/scraper/enqueue', { data: job })
    )
  );

  // Assert: All jobs accepted
  results.forEach(result => {
    expect(result.status()).toBe(202);
  });

  // Wait for processing (with timeout)
  await expect(async () => {
    const status = await request.get('/api/scraper/status');
    const body = await status.json();
    expect(body.queueLength).toBe(0); // All jobs processed
  }).toPass({ timeout: 60000 }); // 1 min max
});

// P1 SSE long-running connection test
test('@P1 @SSE @Performance SSE connection maintained during 10min scrape', async ({ page }) => {
  const events: string[] = [];

  // Setup SSE listener
  await page.goto('/scraper');
  await page.evaluate(() => {
    const eventSource = new EventSource('/api/scraper/progress');
    eventSource.onmessage = (event) => {
      window.sseEvents = window.sseEvents || [];
      window.sseEvents.push(event.data);
    };
  });

  // Trigger long scrape
  await page.click('[data-testid="scrape-all-button"]');

  // Wait 10 minutes, collect events
  await page.waitForTimeout(600000); // 10 min

  // Retrieve events from page
  const collectedEvents = await page.evaluate(() => window.sseEvents);

  // Assert: At least 20 events received (1 every 30s = 20 events in 10min)
  expect(collectedEvents.length).toBeGreaterThanOrEqual(20);

  // Assert: Final event indicates completion
  expect(collectedEvents[collectedEvents.length - 1]).toContain('completed');
});
```

**Run specific tags:**

```bash
# Run only P0 tests (critical path, ~5 min)
npx playwright test --grep @P0

# Run P0 + P1 tests (PR pipeline, ~12-15 min)
npx playwright test --grep "@P0|@P1"

# Run only security tests
npx playwright test --grep @Security

# Run only multi-tenant tests
npx playwright test --grep @MultiTenant

# Run only Redis/SSE/Integration tests
npx playwright test --grep "@Redis|@SSE|@Integration"

# Run all Playwright tests in PR (default)
npx playwright test
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `.opencode/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md` - Risk scoring methodology (Probability × Impact)
- **Test Priorities Matrix**: `.opencode/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md` - P0-P3 criteria and coverage targets
- **Test Levels Framework**: `.opencode/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md` - E2E vs API vs Unit selection rules
- **Test Quality**: `.opencode/skills/bmad-testarch-test-design/resources/knowledge/test-quality.md` - Definition of Done (no hard waits, <300 lines, <1.5 min, deterministic)
- **Playwright Utils**: `.opencode/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils/*.md` - API request fixtures, auth session, SSE utilities

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
**Date:** 2026-04-15
