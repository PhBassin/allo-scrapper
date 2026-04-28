# Story 3.1: Implement SSE Heartbeat Mechanism

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want the server to send SSE heartbeat pings every 30 seconds,
so that long-running connections stay alive and clients can detect disconnections.

## Acceptance Criteria

1. **Given** a client connects to `/api/scraper/progress`
   **When** no scrape jobs are active
   **Then** the server sends a `ping` event every 30 seconds
   **And** the event data is `{ type: "ping", timestamp: <ISO8601> }`
   **And** the connection remains open

2. **Given** a scrape job is running for 10+ minutes
   **When** the job is processing
   **Then** heartbeat pings are sent every 30 seconds alongside progress events
   **And** the connection does NOT timeout
   **And** clients receive both ping and progress events

3. **Given** no activity occurs on SSE connection for 15 minutes
   **When** the inactivity timeout is reached
   **Then** the server closes the connection gracefully
   **And** the client receives a close event
   **And** the connection cleanup is logged

## Tasks / Subtasks

- [x] Add RED coverage around the heartbeat contract before changing SSE behavior (AC: 1, 2, 3)
  - [x] Extend `server/src/services/progress-tracker.test.ts` with fake-timer coverage for a 30-second heartbeat cadence and listener cleanup on disconnect
  - [x] Add a regression proving heartbeat traffic is transport-only: it must not pollute the replayed progress history for newly connected listeners
  - [x] Add a regression proving tenant-scoped listeners still receive heartbeats after authentication/org filtering is applied
  - [x] Add or extend route/service tests in `server/src/routes/scraper.test.ts` if the stream-close path or structured logging contract changes

- [x] Implement the heartbeat on the existing SSE transport without changing the endpoint shape (AC: 1, 2)
  - [x] Reuse `server/src/services/progress-tracker.ts` as the single owner of heartbeat timer state; do not split timer ownership across route, service, and tracker layers
  - [x] Replace the current comment heartbeat (`: heartbeat`) with a JSON `data:` payload `{ type: 'ping', timestamp: <ISO8601> }` every 30 seconds
  - [x] Keep `GET /api/scraper/progress` as the only SSE endpoint; do not add a second heartbeat route, polling fallback, or WebSocket path in this story
  - [x] Preserve the existing SSE headers and authenticated subscription flow in `server/src/services/scraper-service.ts` and `server/src/routes/scraper.ts`

- [x] Preserve current progress semantics while adding heartbeat transport events (AC: 1, 2)
  - [x] Keep existing business progress events (`started`, `cinema_started`, `completed`, etc.) unchanged in payload shape and delivery order
  - [x] Do not store heartbeat events in the replay buffer used for late subscribers; heartbeats are transport signals, not business history
  - [x] Do not break org-scoped SSE delivery: heartbeat delivery must work for tenant listeners even though a `ping` is not tied to a specific scrape report
  - [x] Keep listener/timer cleanup leak-free when clients disconnect, when `reset()` is called, and when the last listener unsubscribes

- [x] Add the 15-minute idle-close rule without folding in future reconnect work (AC: 2, 3)
  - [x] Define inactivity in implementation as absence of business-progress activity for that stream; heartbeat pings alone must not keep an otherwise idle stream open forever
  - [x] Do not close active long-running scrape streams just because no business event happened between two heartbeat ticks
  - [x] Treat “client receives a close event” as transport-observable stream closure in the current fetch-based client, not as a new SSE payload type named `close`
  - [x] Reuse the existing structured logger for SSE connect/disconnect cleanup logging
  - [x] Do not implement automatic reconnect, missed-heartbeat detection, event IDs, or resume semantics here; those belong to Stories `3.2` and `3.3`

- [x] Keep the client contract compatible enough for later Epic 3 work (AC: 1, 2)
  - [x] Because `client/src/api/client.ts` parses every `data:` frame as JSON and forwards it to UI state, update shared typing and focused client tests only if needed so `ping` does not break current progress rendering
  - [x] If client-side compatibility changes are required, keep them minimal and contract-focused: accept/ignore `ping`, but do not implement reconnection UI in this story
  - [x] Update SSE API docs if the transport contract changes from comment heartbeats every 15s to JSON `ping` heartbeats every 30s

- [x] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [x] Run `cd server && npm run test:run -- src/services/progress-tracker.test.ts src/routes/scraper.test.ts`
  - [x] Run `cd server && npm run test:run` if shared SSE behavior changes beyond the tracker internals
  - [x] Run `cd client && npm run test:run -- src/hooks/useScrapeProgress.test.ts src/api/client.test.ts` if the shared SSE payload type or parser changes

### Review Findings

- [x] [Review][Patch] Idle-timeout can silently strand active or quiet SSE clients [server/src/services/progress-tracker.ts:183]
- [x] [Review][Patch] Localhost health-probe exemption rejects proxied/containerized local checks [server/src/middleware/rate-limit.ts:82]
- [x] [Review][Patch] Idle-close behavior is not covered through the authenticated SSE route/service seam [server/src/routes/scraper.test.ts:274]
- [x] [Review][Patch] Final buffered SSE payload can be misparsed or dropped on EOF with split UTF-8 data [client/src/api/client.ts:257]
- [x] [Review][Defer] Idle SSE subscriptions remain closed until a later reconnect strategy is implemented [client/src/api/client.ts:257] — deferred, owned by Story 3.2 reconnect behavior

## Dev Notes

### Scope and Guardrails

- Story `3.1` is the second required step in Epic 3, immediately after `3.7`, and it is the blocker for later SSE reconnection and long-running validation stories. [Source: `_bmad-output/planning-artifacts/epics.md:239-255`, `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`]
- The existing runtime already has an SSE keepalive, but it is a comment heartbeat every 15 seconds (`: heartbeat`) rather than the new JSON `ping` contract required by Story 3.1. [Source: `server/src/services/progress-tracker.ts:154-166`, `docs/reference/api/scraper.md:170-180`]
- The route already exposes only one SSE endpoint, `GET /api/scraper/progress`, behind auth and the protected limiter. Keep this route and mount structure intact. [Source: `server/src/routes/scraper.ts:303-323`]
- Do not pull Story `3.2` reconnect behavior, Story `3.3` event-id replay semantics, or Story `3.5` rate-limit validation into this implementation.

### Critical Current-Code Reality

- `ScraperService.subscribeToProgress()` only sets SSE headers, registers the listener with `progressTracker`, and logs connect/disconnect. That means the tracker is the right seam for heartbeat cadence, replay behavior, and idle-close timer ownership. [Source: `server/src/services/scraper-service.ts:182-211`]
- `ProgressTracker` currently stores replayable progress events in `this.events`, fans them out to connected listeners, and starts the keepalive timer only when the first listener connects. [Source: `server/src/services/progress-tracker.ts:57-116`, `server/src/services/progress-tracker.ts:155-166`]
- Tenant scoping currently depends on `matchesListener(event, listenerTrace)`, which checks `event.traceContext?.org_slug` against the listener org slug. A naive `emit({ type: 'ping' })` without trace context would fail that check for tenant listeners. Heartbeats therefore need a transport-specific send path or listener-scoped context, not the normal replayed business-event path. [Source: `server/src/services/progress-tracker.ts:61-69`, `server/src/services/progress-tracker.ts:109-115`]
- Replaying heartbeat events to new listeners would be incorrect because the replay buffer is for scrape progress history. New listeners should see historical business events plus fresh live pings, not stale keepalive frames from the past. [Source: `server/src/services/progress-tracker.ts:76-82`, `server/src/services/progress-tracker.ts:101-116`]
- The current client fetch-based SSE parser ignores comment heartbeats because it only parses `data:` lines. Once the backend switches to JSON `ping` frames, current client consumers will start receiving those messages. Compatibility must be handled deliberately. [Source: `client/src/api/client.ts:205-277`, `client/src/types/index.ts:103-120`, `client/src/hooks/useScrapeProgress.ts:262-310`]
- The current client does not have a dedicated SSE `close` event abstraction. Stream termination is observable through the fetch reader completing or the error/abort path, so Story 3.1 should not invent a new `{ type: 'close' }` payload just to satisfy AC #3. [Source: `client/src/api/client.ts:230-277`, `docs/troubleshooting/scraper.md:481-496`]

### Reinvention Prevention

- Reuse the existing SSE pipeline instead of introducing another transport abstraction:
  - `server/src/routes/scraper.ts`
  - `server/src/services/scraper-service.ts`
  - `server/src/services/progress-tracker.ts`
- Reuse the existing authenticated observability context passed from the scraper route into the service and tracker. Do not create a second auth or subscription model just for heartbeat.
- Reuse the current `ProgressTracker.reset()` and listener removal lifecycle. Do not add detached timers that outlive the tracker or individual responses.
- If client compatibility work becomes necessary, extend the existing `ProgressEvent` shared type and current SSE parser instead of introducing a second client-side subscription helper.

### Cross-Story Intelligence (Story 3.7)

- Story `3.7` reinforced the repo pattern of making the smallest correct change at the real seam in the request/transport path and proving it with focused regressions. Apply the same approach here: fix the heartbeat contract in the existing tracker/service path instead of layering a second mechanism on top. [Source: `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md:71-84`, `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md:119-143`]
- Story `3.7` also showed that stack-level behavior must be tested through the actual mounted surface, not only in isolation. Here that means tracker-level tests are necessary, but at least one route/service regression should still prove the authenticated SSE path remains wired correctly. [Source: `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md:88-97`, `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md:121-125`]

### Architecture Compliance Notes

- Keep backend implementation inside the existing server structure: routes in `server/src/routes/`, transport orchestration in `server/src/services/`, tests colocated next to the code. [Source: `_bmad-output/project-context.md:101-107`, `_bmad-output/project-context.md:146-150`]
- Keep strict TypeScript typing for the SSE payload union. Do not use `any` to force heartbeat messages through shared parsing/state code. [Source: `_bmad-output/project-context.md:60-64`, `_bmad-output/project-context.md:84-87`]
- Keep structured logging for connect/disconnect/cleanup paths; do not introduce `console.log` in production code. [Source: `_bmad-output/project-context.md:75-78`, `_bmad-output/project-context.md:197-203`]

### Library / Framework Requirements

- Continue using Express response streaming with `text/event-stream`; do not switch the endpoint to WebSockets or a third-party SSE package in this story. [Source: `server/src/services/scraper-service.ts:185-190`, `docs/reference/api/scraper.md:172-176`]
- Continue using Vitest for server and client regressions. Prefer fake timers for cadence/idle-timeout assertions rather than real-time sleeps. [Source: `_bmad-output/project-context.md:110-136`]

### Testing Requirements

- Add focused server tests around cadence, listener cleanup, tenant-scoped heartbeat delivery, and non-replay of heartbeat frames.
- Add a focused client/API regression only if needed to prove the current fetch-based subscriber handles server-side stream closure cleanly without introducing a synthetic `close` message type.
- If the shared client `ProgressEvent` type changes, add the smallest client regression proving `ping` frames do not corrupt `useScrapeProgress` job state.
- Keep long-running 10-minute validation and reconnect behavior out of this story's implementation scope; this story only establishes the transport contract those later tests depend on. [Source: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:170-177`]

### Suggested Implementation Strategy

1. RED: capture the current 15-second comment-heartbeat behavior and the missing JSON `ping`/idle-close contract with fake-timer tests.
2. Move heartbeat generation into a transport-only send path inside `ProgressTracker` so it does not enter the replay buffer.
3. Make heartbeat delivery listener-aware so tenant-scoped subscribers still receive pings.
4. Add idle-close logic that measures business inactivity without treating heartbeat frames as progress activity.
5. If required, make the smallest shared client type/parser adjustment so `ping` is accepted or ignored safely.
6. Update SSE docs if the runtime contract changes.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md`
- `server/src/services/progress-tracker.ts`
- `server/src/services/progress-tracker.test.ts`
- `server/src/services/scraper-service.ts`
- `server/src/routes/scraper.ts`
- `server/src/routes/scraper.test.ts`
- `client/src/api/client.ts` only if ping compatibility requires a minimal parser change
- `client/src/types/index.ts` only if the shared progress-event union must include `ping`
- `client/src/hooks/useScrapeProgress.ts` and `client/src/hooks/useScrapeProgress.test.ts` only if needed to keep the UI stable with JSON heartbeat frames
- `docs/reference/api/scraper.md` if the published SSE contract is updated

### Pitfalls to Avoid

- Do not implement heartbeat by calling the normal `emit()` path unless you explicitly prevent replay-buffer pollution and tenant-filter dropouts.
- Do not let heartbeat frames reorder or mutate business progress events.
- Do not let heartbeat-only traffic keep an idle, no-active-scrape stream open forever if the acceptance contract requires a 15-minute idle close.
- Do not add reconnection UI, `Last-Event-ID`, or resumable event history in this story.
- Do not leave docs claiming comment heartbeats every 15 seconds if the runtime now emits JSON `ping` every 30 seconds.

### Project Structure Notes

- No dedicated architecture or PRD shard was found for Epic 3; this story is grounded in `epics.md`, readiness notes, the test handoff, the Epic 2 retrospective, current SSE code, and the generated project context.
- The repo already has both server-side SSE tests and client-side progress-hook tests. Extend those before creating new test harnesses.

### Git Intelligence Summary

- Recent work continues to favor small endpoint-contract fixes plus artifact synchronization: `fix(server): accept trailing slash on DLQ admin alias`, `feat(server): add DLQ job detail endpoint`, `docs(bmad): sync story 2.6 artifacts`. Follow that same pattern here: tighten the SSE contract with focused regressions and keep docs/artifacts in sync when behavior changes.

### Project Context Reference

- Epic 2 retrospective explicitly says to formalize the SSE heartbeat contract before implementing Story 3.1 and to separate heartbeat transport events from business-progress events. This is a direct guardrail for implementation, not optional polish. [Source: `_bmad-output/implementation-artifacts/epic-2-retro-2026-04-28.md:110-127`]

### References

- Epic 3 implementation order and Story 3.1 definition: `_bmad-output/planning-artifacts/epics.md:239-255`, `_bmad-output/planning-artifacts/epics.md:869-899`
- Epic 3 notes summary: `_bmad-output/planning-artifacts/notes-epics-stories.md:171-183`
- Readiness report ordering and Story 3.1 readiness: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- Test handoff requirements for Story 3.1: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:168-177`
- Epic 2 retro guidance for heartbeat contract preparation: `_bmad-output/implementation-artifacts/epic-2-retro-2026-04-28.md:110-127`
- Current SSE route: `server/src/routes/scraper.ts:303-323`
- Current SSE service subscription flow: `server/src/services/scraper-service.ts:182-211`
- Current progress tracker behavior: `server/src/services/progress-tracker.ts:57-205`
- Existing tracker tests: `server/src/services/progress-tracker.test.ts:1-110`
- Existing scraper route tests: `server/src/routes/scraper.test.ts:274-309`
- Current client SSE parser: `client/src/api/client.ts:205-277`
- Existing client SSE parser tests: `client/src/api/client.test.ts`
- Current shared client progress event type: `client/src/types/index.ts:103-139`
- Current progress hook subscription behavior: `client/src/hooks/useScrapeProgress.ts:217-325`
- Current published SSE docs: `docs/reference/api/scraper.md:162-180`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- `git log --oneline -5`
- Epic 3 planning and readiness artifacts
- current SSE server/client implementation in `server/src/services/progress-tracker.ts`, `server/src/services/scraper-service.ts`, `server/src/routes/scraper.ts`, `client/src/api/client.ts`, and `client/src/hooks/useScrapeProgress.ts`
- `cd server && npm run test:run -- src/services/progress-tracker.test.ts`
- `cd client && npm run test:run -- src/api/client.test.ts`
- `cd server && npm run test:run -- src/services/progress-tracker.test.ts src/routes/scraper.test.ts`
- `cd client && npm run test:run -- src/hooks/useScrapeProgress.test.ts src/api/client.test.ts`
- `cd server && npm run test:run`
- `cd client && npm run test:run`
- `cd client && npm run lint`
- `cd server && npm run test:run -- src/services/progress-tracker.test.ts src/routes/scraper.test.ts src/middleware/rate-limit.test.ts`
- `cd client && npm run test:run -- src/api/client.test.ts src/hooks/useScrapeProgress.test.ts`
- `cd server && npm run test:run` (post-review fixes)
- `cd client && npm run test:run` (post-review fixes)
- `cd client && npm run lint` (post-review fixes)
- `cd client && npm run test:run -- src/api/client.test.ts src/hooks/useScrapeProgress.test.ts` (final EOF flush fix)
- `cd client && npm run test:run` (final EOF flush fix)
- `cd client && npm run lint` (final EOF flush fix)

### Completion Notes List

- Created an implementation-ready story for Epic 3 Story 3.1 based on the real current SSE transport, not only the epic text.
- Captured the two highest-risk implementation traps for this story: heartbeat replay-buffer pollution and tenant-scoped listeners silently missing pings.
- Scoped the story to backend transport contract work while still flagging the minimal client compatibility change that may be necessary once `ping` becomes a JSON `data:` frame.
- Kept reconnect logic, event IDs, and long-running E2E validation explicitly out of scope for this story.
- Implemented transport-only JSON heartbeat pings every 30 seconds in `ProgressTracker` without replaying them as scrape history.
- Added idle stream closure after 15 minutes without business progress and kept active streams alive when progress events continue within the timeout window.
- Preserved tenant-scoped SSE delivery by sending heartbeat frames directly to connected listeners instead of routing them through business-event filtering.
- Extended the shared client `ProgressEvent` union with `ping` and updated `useScrapeProgress` to treat heartbeat frames as connection liveness signals rather than job-state events.
- Updated focused and full server/client test coverage, plus published API docs, to match the new heartbeat contract.
- Verified the implementation with focused server/client tests, the full server suite (845 passing), the full client suite (505 passing), and client lint.
- Resolved review finding by preventing idle-close while any scrape job remains active and surfacing a clean SSE EOF as a disconnect error to the client.
- Resolved review finding by allowing localhost probes forwarded through private container hops while still rejecting external spoof combinations.
- Resolved review finding by adding route-level coverage that the mounted SSE endpoint executes cleanup when the request closes.
- Resolved review finding by flushing pending decoder state before EOF handling so the final SSE payload survives chunk-split UTF-8 boundaries.

### File List

- `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/src/services/progress-tracker.ts`
- `server/src/services/progress-tracker.test.ts`
- `client/src/types/index.ts`
- `client/src/hooks/useScrapeProgress.ts`
- `client/src/hooks/useScrapeProgress.test.ts`
- `client/src/api/client.test.ts`
- `docs/reference/api/scraper.md`
- `client/src/api/client.ts`
- `server/src/routes/scraper.test.ts`
- `server/src/middleware/rate-limit.ts`
- `server/src/middleware/rate-limit.test.ts`

## Change Log

- 2026-04-28: Created implementation-ready story file for Epic 3 Story 3.1 with explicit guardrails around SSE heartbeat transport, tenant-scoped delivery, replay safety, idle-close behavior, and current client compatibility.
- 2026-04-28: Implemented Story 3.1 by replacing comment heartbeats with 30-second JSON `ping` frames, adding 15-minute idle stream closure, keeping heartbeat traffic out of replayed progress history, and updating client compatibility/tests/docs.
- 2026-04-28: Addressed code review findings by preventing idle-close on active jobs, surfacing clean SSE EOF as a disconnect signal, extending route-level cleanup coverage, and relaxing localhost probe trust for private container hops.
- 2026-04-28: Addressed the final client parser review finding by flushing decoder state before EOF and adding a regression for chunk-split UTF-8 SSE payloads.
