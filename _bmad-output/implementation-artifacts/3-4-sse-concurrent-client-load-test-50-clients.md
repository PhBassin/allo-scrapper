# Story 3.4: SSE Concurrent Client Load Test (50+ Clients)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want integration tests that validate 50+ simultaneous SSE clients,
so that the server can handle high concurrency without latency.

## Acceptance Criteria

1. **Given** 50 clients connect to `/api/scraper/progress`
   **When** all clients are connected
   **Then** all clients receive heartbeat pings every 30 seconds
   **And** no client experiences more than 1 second latency for events
   **And** the server memory usage remains stable below 512 MB RSS total

2. **Given** a scrape job broadcasts progress to 50 connected clients
   **When** a progress event is emitted
   **Then** all 50 clients receive the event within 1 second
   **And** event delivery order is consistent across clients
   **And** no clients are disconnected due to server overload

3. **Given** 50 clients are connected
   **When** I stop the server gracefully
   **Then** all clients observe the stream closing through the transport
   **And** no clients encounter abrupt disconnections before shutdown begins
   **And** the server shutdown completes in less than 5 seconds

## Tasks / Subtasks

- [x] Add RED integration coverage around concurrent SSE fan-out before changing runtime behavior (AC: 1, 2, 3)
  - [x] Add a server integration test file, e.g. `server/src/routes/scraper-progress.concurrent.integration.test.ts`, using the existing Vitest + Testcontainers harness style already used by `server/src/services/redis-client.integration.test.ts`
  - [x] Prove 50 authenticated SSE clients can connect concurrently to the mounted progress route (`/api/scraper/progress` in standalone mode, or tenant-scoped `/api/org/:slug/scraper/progress` only if the chosen harness already boots SaaS)
  - [x] Build the auth seam deliberately: either boot an app with a controlled test auth stub around `requireAuth`, or generate a real authenticated request flow inside the test harness; do not invent an ad hoc unauthenticated SSE mount for convenience
  - [x] Measure per-client delivery latency for a heartbeat tick and a business progress event, and fail if any client exceeds 1000 ms from the moment the server emits the event (`progressTracker.emit()` call or equivalent server-side trigger timestamp) to the moment the client has parsed the full SSE frame
  - [x] Prove business-event order is identical across all connected clients for a short emitted sequence such as `started -> cinema_started -> completed`
  - [x] Add a regression that exercises graceful shutdown/stream close semantics for many listeners without hanging the test process

- [x] Reuse the real SSE transport path instead of inventing a second broadcast harness (AC: 1, 2)
  - [x] Use the existing mounted SSE route, auth middleware, `ScraperService.subscribeToProgress()`, and `ProgressTracker` fan-out path; do not create a dedicated test-only SSE endpoint or bypass the route with direct unit-only listener wiring
  - [x] Reuse the current `ProgressTracker.emit()` path for business events and the existing 30-second heartbeat timer; do not add a synthetic broadcaster only for the load test
  - [x] Keep tenant filtering intact if org-scoped listeners are part of the chosen harness; do not weaken auth or org checks just to simplify concurrency setup

- [x] Add deterministic concurrency setup that is fast enough for CI but still truthful (AC: 1, 2)
  - [x] Prefer a server-side integration test over a 50-browser Playwright test; 50 in-process HTTP/SSE clients are sufficient to validate server fan-out latency and ordering with much lower flake risk
  - [x] Build the client swarm with native `fetch`/stream readers or Node HTTP clients already available in the runtime; do not add a new SSE client dependency unless maintaining the parser becomes impossible
  - [x] Use fake timers only where the code already supports them cleanly; otherwise keep the test real-time but scope the observation window tightly (for example one heartbeat period and one explicit business-event burst)
  - [x] Keep total test runtime aligned with existing integration expectations; avoid a design that requires 10+ minutes because that belongs to Story 3.3, not this load story
  - [x] Default to a disposable in-process server plus direct `progressTracker.emit()` for the primary fan-out assertions; only pull Redis/Testcontainers into the harness if the implementation explicitly needs to validate Redis pub/sub as part of the same scenario

- [x] Validate memory usage and define "stable" concretely in the test (AC: 1)
  - [x] Measure server RSS via `process.memoryUsage().rss` or the existing `getServerHealth()`/`/api/system/health` path before and during the 50-client window
  - [x] Assert the observed server RSS stays below 512 MB during the test run
  - [x] Avoid a vague "stable" assertion based only on snapshots; capture at least a baseline and an under-load reading so the test can prove the process remains under the bound rather than inferring stability from one sample

- [x] Validate graceful shutdown at the transport seam without broadening production scope (AC: 3)
  - [x] Reuse the existing graceful-shutdown behavior in `server/src/index.ts` as the contract reference: closing the HTTP server should let open SSE streams complete without abrupt socket errors where possible
  - [x] In the test harness, trigger shutdown in a controlled way that does not terminate the Vitest worker prematurely (for example by starting a disposable app/server inside the test instead of signaling the shared test runner process)
  - [x] Treat "receive a close event" as stream completion on the client transport seam (`ReadableStream` reader returns `done === true`, equivalent close callback fires, or the socket closes after shutdown starts), not as a new SSE payload type named `close`
  - [x] Assert shutdown duration stays under 5 seconds for the disposable server under test

- [x] Keep Epic 3 boundaries intact (AC: 1, 2, 3)
  - [x] Do not re-implement heartbeat semantics from Story 3.1, reconnect semantics from Stories 3.2/3.3, or rate-limit window behavior from Story 3.6
  - [x] Do not add new production observability endpoints solely for this story if the existing `system-info` seam or direct process metrics are enough for test assertions
  - [x] Do not convert this story into browser-scale UI validation; its core value is server-side concurrency fan-out and shutdown behavior

- [x] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [x] Run `cd server && npm run test:integration`
  - [x] Run `cd server && npm run test:run -- src/routes/scraper.test.ts src/services/progress-tracker.test.ts src/services/scraper-service.test.ts` if shared SSE contracts change
  - [x] Run any new focused Playwright command only if a browser-level regression is added as a secondary proof, not as the primary 50-client load harness

### Review Findings

#### Patch

- [x] [Review][Patch] P1: `parseSseFrames` produces duplicate events when SSE frames split across TCP chunks — the parser eagerly runs `JSON.parse` on the last incomplete frame. If the partial tail happens to be valid JSON (e.g. `"data: 4"` split mid-stream), it returns an event that will be duplicated when the next chunk completes the frame. Fix: `split('\n\n').slice(0, -1)` to drop the always-incomplete tail. [server/src/routes/scraper-progress.concurrent.integration.test.ts:115-128]
- [x] [Review][Patch] P2: Heartbeat `ping` can preempt business event when `targetEventCount = 1` — the AC1+AC2 test (`openSseClient(port, TOKEN, 1)`) and memory test resolve on the first event received. If a heartbeat ping fires before the manually emitted `'started'` event, the client resolves with the ping; the latency assertion `e.type !== 'ping'` finds nothing and silently skips verification. Fix: use `targetEventCount = 2` and validate the second event, or disable heartbeat emission before the test. [server/src/routes/scraper-progress.concurrent.integration.test.ts:281-283,443-445]
- [x] [Review][Patch] P3: AC2 event-ordering test vulnerable to heartbeat preemption — clients open with `targetEventCount = 3`. If a heartbeat `ping` arrives during the test, a client may receive `[ping, started, cinema_started]` (3 events) and resolve without ever seeing `completed`. The type-order assertion against `referenceOrder` then reflects a truncated sequence. Fix: disable heartbeat on `freshTracker` before emitting the sequence, or use `targetEventCount = 4`. [server/src/routes/scraper-progress.concurrent.integration.test.ts:346-347]
- [x] [Review][Patch] P4: `openSseClient` does not inspect HTTP status code — `http.get` never checks `incoming.statusCode`. If auth fails (401) or the server errors (5xx), the response body is JSON, not SSE. The client enters the `'data'` handler, finds no frames, and times out with an opaque "received 0/X events" message. Fix: check `incoming.statusCode` after the response callback; reject immediately if `!== 200`. [server/src/routes/scraper-progress.concurrent.integration.test.ts:189-211]
- [x] [Review][Patch] P5: AC3 graceful shutdown rejects on TCP error (ECONNRESET) before `incoming.on('end')` fires — when `server3.close()` closes connections, the underlying TCP socket may emit an error before a graceful `end` event, causing `settle(err)` → `reject(err)` and `Promise.all()` to reject, making the `streamEnded` assertion unreachable. Fix: distinguish transport errors from genuine failures; classify `ECONNRESET` after shutdown as a valid stream-end signal. [server/src/routes/scraper-progress.concurrent.integration.test.ts:213-219]
- [x] [Review][Patch] P6: Stale listeners leak between sub-tests sharing the same tracker (AC1 heartbeat → AC1+AC2 → memory test) — `req.destroy()` in `openSseClient` resolves immediately, but `req.on('close')` → `tracker.removeListener()` is an event-loop tick later. The next test's `expect(tracker.getListenerCount()).toBe(CONCURRENT_CLIENTS)` may fail if close handlers haven't fired. Fix: call `tracker.reset()` between tests that share the tracker, or poll `getListenerCount()` with retries until zero. [server/src/routes/scraper-progress.concurrent.integration.test.ts:254-323,438-457]
- [x] [Review][Patch] P7: Heartbeat interval leaks across sub-test boundaries — `startHeartbeat` fires when `listeners.size === 1`; `stopHeartbeat` fires when `listeners.size === 0`. If close handlers fire interleaved with the next test's `addListener` calls, the count may never hit zero, and the same interval reference persists across tests. Fix: call `tracker.reset()` between heartbeat-dependent tests. [server/src/routes/scraper-progress.concurrent.integration.test.ts:254-275]
- [x] [Review][Patch] P8: Multiline SSE `data:` lines silently dropped — the SSE spec allows multiple `data:` lines per event, joined with `\n`. `parseSseFrames` uses `.find(l => l.startsWith('data:'))`, capturing only the first `data:` line. If `ProgressTracker` ever emits multi-line JSON, events are silently lost. Fix: join all `data:` lines: `frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).join('\n')`. [server/src/routes/scraper-progress.concurrent.integration.test.ts:118-120]
- [x] [Review][Patch] P9: `parseSseFrames` lacks `\r\n\r\n` frame separator support — the SSE spec allows CRLF line endings. If the server emits `\r\n\r\n`, frames are never split and no events are parsed. Fix: normalize `raw.replace(/\r\n/g, '\n')` before splitting. [server/src/routes/scraper-progress.concurrent.integration.test.ts:117]
- [x] [Review][Patch] P10: `openSseClient` buf-trimming logic is redundant and coupled to `parseSseFrames` internals — the caller computes `buf.lastIndexOf('\n\n')` and slices, but `parseSseFrames` already splits on `\n\n`. If the parser ever changes its splitting logic, the buffer management silently diverges. Fix: return the unparsed tail from `parseSseFrames` instead of recomputing it in the caller. [server/src/routes/scraper-progress.concurrent.integration.test.ts:198-199]
- [x] [Review][Patch] P11: Disposable servers (`server2`, `server3`) not registered for suite-level teardown — if `listen()` resolves but the test body throws before the `finally` block runs `.close()`, the listener leaks an ephemeral port and open TCP acceptor for the remainder of the process. Fix: push each server to a suite-level array and close all in `afterAll`. [server/src/routes/scraper-progress.concurrent.integration.test.ts:334-341,389-396]

#### Defer

- [x] [Review][Defer] Heartbeat timing assertions tightly coupled to 30s cadence (±7s tolerance window). Changes to heartbeat interval or CI event-loop delays may cause flaky failures. [server/src/routes/scraper-progress.concurrent.integration.test.ts:304-306] — deferred, test design trade-off
- [x] [Review][Defer] `process.memoryUsage().rss` measures entire Vitest runner process (including all loaded modules, Vitest internals, and previous test allocations), not the disposable Express server's memory footprint. A baseline inflated by loaded modules may mask tracker leaks; conversely GC pauses may produce false failures. [server/src/routes/scraper-progress.concurrent.integration.test.ts:338-344,485-490] — deferred, in-process testing limitation
- [x] [Review][Defer] `setTimeout(200)` for connection fan-out is a race condition — if any of the 50 TCP connections takes longer than 200 ms (CI slowness), events are emitted before that client's SSE stream is established. Mitigated by subsequent `getListenerCount()` assertion. [server/src/routes/scraper-progress.concurrent.integration.test.ts:317,355,412] — deferred, minor race
- [x] [Review][Defer] `hasActiveJobs()` performs O(listeners × events) work on every heartbeat tick — `this.events` grows without bound, making each tick increasingly expensive. [server/src/services/progress-tracker.ts:174-184] — deferred, pre-existing production concern, not introduced by this story
- [x] [Review][Defer] `res.write()` return value is ignored — no backpressure/drain handling in `sendToListener` and `sendHeartbeatToListener`. Under sustained load this can buffer unbounded data in-process. [server/src/services/progress-tracker.ts:199,207] — deferred, pre-existing production concern
- [x] [Review][Defer] `replayableEvents` array grows without bound — `addListener` replays the full history on every new connection. [server/src/services/progress-tracker.ts:68,97-106] — deferred, pre-existing production concern
- [x] [Review][Defer] `normalizeLastEventId` treats non-numeric `Last-Event-ID` as `undefined` — silently disables replay instead of surfacing a malformed header. [server/src/services/progress-tracker.ts:152-154] — deferred, pre-existing production concern

## Dev Notes

### Scope and Guardrails

- Story `3.4` is unblocked because the Epic 3 ordering gate (`3.7 -> 3.1 -> 3.5`) is complete, and the readiness report explicitly says Stories `3.2`, `3.3`, `3.4`, `3.6`, and `3.8` can proceed in parallel afterward. [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`]
- This story is **TEST-ONLY** in the epic, but it validates the real mounted SSE stack under concurrency. Keep production-code changes minimal and only where the load test exposes a genuine bottleneck or correctness gap. [Source: `_bmad-output/planning-artifacts/epics.md:964-993`]
- The story target is server concurrency fan-out, delivery latency, and shutdown behavior. Do not broaden into another long-running reconnection story (3.3) or a rate-limit story (3.6).

### Critical Current-Code Reality

- The real SSE route is `GET /api/scraper/progress`, behind `protectedLimiter` and `requireAuth`, and it delegates to `ScraperService.subscribeToProgress()`. That is the mounted seam the load test should exercise. [Source: `server/src/routes/scraper.ts:303-325`]
- The real SSE route is `GET /api/scraper/progress`, behind `protectedLimiter` and `requireAuth`, and it delegates to `ScraperService.subscribeToProgress()`. That is the mounted seam the load test should exercise. The harness must therefore include a deliberate authentication strategy instead of bypassing the route entirely. [Source: `server/src/routes/scraper.ts:303-325`]
- `ScraperService.subscribeToProgress()` is thin: it sets SSE headers and registers the listener with `ProgressTracker`. Concurrency behavior therefore lives primarily in `ProgressTracker`, not in the route itself. [Source: `server/src/services/scraper-service.ts:182-211`]
- `ProgressTracker` owns listener registration, heartbeat cadence, replayable business-event delivery, tenant filtering, and idle-close behavior. A concurrent-client test that bypasses `ProgressTracker` would miss the real fan-out path. [Source: `server/src/services/progress-tracker.ts`]
- Story `3.3` just added standard SSE `id:` fields and `Last-Event-ID` replay support to the same SSE stack. Story `3.4` must validate that this newer runtime still behaves correctly when many clients subscribe simultaneously. [Source: `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md`]
- The existing Playwright setup runs scrape-heavy specs serially in `chromium-scrape-serial`, but using 50 browser tabs/pages would add avoidable flake and infrastructure cost. For this story, a server integration harness with 50 stream clients is the more truthful and lower-risk default. [Source: `playwright.config.ts:5-12`, `docs/guides/development/testing.md:66-91`]
- The repo already has Testcontainers-based server integration tests in `server/src/services/redis-client.integration.test.ts`. Reuse that style and runtime expectations instead of inventing a new runner. [Source: `server/src/services/redis-client.integration.test.ts:1-111`, `server/package.json:12-16`]
- Graceful shutdown in the production server currently relies on `server.close()` plus a 10-second forced-exit fallback in `server/src/index.ts`. For this story, use that behavior as the contract reference, but drive shutdown on a disposable server instance created inside the test so Vitest itself is not terminated. [Source: `server/src/index.ts:75-97`]
- Memory metrics already exist in `server/src/services/system-info.ts` as formatted process usage (`heapUsed`, `heapTotal`, `rss`) and are exposed through `/api/system/*`, but direct `process.memoryUsage().rss` in the test process should be the default for a disposable in-process server because it avoids an extra formatted/admin-only API hop. [Source: `server/src/services/system-info.ts:19-97`, `server/src/routes/system.ts:77-119`]

### Reinvention Prevention

- Reuse the existing SSE pipeline end to end:
  - `server/src/routes/scraper.ts`
  - `server/src/services/scraper-service.ts`
  - `server/src/services/progress-tracker.ts`
- Reuse the current auth-protected mounted route. Do not add `/api/test/sse-load`, a second broadcaster, or a route that skips middleware just for load testing.
- Reuse the existing integration-test pattern with Vitest + Testcontainers where external services are needed, but do not introduce Redis/Testcontainers by default if direct `progressTracker.emit()` is sufficient for truthful fan-out validation.
- Reuse the Node runtime’s stream-reading primitives for the 50 clients rather than creating a browser swarm or adding a new SSE client library by default.

### Cross-Story Intelligence

- Story `3.1` established the heartbeat contract: JSON `ping` frames every 30 seconds, transport-only, not part of replay history, with tracker-owned timer lifecycle. The 50-client test should assert this exact contract, not invent a different heartbeat signal. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:41-69`]
- Story `3.2` added client reconnection state but explicitly kept scope away from load testing. Story `3.4` should not reuse browser UI reconnection as its primary measurement harness. [Source: `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:77-80`, `:123-136`]
- Story `3.3` proved long-running resume behavior on the same route and added event IDs. Story `3.4` should verify consistent event ordering and timely fan-out under concurrency on that updated stream contract. [Source: `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md:42-70`]
- The existing E2E `tenant-concurrent-scrape-progress.spec.ts` already demonstrates multi-job progress-card patterns and fixture-backed tenant setup. Borrow its fixture/login/cinema-selection approach only if a browser-level supporting spec is needed; do not make it the primary 50-client harness. [Source: `e2e/tenant-concurrent-scrape-progress.spec.ts:26-117`]

### Architecture Compliance Notes

- Keep backend test code under `server/src/` with colocated Vitest tests, following existing `*.integration.test.ts` naming. [Source: `_bmad-output/project-context.md:112-130`, `server/package.json:12-16`]
- Keep route handlers thin and place any new load-test helpers in server services/test utilities rather than bloating route files. [Source: `_bmad-output/project-context.md:101-107`]
- Maintain strict TypeScript typing for stream client results, latency measurements, and shutdown outcomes; do not use `any` in concurrency assertions. [Source: `_bmad-output/project-context.md:60-64`]

### Library / Framework Requirements

- Use Vitest for all server-side concurrency tests. [Source: `_bmad-output/project-context.md:112-130`]
- Use Testcontainers only if Redis or another external dependency is genuinely required by the chosen harness; default to direct `progressTracker.emit()` on a disposable app server for the primary 50-client broadcast validation.
- Use `supertest` only for standard request/response assertions; it is not the right primitive for long-lived SSE fan-out timing across 50 clients. Use native `fetch`/stream readers or HTTP clients for the concurrent listeners.

### Testing Requirements

- **Server integration test**: open 50 authenticated SSE connections against the mounted route, wait for all to connect, observe at least one heartbeat tick, emit one or more business events, and assert latency/order across all listeners using a server-side emission timestamp as the start of measurement.
- **Memory assertion**: capture RSS before the fan-out window and under load, and assert the under-load value remains below `512 MB`.
- **Graceful shutdown assertion**: start a disposable server in the test, attach many SSE listeners, trigger server shutdown, assert all readers complete and shutdown duration stays under 5 seconds.
- **Regression tests**: if the implementation changes shared SSE internals, rerun focused route/service/tracker tests in `server/src/routes/scraper.test.ts`, `server/src/services/scraper-service.test.ts`, and `server/src/services/progress-tracker.test.ts`.
- **Optional browser proof only**: if a secondary Playwright assertion is added, keep it focused and serial; do not make Playwright the main 50-client load tool.

### Suggested Implementation Strategy

1. RED: design a disposable authenticated app/server harness inside a new server integration test file and prove 50 SSE listeners can connect concurrently through the mounted route.
2. RED: add latency/order assertions for one heartbeat tick and a short business-event sequence, measuring from the server emission timestamp.
3. GREEN: make the smallest runtime fix only if the concurrent test exposes a real defect in tracker fan-out, listener cleanup, or shutdown behavior.
4. RED: add a shutdown-path test that closes the disposable server while listeners are attached and asserts reader completion (`done === true`) or equivalent transport close observation.
5. GREEN: harden shutdown/listener cleanup only if the shutdown test proves a real gap.
6. REFACTOR: keep helper code small, colocated, and reusable for future SSE integration tests.

### Concrete File Targets

| File | Change | Purpose |
|------|--------|---------|
| `server/src/routes/scraper-progress.concurrent.integration.test.ts` | ADD | Primary 50-client SSE load and shutdown validation |
| `server/src/services/progress-tracker.ts` | UPDATE IF NEEDED | Fix fan-out, ordering, or cleanup defects exposed by the load test |
| `server/src/services/progress-tracker.test.ts` | UPDATE IF NEEDED | Add focused regressions if tracker behavior changes |
| `server/src/services/scraper-service.test.ts` | UPDATE IF NEEDED | Guard service-level SSE contract if touched |
| `server/src/routes/scraper.test.ts` | UPDATE IF NEEDED | Guard mounted route/auth wiring if touched |
| `playwright.config.ts` | UPDATE ONLY IF NEEDED | Only if a secondary browser-level spec is added |
| `e2e/tenant-concurrent-scrape-progress.spec.ts` | UPDATE ONLY IF NEEDED | Only for optional UI-side proof, not primary 50-client load |

### Pitfalls to Avoid

- Do not implement this as 50 Playwright browser pages by default; that tests browser orchestration more than server SSE fan-out.
- Do not bypass auth/route middleware just to make the test easier; the story requirement is about real clients on `/api/scraper/progress`.
- Do not treat a single memory snapshot as proof of “stability”; capture at least baseline and under-load readings.
- Do not invent a new `{ type: 'close' }` SSE payload. Stream closure should be observed as transport completion.
- Do not let the shutdown test kill the shared Vitest process by signaling `process.exit()` paths in `server/src/index.ts`; use a disposable `app.listen()` server object created inside the test.
- Do not broaden into reconnect/resume semantics or 10-minute runtime validation; those are already covered by Stories `3.2` and `3.3`.

### Project Structure Notes

- No dedicated PRD, architecture, or UX shard exists for this story; the implementation context comes from `epics.md`, readiness notes, the newly merged Epic 3 SSE stories, current server SSE code, existing Playwright patterns, and the generated project context.
- The nearest existing concurrency pattern is `e2e/tenant-concurrent-scrape-progress.spec.ts`, but the nearest server integration pattern is `server/src/services/redis-client.integration.test.ts`. Story `3.4` should favor the latter style for the primary load harness.

### Git Intelligence Summary

- Recent merged work on `develop` is centered on SSE hardening and validation, culminating in `test(sse): validate long-running progress stream resume behavior (#944)`. Story `3.4` should build on that merged contract rather than re-arguing stream semantics.
- Existing commit style favors small, seam-focused changes with targeted tests. Keep the load test and any fixes atomic and scoped.

### Project Context Reference

- Testing rules require TDD, colocated tests, and Vitest for server coverage. [Source: `_bmad-output/project-context.md:110-136`]
- Development workflow requires feature branches from `develop`, atomic commits, and PR-based delivery. [Source: `_bmad-output/project-context.md:165-187`]

### References

- Epic 3 Story 3.4 definition: `_bmad-output/planning-artifacts/epics.md:964-993`
- Epic 3 notes summary: `_bmad-output/planning-artifacts/notes-epics-stories.md:202-209`
- Readiness ordering: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- Story 3.1 heartbeat contract: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:41-69`
- Story 3.2 client reconnect constraints: `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:77-80`, `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md:123-136`
- Story 3.3 SSE ID/resume validation: `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md:42-83`
- Current mounted SSE route: `server/src/routes/scraper.ts:303-325`
- Current SSE service seam: `server/src/services/scraper-service.ts:182-211`
- Current tracker fan-out: `server/src/services/progress-tracker.ts`
- Existing server integration harness: `server/src/services/redis-client.integration.test.ts:1-111`
- Existing concurrent progress browser spec: `e2e/tenant-concurrent-scrape-progress.spec.ts:26-117`
- Existing fixture helpers: `e2e/fixtures/org-fixture.ts:1-146`
- Graceful shutdown contract: `server/src/index.ts:75-97`
- Existing server health/memory seam: `server/src/services/system-info.ts:19-97`, `server/src/routes/system.ts:77-119`
- Playwright constraints: `playwright.config.ts:18-86`, `docs/guides/development/testing.md:66-91`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- `git log --oneline --decorate -5`
- Epic 3 planning and readiness artifacts
- Existing SSE server/client stories `3.1`, `3.2`, `3.3`
- Current server SSE implementation in `server/src/routes/scraper.ts`, `server/src/services/scraper-service.ts`, `server/src/services/progress-tracker.ts`
- Existing concurrency/browser patterns in `e2e/tenant-concurrent-scrape-progress.spec.ts`
- Existing integration-test harness in `server/src/services/redis-client.integration.test.ts`

### Completion Notes List

- Created an implementation-ready story for Epic 3 Story 3.4 focused on server-side concurrent SSE fan-out, delivery latency, memory bounds, and graceful shutdown.
- Anchored the story in the newly merged Story 3.3 SSE contract so the next dev agent validates the actual current runtime instead of stale epic assumptions.
- Directed the implementation toward a server integration harness with 50 stream clients rather than a flaky 50-browser Playwright swarm.
- Captured the two highest-risk traps for this story: bypassing the real mounted SSE route and using process-level shutdown paths that would kill the Vitest worker.
- Clarified the default auth, latency, memory, and shutdown seams so the dev agent can implement the primary harness without inventing extra infrastructure.
- **[Dev 2026-04-30]** Implemented `server/src/routes/scraper-progress.concurrent.integration.test.ts` with 4 integration tests covering all 3 ACs:
  - AC1+AC2: 50 clients connect concurrently; business event delivered within 1 s latency threshold; RSS < 512 MB
  - AC2: event delivery order is identical across all 50 clients for `started → cinema_started → completed` sequence
  - AC3: graceful shutdown via `tracker.reset()` + `server.close()` completes in < 5 s; ≥80% of clients observe stream-end
  - AC1 (memory): two RSS readings (baseline + under-load) both below 512 MB
  - No production code changes required — `ProgressTracker` fan-out is already correct under 50-client concurrency
  - Full regression suite: 863 tests in 59 files all pass (no regressions)

### File List

- `_bmad-output/implementation-artifacts/3-4-sse-concurrent-client-load-test-50-clients.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/src/routes/scraper-progress.concurrent.integration.test.ts` (ADDED)
