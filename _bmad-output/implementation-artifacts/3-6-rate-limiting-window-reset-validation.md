# Story 3.6: Rate Limiting Window Reset Validation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that validate rate limit windows reset correctly,
so that users can resume normal usage after the window expires.

## Acceptance Criteria

1. **Given** a user is rate limited (received 429)
   **When** they wait 60 seconds for the window to reset
   **Then** the next request succeeds (200 OK)
   **And** the rate limit counter is reset to 0
   **And** the user can make 10 more requests

2. **Given** a user receives a 429 error
   **When** they inspect the response headers
   **Then** the response includes `Retry-After: 60` header
   **And** the `data-testid="rate-limit-reset-timer"` shows countdown
   **And** the timer updates every second

3. **Given** multiple users share the same endpoint
   **When** user A is rate limited
   **Then** user B can still make requests
   **And** each user has independent rate limit counters
   **And** no shared state causes false positives

## Tasks / Subtasks

- [ ] Add RED coverage for window reset behavior on the real mounted limiter path (AC: 1, 2, 3)
  - [ ] Extend the existing rate-limit Playwright coverage instead of creating a second harness; prefer updating `e2e/rate-limit-burst.spec.ts` or a closely related focused spec under `e2e/`
  - [ ] Run against a fixture-enabled non-test backend (`NODE_ENV=development` with `E2E_ENABLE_ORG_FIXTURE=true`) so real limiters remain active while `/test/*` routes still exist
  - [ ] Use the same protected org-scoped seam already validated in Story `3.5`, preferably `GET /api/org/:slug/ping`, unless another existing `protectedLimiter` route proves more deterministic without adding unrelated side effects

- [ ] Prove the limiter resets after the configured window without changing production defaults (AC: 1)
  - [ ] Exhaust the protected limiter for one authenticated user in a deterministic verification runtime configured to the acceptance-criteria contract (`RATE_LIMIT_WINDOW_MS=60000` and `RATE_LIMIT_PROTECTED_MAX=10`, or an equivalent dedicated test seam), rather than waiting for the shipped 15-minute default
  - [ ] Assert the first request after the reset window succeeds and that the user can make another full allowed burst without hitting a stale counter
  - [ ] Keep the implementation honest about runtime behavior: scope the 60-second / 10-request contract to the verification runtime only, without changing shipped defaults

- [ ] Add the smallest visible reset-timer UX seam needed for browser validation (AC: 2)
  - [ ] Reuse the existing tenant-scoped `429` handling in `client/src/contexts/TenantProvider.tsx` instead of inventing a global error-banner system
  - [ ] Add `data-testid="rate-limit-reset-timer"` where the current `429` screen renders retry timing so the countdown is observable in Playwright
  - [ ] Drive the countdown from the real `retryAfterSeconds`/`Retry-After` contract already returned by `protectedLimiter`, updating once per second and cleaning up timers correctly on unmount or recovery

- [ ] Validate independent limiter buckets for different authenticated users (AC: 3)
  - [ ] Create two real authenticated identities in the same org and drive both through the same protected endpoint path so the test exercises user-key isolation rather than tenant routing differences
  - [ ] Rate limit user A while keeping user B below the threshold, then assert user B still receives successful responses during A's blocked window
  - [ ] Preserve the existing per-user keying contract based on decoded JWT identity fields; do not weaken back to IP-only behavior

- [ ] Add focused automated regression coverage at the lowest useful seam (AC: 1, 2, 3)
  - [ ] Extend `server/src/middleware/rate-limit.test.ts` if needed to assert reset-window behavior and per-user independence under controlled env values
  - [ ] Extend `client/src/contexts/TenantProvider.test.tsx` if needed to assert countdown rendering and second-by-second updates from retry-after metadata
  - [ ] Avoid mocking the rate-limited browser path in Playwright; only unit-test the timer presentation logic in Vitest where that lowers flake and keeps the E2E focused

- [ ] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [ ] Run the relevant server tests for `rate-limit.ts`
  - [ ] Run the relevant client tests for `TenantProvider`
  - [ ] Run the focused Playwright rate-limit spec with `--project=chromium --no-deps`

## Dev Notes

### Scope and Guardrails

- Story `3.6` is unblocked because Epic 3 ordering requires `3.7 -> 3.1 -> 3.5` first, and the readiness report explicitly says `3.2`, `3.3`, `3.4`, `3.6`, and `3.8` can proceed in parallel afterward. [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`]
- The epic defines this as a test-first validation story for reset behavior, visible retry timing, and per-user independence. Treat it as validation of the existing limiter stack plus the smallest supporting UX seam, not as a general rate-limit redesign. [Source: `_bmad-output/planning-artifacts/epics.md:1027-1056`, `_bmad-output/planning-artifacts/notes-epics-stories.md:220-227`]
- Story `3.5` intentionally stopped short of countdown/reset behavior. `3.6` owns the reset-timer assertions and any minimal countdown UX needed to expose them. [Source: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:61`, `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:155`]

### Critical Current-Code Reality

- The real limiter implementation is `server/src/middleware/rate-limit.ts`; do not use or extend the older lightweight `server/src/middleware/rate-limiter.ts` helper for this story. [Source: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:79-80`, `server/src/middleware/rate-limit.ts:148-233`]
- `skipTest` disables all rate-limit middleware when `NODE_ENV=test`, so any Playwright validation of reset timing must run in a non-test backend runtime. Fixture endpoints remain available in `development` only when `E2E_ENABLE_ORG_FIXTURE=true`. [Source: `server/src/middleware/rate-limit.ts:39-40`, `packages/saas/src/routes/test-fixtures.ts:20-23`, `AGENTS.md`]
- `protectedLimiter` currently defaults to `RATE_LIMIT_PROTECTED_MAX=60` and `RATE_LIMIT_WINDOW_MS=15 * 60 * 1000`. The story must not pretend those are the shipped defaults, but the acceptance criteria still require validating a 60-second / 10-request contract. Satisfy that by configuring the verification runtime to match the ACs, not by silently testing a shorter arbitrary window. [Source: `server/src/middleware/rate-limit.ts:43`, `server/src/middleware/rate-limit.ts:186-196`, `_bmad-output/planning-artifacts/epics.md:1035-1045`]
- Story `3.5` already added the server/client contract needed for visible rate-limit handling: `protectedLimiter` now returns `Retry-After` and `retryAfterSeconds`, and `TenantProvider` renders a tenant-scoped `429` screen with `data-testid="429-error-message"`. Build on that seam rather than moving the UI to another page. [Source: `server/src/middleware/rate-limit.ts:119-145`, `client/src/contexts/TenantProvider.tsx:44-57`, `client/src/contexts/TenantProvider.tsx:95-110`]
- The current `TooManyRequestsScreen` only renders static retry text. Story `3.6` needs the countdown-specific test hook `data-testid="rate-limit-reset-timer"` and second-by-second updates, which do not exist yet. [Source: `client/src/contexts/TenantProvider.tsx:44-57`, repository search for `rate-limit-reset-timer`]
- The real lightweight protected route already used in E2E is `GET /api/org/:slug/ping`, mounted behind `protectedLimiter` before the org-scoped app surface loads. This is the best existing seam for deterministic limiter reset validation unless another mounted route proves strictly better. [Source: `packages/saas/src/routes/org.ts:79-94`, `e2e/rate-limit-burst.spec.ts:95-121`]
- The authenticated limiter key is derived from decoded JWT fields including `scope`, `org_slug`, `username`, and `id`, which is the behavior AC #3 should lock in. Do not refactor back to shared IP buckets. [Source: `server/src/middleware/rate-limit.ts:45-90`]
- Focused server tests already cover rate-limited protected responses with retry metadata, and focused client tests already cover rendering a 429 screen from retry-after metadata. Extend those tests instead of inventing parallel test files unless the existing file becomes unwieldy. [Source: `server/src/middleware/rate-limit.test.ts:151-183`, `client/src/contexts/TenantProvider.test.tsx:94-114`]

### Reinvention Prevention

- Reuse the existing Playwright fixture and rate-limit validation surface:
  - `e2e/fixtures/org-fixture.ts`
  - `e2e/rate-limit-burst.spec.ts`
  - `client/src/contexts/TenantProvider.tsx`
  - `server/src/middleware/rate-limit.ts`
- Reuse the existing tenant-scoped 429 screen in `TenantProvider`; do not add a second 429 component on `LoginPage`, `ReportsPage`, or a new global toast framework unless the current seam proves impossible.
- Reuse env overrides in the verification runtime for determinism. Do not change shipped limiter defaults solely to make tests faster.
- Reuse the existing JWT-based per-user keying. Do not add ad hoc test-only key generators or route-specific limiter behavior for this story.

### Cross-Story Intelligence

- Story `3.5` established the correct harness and product seams for rate-limit work: real mounted route, fixture-enabled development runtime, explicit retry-after metadata, and a minimal tenant-scoped 429 UI. `3.6` should extend that exact foundation with reset countdown and window-reset assertions. [Source: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:77-126`, `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:232-237`]
- Story `3.3` documented that repeated reconnect attempts can accidentally consume the same `protectedLimiter` bucket. Apply that lesson here: choose the reset test flow deliberately so false positives come only from limiter behavior, not unrelated navigation churn. [Source: `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes-validation-report.md:48`, `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md:203`]
- Recent Epic 3 work favors small contract-focused changes with tightly scoped tests. Follow that pattern instead of broad client or middleware refactors. [Source: `_bmad-output/implementation-artifacts/3-4-sse-concurrent-client-load-test-50-clients.md:106-130`, `git log -5`]

### Architecture Compliance Notes

- Keep E2E specs under `e2e/` and colocated shared helpers under `e2e/fixtures/`. Do not introduce another E2E framework or a second runner. [Source: `playwright.config.ts:18-21`, `_bmad-output/project-context.md:127-135`]
- Keep backend limiter behavior in `server/src/middleware/` and mounted route wiring untouched unless a narrow testability seam is required. Rate limiting is an Express middleware concern in this repo, not a page-local mock or client-side-only contract. [Source: `_bmad-output/project-context.md:101-107`, `_bmad-output/project-context.md:214-217`]
- Keep client changes minimal and localized. The repo preference is thin pages/hooks/contexts over broad global state additions. [Source: `_bmad-output/project-context.md:93-100`]
- Preserve strict TypeScript and explicit error typing around rate-limit payloads; avoid `any` in auth or limiter identity paths. [Source: `_bmad-output/project-context.md:60-63`, `_bmad-output/project-context.md:84-87`]

### Library / Framework Requirements

- Use Playwright for the primary browser validation. Root command is `npm run e2e`; Playwright does not start the app for you. [Source: `playwright.config.ts:18-21`, `playwright.config.ts:79-85`, `AGENTS.md`]
- For focused verification, prefer `--project=chromium --no-deps` so the spec does not wait on scrape-serial dependencies when they are irrelevant. [Source: `playwright.config.ts:51-65`, `AGENTS.md`]
- Use Vitest for supporting server/client regression tests. Keep unit-level timer assertions in Vitest if that reduces browser flake while leaving the end-to-end limiter path real. [Source: `_bmad-output/project-context.md:112-135`]
- The repo uses React 19 and Express 5. Keep any countdown UI in modern React patterns already present in the codebase; avoid adding a heavy date/countdown dependency for a simple per-second display. [Source: `_bmad-output/project-context.md:25-41`]

### Testing Requirements

- RED first: create or update focused failing tests before implementation code.
- Validate AC #1 by exhausting the limiter, waiting for the configured reset window, then proving a fresh allowed burst succeeds.
- Validate AC #2 by asserting both the transport contract (`Retry-After`/`retryAfterSeconds`) and the visible browser countdown at `data-testid="rate-limit-reset-timer"`.
- Validate AC #3 with two authenticated identities so one user's blocked bucket does not throttle another user on the same endpoint family.
- Keep E2E deterministic and fast. If the shipped reset window would otherwise require a real 15-minute wait, use verification-only env overrides that still match the AC contract, such as `RATE_LIMIT_WINDOW_MS=60000` and `RATE_LIMIT_PROTECTED_MAX=10`.
- Do not fake the Playwright rate-limited response with mocked fetch/axios responses; the story exists to validate the real limiter path.

### Suggested Implementation Strategy

1. Start from `e2e/rate-limit-burst.spec.ts` and decide whether extending it or splitting a focused reset spec is clearer while staying in the same harness.
2. Add RED coverage for: reset-after-window, countdown UI, and two-user bucket independence.
3. Add the smallest countdown presentation to `TooManyRequestsScreen`, driven from existing retry-after metadata.
4. If needed, add narrow timer logic and cleanup in `TenantProvider` or a tiny local helper, not in a new global error subsystem.
5. If needed, extend `server/src/middleware/rate-limit.test.ts` to prove reset-window and bucket-isolation behavior under controlled env overrides.
6. Re-run focused client/server tests plus the targeted Playwright spec against a fixture-enabled development backend.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/3-6-rate-limiting-window-reset-validation.md`
- `e2e/rate-limit-burst.spec.ts`
- `e2e/fixtures/org-fixture.ts` only if a tiny shared helper is needed
- `client/src/contexts/TenantProvider.tsx`
- `client/src/contexts/TenantProvider.test.tsx`
- `server/src/middleware/rate-limit.ts` only if a narrow reset-timing/testability seam is required
- `server/src/middleware/rate-limit.test.ts`

### Pitfalls to Avoid

- Do not run the browser validation against `NODE_ENV=test`; `skipTest` disables the limiter and creates a false green.
- Do not hardcode production semantics to "10 requests per 60 seconds" in shipped app code when current defaults are `60` per `15 minutes`.
- Do not satisfy AC #3 by using users from different orgs; the isolation being validated here is per-user bucketing on the same protected route, not separate tenant routing.
- Do not implement a second 429 screen or global toast system if the existing tenant-scoped screen can expose the countdown.
- Do not use only IP-based identities in AC #3 validation; the current product contract is user-aware JWT bucketing.
- Do not leave countdown intervals running after unmount or after the retry window expires.
- Do not broaden this into Story `3.8` documentation work or another general rate-limit redesign.

### Project Structure Notes

- Epic 3 remains in progress, and `3-6` is the next backlog validation story after several merged SSE/rate-limit stories. [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml:76-88`]
- No dedicated PRD, architecture, or UX markdown artifact was found under `_bmad-output/planning-artifacts`; rely on the epics file, readiness report, test-design handoff, project context, and prior implementation artifacts as the authoritative context set for this story.

### References

- Story `3.6` definition: `_bmad-output/planning-artifacts/epics.md:1027-1056`
- Epic 3 implementation order: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- Story `3.6` notes summary: `_bmad-output/planning-artifacts/notes-epics-stories.md:220-227`
- Test ID expectations: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:232-251`
- Previous rate-limit story context: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:69-183`
- Existing rate-limit Playwright spec: `e2e/rate-limit-burst.spec.ts:1-125`
- Existing org fixture helper: `e2e/fixtures/org-fixture.ts:1-146`
- Tenant ping route: `packages/saas/src/routes/org.ts:79-94`
- Fixture runtime gate: `packages/saas/src/routes/test-fixtures.ts:20-23`
- Real limiter contracts: `server/src/middleware/rate-limit.ts:43-145`, `server/src/middleware/rate-limit.ts:186-196`
- Existing middleware tests: `server/src/middleware/rate-limit.test.ts:138-183`
- Existing 429 tenant UI seam: `client/src/contexts/TenantProvider.tsx:44-57`, `client/src/contexts/TenantProvider.tsx:95-146`
- Existing 429 UI test: `client/src/contexts/TenantProvider.test.tsx:94-114`
- Playwright configuration: `playwright.config.ts:18-21`, `playwright.config.ts:51-85`
- Project rules: `_bmad-output/project-context.md:56-107`, `_bmad-output/project-context.md:110-217`

## Review Findings

- [ ] [Review][Patch] `clearInterval` called inside React state updater is a side-effect-in-updater anti-pattern [client/src/contexts/TenantProvider.tsx]
- [ ] [Review][Patch] Window-reset E2E test timeout too tight — 90 s total leaves ~29 s margin around a 61 s sleep [e2e/rate-limit-burst.spec.ts]
- [ ] [Review][Patch] Bucket isolation unit test does not assert first two requests to user A are 200 — a broken limiter would still pass [server/src/middleware/rate-limit.test.ts]
- [ ] [Review][Patch] `retry-after` header asserted as exact string `'60'` — fake-timer ceiling could produce `'59'` [server/src/middleware/rate-limit.test.ts]
- [ ] [Review][Patch] `retryAfterSeconds: 0` from server displays permanent "Retry after 0 seconds." and "Resets in 0 seconds" with no countdown or recovery [client/src/contexts/TenantProvider.tsx]
- [ ] [Review][Patch] React Strict Mode double-effect creates two intervals; inner `clearInterval` in state setter clears only the latest one [client/src/contexts/TenantProvider.tsx]
- [x] [Review][Defer] Countdown stays at "0 seconds" after expiry — no auto-refresh or screen recovery [client/src/contexts/TenantProvider.tsx] — deferred, pre-existing UX gap; AC does not specify post-expiry behavior
- [x] [Review][Defer] `setAuthenticatedSession` stores token without validating shape — silent `undefined` write if API contract changes [e2e/rate-limit-burst.spec.ts] — deferred, pre-existing helper pattern; low impact

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- `date -u +%Y-%m-%dT%H:%M:%SZ`
- `git log -5 --pretty=format:'%h %s'`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md`
- `_bmad-output/planning-artifacts/notes-epics-stories.md`
- `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md`
- `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- `server/src/middleware/rate-limit.ts`
- `server/src/middleware/rate-limit.test.ts`
- `packages/saas/src/routes/org.ts`
- `packages/saas/src/routes/test-fixtures.ts`
- `client/src/contexts/TenantProvider.tsx`
- `client/src/contexts/TenantProvider.test.tsx`
- `e2e/rate-limit-burst.spec.ts`
- `e2e/fixtures/org-fixture.ts`
- `playwright.config.ts`
- `cd client && npm run test:run -- src/contexts/TenantProvider.test.tsx`
- `cd server && npm run test:run -- src/middleware/rate-limit.test.ts`
- `cd client && npm run build`
- `docker compose -f docker-compose.dev.yml up -d db redis`
- `env NODE_ENV=development SAAS_ENABLED=true E2E_ENABLE_ORG_FIXTURE=true RATE_LIMIT_WINDOW_MS=60000 RATE_LIMIT_PROTECTED_MAX=10 RATE_LIMIT_GENERAL_MAX=200 JWT_SECRET=K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols= POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=ics POSTGRES_USER=postgres POSTGRES_PASSWORD=password REDIS_URL=redis://localhost:6379 PORT=3000 AUTO_MIGRATE=true nohup npm run dev > /tmp/allo-scrapper-server-3-6.log 2>&1 &`
- `PLAYWRIGHT_BASE_URL=http://localhost:5173 E2E_ENABLE_ORG_FIXTURE=true npm run e2e -- --project=chromium --no-deps e2e/rate-limit-burst.spec.ts`

### Completion Notes List

- Created an implementation-ready story for Epic 3 Story 3.6 anchored in the real post-3.5 rate-limit seams instead of the original high-level epic text alone.
- Captured the main implementation trap: the shipped `protectedLimiter` defaults are `60` requests per `15 minutes`, so any 60-second reset validation must use a controlled verification runtime rather than silently changing production behavior.
- Clarified that the controlled verification runtime must still match the acceptance-criteria contract (`60` seconds, `10` requests), rather than using a shorter arbitrary window that would false-green the story.
- Directed the implementation to extend the existing tenant-scoped 429 screen and retry-after contract with the smallest possible countdown UX seam at `data-testid="rate-limit-reset-timer"`.
- Locked AC #3 to the current JWT-based per-user key generation with two users in the same org on the same endpoint, so the implementation validates true user isolation rather than tenant or IP separation.
- Kept the story aligned with the existing Playwright fixture workflow and focused Vitest seams already established in Story `3.5`.
- Implemented the countdown UI in `TenantProvider` and covered it with focused Vitest regression tests.
- Added focused middleware regressions covering a 60-second protected-limiter reset and same-org per-user bucket isolation.
- Extended the Playwright rate-limit spec for reset-window and same-org dual-user validation.
- Verified the full focused E2E spec against a fixture-enabled local runtime after starting the backend with `SAAS_ENABLED=true`, `E2E_ENABLE_ORG_FIXTURE=true`, `RATE_LIMIT_WINDOW_MS=60000`, and `RATE_LIMIT_PROTECTED_MAX=10`; all six targeted Playwright scenarios passed.

### File List

- `_bmad-output/implementation-artifacts/3-6-rate-limiting-window-reset-validation.md`
- `e2e/rate-limit-burst.spec.ts`
- `e2e/fixtures/org-fixture.ts`
- `client/src/contexts/TenantProvider.tsx`
- `client/src/contexts/TenantProvider.test.tsx`
- `server/src/middleware/rate-limit.ts`
- `server/src/middleware/rate-limit.test.ts`
