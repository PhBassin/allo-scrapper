# Story 2.5: E2E Scraper Progress Tracking with 10+ Concurrent Jobs

Status: done

## Agent Record

- **PR**: [#921 feat(saas): track tenant scrape progress by job](https://github.com/PhBassin/allo-scrapper/pull/921)
- **Completed**: 2026-04-26
- **Summary**: Implemented tenant-authenticated per-job scrape progress tracking in SaaS mode. Added concurrent admin-triggered jobs support with isolated SSE updates per tenant. Fixed tenant schema/bootstrap and DB scoping so fixture-backed orgs get tenant-local app tables and deterministic cinema seed data. E2E test covers 10 concurrent scrape jobs with one isolated failure scenario. Client-side hook useScrapeProgress added with focused unit tests. ProgressTracker service unit tests added in server workspace. Tests pass across all workspaces (client, server, saas, scraper).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that trigger 10 scrapes simultaneously,
so that I can validate real-time progress tracking under load.

## Acceptance Criteria

1. **Given** 10 cinema scrapes are triggered via the UI  
   **When** all scrapes start processing  
   **Then** all 10 jobs show progress updates in real-time via SSE  
   **And** each `data-testid="scrape-progress-card"` displays the correct cinema name  
   **And** progress percentages update at least every 5 seconds

2. **Given** 10 scrapes are running  
   **When** all scrapes complete  
   **Then** all 10 `data-testid="scrape-status-completed"` elements are visible  
   **And** no scrapes are stuck in "processing" state  
   **And** the completion time is within 2 minutes

3. **Given** a scrape fails during concurrent execution  
   **When** the failure occurs  
   **Then** the failed scrape shows error status in the UI  
   **And** the error message is displayed in the progress card  
   **And** other scrapes continue processing without interruption

## Tasks / Subtasks

- [ ] Add RED Playwright coverage for concurrent scrape progress before implementation (AC: 1, 2, 3)
  - [ ] Add or extend an E2E spec under `e2e/` that is dedicated to concurrent scrape progress and keeps `serial` execution for real scrape orchestration
  - [ ] Seed a fixture-backed org and expand it to at least 10 target cinemas through the real tenant admin/API flow before triggering scrapes, because the base fixture contract only guarantees 3 cinemas
  - [ ] Assert the UI exposes one progress card per active scrape job, plus stable completion/error markers that can be targeted without text-only selectors
  - [ ] Add a controlled failure path for one scrape job while the remaining jobs complete, avoiding flaky dependence on external upstream failures

- [ ] Introduce the minimum UI/testability seams required for per-job progress visibility (AC: 1, 2, 3)
  - [ ] Extend the existing scrape progress UI instead of creating a second progress surface
  - [ ] Add `data-testid="scrape-progress-card"` and `data-testid="scrape-status-completed"` to the real progress component tree
  - [ ] Add explicit progress-per-job labels and status rendering so Playwright can map each card to a cinema name and final state
  - [ ] Add error-state rendering for per-job failures without regressing the existing single-panel progress flow

- [ ] Make concurrent scrape progress observable through the current SSE/event model (AC: 1, 2, 3)
  - [ ] Reuse `/api/scraper/progress`, `ProgressTracker`, and `useScrapeProgress` as the only real-time transport
  - [ ] If the current event model is too aggregate for 10-card visibility, extend existing progress events/types instead of inventing a second WebSocket/SSE channel
  - [ ] Preserve compatibility with the current `ScrapeProgress` loading/completed states used by existing page and component tests
  - [ ] Keep event payloads JSON-serializable and typed on both server and client sides

- [ ] Ensure the 10-job scenario is deterministic and CI-safe (AC: 1, 2, 3)
  - [ ] Use the real tenant route shape for setup and triggering in SaaS mode: admin UI at `/org/:slug/admin?tab=cinemas`, cinema creation at `/api/org/:slug/cinemas`, scraper trigger at `/api/org/:slug/scraper/trigger`
  - [ ] Prefer targeted per-cinema triggers over a single global scrape if that is what the current UI can reliably drive to exactly 10 concurrent jobs
  - [ ] Bound the scenario to complete within the story contract without 10-minute waits or other long-running timing assumptions
  - [ ] Avoid brittle raw `waitForTimeout` checks when a response, UI state, or SSE-driven assertion is available
  - [ ] Keep the test scoped to fixture-backed SaaS runtime when required, matching the existing multi-tenant E2E pattern and current org-scoped admin route conventions

- [ ] Cover failure isolation without breaking ongoing progress updates (AC: 3)
  - [ ] Add a deterministic failure injection seam in the scraper/server path only if needed for one-card error validation
  - [ ] Verify the failed scrape renders an error state/message in its own card
  - [ ] Verify the remaining scrape cards still reach completed state and are not blocked by the failed job
  - [ ] Avoid turning this story into DLQ API validation; DLQ behavior remains covered by Stories 2.1, 2.2, and 2.6

- [ ] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [ ] Run `cd client && npm run test:run -- src/components/ScrapeProgress.test.tsx src/pages/admin/CinemasPage.test.tsx`
  - [ ] Run the targeted Playwright spec with the backend and scraper services already running
  - [ ] Run `cd server && npm run test:run -- src/routes/scraper.test.ts src/services/scraper-service.test.ts` if progress contracts or scraper routes change
  - [ ] Run `cd scraper && npm run test:run` only if scraper runtime/event emission changes

## Dev Notes

### Scope and Guardrails

- This story is about proving concurrent scrape progress visibility through the real UI and SSE path, not redesigning scraping, queueing, or introducing a new real-time transport.
- The current app already has a scrape progress surface, but it is aggregate-only: `ScrapeProgress` renders a single `data-testid="scrape-progress"` container and does not currently expose `scrape-progress-card`, `scrape-status-completed`, `scrape-progress-percentage`, or `scrape-progress-eta`. Story 2.5 should add the smallest possible testable UI extension on top of that existing component. [Source: `client/src/components/ScrapeProgress.tsx:8-150`, `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:157-165`]
- Keep the scenario grounded in the existing fixture-backed SaaS runtime for deterministic org-scoped test data. The repo already has a proven Playwright fixture pattern for seeding and cleaning organizations; reuse it rather than creating bespoke DB setup for this story. [Source: `e2e/fixtures/org-fixture.ts:1-138`, `AGENTS.md`, `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md:110-117`]
- The fixture contract alone is not enough to satisfy the "10 concurrent jobs" setup: Story 0.2 guarantees only 3 seeded cinemas, and the SaaS free plan defaults to `max_cinemas=3`. If Story 2.5 needs 10 tenant cinemas, the implementation must either use a quota-safe setup path already supported by the test/runtime seam or add a narrow, explicit story-owned setup seam instead of hand-waving this prerequisite. [Source: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md:13-18`, `packages/saas/migrations/saas_001_create_plans.sql`, `packages/saas/src/routes/org.test.ts:299-330`]

### Reinvention Prevention

- Reuse `ScrapeProgress` and `useScrapeProgress` as the only client-side progress seam. Do not build a parallel React component tree just for the 10-job scenario. [Source: `client/src/components/ScrapeProgress.tsx:8-150`, `client/src/hooks/useScrapeProgress.ts:12-103`]
- Reuse `/api/scraper/progress` and `ProgressTracker` as the only SSE channel. Do not introduce WebSockets, polling, or a second SSE endpoint. [Source: `server/src/routes/scraper.ts:272-292`, `server/src/services/progress-tracker.ts:52-162`, `server/src/services/scraper-service.ts:189-218`]
- Reuse the current admin scraping entrypoints on `CinemasPage` (`scrape-all-button` and per-cinema buttons) rather than inventing a hidden test-only trigger flow. [Source: `client/src/pages/admin/CinemasPage.tsx:163-191`, `client/src/pages/admin/CinemasPage.test.tsx:108-250`]
- Reuse the existing SaaS org-scoped route topology for both setup and scraping. In tenant mode, the scraper router is mounted under `/api/org/:slug/scraper`, not just `/api/scraper`; story implementation and tests must verify the actual path used from `/org/:slug/admin?tab=cinemas` rather than assume standalone routes. [Source: `packages/saas/src/routes/org.ts:99-112`, `packages/saas/src/routes/org.test.ts:391-420`, `client/src/pages/RegisterPage.tsx:160-166`, `client/src/App.tsx:175-205`]
- Reuse the Playwright org fixture utilities for org creation and cleanup. Do not add ad hoc shell/database cleanup scripts to E2E tests. [Source: `e2e/fixtures/org-fixture.ts:53-138`, `e2e/fixtures/org-cleanup.ts:111-209`]

### Previous Story Intelligence (Story 2.4)

- Story 2.4 hardened reconnect recovery in the Redis consumer and explicitly anchored recovery to the existing queue/resume model. Story 2.5 should treat that reconnect behavior as a prerequisite already under test, not re-implement reconnect logic in the UI layer. [Source: `_bmad-output/implementation-artifacts/2-4-redis-reconnection-handling-during-job-processing.md:41-68`, `:187-196`]
- Story 2.4 added confidence around in-flight recovery and no-loss semantics. This story should extend that confidence upward into the user-visible progress experience by validating that concurrent UI tracking stays coherent under real queued work. [Source: `_bmad-output/implementation-artifacts/2-4-redis-reconnection-handling-during-job-processing.md:117-132`, `:189-196`]

### Current Code Reality That This Story Must Extend

- `CinemasPage` currently shows a single `ScrapeProgress` panel when any scrape is active and exposes `scrape-all-button` plus per-row `scrape-cinema-<id>` buttons. There is no current per-job card UI, and `showProgress` is just a boolean. [Source: `client/src/pages/admin/CinemasPage.tsx:41-43`, `:121-131`, `:166-191`, `:267-281`]
- The tenant admin UI route is `/org/:slug/admin?tab=cinemas` via `AdminPage`, not a standalone `/admin/cinemas` path. E2E navigation and helper code should use that real route shape to avoid drifting away from the tenant app shell. [Source: `client/src/App.tsx:175-205`, `client/src/pages/admin/AdminPage.tsx:112-180`]
- `ScrapeProgress` only renders aggregate counters (`processedCinemas`, `processedFilms`) from a flat event list. It does not currently derive per-cinema card state, progress percentages by card, or completed/error markers for individual jobs. [Source: `client/src/components/ScrapeProgress.tsx:24-150`]
- `useScrapeProgress()` simply appends every parsed SSE event to local state and closes the SSE connection 1.5s after a terminal `completed` or `failed` event. There is no reconnect logic yet, and the hook currently assumes one stream of events rather than multiple independently visible job cards. That makes Story 2.5 sensitive to event-model changes and a good place to keep type updates minimal and deliberate. [Source: `client/src/hooks/useScrapeProgress.ts:26-89`]
- The client `subscribeToProgress()` uses `EventSource` on `/api/scraper/progress` and currently logs parse/SSE errors to `console.error`. Story 2.5 should not widen that scope into Story 3.2 reconnection work, but it may need to adapt parsing if the event payload contract grows to support job-level card rendering. [Source: `client/src/api/client.ts:192-215`]
- `client/src/api/cinemas.ts` currently targets standalone `/cinemas` admin endpoints, while other client code already uses org-scoped SaaS paths when running under tenant routes. If Story 2.5 needs to create additional cinemas as part of deterministic test setup, the story must steer the developer toward the actual tenant-safe creation path (`/api/org/:slug/cinemas`) rather than assuming the standalone client helper is sufficient in SaaS mode. [Source: `client/src/api/cinemas.ts:33-75`, `client/src/pages/RegisterPage.tsx:160-166`, `packages/saas/src/routes/org.ts:99-112`]
- Server-side progress events are still broad status events (`started`, `cinema_started`, `film_started`, `completed`, `failed`, etc.) and the tracker writes them as unnamed SSE `data:` messages. If job-level correlation is required for 10 concurrent cards, extend this existing event union on both server and client instead of layering on separate state. [Source: `server/src/services/progress-tracker.ts:12-31`, `:85-123`, `client/src/types/index.ts:103-145`]

### Architecture Compliance Notes

- Keep UI changes in the existing client structure: reusable component logic in `client/src/components/`, hook logic in `client/src/hooks/`, route/page orchestration in `client/src/pages/`. [Source: `_bmad-output/project-context.md:93-100`, `:146-156`]
- Keep backend HTTP and business-logic changes split between `server/src/routes/` and `server/src/services/`. If progress event payloads change, keep route handlers focused and place orchestration in services/tracker code. [Source: `_bmad-output/project-context.md:101-107`]
- Preserve strict TypeScript across client, server, and scraper. Do not use `any` for progress event extensions, SSE payload parsing, or test fixtures. [Source: `_bmad-output/project-context.md:60-78`]
- Use structured logging only in production code. Playwright/browser debug output can stay in tests, but do not add `console.log` to client/server runtime code for this story. [Source: `_bmad-output/project-context.md:75-79`, `:197-203`]

### Testing Requirements

- Primary validation is Playwright E2E because this story is explicitly `RISK002-E2E-001`; keep the new spec focused on concurrent progress visibility, completion, and failure isolation. [Source: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:157-165`]
- Preserve existing unit/component coverage when UI structure changes. `ScrapeProgress.test.tsx` and `CinemasPage.test.tsx` already cover the aggregate progress surface and are the lowest-cost regression net for new test IDs or rendering branches. [Source: `client/src/components/ScrapeProgress.test.tsx:12-333`, `client/src/pages/admin/CinemasPage.test.tsx:108-364`]
- Existing Playwright scrape specs are serial because they trigger real scraping. Story 2.5 should keep that constraint for the concurrent 10-job scenario rather than trying to parallelize real scrape specs. [Source: `e2e/scrape-progress.spec.ts:10-12`, `e2e/cinema-scrape.spec.ts:10-12`, `playwright.config.ts:49-63`]
- Avoid long hard waits where possible. TEA guidance explicitly calls out deterministic tests and discourages time-heavy waits; use response/state/SSE-driven assertions first, and keep any polling bounded. [Source: `_bmad-output/test-artifacts/test-design/test-design-qa.md:624-625`]

### Suggested Implementation Strategy

1. RED: write the Playwright scenario first using fixture-backed auth/data and make the missing `data-testid` / per-job visibility problem explicit.
2. GREEN: extend the existing progress event model and `ScrapeProgress` rendering just enough to represent 10 concurrent job cards.
3. HARDEN: add one deterministic failure path so a single failed card can be asserted without making the suite depend on random upstream scrape failures.
4. VERIFY: re-run focused client tests and the targeted Playwright spec with the scraper worker running separately in local dev, per repo conventions.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs.md`
- `e2e/scrape-progress.spec.ts` or a sibling dedicated concurrent-progress spec under `e2e/`
- `e2e/fixtures/org-fixture.ts` only if a narrow helper is needed to prepare/authenticate a 10-cinema org
- `client/src/components/ScrapeProgress.tsx`
- `client/src/components/ScrapeProgress.test.tsx`
- `client/src/hooks/useScrapeProgress.ts`
- `client/src/pages/admin/CinemasPage.tsx`
- `client/src/pages/admin/CinemasPage.test.tsx`
- `client/src/api/client.ts` only if the SSE payload parser contract changes
- `client/src/types/index.ts`
- `server/src/services/progress-tracker.ts`
- `server/src/services/scraper-service.ts` or `server/src/routes/scraper.ts` only if progress payload shape or orchestration needs a narrow extension
- `scraper/src/index.ts` only if scrape progress emission needs additional job-level metadata

### Pitfalls to Avoid

- Do not solve this by adding a fake test-only frontend view that is disconnected from the real scrape progress experience.
- Do not add Story 3.x heartbeat/reconnect requirements here; missing reconnect status UI belongs to the later SSE epic.
- Do not depend on ambient seeded cinemas from the default database if fixture-backed org data can make the scenario deterministic.
- Do not assume the base fixture org already has 10 cinemas; the current contract guarantees 3, and tenant cinema quotas can block naive expansion.
- Do not rely on a single aggregate `completed` banner as proof that all 10 jobs were tracked individually; the story explicitly calls for per-job card visibility.
- Do not make the test require a 10-minute scrape or external network instability just to observe progress. Keep it bounded to the 2-minute completion contract from Epic 2.

### Project Structure Notes

- This repo has no dedicated `client/src/features/scraper/` module; scraper-trigger UI currently lives in `client/src/pages/admin/CinemasPage.tsx` and `client/src/components/ScrapeProgress.tsx`. Keep new progress UI aligned with that existing structure unless the implementation naturally extracts a small reusable helper.
- There are already E2E fixture utilities under `e2e/fixtures/`; Story 2.5 should build on that pattern instead of introducing a second test-helper location.

### Git Intelligence Summary

- Recent scraper work has been fix/test heavy around reconnect recovery and queue reliability: `fix(scraper): harden Redis reconnect recovery (#919)`, `test(scraper): add redis load integration coverage`, `fix(scraper): preserve reconnect recovery state`. That is a signal to keep Story 2.5 tightly aligned with the current queue/recovery design rather than reopening backend reliability design choices. [Source: `git log --oneline -5`]

### Project Context Reference

- Follow the repo AI rules in `_bmad-output/project-context.md`: strict TS, no `any` in critical flows, business logic in services, custom hooks for reusable client logic, no production `console.log`, and Vitest/Playwright as the existing test stack. [Source: `_bmad-output/project-context.md:56-79`, `:93-107`, `:110-136`, `:146-203`]

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:765-789`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:73-80`
- Epic notes: `_bmad-output/planning-artifacts/notes-epics-stories.md:147-160`
- QA handoff story mapping: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:157-165`
- Data-testid requirements: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:232-253`
- Existing admin scrape UI: `client/src/pages/admin/CinemasPage.tsx:121-191`, `client/src/pages/admin/CinemasPage.tsx:267-281`
- Existing admin scrape tests: `client/src/pages/admin/CinemasPage.test.tsx:108-364`
- Existing progress component: `client/src/components/ScrapeProgress.tsx:8-150`
- Existing progress component tests: `client/src/components/ScrapeProgress.test.tsx:12-333`
- Existing progress hook: `client/src/hooks/useScrapeProgress.ts:12-103`
- Existing SSE client subscription: `client/src/api/client.ts:192-215`
- Shared progress event types: `client/src/types/index.ts:103-145`
- SSE route and service subscription: `server/src/routes/scraper.ts:272-292`, `server/src/services/scraper-service.ts:189-218`
- Progress tracker event model: `server/src/services/progress-tracker.ts:12-162`
- Existing scrape E2E specs: `e2e/scrape-progress.spec.ts:10-183`, `e2e/cinema-scrape.spec.ts:10-136`
- Existing org fixture utilities: `e2e/fixtures/org-fixture.ts:53-138`, `e2e/fixtures/org-cleanup.ts:111-209`
- Example fixture-backed auth flow: `e2e/multi-tenant-cinema-isolation.spec.ts:20-140`
- Tenant admin route shell: `client/src/App.tsx:175-205`, `client/src/pages/admin/AdminPage.tsx:112-180`
- Tenant scraper/cinema route mounting: `packages/saas/src/routes/org.ts:99-112`, `packages/saas/src/routes/org.test.ts:299-330`, `packages/saas/src/routes/org.test.ts:391-420`
- Org-scoped client setup precedent: `client/src/pages/RegisterPage.tsx:160-166`
- Playwright scrape project configuration: `playwright.config.ts:5-63`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 2.5 using sprint tracker, Epic 2 plan, QA handoff, current scrape UI/SSE implementation, existing Playwright fixture utilities, and recent scraper reliability commits
- `git log --oneline -5`

### Completion Notes List

- Selected the next backlog story from sprint tracking: `2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs`.
- Anchored the story to the real current code paths for scrape progress: `CinemasPage`, `ScrapeProgress`, `useScrapeProgress`, `/api/scraper/progress`, and `ProgressTracker`.
- Captured the main implementation gap precisely: the repo currently has only an aggregate `scrape-progress` panel and does not yet expose per-job progress cards or completion markers required by the story.
- Scoped the work to fixture-backed, deterministic E2E coverage and explicitly prevented scope creep into heartbeat/reconnect work owned by Epic 3.
- Validation fix applied: made the tenant route topology explicit so implementation does not drift toward standalone `/api/scraper` or non-tenant admin paths in SaaS mode.
- Validation fix applied: made the 10-cinema setup constraint explicit so the developer handles fixture-size and quota limits intentionally instead of assuming the base fixture already satisfies the story.

### File List

- `_bmad-output/implementation-artifacts/2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs.md`
