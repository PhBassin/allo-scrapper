---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
workflowComplete: true
finalValidationDate: '2026-04-15'
validationStatus: 'PASSED'
validationChecks:
  frCoverage: 'PASS - 18/18 FRs covered'
  architectureCompliance: 'PASS - No starter template, JIT table creation'
  storyQuality: 'PASS - 31/31 stories implementable, no forward dependencies'
  epicStructure: 'PASS - 7 epics (1 blocker + 6 user value)'
  dependencyValidation: 'PASS - 0 forward dependencies detected'
  documentCompleteness: 'PASS - 1400 lines, 0 placeholders'
partyModeConsultation: true
partyModeAgents: ['Murat (TEA)', 'Winston (Architect)', 'Mary (Analyst)', 'John (PM)']
epicStructureRevision: 'Adopted Murat recommendation - consolidated from 9 to 7 epics'
preMortemAnalysis: true
preMortemDate: '2026-04-15'
preMortemRevisions: 'Effort estimates revised (48-64h → 86-120h), performance AC added to Epic 1, DLQ UI downgraded to API-only, implementation order documented for Epic 3, test matrices added to Epic 4 & 6'
fiveWhysAnalysis: true
fiveWhysDate: '2026-04-15'
fiveWhysImprovements: 'Added Definition of Done to all epics, Dependency Notes in Epic 1-3, Deployment Impact classification in Epic 3, Rollback Strategy for Epic 4, Out of Scope section for Story 2.6'
totalEpics: 7
totalStories: 31
originalEffortEstimate: '48-64h'
revisedEffortEstimate: '86-120h'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md'
  - '_bmad-output/test-artifacts/test-design/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design/test-design-architecture.md'
  - 'README.md'
  - '_bmad-output/project-context.md'
---

# allo-scrapper - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for allo-scrapper, decomposing the requirements from the TEA Test Design handoff, existing features documentation (README), and project context into implementable stories focused on test coverage, reliability, and quality improvements.

## Requirements Inventory

### Functional Requirements

**Extracted from TEA Test Design Handoff (Risk-Based Requirements):**

FR1: Multi-tenant data isolation - Users from organization A must not access data (cinemas, users, schedules) from organization B via UI or API
FR2: Redis job queue reliability - Scraper jobs must be processed without loss even under load (100+ concurrent jobs), with dead-letter queue for failed jobs
FR3: SSE connection stability - Real-time progress updates must maintain connection for long-running scrapes (10+ minutes) without abandonment
FR4: Rate limiting accuracy - Legitimate user bursts (3-5 rapid requests) must not trigger false positive rate limiting
FR5: Database migration idempotency - All migrations must be re-runnable without errors on both fresh and populated databases
FR6: Observability multi-tenant support - All traces, logs, and metrics must include organization context (org_id) for debugging
FR7: Test concurrency enablement - Playwright E2E tests must support parallel execution (workers > 1) to detect concurrency bugs
FR8: Theme switching consistency - White-label theme changes must apply consistently across all UI components without CSS conflicts
FR9: Email template validation - System emails must render correctly across email clients with proper branding

**Extracted from README.md (Existing Features requiring test coverage):**

FR10: Automated scraping with bounded concurrency - Scraper must respect concurrency limits (max 5 simultaneous) and handle rate limiting (HTTP 429)
FR11: Real-time progress via SSE - Server-sent events must deliver live scraping updates to clients
FR12: JWT authentication - Secure token-based authentication with session expiry handling
FR13: Role-based access control - Admin and user roles with granular permission assignment
FR14: White-label branding - Complete customization via admin panel (site name, logo, colors, fonts, footer)
FR15: Password management - Change password functionality for authenticated users
FR16: User management CRUD - Create, read, update, delete users with role assignment
FR17: Cinema and schedule management - CRUD operations for cinemas and movie schedules
FR18: Weekly reports - Track cinema programs and identify new releases

### NonFunctional Requirements

**Extracted from TEA Test Design Handoff:**

NFR1: Security - Multi-tenant isolation must be enforced at API, middleware, and database query levels with 100% P0 test coverage (Score 9, BLOCKER)
NFR2: Reliability - Redis job queue must process 100+ jobs without loss, with exponential backoff retry and dead-letter queue (Score 6, HIGH)
NFR3: Performance - SSE connections must remain stable for 10+ minute scrapes with 50+ concurrent clients (Score 6, HIGH)
NFR4: Usability - Rate limiting must have <1% false positive rate for legitimate user bursts (Score 6, HIGH)
NFR5: Maintainability - Database migrations must be idempotent and pass both fresh DB and re-run scenarios (Score 4, MEDIUM)
NFR6: Observability - All traces must include org_id for multi-tenant debugging (Score 4, MEDIUM)
NFR7: Test Quality - All P0 tests must execute in <15 minutes, P1 tests in <45 minutes, full suite in <90 minutes

**Extracted from project-context.md:**

NFR8: TypeScript Strict Mode - All packages must use strict mode with no `any` in security contexts (tenant isolation, JWT payloads, permissions)
NFR9: ESM Module System - All packages use `"type": "module"` with dynamic imports for optional features
NFR10: Error Handling - All errors must be logged with structured logging (Winston) including org_id/user_id/endpoint context
NFR11: Performance - Scraper parsing must process each page <100ms with profile constraints documented
NFR12: Content Security Policy - Strict CSP without unsafe-inline/unsafe-eval in script-src

**Extracted from README.md:**

NFR13: Docker Ready - Full containerization with multi-stage builds for linux/amd64
NFR14: Production Ready - Health checks, error handling, graceful shutdown, and database migrations
NFR15: CI/CD - Automated GitHub Actions workflow for Docker builds and releases
NFR16: Rate Limiting - Per-endpoint rate limiting (auth: 5 req/min, health: 10 req/min, protected: 10 req/min default)

### Additional Requirements

**From TEA Test Design Architecture Document:**

- **Pre-Implementation Blocker (Sprint 0):** Multi-tenant test fixture API must be implemented before RISK-001 tests can be written (`POST /test/seed-org`, `DELETE /test/cleanup-org/:id`)
- **Pre-Implementation Blocker (Sprint 0):** Redis Testcontainers setup required in CI for RISK-002 integration tests
- **Sprint +1 Dependency:** Dead-letter queue (DLQ) implementation required for RISK-002 tests (Redis job failures)
- **Sprint +1 Dependency:** SSE heartbeat mechanism (server sends ping every 30s) required for RISK-003 tests
- **Sprint +2 Documentation:** Rate limit windows per endpoint must be documented in README for RISK-004 test accuracy

**Infrastructure Requirements:**
- Prometheus metrics collection
- Grafana dashboards for observability
- Loki log aggregation
- Tempo distributed tracing (OpenTelemetry)
- Redis mandatory for job queue + progress pub/sub

**Security Requirements:**
- JWT secret validation (min 32 chars, forbidden defaults rejected)
- Health check endpoint rate limiting with localhost exemption (Docker/Kubernetes probes)
- Branded types for IDs to prevent mixing tenant_id/org_id/user_id

### UX Design Requirements

**Note:** No formal UX Design document exists. The following are inferred from test design handoff for testability:

UX-DR1: Add `data-testid` attributes to cinema list component for multi-tenant isolation validation (`cinema-list`)
UX-DR2: Add `data-testid` attributes to user management table for cross-tenant access validation (`user-management-table`)
UX-DR3: Add `data-testid` attributes to schedule calendar for cross-tenant schedule validation (`schedule-calendar`)
UX-DR4: Add `data-testid` attributes to 403 error messages for access denial validation (`403-error-message`)
UX-DR5: Add `data-testid` attributes to scrape progress components for real-time validation (`scrape-all-button`, `scrape-progress-card`, `scrape-status-completed`)
UX-DR6: Add `data-testid` attributes to SSE connection status indicators (`sse-connection-status`, `sse-reconnecting-indicator`)
UX-DR7: Add `data-testid` attributes to scrape progress details (`scrape-progress-percentage`, `scrape-progress-eta`)
UX-DR8: Add `data-testid` attributes to rate limiting error messages (`429-error-message`, `rate-limit-reset-timer`)
UX-DR9: Add `data-testid` attributes to DLQ admin panel components (`dlq-table`, `retry-button`)
UX-DR10: Add `data-testid` attributes to login form for rate limiting burst tests (`login-form`)

### FR Coverage Map

FR1: Epic 1 - Multi-tenant data isolation enforcement + observability integration
FR2: Epic 2 - Redis job queue reliability with DLQ
FR3: Epic 3 - SSE connection stability + rate limiting coexistence
FR4: Epic 3 - Rate limiting accuracy for legitimate bursts (merged with SSE)
FR5: Epic 4 - Database migration idempotency
FR6: Epic 1 - Observability with org_id context (integrated into multi-tenant epic)
FR7: Epic 0 - Playwright parallel execution enablement (technical blocker, not a full epic)
FR8: Epic 5 - White-label theme consistency
FR9: Epic 6 - Email template validation
FR10: Epic 2 - Automated scraping with bounded concurrency (existing feature coverage)
FR11: Epic 3 - Real-time progress via SSE (existing feature coverage)
FR12: Existing feature - JWT authentication already covered by auth tests (no new epic)
FR13: Existing feature - RBAC already covered by role management tests (no new epic)
FR14: Epic 5 - White-label branding (existing feature, adding consistency tests)
FR15: Existing feature - Password management already covered (no new epic)
FR16: Existing feature - User CRUD already covered (no new epic)
FR17: Existing feature - Cinema/schedule CRUD already covered (no new epic)
FR18: Existing feature - Weekly reports already covered (no new epic)

## Epic List

**Note:** This structure consolidates the original 9 epics into 7 (6 full epics + 1 technical blocker) based on architectural dependencies and test synergies identified during party mode discussion with Murat (TEA), Winston (Architect), Mary (Analyst), and John (PM).

**Key Changes:**
- Epic 0 added as technical blocker (Test Infrastructure Setup, 16-24h revised from 4-8h)
- Epic 1 now includes observability integration (security + debugging, 20-28h revised from 12-16h)
- Epic 2 scoped to API-only for DLQ (no admin UI in MVP, 16-20h revised from 12-16h)
- Epic 3 merges SSE + Rate Limiting with implementation order requirements (18-24h revised from 12-16h)
- Epic 4 includes test matrix for migration idempotency (8-12h revised from 4-6h)
- Epic 5-6 consolidate white-label quality with cross-client validation (4-6h each, revised from 2-4h)
- **Effort revised:** Original 48-64h → Realistic 86-120h (includes hidden tasks, buffers, and detailed test matrices)

### Epic 0: Test Infrastructure Setup (Technical Blocker)
QA can execute E2E tests in parallel (Playwright workers > 1) without flakiness. Test infrastructure prerequisites are in place: multi-tenant test fixtures API, Redis Testcontainers in CI, auto-cleanup utilities. This epic must complete before Epic 1 begins.

**FRs covered:** FR7
**NFRs covered:** NFR7 (Test quality), NFR15 (CI/CD)
**Effort:** 16-24 hours (revised from 4-8h - includes fixture API design, CI configuration, documentation, debugging)
**Priority:** ⚡ TECHNICAL BLOCKER - Must complete in Sprint 0 before any other epic

**Why Epic 0:** Without parallel test execution capability, the 13 E2E tests across Epics 1-3 create a CI bottleneck. This is a dependency, not a standalone epic delivering user value.

**Hidden Tasks Included in Estimate:**
- Fixture API architecture design and documentation (3-4h)
- Redis Testcontainers CI debugging (port conflicts, timeouts) (4-6h)
- Parallel execution flakiness debugging (2-4h)
- Test cleanup strategy documentation (1-2h)
- Code review and iteration (2-3h)

### Epic 1: Multi-Tenant Security & Isolation Hardening (with Observability)
Organizations in SaaS mode are completely isolated with zero cross-tenant data leakage. All traces, logs, and metrics include org_id for debugging. Security teams can validate isolation and trace suspicious cross-tenant access attempts through observability stack.

**FRs covered:** FR1, FR6
**NFRs covered:** NFR1 (Security Score 9 BLOCKER), NFR6 (Observability Score 4), NFR8 (TypeScript strict mode), NFR10 (Structured error logging)
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4
**Effort:** 20-28 hours (revised from 12-16h - includes trace validation, E2E performance tuning, parallel workers debugging)
**Priority:** 🔴 BLOCKER

**Why merged:** Observability is the detection mechanism for multi-tenant isolation failures. Testing security without validated tracing is incomplete. All security tests should assert org_id presence in logs/traces.

**Hidden Tasks Included in Estimate:**
- Trace validation across all endpoints (3-4h)
- E2E test performance optimization for <2min target (4-6h)
- Parallel worker isolation debugging (2-3h)
- Security violation alerting setup (2-3h)
- Code review and security audit (3-4h)

### Epic 2: Scraper Job Queue Reliability & Failure Handling
Cinema scraping jobs are reliable under load (100+ concurrent jobs) with zero job loss. Failed jobs automatically retry with exponential backoff and move to dead-letter queue after 3 failures. Admins have visibility into failed jobs via API endpoints (no UI in MVP).

**FRs covered:** FR2, FR10
**NFRs covered:** NFR2 (Reliability Score 6 HIGH), NFR14 (Production ready)
**UX-DRs covered:** UX-DR5
**Effort:** 16-20 hours (revised from 12-16h - includes DLQ API implementation, load testing setup, performance profiling)
**Priority:** 🔴 HIGH
**Epic Status:** 🟡 IN-PROGRESS — 5/6 stories done, 1 ready-for-dev (2.6 DLQ API endpoints)

**Progress (2026-04-26):**
- ✅ 2-1: DLQ support (PR #904, merged)
- ✅ 2-2: Exponential backoff retry (PR #906 + #907, merged)
- ✅ 2-3: Load testing 100 concurrent jobs (merged, test/story-2-3-redis-load)
- ✅ 2-4: Redis reconnection handling (PR #919, merged)
- ✅ 2-5: E2E scraper progress tracking 10 concurrent jobs (PR #921, merged — includes tenant-scoped SSE + useScrapeProgress hook)
- 🔵 2-6: DLQ API endpoints (story file created, ready-for-dev)

**Note on DLQ UI:** Story 2.6 scoped to API-only for MVP to prevent scope creep. Admin UI (table, filters, pagination, real-time updates) can be added in future epic if needed.

**Hidden Tasks Included in Estimate:**
- Load testing infrastructure setup (k6 scripts, test data generation) (3-4h)
- Performance profiling and optimization (2-3h)
- DLQ API endpoint implementation (2-3h)
- Redis connection resilience testing (2-3h)
- Code review and reliability validation (2-3h)

### Epic 3: Real-Time Communication & Protection (SSE + Rate Limiting)
Real-time scraping progress updates remain stable for long operations (10+ minutes) without connection abandonment. SSE connections automatically reconnect with heartbeat mechanism. Legitimate user bursts (3-5 rapid requests) are never blocked by false positive rate limiting. SSE long-polling does not trigger rate limits. Localhost exemption works for Docker health probes.

**FRs covered:** FR3, FR4, FR11
**NFRs covered:** NFR3 (Performance Score 6 HIGH), NFR4 (Usability Score 6 HIGH), NFR16 (Rate limiting per endpoint)
**UX-DRs covered:** UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR10
**Effort:** 18-24 hours (revised from 12-16h - includes client-side changes for SSE, burst testing scenarios, implementation order dependencies)
**Priority:** 🔴 HIGH

**Why merged:** SSE tests trigger rate limits if not designed together. E2E tests must validate that long-running SSE connections (10+ min) do not count against rate limit quotas. Shared test infrastructure and validation concerns.

**CRITICAL: Implementation Order**
These stories MUST be implemented in the following order to prevent blocking issues:

1. **Story 3.7 (localhost exemption) - MUST BE FIRST**
   - Prevents Docker health check failures in staging/CI
   - Blocks: Deployment to staging environment
   
2. **Story 3.1 (SSE heartbeat mechanism) - SECOND**
   - Enables long-running connection tests (10+ min)
   - Blocks: Stories 3.2, 3.3, 3.4 (all require stable SSE)
   
3. **Story 3.5 (rate limit burst scenarios) - THIRD**
   - Validates rate limits don't break SSE connections
   - Blocks: Story 3.6 (window reset depends on burst behavior)
   
4. **Stories 3.2, 3.3, 3.4, 3.6, 3.8 - CAN BE PARALLEL**
   - After Stories 3.1, 3.5, 3.7 complete, these can run in any order

**Hidden Tasks Included in Estimate:**
- Client-side SSE reconnection logic implementation (3-4h)
- Burst testing scenario setup (50+ concurrent clients) (2-3h)
- Rate limit window documentation and testing (2-3h)
- SSE + rate limit integration debugging (3-4h)
- Code review and integration testing (2-3h)

### Epic 4: Database Migration Reliability & Idempotency
Database schema migrations are safe and re-runnable on both fresh and populated databases. CI pipeline enforces idempotency validation. DevOps can apply migrations confidently without fear of schema corruption.

**FRs covered:** FR5
**NFRs covered:** NFR5 (Maintainability Score 4 MEDIUM), NFR14 (Production ready)
**Effort:** 8-12 hours (revised from 4-6h - includes test matrix for 4 scenarios, CI integration, migration template creation)
**Priority:** 🟡 MEDIUM

**Hidden Tasks Included in Estimate:**
- Migration idempotency template creation (1-2h)
- CI integration for automated validation (2-3h)
- Test matrix setup for 4 scenarios (2-3h)
- Migration rollback strategy documentation (1-2h)
- Code review and validation testing (2h)

### Epic 5: White-Label Theme Consistency & Validation
White-label theme changes apply uniformly across all UI components without CSS conflicts. Automated regression tests validate theme switching. CSP strict mode enforced without unsafe-inline/unsafe-eval.

**FRs covered:** FR8, FR14
**NFRs covered:** NFR12 (CSP strict)
**Effort:** 4-6 hours (revised from 2-4h - includes CSP strict mode testing, theme regression suite, cross-browser validation)
**Priority:** 🟢 LOW

**Hidden Tasks Included in Estimate:**
- CSP strict mode compatibility testing (iframe breakage detection) (1-2h)
- Theme regression test suite creation (1-2h)
- Cross-browser validation (Chrome, Firefox, Safari) (1h)
- Code review and CSP policy documentation (1h)

### Epic 6: Email Template Validation & Branding
System emails (password reset, notifications) render correctly across email clients (Gmail, Outlook, Apple Mail). Email branding matches white-label settings. Automated validation tests prevent email rendering regressions.

**FRs covered:** FR9
**NFRs covered:** NFR14 (Production ready)
**Effort:** 4-6 hours (revised from 2-4h - includes cross-client testing matrix, branding validation, email testing tool setup)
**Priority:** 🟢 LOW

**Hidden Tasks Included in Estimate:**
- Email testing tool setup (Litmus or Email on Acid integration) (1-2h)
- Cross-client testing matrix execution (4 clients) (1-2h)
- Branding consistency validation (white-label logo/colors) (1h)
- Code review and email template documentation (1h)

---

## Epic 0: Test Infrastructure Setup (Technical Blocker)

QA can execute E2E tests in parallel (Playwright workers > 1) without flakiness. Test infrastructure prerequisites are in place: multi-tenant test fixtures API, Redis Testcontainers in CI, auto-cleanup utilities. This epic must complete before Epic 1 begins.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Unit tests written and passing (coverage ≥80%)
- [ ] Integration tests written and passing
- [ ] Code review completed and approved
- [ ] CI pipeline green (tests + build + linting)
- [ ] Documentation updated (README, inline comments, troubleshooting guide)
- [ ] Performance validated (seed <500ms, cleanup <200ms, parallel workers=4 support)
- [ ] Deployed to staging and validated

### Story 0.1: Enable Playwright Parallel Execution

As a QA engineer,
I want to run Playwright E2E tests with workers > 1,
So that the test suite executes faster and detects concurrency bugs.

**Acceptance Criteria:**

**Given** the Playwright configuration file exists  
**When** I set `workers: 4` in `playwright.config.ts`  
**Then** all existing E2E tests pass without flakiness  
**And** test execution time is reduced by at least 50%  
**And** no test pollution occurs (tests are isolated from each other)  
**And** CI pipeline runs with `workers: 2` minimum

### Story 0.2: Implement Multi-Tenant Test Fixture API

As a QA engineer,
I want a test fixture API to seed and cleanup multi-tenant organizations,
So that I can write cross-tenant isolation tests without manual database setup.

**Acceptance Criteria:**

**Given** the server is running in test mode  
**When** I call `POST /test/seed-org` with organization data  
**Then** a new organization is created with isolated test data (users, cinemas, schedules)  
**And** the API returns the org_id and admin user credentials  
**And** the organization includes at least 2 test users, 3 test cinemas, and 10 test schedules  

**Given** a test organization exists  
**When** I call `DELETE /test/cleanup-org/:id`  
**Then** all org-scoped data is removed (users, cinemas, schedules, settings)  
**And** no orphaned data remains in the database  
**And** the operation completes in < 500ms

**Given** the application is in production mode  
**When** I attempt to call `/test/seed-org`  
**Then** the endpoint returns 404 Not Found  
**And** no test data can be created in production

**Performance & Parallel Execution Criteria:**

**Given** Playwright runs with `workers: 4`  
**When** 4 tests call `/test/seed-org` simultaneously  
**Then** 4 organizations are created without conflicts  
**And** each organization has unique org_id, usernames, cinema names  
**And** no database deadlocks or constraint violations occur  
**And** each seed operation completes in <500ms

**Given** multiple tests are running in parallel  
**When** each test calls `/test/cleanup-org/:id`  
**Then** only the specified org_id data is deleted  
**And** other parallel tests' data remains intact  
**And** cleanup completes in <200ms per organization

**Documentation Criteria:**

**Given** the fixture API is implemented  
**When** a developer reads the documentation  
**Then** the documentation includes:
- API endpoint signatures (POST /test/seed-org, DELETE /test/cleanup-org/:id)
- Example request/response payloads
- Cleanup strategy explanation (cascade delete vs truncate)
- Parallel execution safety guarantees
- Troubleshooting guide for common issues (port conflicts, orphaned data)

### Story 0.3: Setup Redis Testcontainers in CI

As a QA engineer,
I want Redis Testcontainers configured in the CI pipeline,
So that integration tests can run against a real Redis instance without manual setup.

**Acceptance Criteria:**

**Given** the GitHub Actions workflow exists  
**When** integration tests run in CI  
**Then** a Redis container is automatically started via Testcontainers  
**And** the container is accessible at `localhost:6379` from tests  
**And** the container is automatically cleaned up after tests complete  

**Given** Redis Testcontainers is configured  
**When** I run integration tests locally with `npm test`  
**Then** Redis Testcontainers starts automatically  
**And** developers do not need to manually run `docker compose up redis`

**Given** a Redis integration test fails  
**When** I inspect the CI logs  
**Then** Redis container logs are included in the test output  
**And** I can debug connection issues without re-running CI

### Story 0.4: Create Auto-Cleanup Test Utilities

As a QA engineer,
I want test cleanup utilities that automatically remove test data after each test,
So that tests remain isolated and do not pollute the database.

**Acceptance Criteria:**

**Given** a Playwright test fixture exists  
**When** I use `test.afterEach(cleanup)`  
**Then** all data created during the test is removed  
**And** the cleanup completes in < 500ms  
**And** cleanup failures are logged with details

**Given** multiple tests run in parallel  
**When** each test creates organizations via `/test/seed-org`  
**Then** each test's cleanup only removes its own data  
**And** no cross-test data deletion occurs  
**And** parallel tests do not interfere with each other

**Given** a test fails before reaching the cleanup step  
**When** the test framework exits  
**Then** a global cleanup hook removes all test organizations  
**And** no orphaned test data remains in the database

---

## Epic 1: Multi-Tenant Security & Isolation Hardening (with Observability)

Organizations in SaaS mode are completely isolated with zero cross-tenant data leakage. All traces, logs, and metrics include org_id for debugging. Security teams can validate isolation and trace suspicious cross-tenant access attempts through observability stack.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Unit tests written and passing (coverage ≥80%)
- [ ] Integration tests written and passing
- [ ] E2E tests written and passing (execution time <2min single worker, <5min with workers=4)
- [ ] Code review completed and approved
- [ ] Security review completed (multi-tenant isolation validated)
- [ ] CI pipeline green (tests + build + linting + security scan)
- [ ] Documentation updated (README, API docs, security model)
- [ ] Performance validated (test cleanup <500ms, no cross-test pollution)
- [ ] Observability validated (org_id in all traces/logs)
- [ ] Deployed to staging and validated

**Dependency on Epic 0:**
- All stories in this epic require Story 0.2 (Multi-Tenant Test Fixture API) to seed test organizations
- All stories in this epic require Story 0.4 (Auto-Cleanup Test Utilities) to remove test data after execution
- Stories 1.3, 1.4, 1.5 require Story 0.1 (Playwright Parallel Execution) for workers=4 support

### Story 1.1: Implement org_id Validation Middleware

As a security engineer,
I want all API requests to validate org_id from JWT against resource ownership,
So that users cannot access data from other organizations.

**Acceptance Criteria:**

**Given** a user is authenticated with org_id=A  
**When** they request `GET /api/cinemas?org_id=B`  
**Then** the API returns 403 Forbidden  
**And** the response includes error message "Cross-tenant access denied"  
**And** the attempt is logged with org_id, user_id, and requested org_id

**Given** a user is authenticated with org_id=A  
**When** they request `GET /api/cinemas` (no org_id in query)  
**Then** the API returns only cinemas where org_id=A  
**And** the query is automatically filtered by middleware  
**And** no cross-tenant data is leaked

**Given** a user attempts to manipulate org_id in request body  
**When** they send `POST /api/cinemas` with `{ "name": "Cinema", "org_id": "B" }`  
**Then** the API forces org_id to the authenticated user's org_id  
**And** the cinema is created with org_id=A (from JWT)  
**And** the manipulation attempt is logged as a security event

### Story 1.2: Add org_id to All Observability Traces

As a DevOps engineer,
I want all OpenTelemetry traces to include org_id as a span attribute,
So that I can filter traces by organization when debugging issues.

**Acceptance Criteria:**

**Given** a request is made by a user with org_id=A  
**When** the request is traced via OpenTelemetry  
**Then** the trace span includes attribute `org_id=A`  
**And** the attribute is present on all child spans  
**And** the trace is exportable to Tempo with org_id metadata

**Given** a scraper job is triggered for org_id=A  
**When** the job executes  
**Then** all scraper trace spans include `org_id=A`  
**And** the Redis job metadata includes org_id  
**And** SSE progress events include org_id in trace context

**Given** an error occurs during a request  
**When** the error is logged via Winston  
**Then** the log entry includes `org_id` field  
**And** the log is structured JSON with `{ org_id, user_id, endpoint, error }`  
**And** Loki can filter logs by org_id

### Story 1.3: E2E Multi-Tenant Cinema Isolation Test

As a QA engineer,
I want E2E tests that validate cinema data isolation between organizations,
So that I can prove users cannot view other organizations' cinemas.

**Acceptance Criteria:**

**Given** organization A has cinemas [Cinema A1, Cinema A2]  
**And** organization B has cinemas [Cinema B1, Cinema B2]  
**When** user from org A views the cinema list page  
**Then** only Cinema A1 and Cinema A2 are displayed  
**And** Cinema B1 and Cinema B2 are NOT visible  
**And** the `data-testid="cinema-list"` element contains exactly 2 items

**Given** user from org A is authenticated  
**When** they manually navigate to `/cinemas/:id` (Cinema B1's ID)  
**Then** the page shows 403 Forbidden error  
**And** the `data-testid="403-error-message"` element is visible  
**And** the error message explains cross-tenant access is blocked

**Given** user from org A is authenticated  
**When** they inspect network requests in browser DevTools  
**Then** `GET /api/cinemas` response contains only org A cinemas  
**And** no org B cinema IDs are leaked in any API response

**Performance & Cleanup Criteria:**

**Given** this test runs with Playwright `workers: 4`  
**When** the test executes  
**Then** the test completes in <2 minutes (single worker)  
**And** parallel execution with 4 workers completes in <5 minutes total  
**And** test cleanup removes all seeded organizations within 500ms  
**And** no orphan data remains after test completion

**Given** multiple instances of this test run in parallel  
**When** each creates test organizations via `/test/seed-org`  
**Then** organizations are isolated (no cross-test data pollution)  
**And** cleanup only removes each test's own data  
**And** parallel tests do not interfere with each other

### Story 1.4: E2E Multi-Tenant User Management Isolation Test

As a QA engineer,
I want E2E tests that validate user data isolation between organizations,
So that admins cannot view or edit users from other organizations.

**Acceptance Criteria:**

**Given** organization A has users [Alice, Admin A]  
**And** organization B has users [Bob, Admin B]  
**When** Admin A views the user management page  
**Then** only Alice and Admin A are displayed in `data-testid="user-management-table"`  
**And** Bob and Admin B are NOT visible

**Given** Admin A is authenticated  
**When** they attempt to edit user Bob (org B) via `PUT /api/users/:id`  
**Then** the API returns 403 Forbidden  
**And** Bob's user data is NOT modified  
**And** the attempt is logged as a security violation

**Given** Admin A is authenticated  
**When** they attempt to delete user Bob (org B) via `DELETE /api/users/:id`  
**Then** the API returns 403 Forbidden  
**And** Bob's user account is NOT deleted  
**And** a security alert is generated in logs

**Performance & Cleanup Criteria:**

**Given** this test runs with Playwright `workers: 4`  
**When** the test executes  
**Then** the test completes in <2 minutes (single worker)  
**And** parallel execution with 4 workers completes in <5 minutes total  
**And** test cleanup removes all seeded organizations within 500ms  
**And** no orphan user accounts remain after test completion

### Story 1.5: E2E Multi-Tenant Schedule Isolation Test

As a QA engineer,
I want E2E tests that validate schedule data isolation between organizations,
So that users cannot view screening schedules from other organizations.

**Acceptance Criteria:**

**Given** organization A has schedules for Cinema A1  
**And** organization B has schedules for Cinema B1  
**When** user from org A views the schedule calendar page  
**Then** only schedules from Cinema A1 are displayed in `data-testid="schedule-calendar"`  
**And** schedules from Cinema B1 are NOT visible

**Given** user from org A is authenticated  
**When** they request `GET /api/schedules?cinema_id=<Cinema B1 ID>`  
**Then** the API returns 403 Forbidden  
**And** no schedule data from Cinema B1 is returned

**Given** user from org A is authenticated  
**When** they inspect the schedule API response  
**Then** all schedule entries include org_id=A  
**And** no schedules with org_id=B are present in the response

**Performance & Cleanup Criteria:**

**Given** this test runs with Playwright `workers: 4`  
**When** the test executes  
**Then** the test completes in <2 minutes (single worker)  
**And** parallel execution with 4 workers completes in <5 minutes total  
**And** test cleanup removes all seeded schedules and cinemas within 500ms  
**And** no orphan schedule data remains after test completion

### Story 1.6: API-Level Tenant Isolation Enforcement Tests

As a QA engineer,
I want integration tests that validate tenant isolation at the API and database-client injection level,
So that org-scoped requests always execute in the correct tenant context and cannot leak cross-tenant data.

**Acceptance Criteria:**

**Given** a database query for cinemas is executed through an org-scoped SaaS route  
**When** the request is handled via the shared router/query stack  
**Then** the request uses the tenant-scoped database client attached by middleware  
**And** the effective query scope is bound to the authenticated tenant context  
**And** developers cannot accidentally bypass tenant scoping by falling back to the global DB client on org routes

**Given** a user with org_id=A makes a request  
**When** the request handler queries the database  
**Then** all queries are scoped to org_id=A  
**And** cross-tenant access attempts are rejected with a stable `403` contract before data is returned  
**And** no cross-tenant data is returned

**Given** a database change introduces a shared `public` table that stores multi-tenant rows in this area  
**When** the table is queried via the API  
**Then** the implementation includes explicit tenant filtering by authenticated org context  
**And** the migration includes a NOT NULL constraint on org_id column  
**And** the migration includes an index on org_id for performance

---

## Epic 2: Scraper Job Queue Reliability & Failure Handling

Cinema scraping jobs are reliable under load (100+ concurrent jobs) with zero job loss. Failed jobs automatically retry with exponential backoff and move to dead-letter queue after 3 failures. Admins have visibility into failed jobs via API endpoints (no UI in MVP).

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Unit tests written and passing (coverage ≥80%)
- [ ] Integration tests written and passing (Redis Testcontainers setup)
- [ ] Load tests written and passing (100+ concurrent jobs)
- [ ] Code review completed and approved
- [ ] CI pipeline green (tests + build + linting)
- [ ] Documentation updated (README, API docs, DLQ API endpoints)
- [ ] Performance validated (100+ jobs without loss, exponential backoff working)
- [ ] Deployed to staging and validated

**Dependency on Epic 0:**
- Story 2.3 (Load Testing) requires Story 0.3 (Redis Testcontainers in CI) for integration testing
- Story 2.5 (E2E Scraper Progress Tracking) requires Story 0.2 (Fixture API) for test data seeding

### Story 2.1: Implement Dead-Letter Queue for Failed Scraper Jobs

As a DevOps engineer,
I want failed scraper jobs to move to a dead-letter queue after 3 retry attempts,
So that failed jobs don't block the queue and can be debugged later.

**Acceptance Criteria:**

**Given** a scraper job fails 3 times with exponential backoff (1s, 2s, 4s)  
**When** the 3rd retry fails  
**Then** the job is moved to the dead-letter queue (DLQ)  
**And** the DLQ entry includes metadata: job_id, failure_reason, retry_count, timestamp, cinema_id, org_id  
**And** the job is removed from the active queue

**Given** a job is in the DLQ  
**When** I query `GET /api/scraper/dlq`  
**Then** the API returns all DLQ jobs with metadata  
**And** jobs are sorted by timestamp (most recent first)  
**And** the response includes pagination (max 50 jobs per page)

**Given** a job is in the DLQ  
**When** an admin clicks "Retry" in the admin panel  
**Then** the job is re-queued to the active queue  
**And** the retry counter is reset to 0  
**And** the job executes with fresh attempts

### Story 2.2: Add Exponential Backoff Retry Logic for Redis Failures

As a backend developer,
I want Redis connection failures to retry with exponential backoff,
So that transient Redis issues don't cause immediate job failures.

**Acceptance Criteria:**

**Given** a Redis connection timeout occurs when enqueuing a job  
**When** the timeout is detected  
**Then** the operation retries after 1 second  
**And** if the 2nd attempt fails, retry after 2 seconds  
**And** if the 3rd attempt fails, move job to DLQ

**Given** a job is being dequeued from Redis  
**When** Redis crashes mid-dequeue  
**Then** the job is marked as failed in Redis  
**And** the failure is logged with structured metadata (job_id, error, timestamp)  
**And** the job is retried with exponential backoff

**Given** exponential backoff is implemented  
**When** I run unit tests for retry logic  
**Then** delays are calculated correctly: [1s, 2s, 4s]  
**And** the test validates that after 3 failures, DLQ is invoked  
**And** no infinite retry loops occur

### Story 2.3: Redis Job Queue Load Testing (100+ Concurrent Jobs)

As a QA engineer,
I want integration tests that enqueue 100+ jobs simultaneously,
So that I can validate zero job loss under high load.

**Acceptance Criteria:**

**Given** the Redis job queue is running  
**When** I enqueue 100 scraper jobs simultaneously  
**Then** all 100 jobs are processed without loss  
**And** job processor respects p-limit concurrency (max 5 simultaneous)  
**And** all jobs complete within 5 minutes

**Given** 100 jobs are processing  
**When** I monitor Redis queue depth  
**Then** the queue depth decreases steadily  
**And** no jobs are stuck in "processing" state for > 2 minutes  
**And** completed jobs are removed from the queue

**Given** a job fails midway during load test  
**When** the failure is detected  
**Then** the job is marked as failed in Redis  
**And** the job enters retry logic (exponential backoff)  
**And** other jobs continue processing without interruption

### Story 2.4: Redis Reconnection Handling During Job Processing

As a backend developer,
I want the job processor to handle Redis disconnections gracefully,
So that in-flight jobs are resumed after reconnection.

**Acceptance Criteria:**

**Given** Redis disconnects while a job is processing  
**When** the disconnection is detected  
**Then** the job processor pauses and attempts to reconnect  
**And** reconnection retries with exponential backoff (1s, 2s, 4s)  
**And** in-flight jobs are NOT marked as failed during reconnection

**Given** Redis reconnects successfully  
**When** the connection is restored  
**Then** the job processor resumes processing jobs  
**And** jobs that were paused are resumed from the last checkpoint  
**And** no jobs are duplicated or lost

**Given** Redis fails to reconnect after 3 attempts  
**When** the final reconnection attempt fails  
**Then** all in-flight jobs are moved to DLQ  
**And** the job processor logs a critical error  
**And** an alert is sent to the DevOps team (if alerting is configured)

### Story 2.5: E2E Scraper Progress Tracking with 10+ Concurrent Jobs

As a QA engineer,
I want E2E tests that trigger 10 scrapes simultaneously,
So that I can validate real-time progress tracking under load.

**Acceptance Criteria:**

**Given** 10 cinema scrapes are triggered via the UI  
**When** all scrapes start processing  
**Then** all 10 jobs show progress updates in real-time via SSE  
**And** each `data-testid="scrape-progress-card"` displays the correct cinema name  
**And** progress percentages update at least every 5 seconds

**Given** 10 scrapes are running  
**When** all scrapes complete  
**Then** all 10 `data-testid="scrape-status-completed"` elements are visible  
**And** no scrapes are stuck in "processing" state  
**And** the completion time is within 2 minutes

**Given** a scrape fails during concurrent execution  
**When** the failure occurs  
**Then** the failed scrape shows error status in the UI  
**And** the error message is displayed in the progress card  
**And** other scrapes continue processing without interruption

### Story 2.6: DLQ API Endpoints (API-Only, No UI)

> **Reconciled 2026-04-26** (Sprint Change Proposal 2026-04-26): Story 2.1 / PR #904 already shipped
> `GET /api/scraper/dlq` and `POST /api/scraper/dlq/:jobId/retry`. Story 2.6 adds the missing
> single-job GET and mounts admin-prefix aliases. Canonical path remains `/api/scraper/dlq`.

As an admin,
I want API endpoints to query and retry failed jobs from the DLQ,
So that I can programmatically manage scraping failures (UI can be added in future epic).

**Acceptance Criteria:**

**Given** failed jobs exist in the DLQ  
**When** I request `GET /api/scraper/dlq` (canonical) or `GET /api/admin/scraper/dlq` (alias)  
**Then** the API returns `{ success: true, data: DlqJobListResult }` where `DlqJobListResult` is `{ jobs: DlqJobEntry[], total, page, pageSize }`  
**And** each `DlqJobEntry` includes: `job_id`, `job` (full payload), `failure_reason`, `retry_count`, `timestamp`, `cinema_id`, `org_id`  
**And** jobs are sorted by `timestamp` descending  
**And** pagination defaults `page=1, pageSize=50`, max `pageSize=50`  
**And** non-system-role callers only see jobs for their own `org_id`

**Given** I want details on a specific DLQ job  
**When** I request `GET /api/scraper/dlq/:jobId` (canonical) or `GET /api/admin/scraper/dlq/:jobId` (alias)  
**Then** the API returns `{ success: true, data: DlqJobEntry }` for that job  
**And** a 404 is returned if the job does not exist or is out-of-scope for the caller

**Given** I want to retry a failed job  
**When** I request `POST /api/scraper/dlq/:jobId/retry` (canonical) or `POST /api/admin/scraper/dlq/:jobId/retry` (alias)  
**Then** the job is re-queued to the active Redis queue and removed from the DLQ  
**And** the API returns **200 OK** with `{ success: true, data: DlqJobEntry }` (the republished entry)  
**And** a 404 is returned if the job is not found or is out-of-scope

**Given** I request any DLQ endpoint without a valid session  
**Then** the API returns **401 Unauthorized**

**Given** I have a valid session but lack scraper-management permission  
**Then** the API returns **403 Forbidden** with `{ success: false, error: 'Permission denied' }`

**Scope Note:**
This story is **API-only** to prevent scope creep. Admin UI (table, filters, pagination, real-time updates via SSE) can be added in a future epic if needed. For MVP, admins can use curl/Postman to query and retry DLQ jobs.

**Future UI Considerations (Out of Scope for MVP):**
- Frontend table component with `data-testid="dlq-table"`
- Retry button UI with `data-testid="retry-button"`
- Real-time DLQ updates via SSE
- Filters (by cinema, org, date range)
- Pagination controls
- Estimated effort for UI: 8-12h additional

---

## Epic 3: Real-Time Communication & Protection (SSE + Rate Limiting)

Real-time scraping progress updates remain stable for long operations (10+ minutes) without connection abandonment. SSE connections automatically reconnect with heartbeat mechanism. Legitimate user bursts (3-5 rapid requests) are never blocked by false positive rate limiting. SSE long-polling does not trigger rate limits. Localhost exemption works for Docker health probes.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Unit tests written and passing (coverage ≥80%)
- [ ] Integration tests written and passing (SSE long-running tests, rate limit burst scenarios)
- [ ] E2E tests written and passing (50+ concurrent clients, 10+ minute SSE connections)
- [ ] Code review completed and approved
- [ ] CI pipeline green (tests + build + linting)
- [ ] Documentation updated (README with rate limit windows, SSE reconnection strategy)
- [ ] Performance validated (SSE stable 10+ min, rate limits <1% false positives)
- [ ] Deployment impact assessed (see per-story classification below)
- [ ] Deployed to staging and validated

**Dependency on Epic 0:**
- Story 3.2, 3.3, 3.4 require Story 0.1 (Playwright Parallel Execution) for concurrent client testing

### Story 3.1: Implement SSE Heartbeat Mechanism

As a backend developer,
I want the server to send SSE heartbeat pings every 30 seconds,
So that long-running connections stay alive and clients can detect disconnections.

**Acceptance Criteria:**

**Given** a client connects to `/api/scraper/progress`  
**When** no scrape jobs are active  
**Then** the server sends a `ping` event every 30 seconds  
**And** the event data is `{ type: "ping", timestamp: <ISO8601> }`  
**And** the connection remains open

**Given** a scrape job is running for 10+ minutes  
**When** the job is processing  
**Then** heartbeat pings are sent every 30 seconds alongside progress events  
**And** the connection does NOT timeout  
**And** clients receive both ping and progress events

**Given** no activity occurs on SSE connection for 15 minutes  
**When** the inactivity timeout is reached  
**Then** the server closes the connection gracefully  
**And** the client receives a close event  
**And** the connection cleanup is logged

**Deployment Impact:**
- 🟡 **SAFE:** Can deploy independently, no breaking changes
- **Config Required:** None
- **Rollback Safe:** Yes (heartbeat is optional feature, clients ignore unknown events)
- **Infrastructure Impact:** None (existing SSE endpoint, additive feature)

### Story 3.2: Implement Client SSE Reconnection Logic

As a frontend developer,
I want the client to detect missing heartbeats and reconnect automatically,
So that users don't lose progress updates during network interruptions.

**Acceptance Criteria:**

**Given** the client is connected to SSE  
**When** no ping event is received for 60 seconds  
**Then** the client detects a missing heartbeat  
**And** the `data-testid="sse-connection-status"` shows "Reconnecting..."  
**And** the client triggers EventSource reconnection

**Given** the client reconnects successfully  
**When** the connection is re-established  
**Then** the `data-testid="sse-connection-status"` shows "Connected"  
**And** the client resumes receiving progress events  
**And** no progress data is lost (idempotent event IDs)

**Given** the client reconnects after a network interruption  
**When** the server sends the next progress event  
**Then** the client displays the correct progress percentage  
**And** the `data-testid="scrape-progress-percentage"` is updated  
**And** the `data-testid="scrape-progress-eta"` is recalculated

**Deployment Impact:**
- 🟡 **SAFE:** Can deploy independently, client-side change only
- **Config Required:** None
- **Rollback Safe:** Yes (graceful degradation if server heartbeat not available)
- **Infrastructure Impact:** None

### Story 3.3: SSE Long-Running Connection Validation (10+ Minutes)

As a QA engineer,
I want E2E tests that validate SSE connections remain stable for 10+ minute scrapes,
So that long-running operations don't timeout or disconnect.

**Acceptance Criteria:**

**Given** a scrape is triggered that takes 10+ minutes  
**When** the scrape is processing  
**Then** the SSE connection remains open for the entire duration  
**And** progress updates are received at least every 30 seconds  
**And** no connection timeouts occur

**Given** a 10-minute scrape is running  
**When** I monitor network activity  
**Then** heartbeat pings are sent every 30 seconds  
**And** progress events are sent whenever scrape progress changes  
**And** the connection shows as "open" in browser DevTools

**Given** the server sends progress events  
**When** I inspect the event data  
**Then** each event includes a unique event ID (for idempotency)  
**And** event IDs are monotonically increasing  
**And** the client can resume from the last event ID after reconnection

**Deployment Impact:**
- 🟢 **TEST-ONLY:** No deployment impact (E2E test, not production code)
- **Config Required:** None
- **Rollback Safe:** N/A (test suite)

### Story 3.4: SSE Concurrent Client Load Test (50+ Clients)

As a QA engineer,
I want integration tests that validate 50+ simultaneous SSE clients,
So that the server can handle high concurrency without latency.

**Acceptance Criteria:**

**Given** 50 clients connect to `/api/scraper/progress` simultaneously  
**When** all clients are connected  
**Then** all clients receive heartbeat pings every 30 seconds  
**And** no client experiences > 1 second latency for events  
**And** the server memory usage remains stable (< 512MB total)

**Given** a scrape job broadcasts progress to 50 connected clients  
**When** a progress event is emitted  
**Then** all 50 clients receive the event within 1 second  
**And** event delivery order is consistent across clients  
**And** no clients are disconnected due to server overload

**Given** 50 clients are connected  
**When** I stop the server gracefully  
**Then** all clients receive a close event  
**And** no clients encounter abrupt disconnections  
**And** the server shutdown completes in < 5 seconds

**Deployment Impact:**
- 🟢 **TEST-ONLY:** No deployment impact (integration test, not production code)
- **Config Required:** None
- **Rollback Safe:** N/A (test suite)

### Story 3.5: Rate Limiting Burst Scenario Tests

As a QA engineer,
I want E2E tests that validate legitimate user bursts are not rate limited,
So that normal usage patterns don't trigger false positives.

**Acceptance Criteria:**

**Given** a user is authenticated  
**When** they make 3 successful login attempts in 10 seconds  
**Then** all 3 requests succeed (200 OK)  
**And** no 429 Too Many Requests errors occur  
**And** the user is not blocked

**Given** a user refreshes the page 5 times in 5 seconds  
**When** the page refresh requests are sent  
**Then** all 5 requests succeed  
**And** no rate limiting is triggered  
**And** the user can continue using the application

**Given** a user makes 11 requests in 60 seconds to a protected endpoint  
**When** the 11th request is sent  
**Then** the request receives 429 Too Many Requests  
**And** the `data-testid="429-error-message"` is displayed  
**And** the error message includes retry-after time

**Deployment Impact:**
- 🟡 **SAFE:** Can deploy independently, validates existing rate limit behavior
- **Config Required:** None (tests existing rate limit configuration)
- **Rollback Safe:** N/A (test suite)
- **Note:** This story validates that SSE long-polling is NOT rate-limited (critical for Epic 3 merge)

### Story 3.6: Rate Limiting Window Reset Validation

As a QA engineer,
I want E2E tests that validate rate limit windows reset correctly,
So that users can resume normal usage after the window expires.

**Acceptance Criteria:**

**Given** a user is rate limited (received 429)  
**When** they wait 60 seconds for the window to reset  
**Then** the next request succeeds (200 OK)  
**And** the rate limit counter is reset to 0  
**And** the user can make 10 more requests

**Given** a user receives a 429 error  
**When** they inspect the response headers  
**Then** the response includes `Retry-After: 60` header  
**And** the `data-testid="rate-limit-reset-timer"` shows countdown  
**And** the timer updates every second

**Given** multiple users share the same endpoint  
**When** user A is rate limited  
**Then** user B can still make requests  
**And** each user has independent rate limit counters  
**And** no shared state causes false positives

**Deployment Impact:**
- 🟢 **TEST-ONLY:** No deployment impact (E2E test, validates window reset behavior)
- **Config Required:** None
- **Rollback Safe:** N/A (test suite)

### Story 3.7: Localhost Exemption for Docker Health Probes

As a DevOps engineer,
I want localhost requests to be exempt from rate limiting,
So that Docker health probes don't trigger 429 errors.

**Acceptance Criteria:**

**Given** a Docker health probe sends requests to `/api/health` every 10 seconds  
**When** the requests originate from `127.0.0.1` or `::1`  
**Then** no rate limiting is applied  
**And** the health probe never receives 429 errors  
**And** health checks succeed continuously

**Given** a request is made from a non-localhost IP  
**When** the request is sent to `/api/health`  
**Then** rate limiting is applied (10 req/min)  
**And** the 11th request within 60 seconds receives 429  
**And** localhost exemption does NOT apply

**Given** I run integration tests for health check endpoint  
**When** I send 20 requests in 10 seconds from localhost  
**Then** all 20 requests succeed  
**And** no rate limiting is triggered  
**And** the exemption logic is validated

**Deployment Impact:**
- 🔴 **BLOCKER:** Must deploy BEFORE any rate limiting changes to prevent health check failures
- **Config Required:** None (code-only change)
- **Rollback Safe:** Yes (localhost exemption is additive, not breaking)
- **Infrastructure Impact:** CRITICAL - Docker/Kubernetes health probes depend on this
- **Note:** This is Story #1 in implementation order (see Epic 3 header)

### Story 3.8: Rate Limiting Documentation

As a developer,
I want rate limiting windows documented per endpoint in README.md,
So that API consumers understand limits and avoid hitting 429 errors.

**Acceptance Criteria:**

**Given** the README.md file exists  
**When** I navigate to the "Rate Limiting" section  
**Then** a table lists all endpoints with their rate limits  
**And** the table columns include: Endpoint, Limit (req/min), Exemptions  
**And** examples include `/api/auth/login: 5 req/min, no exemptions`

**Given** the documentation is complete  
**When** I read the rate limiting section  
**Then** the documentation explains retry-after behavior  
**And** the documentation includes code examples for handling 429 errors  
**And** the documentation lists localhost exemption rules

**Given** a developer integrates with the API  
**When** they read the rate limiting docs  
**Then** they understand how to implement exponential backoff  
**And** they know which endpoints have exemptions  
**And** they can test rate limiting in a dev environment

**Deployment Impact:**
- 🟢 **DOCUMENTATION-ONLY:** No deployment impact
- **Config Required:** None
- **Rollback Safe:** N/A (documentation update)

---

## Epic 4: Database Migration Reliability & Idempotency

Database schema migrations are safe and re-runnable on both fresh and populated databases. CI pipeline enforces idempotency validation. DevOps can apply migrations confidently without fear of schema corruption.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Unit tests written and passing (idempotency tests for 4 scenarios)
- [ ] CI integration tests passing (fresh DB + re-run validation)
- [ ] Code review completed and approved
- [ ] CI pipeline green (migration validation automated)
- [ ] Documentation updated (migration template, rollback strategy)
- [ ] Rollback strategy documented and tested
- [ ] Deployed to staging and validated

### Story 4.1: Enforce Migration Idempotency Checks in Migrations

As a backend developer,
I want all migrations to check if schema elements exist before creating them,
So that migrations can be re-run safely without errors.

**Acceptance Criteria:**

**Given** a migration adds a new column  
**When** the migration script executes  
**Then** the script checks if the column exists before adding it  
**And** if the column exists, the migration logs "Column already exists, skipping"  
**And** if the column doesn't exist, the migration adds it and logs "Column added successfully"

**Given** a migration creates a new table  
**When** the migration script executes  
**Then** the script uses `CREATE TABLE IF NOT EXISTS`  
**And** the migration succeeds on both fresh and populated databases  
**And** no duplicate table errors occur

**Given** a migration creates an index  
**When** the migration script executes  
**Then** the script checks if the index exists before creating it  
**And** if the index exists, the migration skips creation  
**And** if the index doesn't exist, the migration creates it

**Test Matrix - Migration Idempotency Validation:**

All migrations must pass the following 4 test scenarios:

- [ ] **Scenario 1:** Fresh database + run migration once → SUCCESS
- [ ] **Scenario 2:** Fresh database + run migration twice (idempotency test) → SUCCESS (no errors on 2nd run)
- [ ] **Scenario 3:** Populated database (existing data) + run migration once → SUCCESS
- [ ] **Scenario 4:** Populated database + run migration twice → SUCCESS (no errors on 2nd run)

**Given** a new migration is created  
**When** the migration is submitted for code review  
**Then** the migration includes comments documenting idempotency strategy  
**And** the migration has been tested against all 4 scenarios above  
**And** test results are included in the PR description

**Rollback Strategy:**

**Scenario 1: Migration fails during execution**
- **Action:** Transaction auto-rollback (BEGIN/COMMIT wrapper)
- **Validation:** Check schema state unchanged via `information_schema`
- **Downtime:** 0 minutes (atomic transaction)

**Scenario 2: Migration succeeds but breaks application**
- **Action:** Run reverse migration (DROP column IF EXISTS, DROP table IF EXISTS)
- **Validation:** Application logs show no schema errors
- **Downtime:** 2-5 minutes (deploy reverse migration)

**Scenario 3: Migration succeeds but data is corrupted**
- **Action:** Restore from backup + replay WAL logs
- **Validation:** Data integrity checks pass
- **Downtime:** 15-60 minutes (depends on DB size)

### Story 4.2: Add Verification Steps to All Migrations

As a database administrator,
I want migrations to include verification steps that confirm schema changes,
So that migration failures are detected immediately.

**Acceptance Criteria:**

**Given** a migration adds a column  
**When** the migration completes  
**Then** a verification step queries `information_schema.columns`  
**And** if the column exists, the migration logs "Migration successful"  
**And** if the column is missing, the migration raises an exception

**Given** a migration creates a table  
**When** the migration completes  
**Then** a verification step queries `information_schema.tables`  
**And** if the table exists, the migration logs "Table created successfully"  
**And** if the table is missing, the migration raises an exception

**Given** a migration verification fails  
**When** the exception is raised  
**Then** the migration transaction is rolled back  
**And** the database state is unchanged  
**And** the failure is logged with detailed error context

**Rollback Strategy:**

**Scenario 1: Verification fails (schema element missing)**
- **Action:** Automatic transaction rollback (RAISE EXCEPTION triggers ROLLBACK)
- **Validation:** Schema state verified unchanged
- **Downtime:** 0 minutes (atomic transaction)

**Scenario 2: Verification passes but post-deployment issues occur**
- **Action:** Same as Story 4.1 Scenario 2 (reverse migration)
- **Validation:** Verification steps in reverse migration confirm cleanup
- **Downtime:** 2-5 minutes

### Story 4.3: CI Pipeline Migration Idempotency Validation

As a DevOps engineer,
I want the CI pipeline to run all migrations twice (fresh + re-run),
So that non-idempotent migrations are caught before production deployment.

**Acceptance Criteria:**

**Given** the CI pipeline runs database tests  
**When** migrations are executed  
**Then** the pipeline runs migrations on a fresh database first  
**And** all migrations succeed on the fresh database  
**And** the pipeline then re-runs the same migrations  
**And** all migrations succeed on the re-run (idempotency validated)

**Given** a migration fails on re-run  
**When** the idempotency check detects the failure  
**Then** the CI pipeline fails with a clear error message  
**And** the error message indicates which migration is not idempotent  
**And** the pull request is blocked until the migration is fixed

**Given** all migrations pass idempotency checks  
**When** the CI pipeline completes  
**Then** a success log confirms "All migrations are idempotent"  
**And** the pull request can be merged  
**And** deployment to staging is unblocked

**Rollback Strategy:**

**Scenario 1: CI detects non-idempotent migration**
- **Action:** Block PR merge, require migration fix
- **Validation:** CI re-runs after fix, confirms idempotency
- **Downtime:** 0 minutes (caught before production)

**Scenario 2: CI passes but production migration fails**
- **Action:** Same as Story 4.1 rollback strategies
- **Validation:** CI validation reduces risk, but production rollback may still be needed
- **Downtime:** Depends on scenario (0-60 minutes)

---

## Epic 5: White-Label Theme Consistency & Validation

White-label theme changes apply uniformly across all UI components without CSS conflicts. Automated regression tests validate theme switching. CSP strict mode enforced without unsafe-inline/unsafe-eval.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] E2E tests written and passing (theme regression suite, CSP validation)
- [ ] Code review completed and approved
- [ ] CI pipeline green (tests + build + linting)
- [ ] Documentation updated (CSP policy, theme customization guide)
- [ ] Cross-browser validated (Chrome, Firefox, Safari)
- [ ] Deployed to staging and validated

### Story 5.1: Theme Switching E2E Regression Tests

As a QA engineer,
I want E2E tests that validate theme changes apply consistently across all pages,
So that white-label customizations don't cause CSS conflicts.

**Acceptance Criteria:**

**Given** an admin changes the primary color to #FF5733  
**When** the theme is saved  
**Then** all buttons across the application use #FF5733  
**And** the header background uses the secondary color  
**And** no CSS conflicts or overrides occur

**Given** an admin changes the heading font to "Poppins"  
**When** the theme is saved  
**Then** all h1-h6 elements use "Poppins" font  
**And** body text uses the configured body font  
**And** font loading is tested across all pages

**Given** a theme is applied  
**When** I navigate to multiple pages (home, admin, cinema list)  
**Then** all pages reflect the custom theme  
**And** no pages show default Allo-Scrapper branding  
**And** the theme is consistent across all components

### Story 5.2: CSP Strict Mode Validation

As a security engineer,
I want the application to enforce CSP without unsafe-inline/unsafe-eval,
So that XSS vulnerabilities are mitigated.

**Acceptance Criteria:**

**Given** the application is running  
**When** I inspect the HTTP response headers  
**Then** the `Content-Security-Policy` header is present  
**And** the policy does NOT include `unsafe-inline` in `script-src`  
**And** the policy does NOT include `unsafe-eval` in `script-src`

**Given** a white-label theme is applied  
**When** the theme CSS is loaded  
**Then** no inline styles are used in HTML  
**And** all styles are loaded via external CSS files  
**And** CSP validation passes in browser DevTools

**Given** CSP strict mode is enforced  
**When** I run E2E tests  
**Then** no CSP violations are logged in browser console  
**And** all theme customizations load correctly  
**And** no blocked resources are detected

---

## Epic 6: Email Template Validation & Branding

System emails (password reset, notifications) render correctly across email clients (Gmail, Outlook, Apple Mail). Email branding matches white-label settings. Automated validation tests prevent email rendering regressions.

**Definition of Done (applies to ALL stories in this epic):**
- [ ] All acceptance criteria met (Given/When/Then validated)
- [ ] Email rendering tests passing across 6 email clients (test matrix validated)
- [ ] Code review completed and approved
- [ ] CI pipeline green (tests + build + linting)
- [ ] Documentation updated (email template customization guide)
- [ ] Email testing tool configured (Litmus or Email on Acid)
- [ ] Deployed to staging and validated

### Story 6.1: Email Template Cross-Client Rendering Tests

As a QA engineer,
I want integration tests that validate email rendering across email clients,
So that emails display correctly in Gmail, Outlook, and Apple Mail.

**Acceptance Criteria:**

**Given** a password reset email is generated  
**When** the email HTML is rendered  
**Then** the email passes HTML validation (no unclosed tags)  
**And** the email uses table-based layout (compatible with Outlook)  
**And** images are embedded or hosted with absolute URLs

**Given** an email template is rendered  
**When** I test it with Litmus or Email on Acid simulation  
**Then** the email displays correctly in Gmail (web + mobile)  
**And** the email displays correctly in Outlook 2016/2019  
**And** the email displays correctly in Apple Mail (macOS + iOS)

**Given** an email includes branding customization  
**When** the email is sent  
**Then** the header color matches the white-label settings  
**And** the logo is displayed with correct dimensions  
**And** the footer text matches the configured branding

**Test Matrix - Email Client Compatibility:**

All email templates must pass rendering tests on the following email clients:

- [ ] **Gmail Web** (Chrome browser, latest version)
- [ ] **Gmail Mobile** (iOS Gmail app, latest version)
- [ ] **Outlook 2016** (Windows desktop client)
- [ ] **Outlook 2019** (Windows desktop client)
- [ ] **Apple Mail** (macOS, latest version)
- [ ] **iOS Mail** (iPhone, latest iOS version)

**Testing Tool:** Use Litmus or Email on Acid for automated rendering tests

**Given** an email template is updated  
**When** the template is submitted for code review  
**Then** screenshots from all 6 email clients above are included in PR  
**And** any rendering issues are documented and resolved  
**And** the PR description confirms all clients pass validation

### Story 6.2: Email Template Branding Consistency

As an admin,
I want system emails to reflect my organization's white-label branding,
So that emails are consistent with the application's visual identity.

**Acceptance Criteria:**

**Given** an organization has custom email branding configured  
**When** a password reset email is sent  
**Then** the email header background uses the configured header color  
**And** the email footer text matches the configured footer text  
**And** the "From Name" and "From Address" match the configured values

**Given** the white-label branding is updated  
**When** a new email is sent  
**Then** the email reflects the updated branding  
**And** previously sent emails retain old branding (no retroactive changes)  
**And** the email template cache is cleared after branding updates

**Given** no custom branding is configured  
**When** an email is sent  
**Then** the email uses default Allo-Scrapper branding  
**And** the fallback branding is professional and complete  
**And** no broken placeholders or missing values are present

---

## Progress (2026-05-01 — BMAD Sync)

**Status at sync date:** 4 of 7 epics complete (26/31 stories done — 84%)

### Epic 0 — Test Infrastructure Setup ✅ DONE
| Story | Status | PR |
|-------|--------|----|
| 0-1 — Playwright parallel execution | done | #861 |
| 0-2 — Multi-tenant test fixture API | done | #869 |
| 0-3 — Redis Testcontainers in CI | done | #872 |
| 0-4 — Auto-cleanup test utilities | done | #875 |

### Epic 1 — Multi-Tenant Security & Isolation ✅ DONE
| Story | Status | PR |
|-------|--------|----|
| 1-1 — Org ID validation middleware | done | #878 |
| 1-2 — Org ID to observability traces | done | #881 |
| 1-3 — E2E cinema isolation test | done | #884 |
| 1-4 — E2E user management isolation | done | #888 |
| 1-5 — E2E schedule isolation test | done | #891 |
| 1-6 — API-level tenant isolation tests | done | #895 |
| Retrospective | done | epic-1-retro-2026-04-21.md |

### Epic 2 — Scraper Job Queue Reliability ✅ DONE
| Story | Status | PR |
|-------|--------|----|
| 2-1 — Dead Letter Queue | done | #900 |
| 2-2 — Exponential backoff retry | done | #906 |
| 2-3 — Load testing 100 jobs | done | #907 |
| 2-4 — Redis reconnection handling | done | #919 |
| 2-5 — E2E progress tracking 10 jobs | done | #921 |
| 2-6 — DLQ API endpoints | done | #927, #932 |

### Epic 3 — SSE + Rate Limiting ✅ DONE
| Story | Status | PR |
|-------|--------|----|
| 3-7 — Localhost exemption health probes | done | #934, #936 |
| 3-1 — SSE heartbeat mechanism | done | #935 |
| 3-5 — Rate limiting burst tests | done | #937 |
| 3-2 — Client SSE reconnection logic | done | #941 |
| 3-3 — SSE long-running 10min validation | done | #944 |
| 3-4 — SSE 50-client load test | done | #945 |
| 3-6 — Rate limiting window reset | done | #947 |
| 3-8 — Rate limiting documentation | done | #948 |

### Epic 4 — Database Migration Idempotency ✅ DONE
| Story | Status | PR |
|-------|--------|----|
| 4-1 — Migration idempotency checks | done | #949 |
| 4-2 — Verification steps (populated DB) | done | #951 |
| 4-3 — CI pipeline idempotency validation | done | #951 |

### Epic 5 — White-Label Theme Consistency ✅ DONE
| Story | Status |
|-------|--------|
| 5-1 — Theme switching E2E tests | done |
| 5-2 — CSP strict mode validation | done |

### Epic 6 — Email Template Validation ⏳ BACKLOG
| Story | Status |
|-------|--------|
| 6-1 — Cross-client rendering tests | backlog |
| 6-2 — Branding consistency | backlog |

### Work Done Outside BMAD Tracking
| PR | Title | Type |
|----|-------|------|
| #913, #914, #915 | Server security fixes (input validation, image DOS) | fix |
| #916 | Client: email validation + slug race condition | fix |
| #911 | Dependabot: npm dependency bump | chore |
| #918 | SaaS: resolveTenant premature release fix (OPEN) | fix |
| #923 | Scraper: parser structure validation for Allocine changes (OPEN) | fix |
| #929 | Documentation audit refresh | docs |
| #938 | BMAD skills and customization update | chore |

### Epic 7: Technical Debt Consolidation & Preparation
Address technical debt accrued during earlier epics and resolve open pull requests before beginning the next major feature initiative (Epic 6). 

**FRs covered:** N/A (Technical Debt)
**NFRs covered:** NFR10 (Maintainability)
**Effort:** 10-15 hours
**Priority:** 🟡 MEDIUM

**Definition of Done:**
- [ ] Open stability PRs (#918, #923) are reviewed, tested, and merged
- [ ] Theme client/server contract mismatch from Epic 5 is resolved
- [ ] Email testing tool technical spike is completed with a clear decision
- [ ] E2E test flakiness (missing serial execution tags) is resolved

#### Story 7.1: Resolve Open Scraper & Tenant Stability PRs
As a maintainer, I want to merge the open PRs for tenant release (#918) and Scraper parsing (#923) so that stability issues are fixed in `develop`.

#### Story 7.2: Refactor Theme Variables Contract
As a frontend developer, I want the client and server to use the exact same setting keys and CSS variables for the white-label theme so that theme rendering is not brittle.

#### Story 7.3: Technical Spike - Email Testing Tool
As a QA engineer, I want to evaluate Litmus vs Email on Acid and produce a PoC for automated email testing so that Epic 6 is unblocked.
