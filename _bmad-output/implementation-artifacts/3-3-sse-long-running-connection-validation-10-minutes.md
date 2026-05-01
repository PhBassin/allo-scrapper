# Story 3.3: SSE Long-Running Connection Validation (10+ Minutes)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that validate SSE connections remain stable for 10+ minute scrapes,
so that long-running operations don't timeout or disconnect.

## Acceptance Criteria

1. **Given** a scrape is triggered that takes 10+ minutes
   **When** the scrape is processing
   **Then** the SSE connection remains open for the entire duration
   **And** stream liveness frames are received at least every 30 seconds
   **And** no connection timeouts occur

2. **Given** a 10-minute scrape is running
   **When** I monitor network activity
   **Then** heartbeat pings are sent every 30 seconds
   **And** progress events are sent whenever scrape progress changes
   **And** the connection shows as open from the browser/client perspective

3. **Given** the server sends progress events
   **When** I inspect the event stream and force a reconnect
   **Then** each replayable progress event has a unique SSE event ID
   **And** event IDs are monotonically increasing
   **And** the client resumes from the last event ID after reconnection

## Tasks / Subtasks

- [x] Add RED coverage for the SSE event ID and resume contract before long-running validation (AC: 3)
  - [x] Extend `server/src/services/progress-tracker.test.ts` to prove replayable business progress frames are written with standard SSE `id:` lines and unique monotonically increasing IDs
  - [x] Prove heartbeat `ping` frames remain transport-only and do not consume replay/resume IDs or pollute replay history
  - [x] Prove `Last-Event-ID` replay returns only matching tenant events after the provided ID and never replays another tenant's progress
  - [x] Extend `client/src/api/client.test.ts` to prove the fetch-based SSE parser captures `id:` fields and sends `Last-Event-ID` on reconnect
  - [x] Add parser regressions for multi-line `data:` blocks and split UTF-8 chunks so the new ID parsing does not regress the EOF flush fixes from Story 3.1

- [x] Implement the minimal SSE event ID/resume runtime support required by AC #3 (AC: 3)
  - [x] Keep the existing `GET /api/scraper/progress` endpoint; do not add a second SSE route, WebSocket path, polling fallback, or unauthenticated stream
  - [x] Add event IDs at the server streaming layer using standard SSE `id: <monotonic-id>` fields, not an ad hoc JSON-only ID that the stream parser cannot use for resume
  - [x] Store enough replay metadata in `ProgressTracker` to replay business events after `Last-Event-ID` while preserving current tenant filtering and trace-context enrichment
  - [x] Keep `ProgressTracker.getEvents()` returning `ProgressEvent[]` for existing debugging/tests; if replay metadata is stored internally, expose it only through a new private/internal structure rather than changing this public helper's shape
  - [x] Keep event IDs monotonic for the process lifetime or until `ProgressTracker.reset()`; do not reset the ID sequence merely because a new `started` event clears replayable business history
  - [x] Pass the request `Last-Event-ID` header from `server/src/routes/scraper.ts` through `ScraperService.subscribeToProgress()` into `ProgressTracker.addListener()`
  - [x] Normalize invalid, negative, non-numeric, or too-old `Last-Event-ID` values to safe replay behavior without throwing, leaking cross-tenant information, or hanging the stream
  - [x] Preserve current replay semantics for new subscribers without `Last-Event-ID`: replay prior matching business events, but do not replay pings
  - [x] Keep heartbeat `ping` payloads unchanged (`{ type: 'ping', timestamp: <ISO8601> }`) except for any raw-stream formatting needed around them

- [x] Extend the fetch-based client SSE transport to resume from the last event ID (AC: 3)
  - [x] Reuse `subscribeToProgress` in `client/src/api/client.ts`; do not switch to native `EventSource` because the current endpoint depends on `Authorization` headers
  - [x] Parse complete SSE message blocks into `{ id?, data }`, supporting `id:` plus one or more `data:` lines according to the SSE format
  - [x] Track the last processed replayable event ID inside `subscribeToProgress` and include `Last-Event-ID` on reconnect attempts only after an ID has been seen
  - [x] Keep existing reconnection behavior from Story 3.2: heartbeat timeout at 60 seconds, exponential backoff, abort cleanup, terminal auth/server failures surfaced immediately
  - [x] Preserve `useScrapeProgress` state across reconnects; do not reset accumulated events, tracked jobs, `scrape-progress-percentage`, or `scrape-progress-eta`

- [x] Add deterministic long-running SSE validation coverage (AC: 1, 2, 3)
  - [x] Add a focused Playwright spec under `e2e/`, such as `e2e/sse-long-running-connection.spec.ts`, and add it to the scrape-serial project list in `playwright.config.ts` if it triggers real scrape work
  - [x] Use a fixture-backed SaaS runtime when testing org-scoped progress: `SAAS_ENABLED=true`, `E2E_ENABLE_ORG_FIXTURE=true`, authenticated `/api/org/:slug/scraper/progress`, and the existing `seedTestOrg` fixture
  - [x] Ensure the app and scraper worker are actually running; root `npm run dev` does not start the scraper worker, so the test environment must also run `scraper` with `RUN_MODE=consumer`
  - [x] Make the 10+ minute scenario deterministic by configuring the scraper runtime for the test, for example `SCRAPER_CONCURRENCY=1`, `RATE_LIMIT_SCRAPER_MAX` high enough for setup, and a large `SCRAPE_THEATER_DELAY_MS`, instead of relying on unpredictable public-site latency
  - [x] Ensure the selected scrape target can actually run long enough: either use tenant baseline cinemas copied from `server/src/config/cinemas.json` or explicitly seed/choose Allocine-backed cinemas; do not rely only on the `/test/seed-org` `example.test` fixture cinemas because they fail fast and cannot validate a 10-minute active stream
  - [x] Avoid `assertFixtureRuntimeWithinLimit()` or pass a custom max above the long-running timeout; the default fixture runtime limit is 120 seconds and would make a valid 10+ minute test fail for the wrong reason
  - [x] Set the Playwright test timeout explicitly above the validation window, for example `test.setTimeout(12 * 60 * 1000)` or higher if cleanup is included
  - [x] Assert the browser/client-side stream remains open for at least 10 minutes, receives `ping` frames every 30 seconds with acceptable timer tolerance, and does not show `connectionStatus` as `disconnected`
  - [x] Assert the UI remains useful during the long run with existing test IDs: `sse-connection-status`, `scrape-progress-percentage`, and `scrape-progress-eta`
  - [x] Force one reconnect during the long-running window and assert the next request sends `Last-Event-ID` and receives no duplicate or missing progress events for the current tenant

- [x] Keep Epic 3 scope boundaries intact (AC: 1, 2, 3)
  - [x] Do not implement Story 3.4's 50+ concurrent-client load test in this story
  - [x] Do not implement Story 3.6's rate-limit window reset countdown behavior here
  - [x] Do not broaden rate-limit configuration unless a focused regression proves the long-running progress endpoint is being rate-limited incorrectly
  - [x] Do not add a global client error framework or redesign progress UI; use the existing `ScrapeProgress`, `useScrapeProgress`, and `subscribeToProgress` seams
  - [x] Update `docs/reference/api/scraper.md` and `docs/troubleshooting/scraper.md` if the event stream format, heartbeat cadence, reconnection, or resume behavior changes

- [x] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [x] Run `cd server && npm run test:run -- src/services/progress-tracker.test.ts src/routes/scraper.test.ts src/services/scraper-service.test.ts`
  - [x] Run `cd client && npm run test:run -- src/api/client.test.ts src/hooks/useScrapeProgress.test.ts src/components/ScrapeProgress.test.tsx`
  - [x] Run the new Playwright long-running spec against a running server, client, Redis, database, and scraper worker, for example `PLAYWRIGHT_BASE_URL=http://localhost:5173 E2E_ENABLE_ORG_FIXTURE=true npm run e2e -- --project=chromium-scrape-serial e2e/sse-long-running-connection.spec.ts`
  - [x] Run broader `cd server && npm run test:run` and `cd client && npm run lint && npm run test:run` if shared SSE parser, progress tracker, or UI contracts change

## Dev Notes

### Scope and Guardrails

- Story `3.3` is now unblocked because Epic 3 blockers `3.7`, `3.1`, `3.5`, and client reconnect story `3.2` are complete. The readiness report says Stories `3.2`, `3.3`, `3.4`, `3.6`, and `3.8` can run in parallel only after those blockers. [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`]
- The epic labels this story as test-only, but AC #3 cannot pass against current runtime code without adding real SSE event IDs and `Last-Event-ID` replay support. Do not fake this with test-only assertions; implement the smallest production-safe event ID/resume contract needed to make the validation meaningful. [Source: `_bmad-output/planning-artifacts/epics.md:933-963`]
- Interpret AC #1 "progress updates at least every 30 seconds" as stream liveness frames at least every 30 seconds. Business progress events should still be emitted only when scrape progress changes. Story 3.1 intentionally made `ping` a transport event, not business progress history. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:47-58`, `server/src/services/progress-tracker.ts:169-209`]
- Keep the validation long-running and deterministic. A test that completes in seconds, mocks all networking, or runs only with fake timers is not enough for the E2E acceptance criteria.

### Critical Current-Code Reality

- `ProgressTracker` stores raw `ProgressEvent[]` and writes only `data: <json>\n\n` for business events. There is no stored sequence ID, no `id:` SSE field, and no `Last-Event-ID` replay filter. [Source: `server/src/services/progress-tracker.ts:61-122`, `server/src/services/progress-tracker.ts:154-163`]
- `ProgressTracker.emit()` clears `this.events` when a new `started` event arrives and `hasActiveJobs()` is false. That replay-buffer reset must not accidentally reset the monotonic ID sequence used for resume, or a reconnect across scrape sessions can see duplicate IDs. [Source: `server/src/services/progress-tracker.ts:108-114`]
- `ProgressTracker.getEvents()` is used by existing tests to assert that heartbeat pings do not enter replay history. Changing it to return wrapper objects would create avoidable regressions; keep metadata internal or add a separate helper only if needed. [Source: `server/src/services/progress-tracker.ts:238-240`, `server/src/services/progress-tracker.test.ts:115-138`]
- Heartbeat pings are currently direct `data:` frames and are intentionally not added to the replay buffer. Preserve that behavior so pings do not corrupt resume semantics. [Source: `server/src/services/progress-tracker.ts:169-175`, `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:47-51`]
- `GET /api/scraper/progress` is already behind `protectedLimiter` and `requireAuth`, builds observability context, and delegates to `ScraperService.subscribeToProgress()`. This is the seam that should pass `Last-Event-ID`; do not bypass it. [Source: `server/src/routes/scraper.ts:303-323`]
- `ScraperService.subscribeToProgress()` sets the SSE headers and delegates listener lifecycle to `progressTracker.addListener()`. Add resume context through this existing flow. [Source: `server/src/services/scraper-service.ts:182-211`]
- `subscribeToProgress` in `client/src/api/client.ts` is a fetch-based SSE reader with reconnection and heartbeat watchdog support from Story 3.2. It currently parses only `data:` lines and ignores `id:` fields entirely. [Source: `client/src/api/client.ts:211-390`]
- The client currently keeps progress state in `useScrapeProgress` and treats `ping` as a liveness signal. Do not duplicate this state owner or reset progress during resume. [Source: `client/src/hooks/useScrapeProgress.ts:269-319`]
- The shared client `ProgressEvent` union includes `ping`, but neither client nor server types include a standard SSE frame ID because the ID should be stream metadata rather than a business payload field. [Source: `client/src/types/index.ts:103-121`, `server/src/services/progress-tracker.ts:19-38`]
- Existing Playwright config has no `webServer`, defaults to `http://localhost:5173`, and puts scrape-heavy specs in the `chromium-scrape-serial` project. A new long-running scrape spec should follow that pattern. [Source: `playwright.config.ts:3-11`, `playwright.config.ts:50-64`, `playwright.config.ts:78-84`]
- `seedTestOrg` creates fixture cinemas with `https://example.test/...` URLs after `createOrg()` has already seeded tenant baseline cinemas from `server/src/config/cinemas.json`. The example-test fixture cinemas are useful failure sentinels but are not valid long-running scrape targets. Choose Allocine-backed tenant cinemas for the 10-minute scenario. [Source: `packages/saas/src/services/org-service.ts:72-144`, `packages/saas/src/routes/test-fixtures.ts:112-124`, `server/src/config/cinemas.json:1-80`]
- `assertFixtureRuntimeWithinLimit()` defaults to 120 seconds. Existing E2E specs call it at the end, but a 10+ minute validation must either not use it or pass a max above the long-running test timeout. [Source: `e2e/fixtures/org-fixture.ts:5-33`, `e2e/tenant-concurrent-scrape-progress.spec.ts:116`]

### Reinvention Prevention

- Reuse the current SSE pipeline:
  - `server/src/routes/scraper.ts`
  - `server/src/services/scraper-service.ts`
  - `server/src/services/progress-tracker.ts`
  - `client/src/api/client.ts`
  - `client/src/hooks/useScrapeProgress.ts`
  - `client/src/components/ScrapeProgress.tsx`
- Reuse the existing Redis progress flow for real scrape events. The server subscribes to `scrape:progress` at startup and forwards received events into `progressTracker.emit()`. [Source: `server/src/index.ts:30-39`, `server/src/services/redis-client.ts:220-238`]
- Reuse existing Playwright org fixtures instead of creating a second E2E framework or ad hoc test app. Fixture endpoints are exposed only in `NODE_ENV=test` or in development with `E2E_ENABLE_ORG_FIXTURE=true`. [Source: `e2e/fixtures/org-fixture.ts:58-122`, `packages/saas/src/routes/test-fixtures.ts:20-23`]
- Do not switch to native `EventSource`. MDN's EventSource supports automatic last-event-id behavior, but this repo's authenticated stream needs custom `Authorization` headers, so the existing fetch reader is the correct transport seam. [Source: `client/src/api/client.ts:299-307`]
- Do not implement event IDs by adding a second JSON property named `id` to business payloads unless the standard `id:` stream field is also present. Resume behavior depends on the event stream protocol, not only application JSON.

### Cross-Story Intelligence

- Story `3.1` established JSON `ping` heartbeats every 30 seconds, kept pings out of replay history, and made active listeners remain open when scrape jobs are still active. Story `3.3` should build on that, not rework heartbeat ownership. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:223-227`, `server/src/services/progress-tracker.ts:187-209`]
- Story `3.1` review fixed EOF parsing for final buffered SSE payloads, including split UTF-8 chunks. Any parser refactor for `id:` fields must retain those regressions. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:74-76`, `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:232-255`]
- Story `3.2` added the client reconnection loop, `connectionStatus`, preserved progress state across reconnects, and the visible `sse-connection-status` / `scrape-progress-eta` UI contract. This story should add resume IDs to that transport, not create a second reconnect implementation. [Source: `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:198-206`, `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:210-215`]
- Story `3.5` proved E2E validations can false-green when the runtime disables the real behavior under test. For this story, do not validate long-running stability against a runtime that lacks the scraper worker, Redis progress subscription, or authenticated SSE endpoint. [Source: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md:77-86`]
- Story `3.7` reinforced full mounted-surface testing for middleware/transport behavior. For event IDs and resume, unit tests are necessary but not sufficient; at least one route/service regression should prove the mounted SSE path passes resume context correctly. [Source: `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md:85-89`]

### Architecture Compliance Notes

- Keep server code in the existing Express structure: routes in `server/src/routes/`, stream ownership in `server/src/services/`, and tests next to the code. [Source: `_bmad-output/project-context.md:101-107`, `_bmad-output/project-context.md:146-150`]
- Keep client code in existing layers: API transport in `client/src/api/`, state derivation in `client/src/hooks/`, UI rendering in `client/src/components/`, and colocated Vitest tests. [Source: `_bmad-output/project-context.md:93-100`, `_bmad-output/project-context.md:146-150`]
- Keep strict TypeScript typing. Do not use `any` for SSE frame metadata, progress events, JWT/auth context, tenant context, or parser output. [Source: `_bmad-output/project-context.md:60-64`, `_bmad-output/project-context.md:84-87`]
- Preserve tenant isolation. Resume replay must apply the same `org_slug` matching as live delivery and initial replay. A `Last-Event-ID` from another tenant must not reveal whether that event exists. [Source: `server/src/services/progress-tracker.ts:67-73`, `server/src/services/progress-tracker.ts:81-87`]
- Preserve the `protectedLimiter` contract on the long-lived SSE endpoint. Opening one stream should not consume the whole quota, but reconnect tests can make repeated `GET /progress` requests inside the same 15-minute window; configure the test runtime deliberately instead of weakening production defaults. [Source: `server/src/routes/scraper.ts:303-304`, `server/src/middleware/rate-limit.ts:185-196`]
- Preserve structured logging and avoid `console.log` in production code. Existing client parser currently logs parse failures with `console.error`; do not broaden server-side logging anti-patterns. [Source: `_bmad-output/project-context.md:75-78`]

### Library / Framework Requirements

- Use the existing Express response streaming and native Fetch reader; do not add a third-party SSE parser/package unless a focused parser function becomes impossible to maintain safely.
- Use Vitest fake timers for 10-minute server cadence/idle assertions. Do not make server unit tests sleep in real time. [Source: `server/src/services/progress-tracker.test.ts:115-230`]
- Use Playwright for the browser-level long-running validation. The root script is `npm run e2e`; Playwright does not start the app automatically. [Source: `package.json:41-46`, `docs/guides/development/testing.md:76-90`]
- Use the existing `chromium-scrape-serial` project for scrape-heavy specs so long-running scrape tests do not contend with other scrape specs. [Source: `playwright.config.ts:5-11`, `playwright.config.ts:50-58`]

### Latest Technical Information

- Standard SSE messages are UTF-8 text blocks separated by a blank line. `data:` lines are concatenated with newline separators, `id:` sets the event ID, and `retry:` is reserved for reconnection timing. All other fields are ignored. [Source: MDN Server-sent events, Event stream format, `https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format`]
- The current repo deliberately sends unnamed `data:` messages with a JSON `type` discriminator. Adding standard `id:` lines is compatible with that format and should not require named `event:` fields. [Source: `docs/reference/api/scraper.md:162-224`]

### Testing Requirements

- **Server unit/service tests**: Prove ID assignment, ID monotonicity, replay-after-last-ID, tenant-scoped replay, invalid/missing `Last-Event-ID` behavior, ping non-replay, active 10+ minute listener stability with fake timers, and cleanup when a listener disconnects.
- **Server regression tests**: Prove event IDs do not reset when the replay buffer clears on a new `started` event, and prove `getEvents()` still returns plain `ProgressEvent[]` rather than internal wrapper metadata.
- **Route/service tests**: Prove the mounted `GET /api/scraper/progress` path reads `Last-Event-ID`, keeps existing auth/limiter behavior, and passes resume context into the tracker without bypassing tenant context.
- **Client API tests**: Prove parser support for `id:` plus `data:`, multi-line `data:`, split chunks, EOF flush, reconnect `Last-Event-ID` header, abort cleanup, and terminal auth failure behavior.
- **Hook/component tests**: Prove progress state and visible connection status survive reconnect/resume and that `scrape-progress-percentage` / `scrape-progress-eta` remain visible during reconnect.
- **Playwright E2E**: Prove a browser-backed authenticated SSE stream remains open for 10+ minutes during an active scrape, receives 30-second heartbeat pings, receives business progress frames when state changes, and resumes from the last event ID after a forced reconnect.

### Suggested Implementation Strategy

1. RED: Add server tests for `id:` output and `Last-Event-ID` replay in `ProgressTracker`.
2. GREEN: Store progress events with internal monotonic SSE IDs and write `id:` lines for replayable business events.
3. RED: Add route/service tests proving `Last-Event-ID` is read from the request and passed into the tracker.
4. GREEN: Thread `Last-Event-ID` through `routes/scraper.ts` and `ScraperService.subscribeToProgress()`.
5. RED: Add client parser/reconnect tests for `id:` fields and `Last-Event-ID` headers.
6. GREEN: Refactor `subscribeToProgress` parsing to keep last event ID and send it on reconnect while preserving Story 3.2 behavior.
7. RED/GREEN: Add the long-running Playwright spec using a deterministic, explicitly configured runtime.
8. REFACTOR: Update docs and remove any duplicated parser/test helpers introduced during RED/GREEN.

### Concrete File Targets

| File | Change | Purpose |
|------|--------|---------|
| `server/src/services/progress-tracker.ts` | UPDATE | Store monotonic SSE IDs, write `id:` fields, replay after `Last-Event-ID` |
| `server/src/services/progress-tracker.test.ts` | UPDATE | Unit coverage for ID/replay/heartbeat/10-minute stability |
| `server/src/services/scraper-service.ts` | UPDATE | Accept and pass resume context to `ProgressTracker` |
| `server/src/services/scraper-service.test.ts` | UPDATE | Verify service-level resume context wiring |
| `server/src/routes/scraper.ts` | UPDATE | Read `Last-Event-ID` from authenticated SSE requests |
| `server/src/routes/scraper.test.ts` | UPDATE | Verify mounted route wiring and auth/tenant behavior |
| `client/src/api/client.ts` | UPDATE | Parse `id:` fields and send `Last-Event-ID` on reconnect |
| `client/src/api/client.test.ts` | UPDATE | Parser and reconnect resume tests |
| `client/src/hooks/useScrapeProgress.ts` | UPDATE IF NEEDED | Preserve state if API callback contract changes |
| `client/src/hooks/useScrapeProgress.test.ts` | UPDATE IF NEEDED | Guard state preservation during resume |
| `client/src/components/ScrapeProgress.tsx` | UPDATE ONLY IF NEEDED | Keep long-running UI visible and testable |
| `client/src/components/ScrapeProgress.test.tsx` | UPDATE IF NEEDED | Guard test IDs and reconnect UI during resume |
| `e2e/sse-long-running-connection.spec.ts` | ADD | Browser-level 10+ minute SSE validation |
| `playwright.config.ts` | UPDATE IF NEEDED | Add new scrape-heavy spec to `chromium-scrape-serial` list |
| `docs/reference/api/scraper.md` | UPDATE | Document `id:` / `Last-Event-ID` stream contract |
| `docs/troubleshooting/scraper.md` | UPDATE | Remove stale no-reconnect / 15-second heartbeat guidance |

### Pitfalls to Avoid

- Do not mark this story complete with only unit/fake-timer tests; the core value is browser-observed 10+ minute stream stability.
- Do not let `ping` frames advance the replay cursor unless you also store them safely. The safer default is no event ID on pings.
- Do not replay all history after reconnect when `Last-Event-ID` is present; that would duplicate progress events and break idempotency.
- Do not reset the SSE ID counter when `this.events` is cleared for a new scrape session; duplicate IDs across one server process undermine `Last-Event-ID` semantics.
- Do not change `getEvents()` to return metadata wrappers unless all existing tests and debug consumers are deliberately updated; a private `eventIdByEvent`/wrapper store is safer.
- Do not trust a client-provided `Last-Event-ID` across tenants. Apply tenant filtering before replay and treat unknown IDs as a safe no-leak condition.
- Do not reset the client's accumulated progress events on reconnect. Story 3.2 explicitly preserved progress history.
- Do not run the Playwright long-running spec without a scraper worker. The dev compose file starts db, redis, server, and client only; it does not start the scraper worker.
- Do not let `protectedLimiter` or `scraperLimiter` invalidate the validation by throttling setup/reconnect requests; set test-only env overrides in the long-running verification environment rather than changing production defaults.
- Do not use only the fixture `example.test` cinemas for the long-running scrape; they are designed to fail quickly and cannot prove a stable active 10-minute SSE stream.
- Do not use the default 120-second fixture runtime assertion in a 10+ minute Playwright spec.
- Do not rely on public AlloCine latency to make the test last 10 minutes. Control runtime delay/concurrency or the test will be flaky.
- Do not broaden Story 3.4 load-test scope by opening 50 clients in this story.
- Do not broaden Story 3.6 rate-limit reset scope by adding countdown/reset assertions in this story.

### Project Structure Notes

- No separate PRD, architecture, or UX shard was found under `_bmad-output/planning-artifacts`; this story is grounded in `epics.md`, readiness notes, test handoff, current SSE code, previous Epic 3 story artifacts, docs, and generated project context.
- Existing E2E tests already cover scrape progress visibility and tenant concurrent scrape progress. Extend patterns from `e2e/scrape-progress.spec.ts` and `e2e/tenant-concurrent-scrape-progress.spec.ts` rather than creating another test harness.
- Existing UI already exposes `data-testid="sse-connection-status"`, `data-testid="scrape-progress-percentage"`, and `data-testid="scrape-progress-eta"`. Prefer assertions on those elements over adding new display-only test IDs.

### Git Intelligence Summary

- Recent commits are focused on hardening client SSE reconnect behavior: `fix(client): harden SSE reconnect progress handling (#941)`, `fix(client): satisfy strict TS checks in SSE tests`, and `fix(client): harden SSE reconnect progress handling`. This story should continue that pattern by tightening the real SSE contract with focused tests rather than rewriting the transport.
- The working tree was clean when this story was created, so the next dev agent should treat any later dirty files as user or implementation changes, not story-generation leftovers.

### Project Context Reference

- The project requires Node `>=24`, ESM modules, strict TypeScript, and Vitest for server/client tests. [Source: `_bmad-output/project-context.md:17-53`, `_bmad-output/project-context.md:60-73`, `package.json:60-72`]
- The project testing rules require TDD, colocated tests, Vitest for packages, and Playwright for high-value E2E workflows. [Source: `_bmad-output/project-context.md:110-136`]
- Runtime gotcha: server startup subscribes to Redis progress events, but local dev requires starting the scraper worker separately for end-to-end scraping. [Source: `AGENTS.md`, `server/src/index.ts:30-39`]

### References

- Epic 3 overview and implementation order: `_bmad-output/planning-artifacts/epics.md:228-262`
- Story 3.3 definition and deployment impact: `_bmad-output/planning-artifacts/epics.md:933-963`
- Epic 3 dependency readiness: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- Epic notes summary for Story 3.3: `_bmad-output/planning-artifacts/notes-epics-stories.md:193-200`
- Test handoff requirements for RISK-003: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:168-195`
- Story 3.1 heartbeat implementation and review learnings: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:1-255`
- Story 3.2 reconnect implementation and file list: `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:1-217`
- Current progress tracker: `server/src/services/progress-tracker.ts:1-250`
- Current scraper SSE route: `server/src/routes/scraper.ts:303-323`
- Current scraper service subscription: `server/src/services/scraper-service.ts:182-211`
- Server Redis progress forwarding: `server/src/index.ts:30-39`, `server/src/services/redis-client.ts:220-238`
- Current client SSE transport: `client/src/api/client.ts:211-390`
- Current progress hook: `client/src/hooks/useScrapeProgress.ts:219-350`
- Current progress UI: `client/src/components/ScrapeProgress.tsx:1-258`
- Shared client progress event type: `client/src/types/index.ts:103-121`
- Existing scrape E2E patterns: `e2e/scrape-progress.spec.ts:1-183`, `e2e/tenant-concurrent-scrape-progress.spec.ts:1-118`
- Playwright config: `playwright.config.ts:1-85`
- Org fixture runtime: `e2e/fixtures/org-fixture.ts:58-122`, `packages/saas/src/routes/test-fixtures.ts:20-23`
- Published SSE API docs: `docs/reference/api/scraper.md:162-224`
- Stale troubleshooting reconnect docs to update: `docs/troubleshooting/scraper.md:464-496`
- SSE stream format reference: `https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.5

### Debug Log References

- RED: `cd server && npm run test:run -- src/services/progress-tracker.test.ts` failed on missing standard SSE `id:` fields and missing `Last-Event-ID` replay filtering.
- RED: `cd server && npm run test:run -- src/services/scraper-service.test.ts src/routes/scraper.test.ts` failed until `Last-Event-ID` was threaded from the route through `ScraperService.subscribeToProgress()` to `ProgressTracker.addListener()`.
- RED: `cd client && npm run test:run -- src/api/client.test.ts` failed until `subscribeToProgress` captured SSE `id:` metadata and sent `Last-Event-ID` on reconnect.
- GREEN: Real long-running Playwright validation passed in 10.1 minutes with db/Redis, server, client, and scraper worker running locally (`RUN_MODE=consumer`, `SCRAPER_CONCURRENCY=1`, `SCRAPE_THEATER_DELAY_MS=30000`).

### Completion Notes List

- Created an implementation-ready story for Epic 3 Story 3.3 based on the real current SSE heartbeat, client reconnect, and progress tracker implementation.
- Captured the main hidden implementation gap: the story is labeled test-only, but event ID/resume acceptance requires minimal runtime support before a truthful long-running validation can pass.
- Scoped long-running validation to deterministic browser-observed SSE behavior while explicitly excluding Story 3.4 concurrent-client load and Story 3.6 rate-limit reset coverage.
- Implemented standard SSE `id:` fields for replayable business progress events with process-lifetime monotonic IDs until `ProgressTracker.reset()`.
- Added `Last-Event-ID` replay support that filters by tenant before delivery and keeps heartbeat pings transport-only with no replay cursor impact.
- Extended the authenticated fetch-based client SSE transport to parse `id:` plus multi-line `data:` blocks, retain EOF/split UTF-8 behavior, and resume with `Last-Event-ID` after reconnect.
- Added an opt-in deterministic Playwright long-running validation that uses SaaS org fixtures, Allocine-backed tenant cinemas, a real scraper worker, browser-observed pings, UI liveness assertions, and forced reconnect resume validation.
- Updated SSE API and troubleshooting documentation for 30-second pings, `id:` fields, and `Last-Event-ID` resume.
- Verification completed: focused server/client tests, full server/client unit suites, client lint/build, workspace build, server integration/coverage, and real 10+ minute Playwright validation all passed.

### File List

- `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md`
- `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes-validation-report.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/src/services/progress-tracker.ts`
- `server/src/services/progress-tracker.test.ts`
- `server/src/services/scraper-service.ts`
- `server/src/services/scraper-service.test.ts`
- `server/src/routes/scraper.ts`
- `server/src/routes/scraper.test.ts`
- `client/src/api/client.ts`
- `client/src/api/client.test.ts`
- `e2e/sse-long-running-connection.spec.ts`
- `playwright.config.ts`
- `docs/reference/api/scraper.md`
- `docs/troubleshooting/scraper.md`

## Change Log

- 2026-04-29: Created implementation-ready story file for Epic 3 Story 3.3 with explicit guardrails around SSE `id:` / `Last-Event-ID` support, 10+ minute deterministic validation, and current fetch-based reconnect behavior.
- 2026-04-29: Implemented SSE event ID and resume support, added server/client/Playwright validation, updated documentation, and moved Story 3.3 to review.
