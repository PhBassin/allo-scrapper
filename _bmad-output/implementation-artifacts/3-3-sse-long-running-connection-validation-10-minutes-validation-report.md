# Story Validation Report: 3-3-sse-long-running-connection-validation-10-minutes

Validation Date: 2026-04-29T14:55:00Z  
Story File: `_bmad-output/implementation-artifacts/3-3-sse-long-running-connection-validation-10-minutes.md`  
Validator: OpenCode (`bmad-create-story` validate pass)

## Validation Verdict

Result: **PASS WITH FIXES APPLIED**

The story is implementation-ready after applying targeted fixes around SSE ID persistence, replay helper compatibility, rate-limit-aware verification, and deterministic long-running E2E setup.

## What Was Validated

- Story structure completeness (story, ACs, tasks, dev notes, references, agent record)
- Acceptance-criteria traceability into implementation and verification tasks
- Alignment with Epic 3 ordering and completed prerequisites (`3.7`, `3.1`, `3.5`, `3.2`)
- Alignment with current SSE architecture (`/api/scraper/progress`, `ScraperService.subscribeToProgress`, `ProgressTracker`, fetch-based `subscribeToProgress`)
- Alignment with current Playwright/runtime constraints for scraper-heavy and fixture-backed tests

## Issues Found and Fixed

1. **SSE ID sequence could be reset accidentally with replay history**
- Risk: `ProgressTracker.emit()` clears the replay buffer when a new `started` event begins a new scrape session. Without an explicit warning, a dev could couple event IDs to the replay array length and create duplicate `id:` values after history resets, breaking `Last-Event-ID` semantics.
- Fix applied in story:
  - Added tasks requiring event IDs to remain monotonic for the process lifetime or until `ProgressTracker.reset()`.
  - Added current-code notes and pitfalls documenting the `started` replay-buffer reset.
  - Added server regression requirements proving IDs do not reset when replay history clears.

2. **Internal replay metadata could break `getEvents()` consumers**
- Risk: Implementing replay metadata by changing `this.events` from `ProgressEvent[]` to wrapper objects would break existing tests/debug helpers and obscure the Story 3.1 guarantee that pings are not replayed.
- Fix applied in story:
  - Added a task requiring `ProgressTracker.getEvents()` to keep returning `ProgressEvent[]`.
  - Added a current-code note and server regression requirement for preserving this helper contract.

3. **Long-running E2E scenario could use fast-failing fixture cinemas**
- Risk: `/test/seed-org` adds `example.test` cinemas that intentionally fail quickly. A dev could choose those as the only scrape targets and never validate a 10+ minute active stream.
- Fix applied in story:
  - Added explicit guidance to use tenant baseline cinemas copied from `server/src/config/cinemas.json` or otherwise seed/choose Allocine-backed cinemas.
  - Added current-code notes explaining the distinction between baseline cinemas and fixture failure sentinels.

4. **Default fixture runtime assertion conflicts with 10+ minute validation**
- Risk: Existing fixture helper `assertFixtureRuntimeWithinLimit()` defaults to 120 seconds. Copying that pattern into this story would make a correct long-running test fail for the wrong reason.
- Fix applied in story:
  - Added a task and pitfall requiring the long-running spec to skip that default assertion or pass a custom max above the test timeout.

5. **Reconnect validation could be invalidated by rate-limit defaults**
- Risk: The SSE route is protected by `protectedLimiter`, and scrape trigger routes are guarded by scrape/protected limiters. A long-running reconnect test can consume multiple requests inside the same 15-minute window, creating false failures unrelated to SSE stability.
- Fix applied in story:
  - Added rate-limit-aware runtime guidance (`RATE_LIMIT_SCRAPER_MAX` and deliberate protected-limit handling).
  - Added architecture and pitfall notes requiring test-only env overrides rather than weakening production defaults.

## Coverage Check (Post-Fix)

- AC #1 (10+ minute open stream): covered by deterministic Playwright task, worker/runtime setup, explicit timeout, active scrape target guidance, and no default 120s fixture limit.
- AC #2 (30-second pings plus progress events): covered by server heartbeat inheritance from Story 3.1 and browser/client assertions on pings and stream status.
- AC #3 (unique monotonic IDs and resume): covered by server ID/replay tests, route/service `Last-Event-ID` wiring, client parser/reconnect tests, and E2E forced-reconnect assertions.
- Tenant isolation: covered by replay-after-ID tenant filtering tasks and explicit no-leak guardrails.
- Regression risks from Story 3.1/3.2: covered by parser EOF/split UTF-8 regressions, state-preservation tasks, and no duplicate reconnect implementation guidance.

## Ready-for-Dev Confirmation

Status remains `ready-for-dev`.  
No additional blocker found for moving to `bmad-dev-story`.

## Recommended Next Step

- Run `DS` (`bmad-dev-story`) for `3-3-sse-long-running-connection-validation-10-minutes`.
