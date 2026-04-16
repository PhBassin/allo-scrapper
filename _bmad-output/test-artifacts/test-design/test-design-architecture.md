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

# Test Design for Architecture: Allo-Scrapper System

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-04-15
**Author:** BMad TEA Agent
**Status:** Architecture Review Pending
**Project:** Allo-Scrapper v4.6.7
**PRD Reference:** N/A (System-level design)
**ADR Reference:** N/A

---

## Executive Summary

**Scope:** Complete system-level test design for Allo-Scrapper cinema showtimes aggregator covering scraping service, REST API, database, cache layer, frontend UI, and multi-tenant SaaS mode.

**Business Context:**

- **Revenue/Impact:** SaaS mode enables multi-organization deployment (critical for B2B revenue)
- **Problem:** Lack of comprehensive test coverage for multi-tenant isolation, Redis job queue reliability, SSE stability, and rate limiting edge cases
- **GA Launch:** Immediate (v4.6.7 production-ready, but gaps block SaaS release)

**Architecture:**

- **Stack:** Node.js 24, TypeScript, React 19, Express.js 5, PostgreSQL 15+, Redis, Puppeteer
- **Pattern:** Monorepo (npm workspaces: client, server, scraper, packages/saas, packages/logger)
- **Deployment:** Docker Compose, Prometheus + Grafana + Loki + Tempo observability
- **Multi-tenancy:** Optional SaaS mode with org_id isolation

**Expected Scale:**

- 50+ concurrent scraping jobs
- 100ms scraper latency per page target
- 50+ simultaneous SSE connections
- Rate limiting: 5-10 req/min per endpoint per IP

**Risk Summary:**

- **Total risks:** 9 identified
- **High-priority (≥6):** 4 risks (1 BLOCKER score 9, 3 HIGH score 6)
- **Test effort:** ~45 new tests (~80-136 hours over 3-4 sprints)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** - These MUST be completed before QA can write integration tests:

1. **RISK-001: Multi-tenant data leakage** - Provide multi-tenant test fixture with 2+ isolated organizations (recommended owner: Backend team)
2. **Multi-tenant fixture infrastructure** - API endpoints to seed/teardown org-scoped test data programmatically (recommended owner: Backend team)
3. **Redis mock/container for integration tests** - Test infrastructure to simulate Redis failures, timeouts, OOM scenarios (recommended owner: QA + DevOps)

**What we need from team:** Complete these 3 items pre-implementation or test development is blocked.

---

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **RISK-002: Redis job queue corruption** - Implement dead-letter queue for failed jobs + exponential backoff retry logic (Backend team approval required, Sprint +1)
2. **RISK-003: SSE connection abandonment** - Add heartbeat mechanism (ping every 30s) + client reconnection logic (Backend + Frontend approval, Sprint +1)
3. **RISK-004: Rate limiting false positives** - Document rate limit windows per endpoint + provide rate limit test utilities (Backend approval, Sprint +2)
4. **RISK-006: Non-idempotent migrations** - Enforce idempotency checks in migration CI pipeline (Backend + DevOps approval, Sprint +2)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy:** 45 new tests (6 Unit + 24 Integration + 15 E2E) prioritized P0-P3
2. **Tooling:** Vitest (unit), Playwright (E2E), Redis mock library, SSE client test utilities
3. **Tiered CI/CD:** PR (<15min), Nightly (<45min), Weekly (<90min)
4. **Coverage:** P0=11 tests (multi-tenant BLOCKER), P1=24 tests (Redis/SSE/rate limiting), P2=6 tests, P3=4 tests
5. **Quality gates:** P0 pass rate 100% (BLOCK merge), P1 ≥95% (CONCERNS), coverage 85%+ lines/functions

**What we need from team:** Just review and acknowledge (we already have the solution).

---

## For Architects and Devs - Open Topics 👷

### Risk Assessment

**Total risks identified:** 9 (4 high-priority score ≥6, 3 medium score 4-5, 2 low score 1-3)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID        | Category  | Description                                     | Probability | Impact | Score | Mitigation                                   | Owner         | Timeline     |
| -------------- | --------- | ----------------------------------------------- | ----------- | ------ | ----- | -------------------------------------------- | ------------- | ------------ |
| **RISK-001**   | **SEC**   | Multi-tenant data leakage in SaaS mode          | 3 (Likely)  | 3      | **9** | 9 tests (3 E2E + 4 API + 2 Unit)             | security-team | Sprint 0     |
| **RISK-002**   | **OPS**   | Redis job queue corruption under load           | 2 (Possible)| 3      | **6** | 8 tests (5 Integration + 2 Unit + 1 E2E)     | dev-team      | Sprint +1    |
| **RISK-003**   | **PERF**  | SSE connections abandoned during long scrapes   | 3 (Likely)  | 2      | **6** | 6 tests (3 E2E + 2 Integration + 1 Unit)     | qa-team       | Sprint +1    |
| **RISK-004**   | **BUS**   | Rate limiting false positives block legit users | 2 (Possible)| 3      | **6** | 7 tests (4 E2E + 2 Integration + 1 Unit)     | qa-team       | Sprint +2    |

#### Medium-Priority Risks (Score 3-5)

| Risk ID      | Category | Description                                    | Probability | Impact | Score | Mitigation                               | Owner    |
| ------------ | -------- | ---------------------------------------------- | ----------- | ------ | ----- | ---------------------------------------- | -------- |
| **RISK-005** | TECH     | Playwright workers=1 masks concurrency bugs    | 2 (Possible)| 2      | 4     | 3 tests (2 Integration + 1 E2E)          | qa-team  |
| **RISK-006** | DATA     | Non-idempotent migrations cause schema drift   | 2 (Possible)| 2      | 4     | 4 Integration tests + CI enforcement     | dev-team |
| **RISK-007** | OPS      | Observability gaps for multi-tenant tracing    | 2 (Possible)| 2      | 4     | 4 tests (3 Integration + 1 E2E optional) | dev-team |

#### Low-Priority Risks (Score 1-2)

| Risk ID      | Category | Description                         | Probability | Impact | Score | Action       |
| ------------ | -------- | ----------------------------------- | ----------- | ------ | ----- | ------------ |
| **RISK-008** | BUS      | Theme CSS conflicts in white-label  | 2 (Possible)| 1      | 2     | Monitor      |
| **RISK-009** | BUS      | Email notification formatting       | 2 (Possible)| 1      | 2     | Document     |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern                                | Impact                                     | What Architecture Must Provide                                                  | Owner       | Timeline |
| -------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | ----------- | -------- |
| **No multi-tenant test fixture**       | Cannot test cross-tenant isolation (P0)    | API endpoints: POST /test/seed-org, DELETE /test/cleanup-org with org_id scope | Backend     | Sprint 0 |
| **Redis mock/container for CI**        | Cannot test job queue failure scenarios    | Testcontainers Redis + mock utilities for timeout/OOM simulation                | QA + DevOps | Sprint 0 |
| **SSE test client infrastructure**     | Cannot test long-running SSE connections   | Playwright SSE client fixture with reconnection + heartbeat validation          | QA          | Sprint +1|

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Dead-Letter Queue for Scraper Jobs**
   - **Current problem:** Failed jobs after 3 retries are silently discarded, no visibility into failures
   - **Required change:** Implement DLQ in Redis with job metadata (failure reason, retry count, timestamp)
   - **Impact if not fixed:** Production job loss without detection (RISK-002)
   - **Owner:** Backend team
   - **Timeline:** Sprint +1

2. **SSE Heartbeat Mechanism**
   - **Current problem:** SSE connections timeout after 5min (LB default), clients have no reconnection logic
   - **Required change:** Server sends ping event every 30s, client auto-reconnects on connection loss
   - **Impact if not fixed:** Users see stale progress during long scrapes (RISK-003)
   - **Owner:** Backend + Frontend teams
   - **Timeline:** Sprint +1

3. **Idempotent Migration Enforcement**
   - **Current problem:** Some migrations lack `IF NOT EXISTS` checks, fail on re-run
   - **Required change:** CI pipeline validates all migrations are idempotent (pre-commit hook or GHA)
   - **Impact if not fixed:** Fresh installs fail if schema already exists (RISK-006)
   - **Owner:** Backend + DevOps teams
   - **Timeline:** Sprint +2

---

### Testability Assessment Summary

**📊 CURRENT STATE - FYI**

#### What Works Well

- ✅ **Excellent mocking strategy** — Services use dependency injection, Vitest mocks well-structured
- ✅ **Network-first E2E patterns** — Playwright tests intercept API calls, no arbitrary `waitForTimeout()`
- ✅ **Comprehensive auth testing** — JWT validation, standalone vs org-aware tokens fully covered
- ✅ **TDD workflow enforced** — Pre-push hook with `tsc --noEmit && npm run test:run`, coverage thresholds configured

#### Accepted Trade-offs (No Action Required)

For Allo-Scrapper v4.6.7 Phase 1, the following trade-offs are acceptable:

- **Playwright workers=1** — Masks concurrency bugs but prevents scrape test conflicts (acceptable for Phase 1, revisit in Sprint +2 with RISK-005 mitigation)
- **Manual theme validation** — CSS white-label conflicts rare (<2% usage), manual QA sufficient (RISK-008 documented only)
- **Manual email testing** — Email formatting issues low-impact, tested manually in staging (RISK-009 documented only)

This is technical debt that should be revisited post-GA if SaaS adoption exceeds 10 organizations.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

**Purpose:** Detailed mitigation strategies for all 4 high-priority risks (score ≥6). These risks MUST be addressed before SaaS GA launch.

#### RISK-001: Multi-tenant data leakage (Score: 9) - BLOCKER

**Mitigation Strategy:**

1. **Create multi-tenant test fixture** (Backend team)
   - API endpoints: `POST /test/seed-org`, `DELETE /test/cleanup-org`
   - Seed 2+ organizations with isolated data (users, cinemas, schedules)
   - Auto-cleanup after test runs

2. **Implement 9 isolation tests** (QA team)
   - 3 E2E: User org A cannot view/edit data from org B via UI
   - 4 API: Cross-tenant requests return 403, implicit org_id filtering validated
   - 2 Unit: Middleware filters queries by JWT org_id, permission checker validates match

3. **Code audit** (Security team)
   - Review all protected endpoints for org_id filtering
   - Validate permission checks include org scope validation

**Owner:** Security team (coordination), Backend + QA (implementation)
**Timeline:** Sprint 0 (BLOCKER for SaaS release)
**Status:** Planned
**Verification:** All 9 tests pass with 100% rate, code audit complete with no findings

---

#### RISK-002: Redis job queue corruption (Score: 6) - HIGH

**Mitigation Strategy:**

1. **Implement dead-letter queue** (Backend team)
   - Redis DLQ for jobs failing after 3 retries
   - Store job metadata: failure reason, retry count, original payload

2. **Add exponential backoff retry logic** (Backend team)
   - Retry delays: 1s, 2s, 4s (total 7s before DLQ)
   - Detect Redis timeout vs application error (different handling)

3. **Implement 8 load/failure tests** (QA team)
   - 5 Integration: 100 jobs simultaneous, Redis timeout, OOM, crash recovery, DLQ validation
   - 2 Unit: p-limit concurrency enforcement, retry backoff calculation
   - 1 E2E: 10 scrapes simultaneously with progress tracking

**Owner:** Backend team (implementation), QA team (validation)
**Timeline:** Sprint +1
**Status:** Planned
**Verification:** All 8 tests pass, production metrics show 0 job loss after 1 week

---

#### RISK-003: SSE connection abandonment (Score: 6) - HIGH

**Mitigation Strategy:**

1. **Implement heartbeat mechanism** (Backend team)
   - Server sends `ping` event every 30s on `/api/scraper/progress`
   - Client validates ping received, triggers reconnection if missed

2. **Add client reconnection logic** (Frontend team)
   - EventSource auto-reconnect on connection loss
   - Resume progress from last received event (idempotent event IDs)

3. **Implement 6 stability tests** (QA team)
   - 3 E2E: 10min scrape maintains connection, network interruption triggers reconnect, 50 simultaneous connections
   - 2 Integration: Heartbeat sent every 30s, connection closed after 15min inactivity
   - 1 Unit: SSE event serialization correctness

**Owner:** Backend + Frontend teams (implementation), QA team (validation)
**Timeline:** Sprint +1
**Status:** Planned
**Verification:** All 6 tests pass, production SSE connections stable for 99%+ of 10min+ scrapes

---

#### RISK-004: Rate limiting false positives (Score: 6) - HIGH

**Mitigation Strategy:**

1. **Document rate limit windows** (Backend team)
   - Per-endpoint limits: `/api/auth/login` (5 req/min), `/api/health` (10 req/min exempt localhost)
   - Publish rate limit documentation in README.md

2. **Provide rate limit test utilities** (QA team)
   - Playwright fixture: `rateLimit.reset(endpoint)`, `rateLimit.waitForReset(endpoint)`
   - Mock rate limiter for unit tests

3. **Implement 7 edge case tests** (QA team)
   - 4 E2E: 3 logins in 10s succeed, 11th request gets 429, rate limit resets after 60s, page refresh not rate limited
   - 2 Integration: Localhost exempt on /api/health, different IPs independent counters
   - 1 Unit: Rate limit time window calculation correctness

**Owner:** Backend team (documentation + utilities), QA team (tests)
**Timeline:** Sprint +2
**Status:** Planned
**Verification:** All 7 tests pass, production logs show <1% false positive rate (legit users rate-limited)

---

### Assumptions and Dependencies

#### Assumptions

1. **SaaS mode enabled** — Tests assume `SAAS_ENABLED=true`, multi-tenant features active
2. **Redis available** — Integration tests require Redis running (Testcontainers or local Docker)
3. **Playwright workers=1** — E2E tests remain sequential until RISK-005 mitigated (Sprint +2)
4. **Coverage thresholds maintained** — 80%+ lines/functions, 65%+ branches (target: 85%/85%/75% post-implementation)

#### Dependencies

1. **Multi-tenant test fixture** — Required by Sprint 0 (BLOCKER for RISK-001 tests)
2. **Redis mock/container** — Required by Sprint +1 (BLOCKER for RISK-002 tests)
3. **SSE test client utilities** — Required by Sprint +1 (BLOCKER for RISK-003 tests)
4. **Dead-letter queue implementation** — Required by Sprint +1 (Backend prerequisite)
5. **Heartbeat mechanism implementation** — Required by Sprint +1 (Backend + Frontend prerequisite)

#### Risks to Plan

- **Risk:** Redis mock library incompatible with ioredis
  - **Impact:** Cannot test Redis failure scenarios (RISK-002 blocked)
  - **Contingency:** Use Testcontainers Redis instead (slower but reliable)

- **Risk:** Frontend team capacity unavailable for SSE reconnection logic
  - **Impact:** RISK-003 partially mitigated (server heartbeat only, no client reconnect)
  - **Contingency:** Document manual reconnection workaround (user refreshes page)

- **Risk:** Multi-tenant fixture creation takes 2+ sprints (complex data seeding)
  - **Impact:** RISK-001 tests delayed, SaaS release blocked
  - **Contingency:** Manual seeding scripts as interim (slower test execution)

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Review Quick Guide (🚨/⚠️/📋) and prioritize blockers
2. Assign owners and timelines for high-priority risks (≥6)
3. Validate assumptions and dependencies
4. Provide feedback to QA on testability gaps within 3 business days

**Next Steps for QA Team:**

1. Wait for pre-implementation blockers to be resolved (multi-tenant fixture, Redis mock)
2. Refer to companion QA doc (test-design-qa.md) for test scenarios
3. Begin test infrastructure setup (factories, fixtures, environments)
4. Implement P0 tests (RISK-001) in Sprint 0, P1 tests in Sprint +1-2
