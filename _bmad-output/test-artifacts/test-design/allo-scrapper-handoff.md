---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-progress.md'
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect (BMad Agent)'
generatedAt: '2026-04-15T00:00:00Z'
projectName: 'Allo-Scrapper'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

## TEA Artifacts Inventory

| Artifact                    | Path                                                                | BMAD Integration Point                               |
| --------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Architecture Test Design    | `_bmad-output/test-artifacts/test-design/test-design-architecture.md` | Epic testability requirements, architectural blockers |
| QA Test Design              | `_bmad-output/test-artifacts/test-design/test-design-qa.md`        | Story test requirements, acceptance criteria         |
| Risk Assessment (embedded)  | Both documents above                                                | Epic risk classification, story priority             |
| Coverage Strategy (embedded)| `test-design-qa.md` sections P0-P3                                  | Story test requirements by priority                  |
| Progress Log                | `_bmad-output/test-artifacts/test-design-progress.md`               | Audit trail, context for future iterations           |

## Epic-Level Integration Guidance

### Risk References

**High-Priority Risks (Score ≥6) — These MUST be addressed at epic level:**

1. **RISK-001: Multi-tenant data leakage** (Score: 9, SEC)
   - **Epic:** "Multi-Tenant Isolation & Security Hardening"
   - **Quality Gate:** All 9 P0 tests passing (3 E2E + 4 API + 2 Unit) before epic closure
   - **Architectural Blocker:** Multi-tenant test fixture API required pre-implementation
   - **Owner:** Security team + Backend team

2. **RISK-002: Redis job queue corruption under load** (Score: 6, OPS)
   - **Epic:** "Scraper Job Queue Reliability & DLQ Implementation"
   - **Quality Gate:** All 8 tests passing (5 Integration + 2 Unit + 1 E2E), DLQ implemented
   - **Architectural Blocker:** Dead-letter queue + exponential backoff retry logic
   - **Owner:** Backend team + DevOps team

3. **RISK-003: SSE connection abandonment during long scrapes** (Score: 6, PERF)
   - **Epic:** "Real-Time Progress Stability & SSE Enhancements"
   - **Quality Gate:** All 6 tests passing (3 E2E + 2 Integration + 1 Unit), 10min scrapes stable
   - **Architectural Blocker:** Heartbeat mechanism (server) + reconnection logic (client)
   - **Owner:** Backend team + Frontend team

4. **RISK-004: Rate limiting false positives** (Score: 6, BUS)
   - **Epic:** "Rate Limiting Edge Cases & Documentation"
   - **Quality Gate:** All 7 tests passing (4 E2E + 2 Integration + 1 Unit), <1% false positive rate
   - **Architectural Blocker:** Rate limit documentation + test utilities
   - **Owner:** Backend team + QA team

**Medium-Priority Risks (Score 4-5) — Consider separate stories or embed in related epics:**

- **RISK-005:** Playwright workers=1 masks concurrency bugs (TECH, score 4) → Story: "Enable Playwright parallel execution"
- **RISK-006:** Non-idempotent migrations (DATA, score 4) → Story: "Enforce migration idempotency in CI"
- **RISK-007:** Observability gaps for multi-tenant tracing (OPS, score 4) → Story: "Add org_id to OpenTelemetry traces"

### Quality Gates

**Recommended Epic-Level Quality Gates:**

| Epic                                   | Quality Gate Criteria                                                                 | Verification Method                   |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Multi-Tenant Isolation & Security      | 100% P0 tests passing (9 tests), code audit complete, cross-tenant access impossible  | Automated tests + manual audit        |
| Scraper Job Queue Reliability          | 100+ jobs processed without loss, DLQ receives failed jobs after 3 retries            | Load tests (100 jobs) + DLQ validation|
| Real-Time Progress Stability           | 10min scrapes maintain SSE connection, 50+ concurrent SSE clients stable              | Long-running E2E + load tests         |
| Rate Limiting Edge Cases               | Legitimate bursts not rate-limited, 11th request gets 429, localhost exempt           | E2E burst scenarios + exemption tests |
| Database Migration Reliability         | All migrations idempotent (re-run succeeds), fresh DB + populated DB both succeed     | Integration tests (fresh + re-run)    |
| Observability Multi-Tenant Enhancement | All traces include org_id, Prometheus metrics scraped, correlation IDs in logs        | Integration tests + manual validation |

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

**Epic: Multi-Tenant Isolation & Security (RISK-001)**

**Story 1.1:** "Implement multi-tenant test fixture API"
- **Acceptance Criteria:**
  - [ ] `POST /test/seed-org` endpoint creates isolated organization with test data
  - [ ] `DELETE /test/cleanup-org/:id` endpoint removes all org-scoped data
  - [ ] Fixture creates 2+ orgs with isolated users, cinemas, schedules
  - [ ] Auto-cleanup after test runs (no orphaned data)
- **Test Requirements:** RISK001-API-001 through RISK001-API-004
- **Test Level:** Integration
- **data-testid:** N/A (backend API only)

**Story 1.2:** "E2E multi-tenant isolation validation"
- **Acceptance Criteria:**
  - [ ] User from org A cannot view cinemas from org B via UI navigation
  - [ ] User from org A cannot edit users from org B via admin panel
  - [ ] User from org A cannot view schedules from org B via calendar view
  - [ ] All cross-tenant access attempts return 403 Forbidden
- **Test Requirements:** RISK001-E2E-001, RISK001-E2E-002, RISK001-E2E-003
- **Test Level:** E2E
- **data-testid:** `cinema-list`, `user-management-table`, `schedule-calendar`, `403-error-message`

**Story 1.3:** "API-level tenant isolation enforcement"
- **Acceptance Criteria:**
  - [ ] `GET /api/cinemas?org_id=<other_org>` with org A token returns 403
  - [ ] `PUT /api/users/:id` (org B user) with org A token returns 403
  - [ ] `GET /api/schedules` with org A token returns ONLY org A data (implicit filtering)
  - [ ] `POST /api/cinemas` with manipulated org_id in body forced to user's org or 403
- **Test Requirements:** RISK001-API-001, RISK001-API-002, RISK001-API-003, RISK001-API-004
- **Test Level:** Integration
- **data-testid:** N/A (API contract tests)

**Story 1.4:** "Middleware tenant isolation validation"
- **Acceptance Criteria:**
  - [ ] Auth middleware extracts org_id from JWT and filters all queries
  - [ ] Permission checker validates org_id match before granting access
  - [ ] Unit tests validate middleware filters 100% of org-scoped queries
- **Test Requirements:** RISK001-UNIT-001, RISK001-UNIT-002
- **Test Level:** Unit
- **data-testid:** N/A (backend logic)

---

**Epic: Scraper Job Queue Reliability (RISK-002)**

**Story 2.1:** "Implement dead-letter queue for failed scraper jobs"
- **Acceptance Criteria:**
  - [ ] Jobs failing after 3 retries moved to DLQ with metadata (failure reason, retry count, timestamp)
  - [ ] DLQ visible via admin API endpoint `GET /api/scraper/dlq`
  - [ ] DLQ jobs can be manually requeued via `POST /api/scraper/dlq/:id/retry`
- **Test Requirements:** RISK002-INT-005
- **Test Level:** Integration
- **data-testid:** N/A (backend logic + admin panel: `dlq-table`, `retry-button`)

**Story 2.2:** "Add exponential backoff retry logic for Redis failures"
- **Acceptance Criteria:**
  - [ ] Redis connection timeouts trigger retry with delays: 1s, 2s, 4s
  - [ ] After 3 failures, job moved to DLQ (not discarded)
  - [ ] Unit tests validate retry delay calculation correctness
- **Test Requirements:** RISK002-UNIT-002, RISK002-INT-002
- **Test Level:** Unit + Integration
- **data-testid:** N/A (backend logic)

**Story 2.3:** "Redis job queue load testing"
- **Acceptance Criteria:**
  - [ ] Enqueue 100 jobs simultaneously → all processed without loss
  - [ ] Job processor respects p-limit concurrency (max 5 simultaneous)
  - [ ] Redis crash during processing → jobs resumed after reconnection
  - [ ] Dequeue job fails midway → job marked failed in Redis
- **Test Requirements:** RISK002-INT-001, RISK002-INT-003, RISK002-INT-004, RISK002-UNIT-001
- **Test Level:** Integration + Unit
- **data-testid:** N/A (backend stress tests)

**Story 2.4:** "E2E scraper progress tracking with 10+ concurrent jobs"
- **Acceptance Criteria:**
  - [ ] Trigger 10 scrapes simultaneously via UI
  - [ ] All 10 jobs show progress updates in real-time (SSE events)
  - [ ] All jobs complete successfully without loss
- **Test Requirements:** RISK002-E2E-001
- **Test Level:** E2E
- **data-testid:** `scrape-all-button`, `scrape-progress-card`, `scrape-status-completed`

---

**Epic: Real-Time Progress Stability (RISK-003)**

**Story 3.1:** "Implement SSE heartbeat mechanism"
- **Acceptance Criteria:**
  - [ ] Server sends `ping` event every 30s on `/api/scraper/progress`
  - [ ] SSE connection closed after 15min inactivity (no active scrapes)
  - [ ] Integration tests validate heartbeat interval correctness
- **Test Requirements:** RISK003-INT-001, RISK003-INT-002
- **Test Level:** Integration
- **data-testid:** N/A (backend SSE logic)

**Story 3.2:** "Add client SSE reconnection logic"
- **Acceptance Criteria:**
  - [ ] Client detects missing heartbeat (60s timeout)
  - [ ] Client triggers EventSource reconnection automatically
  - [ ] Client resumes progress from last received event (idempotent event IDs)
- **Test Requirements:** RISK003-E2E-002
- **Test Level:** E2E
- **data-testid:** `sse-connection-status`, `sse-reconnecting-indicator`

**Story 3.3:** "SSE long-running connection validation"
- **Acceptance Criteria:**
  - [ ] 10min scrape maintains SSE connection without timeout
  - [ ] 50 simultaneous SSE connections all receive events without latency > 1s
  - [ ] SSE event formatter serializes progress correctly (unit tests)
- **Test Requirements:** RISK003-E2E-001, RISK003-E2E-003, RISK003-UNIT-001
- **Test Level:** E2E + Unit
- **data-testid:** `scrape-progress-percentage`, `scrape-progress-eta`

---

**Epic: Rate Limiting Edge Cases (RISK-004)**

**Story 4.1:** "Document rate limit windows per endpoint"
- **Acceptance Criteria:**
  - [ ] README.md includes table: endpoint → rate limit (req/min) → exemptions
  - [ ] `/api/auth/login`: 5 req/min per IP, no exemptions
  - [ ] `/api/health`: 10 req/min per IP, localhost exempt
  - [ ] All protected endpoints: 10 req/min per IP by default
- **Test Requirements:** N/A (documentation only)
- **Test Level:** N/A
- **data-testid:** N/A

**Story 4.2:** "Rate limiting E2E edge cases"
- **Acceptance Criteria:**
  - [ ] 3 successful logins in 10s all succeed (not rate limited)
  - [ ] User refreshes page 5x in 5s not rate limited
  - [ ] 11th request in 60s window receives 429 Too Many Requests
  - [ ] After 60s wait, rate limit resets and requests succeed
- **Test Requirements:** RISK004-E2E-001, RISK004-E2E-002, RISK004-E2E-003, RISK004-E2E-004
- **Test Level:** E2E
- **data-testid:** `login-form`, `429-error-message`, `rate-limit-reset-timer`

**Story 4.3:** "Rate limiting localhost exemption validation"
- **Acceptance Criteria:**
  - [ ] Docker health checks (localhost) never rate-limited on `/api/health`
  - [ ] Different IPs have independent rate limit counters (no shared state)
  - [ ] Rate limiter time window calculation unit tests pass
- **Test Requirements:** RISK004-INT-001, RISK004-INT-002, RISK004-UNIT-001
- **Test Level:** Integration + Unit
- **data-testid:** N/A (backend logic)

---

### Data-TestId Requirements

**Recommended `data-testid` attributes for testability:**

| Component                     | data-testid                  | Purpose                                      |
| ----------------------------- | ---------------------------- | -------------------------------------------- |
| Cinema list (org-scoped)      | `cinema-list`                | Multi-tenant isolation validation            |
| User management table         | `user-management-table`      | Cross-tenant user access validation          |
| Schedule calendar             | `schedule-calendar`          | Cross-tenant schedule access validation      |
| 403 error message             | `403-error-message`          | Verify cross-tenant access blocked           |
| Scrape all button             | `scrape-all-button`          | Trigger concurrent scrape jobs               |
| Scrape progress card          | `scrape-progress-card`       | Real-time progress tracking validation       |
| Scrape status (completed)     | `scrape-status-completed`    | Job completion validation                    |
| SSE connection status         | `sse-connection-status`      | SSE reconnection validation                  |
| SSE reconnecting indicator    | `sse-reconnecting-indicator` | Client reconnection UX validation            |
| Scrape progress percentage    | `scrape-progress-percentage` | Progress event correctness                   |
| Scrape progress ETA           | `scrape-progress-eta`        | ETA calculation validation                   |
| Login form                    | `login-form`                 | Rate limiting burst scenario                 |
| 429 error message             | `429-error-message`          | Rate limit enforcement validation            |
| Rate limit reset timer        | `rate-limit-reset-timer`     | Rate limit window expiration validation      |
| DLQ table (admin panel)       | `dlq-table`                  | Dead-letter queue visibility validation      |
| DLQ retry button              | `retry-button`               | Manual job retry validation                  |

## Risk-to-Story Mapping

| Risk ID      | Category | P×I | Recommended Story/Epic                               | Test Level        | Priority |
| ------------ | -------- | --- | ---------------------------------------------------- | ----------------- | -------- |
| **RISK-001** | SEC      | 9   | Epic: Multi-Tenant Isolation (Stories 1.1-1.4)       | E2E + API + Unit  | P0       |
| **RISK-002** | OPS      | 6   | Epic: Scraper Job Queue Reliability (Stories 2.1-2.4)| Integration + E2E | P1       |
| **RISK-003** | PERF     | 6   | Epic: Real-Time Progress Stability (Stories 3.1-3.3) | E2E + Integration | P1       |
| **RISK-004** | BUS      | 6   | Epic: Rate Limiting Edge Cases (Stories 4.1-4.3)     | E2E + Integration | P1       |
| **RISK-005** | TECH     | 4   | Story: Enable Playwright parallel execution          | E2E + Integration | P2       |
| **RISK-006** | DATA     | 4   | Story: Enforce migration idempotency in CI           | Integration       | P1       |
| **RISK-007** | OPS      | 4   | Story: Add org_id to OpenTelemetry traces            | Integration       | P2       |
| **RISK-008** | BUS      | 2   | Story: Theme switching regression validation         | E2E               | P3       |
| **RISK-009** | BUS      | 2   | Story: Email template validation                     | Integration       | P3       |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`TD`) → produces this handoff document ✅ **COMPLETED**
2. **BMAD Create Epics & Stories** → consumes this handoff, embeds quality requirements
   - Input: This handoff document
   - Output: `planning-artifacts/epics-and-stories.md` with embedded acceptance criteria
3. **TEA ATDD** (`AT`) → generates acceptance tests per story
   - Input: `epics-and-stories.md` with acceptance criteria
   - Output: Failing acceptance tests (TDD red phase)
4. **BMAD Dev Story** → developers implement with test-first guidance
   - Input: Failing acceptance tests
   - Output: Passing acceptance tests + implementation
5. **TEA Automate** (`TA`) → generates full test suite
   - Input: Implemented features + risk register
   - Output: Comprehensive test suite (P0-P3 coverage)
6. **TEA Trace** (`TR`) → validates coverage completeness
   - Input: Test suite + requirements
   - Output: Traceability matrix + coverage gaps report

## Phase Transition Quality Gates

| From Phase          | To Phase            | Gate Criteria                                                                 |
| ------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Test Design         | Epic/Story Creation | All P0 risks have mitigation strategy, architectural blockers documented      |
| Epic/Story Creation | ATDD                | Stories have acceptance criteria from test design, data-testid requirements set |
| ATDD                | Implementation      | Failing acceptance tests exist for all P0/P1 scenarios                        |
| Implementation      | Test Automation     | All acceptance tests pass, no P0/P1 bugs open                                 |
| Test Automation     | Release             | Trace matrix shows ≥85% coverage of P0/P1 requirements, quality gates met     |

## Notes for BMAD Integration

### Pre-Implementation Blockers (Must Resolve Before Story Implementation)

1. **Multi-tenant test fixture API** (Sprint 0, BLOCKER)
   - Backend team must implement `POST /test/seed-org` and `DELETE /test/cleanup-org`
   - QA cannot write RISK-001 tests without this

2. **Redis Testcontainers setup** (Sprint 0, required for Sprint +1)
   - QA + DevOps must configure Redis container in CI
   - RISK-002 tests blocked without this

3. **Dead-letter queue implementation** (Sprint +1, prerequisite for RISK-002 tests)
   - Backend team must implement DLQ + retry logic
   - Tests can be written in parallel, but will fail until implemented

4. **SSE heartbeat mechanism** (Sprint +1, prerequisite for RISK-003 tests)
   - Backend team must implement heartbeat
   - Frontend team should implement client reconnection logic

### Recommended Sprint Allocation

- **Sprint 0 (current):** Epic 1 (Multi-Tenant Isolation) — P0 BLOCKER
- **Sprint +1:** Epic 2 (Redis Job Queue) + Epic 3 (SSE Stability) — P1 HIGH
- **Sprint +2:** Epic 4 (Rate Limiting) + Story 5 (Migration Idempotency) — P1
- **Sprint +3:** Story 6 (Playwright workers) + Story 7 (Observability) — P2
- **Backlog:** Story 8 (Theme) + Story 9 (Email) — P3

### Contact Points for Clarification

- **Test Design Questions:** QA Lead (reference: `test-design-qa.md`)
- **Architecture Questions:** Backend Lead (reference: `test-design-architecture.md`)
- **Risk Assessment Questions:** Security team (RISK-001), Backend team (RISK-002, RISK-003, RISK-004)

---

**End of Handoff Document**

**Next Action:** Run `bmad-create-epics-and-stories` workflow, provide this handoff as input for quality requirements integration.
