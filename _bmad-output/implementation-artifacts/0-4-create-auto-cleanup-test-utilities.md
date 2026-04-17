# Story 0.4: Create Auto-Cleanup Test Utilities

Status: done

## Story

As a QA engineer,
I want test cleanup utilities that automatically remove test data after each test,
so that tests remain isolated and do not pollute the database.

## Acceptance Criteria

1. **Given** a Playwright test fixture exists  
   **When** I use `test.afterEach(cleanup)`  
   **Then** all data created during the test is removed  
   **And** the cleanup completes in <500ms  
   **And** cleanup failures are logged with details

2. **Given** multiple tests run in parallel  
   **When** each test creates organizations via `/test/seed-org`  
   **Then** each test's cleanup only removes its own data  
   **And** no cross-test data deletion occurs  
   **And** parallel tests do not interfere with each other

3. **Given** a test fails before reaching the cleanup step  
   **When** the test framework exits  
   **Then** a global cleanup hook removes all test organizations  
   **And** no orphaned test data remains in the database

4. **Given** cleanup is invoked multiple times for the same organization id  
   **When** duplicate cleanup calls occur (retry or repeated hooks)  
   **Then** cleanup remains idempotent  
   **And** no error is thrown for already-deleted organizations  
   **And** diagnostics report deduped/deleted/skipped counts

## Tasks / Subtasks

- [ ] Implement Playwright cleanup utility module (AC: 1, 2, 3)
  - [ ] Add fixture and cleanup utility modules under `e2e/fixtures/`
  - [ ] Add `e2e/fixtures/org-fixture.ts` to wrap seed/track lifecycle for tests
  - [ ] Add `e2e/fixtures/org-cleanup.ts` for cleanup logic and diagnostics
  - [ ] Track seeded org ids per-test with worker-local, test-id-keyed state
  - [ ] Expose helper methods: `registerTestOrg(testId, orgId)`, `cleanupTestOrgs(testId)`, `cleanupAllTrackedOrgs()`
  - [ ] Ensure utility is worker-safe (no shared cross-worker mutable global collisions)

- [ ] Integrate cleanup into Playwright lifecycle hooks (AC: 1, 3)
  - [ ] Add per-test teardown with `test.afterEach` to cleanup only that test's org ids
  - [ ] Add global fallback cleanup (`e2e/global-teardown.ts` preferred) for orphan recovery
  - [ ] Wire global teardown explicitly in `playwright.config.ts`
  - [ ] Ensure cleanup executes even when tests fail or abort mid-flow
  - [ ] Introduce shared fixture usage in specs that create orgs via `/test/seed-org`

- [ ] Enforce cleanup isolation guarantees for parallel runs (AC: 2)
  - [ ] Namespace test org identifiers by test/worker metadata (slug prefix + worker index + unique suffix)
  - [ ] Prevent deleting orgs not tracked by the current test context
  - [ ] Add guardrails against duplicate cleanup calls (idempotent delete handling)
  - [ ] Define strict global cleanup selector: only orgs with test prefix and bounded creation window are eligible

- [ ] Add automated test coverage for cleanup utilities (RED first, then GREEN) (AC: 1, 2, 3, 4)
  - [ ] Add unit tests for utility behavior (tracking, dedupe, failure logging)
  - [ ] Add E2E/integration assertions proving per-test and global cleanup behavior
  - [ ] Add a failure-path test proving orphan cleanup executes from global hook
  - [ ] Add idempotency test: repeated cleanup for same org id is safe and reported correctly

- [ ] Add performance assertions and diagnostics (AC: 1)
  - [ ] Measure both per-org delete duration and per-test cleanup batch duration
  - [ ] Assert `<500ms` target on per-org delete with CI-tolerant thresholds
  - [ ] Log cleanup failures with org id, test id, worker id, and error
  - [ ] Include summary log for global cleanup run (count, duration, failures)
  - [ ] On partial failures, continue cleanup for remaining orgs and return aggregated failure summary

- [ ] Documentation updates (AC: 1, 2, 3)
  - [ ] Update `docs/guides/development/testing.md` with cleanup utility usage pattern
  - [ ] Add troubleshooting guidance for orphaned orgs and retry-safe cleanup
  - [ ] Add concise README reference pointing to cleanup workflow docs

## Dev Notes

### Scope and Architecture Guardrails

- This story is Playwright/E2E utility focused; keep implementation under `e2e/` utilities and hooks.
- Reuse Story 0.2 fixture API (`/test/seed-org`, `/test/cleanup-org/:id`) for deletion operations.
- Do not move cleanup responsibility into app runtime routes; keep it test-framework scoped.
- Since current specs do not yet call fixture endpoints directly, first introduce a shared fixture layer and migrate relevant tests to it.

### Existing Dependencies and Inputs

- Story 0.2 provides seed/cleanup fixture API and parallel-safe org creation.
- Story 0.1 enabled parallel workers; this utility must remain deterministic under workers > 1.
- Story 0.3 introduced Redis Testcontainers integration; keep concerns separated (cleanup utility should not depend on Redis lifecycle).

### Suggested Utility Contract

- `registerTestOrg(testId: string, orgId: number): void`
- `cleanupTestOrgs(testId: string): Promise<{ deleted: number; failed: number; durationMs: number }>`
- `cleanupAllTrackedOrgs(): Promise<{ deleted: number; failed: number; durationMs: number }>`

Include internal dedupe so repeated registration or repeated cleanup is safe.

### Global Cleanup Safety Rules

- Global cleanup must never perform blind org deletion.
- Eligible orgs must match deterministic test markers (prefix/tag) plus recency window.
- Anything outside eligibility rules is logged and skipped.

### Logging and Diagnostics

- Log cleanup failures with structured context: `org_id`, `test_id`, `worker_id`, `error`.
- Emit final summary for each afterEach and global cleanup run.
- Keep logs concise to avoid noisy CI output while preserving forensic value.

### Performance Notes

- Target `<500ms` cleanup per test context as acceptance target.
- Use bounded concurrency for multi-org cleanup in the same test context if needed.
- Avoid unbounded parallel deletion that can saturate test fixture API/database.

### Implementation Order (Mandatory)

1. RED: write failing utility tests (tracking, isolation, failure paths).
2. GREEN: implement utility module and hook wiring.
3. HARDEN: add idempotency + performance assertions + structured diagnostics.
4. DOCS: update testing docs and README reference.

### References

- Story definition: `_bmad-output/planning-artifacts/epics.md:404`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:53`
- Story 0.2 artifact: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md`
- Playwright config baseline: `playwright.config.ts`
- E2E docs section: `docs/guides/development/testing.md:222`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 0.4 (post-merge cleanup + next-story artifact generation)

### Completion Notes List

- Story file created with AC-aligned cleanup utility plan.
- Added explicit worker-isolation and orphan-recovery requirements.
- Included RED/GREEN/HARDEN/DOCS implementation sequence.

### File List

- `_bmad-output/implementation-artifacts/0-4-create-auto-cleanup-test-utilities.md`
