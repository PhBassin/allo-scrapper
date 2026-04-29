# Story 3.2: Implement Client SSE Reconnection Logic

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend developer,
I want the client to detect missing heartbeats and reconnect automatically,
So that users don't lose progress updates during network interruptions.

## Acceptance Criteria

1. **Given** the client is connected to SSE
   **When** no ping event is received for 60 seconds
   **Then** the client detects a missing heartbeat
   **And** the `data-testid="sse-connection-status"` shows "Reconnecting..."
   **And** the client triggers EventSource reconnection

2. **Given** the client reconnects successfully
   **When** the connection is re-established
   **Then** the `data-testid="sse-connection-status"` shows "Connected"
   **And** the client resumes receiving progress events
   **And** no progress data is lost (accumulated events preserved across reconnections)

3. **Given** the client reconnects after a network interruption
   **When** the server sends the next progress event
   **Then** the client displays the correct progress percentage
   **And** the `data-testid="scrape-progress-percentage"` is updated
   **And** the `data-testid="scrape-progress-eta"` is recalculated

## Tasks / Subtasks

- [x] Task 1 — Add RED tests for reconnection contract (AC: 1, 2, 3)
  - [x] Extend `client/src/api/client.test.ts` with tests for: heartbeat watchdog that triggers onError after 60s without ping, reconnection attempt notification, abort stops reconnection loop
  - [x] Extend `client/src/hooks/useScrapeProgress.test.ts` with tests for: `connectionStatus` transitions (`connected` → `reconnecting` → `connected`), preserved progress state across reconnect, error cleared on reconnect success
  - [x] Extend `client/src/components/ScrapeProgress.test.tsx` with tests for: `data-testid="sse-connection-status"` rendering "Reconnecting..." / "Connected", `data-testid="scrape-progress-eta"` display

- [x] Task 2 — Implement reconnection logic in `subscribeToProgress` (AC: 1, 2)
  - [x] Add heartbeat watchdog timer (60s) to `client/src/api/client.ts` — reset on each received `ping` event, trigger reconnection on timeout
  - [x] Implement reconnect loop with exponential backoff (1ms initial, 1s, 2s, 4s, 8s, 16s, 32s cap) inside `subscribeToProgress`
  - [x] Expose a `connectionStatus` callback parameter (`onStatusChange`) so the hook layer knows when reconnection is in progress
  - [x] Ensure `controller.abort()` (unsubscribe) immediately stops any in-flight reconnect timer
  - [x] Keep the same fetch-based SSE approach (do NOT switch to `EventSource` API)

- [x] Task 3 — Update `useScrapeProgress` for connection state transitions (AC: 1, 2)
  - [x] Add `connectionStatus: 'connected' | 'reconnecting' | 'disconnected'` to `ProgressState`
  - [x] Wire the new `subscribeToProgress` reconnection callbacks into state transitions
  - [x] Ensure accumulated `events` array is preserved across reconnections (do not reset on reconnect)
  - [x] Clear `error` on successful reconnect, set error only on terminal disconnect

- [x] Task 4 — Update `ScrapeProgress` component for connection status UI (AC: 1, 2, 3)
  - [x] Render `data-testid="sse-connection-status"` with status text: "Connecté" (connected), "Reconnexion..." (reconnecting), "Déconnecté" (disconnected)
  - [x] Add `data-testid="scrape-progress-eta"` displaying estimated time remaining for active jobs
  - [x] Do not hide progress cards during reconnection — keep existing progress visible
  - [x] Show a reconnection spinner/indicator distinct from the initial loading spinner

- [x] Task 5 — Verify with focused commands after implementation
  - [x] Run `cd client && npm run test:run -- src/api/client.test.ts src/hooks/useScrapeProgress.test.ts src/components/ScrapeProgress.test.tsx`
  - [x] Run `cd client && npm run test:run` (full suite — 526 passing)
  - [x] Run `cd client && npm run lint`

### Review Findings

- [x] [Review][Patch] Heartbeat reconnect reuses an already-aborted `AbortController` [client/src/api/client.ts:211]
- [x] [Review][Patch] `heartbeatAborted` is referenced but never declared [client/src/api/client.ts:354]
- [x] [Review][Patch] Transient reconnect failures are surfaced as user-visible errors before retries are exhausted [client/src/api/client.ts:367]
- [x] [Review][Patch] `reset()` sets invalid `ProgressState` by omitting `connectionStatus` [client/src/hooks/useScrapeProgress.ts:333]
- [x] [Review][Patch] SSE auth/server failures now spin in a silent reconnect loop instead of surfacing a terminal error promptly [client/src/api/client.ts:303]
- [x] [Review][Patch] First successful recovery after startup can remain stuck in `reconnecting` until a later ping/event [client/src/api/client.ts:313]

## Dev Notes

### Scope and Guardrails

- Story `3.2` is the first of the parallel-track stories in Epic 3, unblocked after 3.7, 3.1, and 3.5 completed. [Source: `_bmad-output/planning-artifacts/epics.md:901-931`, `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`]
- The backend already sends JSON `ping` heartbeats every 30 seconds (Story 3.1). The client currently receives and acknowledges them (sets `isConnected: true`) but has zero reconnection logic — when the stream closes, the component stays disconnected forever. [Source: `client/src/hooks/useScrapeProgress.ts:269-275`, `client/src/api/client.ts:259-291`]
- Do NOT implement server-side event IDs or `Last-Event-ID` resume semantics — that is Story `3.3` scope.
- Do NOT implement 50+ client load testing or 10+ minute connection validation — those are Stories `3.4` and `3.3` respectively.

### Critical Current-Code Reality

- `subscribeToProgress` in `client/src/api/client.ts:209-296` is a fetch-based SSE reader with NO reconnection. When the stream ends (EOF or error), it calls `onError` once and stops. There is no retry, no watchdog, and no automatic reconnect. [Source: `client/src/api/client.ts:235-290`]
- `useScrapeProgress` in `client/src/hooks/useScrapeProgress.ts:217-318` subscribes ONCE on mount (empty deps array `[]`) and never resubscribes. If the stream closes, `isConnected` is set to `false` permanently. [Source: `client/src/hooks/useScrapeProgress.ts:262-318`]
- The current `isConnected` boolean is too blunt for reconnection UX. The AC requires three distinct states visible to the user: Connected, Reconnecting, Disconnected. A `connectionStatus` tri-state (`'connected' | 'reconnecting' | 'disconnected'`) is needed. [Source: AC #1, AC #2]
- `ScrapeProgress` component does NOT currently render any connection status indicator. The `data-testid="sse-connection-status"` element does not exist. The component shows a loading spinner only when `events.length === 0 && !hasTrackedJobs`. [Source: `client/src/components/ScrapeProgress.tsx:17-26`]
- The `subscribeToProgress` function signature is `(onEvent, onError?) => unsubscribe`. Adding reconnection requires extending this contract — either via a third callback parameter for status changes, or by making `onError` carry richer information (e.g., whether it's a transient disconnect vs terminal failure). Prefer adding a third `onStatusChange` callback to keep `onError` semantics clean. [Source: `client/src/api/client.ts:209`]
- Progress events are currently accumulated in `useScrapeProgress` state. This accumulation MUST be preserved across reconnections — otherwise the UI would lose all progress history on a brief network blip. [Source: AC #2, `client/src/hooks/useScrapeProgress.ts:268-296`]

### Reinvention Prevention

- Reuse the existing `subscribeToProgress` as the single SSE entry point. Do NOT create a second subscription function, a parallel transport, or switch to `EventSource` (which doesn't support custom auth headers). [Source: `client/src/api/client.ts:209-296`]
- Reuse the existing `useScrapeProgress` hook as the single progress state owner. Do NOT create a separate reconnection hook or split connection state management. [Source: `client/src/hooks/useScrapeProgress.ts:217-318`]
- Reuse the existing `ScrapeProgress` component for rendering. Do NOT create a separate connection-status-only component. [Source: `client/src/components/ScrapeProgress.tsx:1-233`]
- Reuse the existing Vitest + Testing Library test infrastructure. Mock `subscribeToProgress` in hook/component tests; test `subscribeToProgress` itself with the established fetch-mocking pattern in `client.test.ts`. [Source: `client/src/api/client.test.ts:1-391`, `client/src/hooks/useScrapeProgress.test.ts:1-244`, `client/src/components/ScrapeProgress.test.tsx:1-558`]

### Cross-Story Intelligence (Story 3.1)

- Story `3.1` established the 30-second JSON `ping` contract and added the `ping` event type to `ProgressEvent`. The reconnection watchdog in this story relies on receiving those pings. The 60-second timeout (2× the ping interval) provides a single missed-ping tolerance window. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:7-69`, `client/src/types/index.ts:119`]
- Story `3.1` review finding #5 deferred idle-SSE reconnection to Story `3.2`. This is the story that picks up that deferred work. The idle-close behavior (server closes after 15min inactivity) means the client MUST reconnect when the server gracefully closes the stream. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:75`]
- Story `3.1` review finding #4 (final buffered SSE payload on EOF) is already fixed — the client correctly processes the final message before reporting EOF. This means reconnection on EOF is safe: no dangling messages are lost. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:74`]

### Cross-Story Intelligence (Story 3.7)

- Story `3.7` established the pattern of minimal changes at the real seam with focused regressions. Apply the same approach: change `subscribeToProgress` for transport-level reconnection, update the hook for state transitions, test at each layer. [Source: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:108-109`]

### Architecture Compliance Notes

- Keep all client code within existing structure: API layer in `client/src/api/`, hooks in `client/src/hooks/`, components in `client/src/components/`, tests colocated. [Source: `_bmad-output/project-context.md:96-100`, `_bmad-output/project-context.md:146-150`]
- Use strict TypeScript — no `any` for connection status or progress event handling. Define explicit types for the new `connectionStatus` and any extended callback signatures. [Source: `_bmad-output/project-context.md:60-64`]
- Follow React patterns: use `useRef` for timer references, avoid stale closures in reconnection callbacks, clean up all timers on unmount. [Source: `_bmad-output/project-context.md:96-100`]
- Keep the fetch-based SSE approach — do NOT switch to `EventSource`. The current implementation correctly handles auth headers (`Authorization: Bearer ...`) which `EventSource` cannot do. [Source: `client/src/api/client.ts:238-245`]

### Library / Framework Requirements

- Continue using native `fetch` API for SSE transport — no new dependencies. [Source: `client/src/api/client.ts:235-290`]
- Continue using Vitest with fake timers (`vi.useFakeTimers()`) for heartbeat watchdog and reconnection timing tests. Do NOT use real-time waits. [Source: `_bmad-output/project-context.md:110-136`]
- Continue using React Testing Library for component tests with user-centric queries. [Source: `_bmad-output/project-context.md:130-136`]

### Testing Requirements

- **Transport layer tests** (`client/src/api/client.test.ts`): Test the heartbeat watchdog triggers reconnection after 60s without ping. Test that receiving a ping resets the watchdog. Test that unsubscribe (`controller.abort()`) stops the reconnect loop. Test reconnection with the mock fetch pattern already established (mock `globalThis.fetch`). Test EOF on first connection → reconnect attempt made.
- **Hook tests** (`client/src/hooks/useScrapeProgress.test.ts`): Test `connectionStatus` transitions through the full lifecycle: `'connected'` → `'reconnecting'` → `'connected'`. Test that progress events accumulated before disconnect are preserved after reconnect. Test that `error` is cleared on successful reconnect. Test that `connectionStatus` returns to `'disconnected'` when all retries fail.
- **Component tests** (`client/src/components/ScrapeProgress.test.tsx`): Test `data-testid="sse-connection-status"` renders correct text for each status. Test `data-testid="scrape-progress-eta"` displays when scraping is active. Test progress cards remain visible during reconnection. Test reconnection spinner is distinct from initial loading spinner.
- **Do NOT** add E2E tests in this story — those belong to Story `3.3` (long-running validation) and Story `3.4` (50+ client load).

### Suggested Implementation Strategy

1. **RED (Transport)**: Write failing tests in `client.test.ts` for the reconnection watchdog and abort behavior using fake timers.
2. **RED (Hook)**: Write failing tests in `useScrapeProgress.test.ts` for `connectionStatus` transitions and state preservation.
3. **RED (Component)**: Write failing tests in `ScrapeProgress.test.tsx` for the new `data-testid` elements.
4. **GREEN (Transport)**: Add reconnection loop and heartbeat watchdog to `subscribeToProgress` in `client.ts`. Add `onStatusChange` callback parameter.
5. **GREEN (Hook)**: Update `useScrapeProgress` to track `connectionStatus`, wire the new status callback, preserve events across reconnections.
6. **GREEN (Component)**: Add connection status indicator and ETA display to `ScrapeProgress.tsx`.
7. **REFACTOR**: Verify no regressions in existing tests, clean up timer handling, ensure abort is leak-free.

### Concrete File Targets

| File | Change | Purpose |
|------|--------|---------|
| `client/src/api/client.ts` | UPDATE | Add reconnection loop + heartbeat watchdog to `subscribeToProgress` |
| `client/src/api/client.test.ts` | UPDATE | Add reconnection watchdog and abort tests |
| `client/src/hooks/useScrapeProgress.ts` | UPDATE | Add `connectionStatus` tri-state, preserve events on reconnect |
| `client/src/hooks/useScrapeProgress.test.ts` | UPDATE | Add connection status transition tests |
| `client/src/components/ScrapeProgress.tsx` | UPDATE | Add `sse-connection-status` and `scrape-progress-eta` UI |
| `client/src/components/ScrapeProgress.test.tsx` | UPDATE | Add connection status rendering tests |

### Pitfalls to Avoid

- Do NOT reset the `events` array on reconnect — accumulated progress history must survive brief disconnects.
- Do NOT use `EventSource` — it cannot send the `Authorization` header required by the authenticated SSE endpoint.
- Do NOT let the reconnection timer outlive the component — every timer must be cleaned up when `unsubscribe()` is called.
- Do NOT implement `Last-Event-ID` or resume-from-event semantics — that is Story `3.3` scope.
- Do NOT change the server-side SSE contract — the backend already emits correct `ping` and progress events from Story `3.1`.
- Do NOT surface transient reconnect errors as user-visible errors — only terminal disconnects (all retries exhausted) should show as errors.
- Do NOT block the initial loading state during reconnection — the component must show both existing progress AND reconnecting indicator simultaneously.

### Project Structure Notes

- No dedicated architecture or PRD shard was found for Epic 3; this story is grounded in `epics.md`, `implementation-readiness-report`, the Story `3.1` implementation and review artifacts, current client SSE code, and the generated project context.
- The repo already has a robust SSE test infrastructure on the client side (fetch mocking, fake timers, hook testing with React Testing Library). Extend these before creating new test harnesses.

### Git Intelligence Summary

- Recent work continues the pattern of small, focused changes with targeted regressions: `test(e2e): add rate limit burst coverage`, `fix(server): trust localhost health probes through private hops`, `feat(server): add SSE heartbeat progress pings`. Follow this same pattern: make the smallest change that fulfills the AC at the right seam, prove it with regressions at each layer.
- Commits follow conventional commits format with scopes like `server`, `e2e`, `bmad`. This story's commits should use scopes `client` and `feat`/`test`.

### Project Context Reference

- Epic 2 retrospective explicitly recommended formalizing the SSE heartbeat contract and adding reconnection logic. This story directly addresses both recommendations. [Source: Epic 2 retro, `_bmad-output/implementation-artifacts/epic-2-retro-2026-04-28.md`]
- The project context mandates TDD workflow: commit test first (RED), then implementation (GREEN). Follow this strictly. [Source: `_bmad-output/project-context.md:122-126`]

### References

- Epic 3 Story 3.2 definition and ACs: `_bmad-output/planning-artifacts/epics.md:901-931`
- Implementation readiness report ordering: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- Story 3.1 implementation and review findings: `_bmad-output/implementation-artifacts/3-1-implement-sse-heartbeat-mechanism.md:1-255`
- Current SSE transport (`subscribeToProgress`): `client/src/api/client.ts:209-296`
- Current SSE transport tests: `client/src/api/client.test.ts:254-391`
- Current progress hook: `client/src/hooks/useScrapeProgress.ts:217-333`
- Current progress hook tests: `client/src/hooks/useScrapeProgress.test.ts:206-244`
- Current progress component: `client/src/components/ScrapeProgress.tsx:1-233`
- Current progress component tests: `client/src/components/ScrapeProgress.test.tsx:1-558`
- Shared ProgressEvent type (ping variant): `client/src/types/index.ts:119`
- Project context rules: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented heartbeat watchdog (60s timeout) and reconnect loop in `subscribeToProgress` with exponential backoff (1ms → 32s cap, max 50 attempts)
- Exported `ConnectionStatus` type (`'connected' | 'reconnecting' | 'disconnected'`) from `client/src/api/client.ts`
- Added `onStatusChange` callback parameter to `subscribeToProgress` for status propagation to the hook layer
- Added `connectionStatus` to `ProgressState` in `useScrapeProgress`, preserving accumulated events across reconnections
- Updated `ScrapeProgress` component with `data-testid="sse-connection-status"` badge (color-coded: green/amber/red) and `data-testid="scrape-progress-eta"`
- Reconnection indicator uses amber spinner distinct from the initial blue loading spinner
- All 526 client tests pass, lint clean
- Kept fetch-based SSE transport (no `EventSource`) — preserves auth header support
- Reconnection only resets on received `ping` events, preventing tight reconnect loops on transient failures

### File List

- `client/src/api/client.ts` — Added `ConnectionStatus` type export, reconnection loop, heartbeat watchdog, `onStatusChange` callback
- `client/src/api/client.test.ts` — Added 5 SSE reconnection tests (watchdog, ping reset, abort, EOF reconnect, status callback)
- `client/src/hooks/useScrapeProgress.ts` — Added `connectionStatus` to `ProgressState`, wired `onStatusChange` callback, clear error on reconnect
- `client/src/hooks/useScrapeProgress.test.ts` — Added 4 reconnection tests (status transitions, event preservation, error clearing)
- `client/src/components/ScrapeProgress.tsx` — Added `sse-connection-status` badge, `scrape-progress-eta`, reconnecting spinner
- `client/src/components/ScrapeProgress.test.tsx` — Added 5 SSE reconnection UI tests
- `_bmad-output/implementation-artifacts/3-2-client-sse-reconnection-logic.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
