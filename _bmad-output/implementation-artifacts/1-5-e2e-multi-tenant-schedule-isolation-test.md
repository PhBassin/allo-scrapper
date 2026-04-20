# Story 1.5: E2E Multi-Tenant Schedule Isolation Test

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that validate schedule data isolation between organizations,
so that users cannot view screening schedules from other organizations.

## Acceptance Criteria

1. **Given** organization A has schedules for Cinema A1  
   **And** organization B has schedules for Cinema B1  
   **When** user from org A views the schedule calendar page  
   **Then** only schedules from Cinema A1 are displayed in `data-testid="schedule-calendar"`  
   **And** schedules from Cinema B1 are NOT visible

2. **Given** user from org A is authenticated  
   **When** they request the tenant-scoped schedule API for Cinema B1  
   **Then** the API returns `403 Forbidden`  
   **And** no schedule data from Cinema B1 is returned

3. **Given** user from org A is authenticated  
   **When** they inspect the schedule API response used by the page  
   **Then** all schedule entries are scoped to org A  
   **And** no schedules from org B are present in the response

4. **Performance & Cleanup**  
   **Given** this test runs with Playwright `workers: 4`  
   **When** the test executes  
   **Then** the test completes in `<2 minutes` (single worker)  
   **And** parallel execution with 4 workers completes in `<5 minutes` total  
   **And** test cleanup removes all seeded schedules and cinemas within `500ms`  
   **And** no orphan schedule data remains after test completion

## Tasks / Subtasks

- [x] Add RED E2E spec for schedule isolation between two tenant orgs (AC: 1, 2, 3)
  - [x] Create `e2e/multi-tenant-schedule-isolation.spec.ts` as a dedicated spec; do not overload `e2e/multi-tenant-cinema-isolation.spec.ts`
  - [x] Use the shared org fixture layer: `import { test, expect, assertFixtureRuntimeWithinLimit } from './fixtures/org-fixture'`
  - [x] Seed two orgs with `seedTestOrg()` and capture the org-specific cinema identifiers needed for positive and negative assertions
  - [x] Keep the scenario deterministic by deriving cinema IDs and known fixture-backed showtime labels from the seeded org payloads or the test fixture data already inserted in `packages/saas/src/routes/test-fixtures.ts`

- [x] Reconcile the real schedule UI/API topology before implementing assertions (AC: 1, 2, 3)
  - [x] Confirm the user-facing schedule view under test is the tenant cinema schedule page (`/org/:slug/cinema/:id`) rendered by `client/src/pages/CinemaPage.tsx`, not the admin scrape-schedule management page in `client/src/pages/admin/SchedulesPage.tsx`
  - [x] Confirm the real client request path used to fetch showtimes is `getCinemaSchedule()` in `client/src/api/client.ts`, which currently targets `/cinemas/:id`, and that under SaaS this resolves to `/api/org/:slug/cinemas/:id`
  - [x] Do not invent a new `/api/schedules?cinema_id=...` contract unless the smallest correct fix genuinely requires one; prefer locking tests to the real schedule-fetch path already used by the tenant UI
  - [x] If acceptance-criteria wording and real route topology diverge, codify the chosen tenant-scoped contract in route tests before relying on it in Playwright

- [ ] Implement tenant-authenticated schedule-page assertions for org A (AC: 1)
  - [x] Log in with org A admin credentials returned by the fixture seed, not legacy global credentials
  - [x] Navigate to the real tenant route shape for a cinema schedule page under org A
  - [x] Add `data-testid="schedule-calendar"` to the actual schedule/showtime container if it does not already exist
  - [ ] Assert org A schedule content is visible and org B schedule content is absent in the rendered calendar view

- [ ] Validate API-level denial for cross-tenant schedule access (AC: 2)
  - [x] Trigger the tenant-scoped schedule fetch for an org B cinema while authenticated as org A
  - [x] Assert the request receives `403` rather than a silent success or incidental `404`
  - [x] Assert no org B schedule payload is returned on the denied request
  - [x] Assert the denial is API-driven, not only a client-side guard or hidden navigation path

- [ ] Validate network payload isolation for the schedule page (AC: 3)
  - [x] Capture the actual schedule API response used by the org A cinema page session
  - [ ] Add a negative assertion that known org B cinema identifiers and showtime data are absent from the org A payload
  - [ ] If the current payload does not expose explicit tenant identity fields, add the minimal stable response metadata or alternate negative assertions needed to prove org-A-only scope without broad API redesign
  - [x] Keep assertions deterministic and not dependent on incidental ordering of showtime entries

- [x] Close UX and contract gaps required by this story (AC: 1, 2, 3)
  - [x] Add or update client tests for any new `schedule-calendar` selector or explicit forbidden-state hooks on the schedule page
  - [x] Add or extend SaaS route tests in `packages/saas/src/routes/org.test.ts` to lock the chosen `403` contract for cross-tenant schedule access
  - [x] Preserve existing cinema-isolation behavior from Story 1.3 and avoid broad rewrites of shared films/cinemas route structure

- [ ] Keep fixture cleanup and parallel safety intact (AC: 4)
  - [x] Reuse `e2e/fixtures/org-fixture.ts`, `e2e/fixtures/org-cleanup.ts`, and `e2e/global-teardown.ts`
  - [ ] Do not add ad-hoc SQL cleanup or manual tenant deletion inside the spec
  - [x] Reuse the shared runtime and cleanup assertions already established in Stories 1.3 and 1.4 where applicable

- [x] Update tests and docs for the new E2E contract (AC: 1, 2, 3, 4)
  - [x] Verify whether `docs/guides/development/testing.md` needs updates for the dedicated schedule-isolation spec or current fixture-mode execution guidance
  - [x] Keep the story scoped to schedule isolation only; do not pull in unrelated admin scheduling, scraper queue, or generic routing refactors

## Dev Notes

### Scope and Guardrails

- This story is about end-user screening/showtime isolation between tenant organizations, not about admin scrape-schedule CRUD.
- Keep implementation minimal: prefer a dedicated Playwright spec, targeted selector instrumentation, and the smallest backend contract clarification needed to make schedule isolation deterministic.
- Story 1.3 already covered cinema isolation and Story 1.4 covered user isolation; reuse their fixture, anti-flake, and API-contract patterns rather than inventing new infrastructure.

### Reinvention Prevention

- Reuse existing fixture and cleanup utilities already delivered in Epic 0:
  - `e2e/fixtures/org-fixture.ts`
  - `e2e/fixtures/org-cleanup.ts`
  - `e2e/global-teardown.ts`
- Reuse current Playwright project settings in `playwright.config.ts`; do not add a separate Playwright config.
- Reuse the existing SaaS tenant route shell in `client/src/App.tsx` and the existing cinema schedule page in `client/src/pages/CinemaPage.tsx`.
- Do not use `client/src/pages/admin/SchedulesPage.tsx` as the page under test. That page manages scrape schedules (`/api/scraper/schedules`) and is not the user-facing cinema showtime view required by this story.

### Previous Story Intelligence (from 1.3 and 1.4)

- Story 1.3 established the pattern for fixture-backed tenant login: use seeded org-admin credentials, not hardcoded global credentials. [Source: `_bmad-output/implementation-artifacts/1-3-e2e-multi-tenant-cinema-isolation-test.md:54-69`]
- Story 1.3 also added measurable fixture runtime and cleanup assertions in `e2e/fixtures/org-fixture.ts`; reuse those thresholds instead of duplicating cleanup logic. [Source: `e2e/fixtures/org-fixture.ts:5-39`]
- Story 1.3 showed that explicit forbidden-state contracts matter: avoid relying on incidental `not found` behavior when the requirement is `403 Forbidden`. [Source: `_bmad-output/implementation-artifacts/1-3-e2e-multi-tenant-cinema-isolation-test.md:60-75`]
- Story 1.4 showed that shared client APIs may still point at standalone-style paths and must be reconciled with SaaS org route topology before writing E2E expectations. [Source: `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md:74-88`]

### Architecture Compliance Notes

- Monorepo ESM and strict TypeScript rules remain mandatory; avoid `any` in tenant-isolation or auth-sensitive code paths. [Source: `_bmad-output/project-context.md:49-87`]
- The tenant route shell lives under `/org/:slug/*`, including `/org/:slug/cinema/:id` for user-facing cinema schedules. [Source: `client/src/App.tsx:175-205`]
- The current user-facing schedule page is `client/src/pages/CinemaPage.tsx`, which fetches showtimes with `getCinemaSchedule()` and currently has no `schedule-calendar` selector. [Source: `client/src/pages/CinemaPage.tsx:23-35`, `client/src/pages/CinemaPage.tsx:147-269`, `client/src/api/client.ts:123-133`]
- The current admin `SchedulesPage` is for scrape cron jobs and talks to `/api/scraper/schedules`; it is out of scope for this story. [Source: `client/src/pages/admin/SchedulesPage.tsx:21-53`, `client/src/api/client.ts:208-260`]
- Under SaaS, tenant org routes mount `cinemasRouter` and `filmsRouter` beneath `/api/org/:slug/*`; there is no separate showtime API route in the current architecture. [Source: `packages/saas/src/routes/org.ts:99-111`]
- The current cinema detail API is `GET /api/cinemas/:id` in the shared router; implementation must verify and lock the tenant-safe behavior actually used under `/api/org/:slug/cinemas/:id`. [Source: `server/src/routes/cinemas.ts:146-165`]
- Fixture seeding already inserts tenant-scoped showtimes into each org schema through `packages/saas/src/routes/test-fixtures.ts`; reuse that seeded data instead of introducing bespoke schedule seed logic. [Source: `packages/saas/src/routes/test-fixtures.ts:120-150`]

### LLM-Dev Implementation Strategy

1. RED: add failing schedule-isolation E2E coverage against the real tenant cinema schedule page and actual tenant-scoped fetch path.
2. GREEN: add only the missing selector hooks and the smallest backend contract fix needed to produce a stable `403` denial for cross-tenant schedule access.
3. HARDEN: add negative payload assertions proving org B showtimes are absent from org A schedule responses.
4. VERIFY: run the dedicated Playwright spec, then the impacted client and SaaS route/unit tests.
5. DOCS: update testing guidance only if the dedicated spec changes the documented fixture-backed workflow.

### Suggested Test Matrix

- Happy path: org A login -> `/org/:slug/cinema/:id` for an org A cinema -> only org A showtimes visible.
- Negative path: org A session -> request org B cinema schedule via the tenant-scoped API -> `403`.
- Network assertion: org A schedule payload contains no org B cinema IDs, names, or showtime entries.
- Parallel/cleanup sanity: repeated runs with workers=4 do not leak or orphan tenant fixture data.

### Concrete File Targets

- `e2e/multi-tenant-schedule-isolation.spec.ts` (new dedicated spec)
- `client/src/pages/CinemaPage.tsx` (likely `schedule-calendar` selector and possibly explicit forbidden-state UX wiring)
- `client/src/pages/CinemaPage.test.tsx` (lock new selector and/or forbidden-state behavior if client UI changes)
- `packages/saas/src/routes/org.test.ts` (route-level regression coverage for schedule access isolation)
- `docs/guides/development/testing.md` (only if the dedicated spec needs documented execution changes)

### Pitfalls to Avoid

- Do not target `client/src/pages/admin/SchedulesPage.tsx`; it is a different feature area.
- Do not invent `/api/schedules` without first verifying whether a minimal adaptation of the current `/api/org/:slug/cinemas/:id` contract is sufficient.
- Do not hardcode global admin credentials; use seeded org-admin credentials from the fixture.
- Do not rely only on visible UI state; capture and verify the real network/API denial.
- Do not accept `404` as good enough if the story still requires `403 Forbidden` for cross-tenant schedule access.
- Do not bypass fixture cleanup with direct SQL or tenant-schema deletes inside tests.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:581-612`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:65`
- Planning notes for story 1.5: `_bmad-output/planning-artifacts/notes-epics-stories.md:96-102`
- Project context rules: `_bmad-output/project-context.md:17-239`
- Previous story context (cinema isolation): `_bmad-output/implementation-artifacts/1-3-e2e-multi-tenant-cinema-isolation-test.md:46-173`
- Previous story context (user isolation): `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md:41-179`
- Tenant route shell: `client/src/App.tsx:175-205`
- User-facing cinema schedule page: `client/src/pages/CinemaPage.tsx:23-269`
- Shared client cinema schedule API: `client/src/api/client.ts:123-133`
- Admin scrape schedule page (out of scope): `client/src/pages/admin/SchedulesPage.tsx:8-248`
- SaaS route mounting for cinemas/films/scraper: `packages/saas/src/routes/org.ts:99-111`
- Shared cinema detail route: `server/src/routes/cinemas.ts:146-165`
- Fixture-backed showtime seeding: `packages/saas/src/routes/test-fixtures.ts:120-150`
- Test handoff selector guidance: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:96-114`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 1.5 based on sprint auto-discovery after marking story 1.4 done
- `npx vitest run src/routes/cinemas.test.ts src/routes/cinemas.security.test.ts` (server)
- `npx vitest run src/pages/CinemaPage.test.tsx` (client)
- `npx vitest run src/routes/org.test.ts` (packages/saas)
- `E2E_ENABLE_ORG_FIXTURE=true npx playwright test e2e/multi-tenant-schedule-isolation.spec.ts --project=chromium --no-deps` (fixture runtime blocked locally: `/test/seed-org` returned `404`)

### Completion Notes List

- Story file created with explicit guardrails separating user-facing showtime isolation from admin scrape-schedule management.
- Added route-topology reconciliation tasks to prevent implementation against a nonexistent `/api/schedules` endpoint when the current tenant UI fetches schedules via `/api/org/:slug/cinemas/:id`.
- Added dedicated Playwright coverage in `e2e/multi-tenant-schedule-isolation.spec.ts` for tenant schedule-page isolation, cross-tenant denial, and payload-level leakage checks.
- Added `data-testid="schedule-calendar"` coverage to `CinemaPage` and locked the selector with a focused client test.
- Hardened the shared cinema detail route so org-scoped `GET /api/org/:slug/cinemas/:id` uses the same tenant auth, permission, and org-boundary enforcement as the list route.
- Extended server and SaaS route tests to lock `403` behavior for cross-tenant cinema schedule access while keeping the current shared route topology intact.
- Verified targeted client, server, and SaaS tests locally; dedicated Playwright verification is currently blocked by a local runtime configuration issue where `/test/seed-org` is not exposed.

### File List

- `_bmad-output/implementation-artifacts/1-5-e2e-multi-tenant-schedule-isolation-test.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `e2e/multi-tenant-schedule-isolation.spec.ts`
- `client/src/pages/CinemaPage.tsx`
- `client/src/pages/CinemaPage.test.tsx`
- `server/src/routes/cinemas.ts`
- `server/src/routes/cinemas.test.ts`
- `server/src/routes/cinemas.security.test.ts`
- `packages/saas/src/routes/org.test.ts`

## Change Log

- 2026-04-20: Created implementation-ready story file for multi-tenant schedule isolation with explicit route-topology guardrails, fixture reuse guidance, and concrete test/file targets.
- 2026-04-20: Started dev-story implementation for schedule isolation by adding the dedicated Playwright spec, `schedule-calendar` instrumentation, and org-scoped cinema detail tenant-boundary enforcement; targeted tests pass, while full E2E execution is currently blocked locally because `/test/seed-org` returns `404`.
