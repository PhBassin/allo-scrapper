# Story Validation Report: 3-5-rate-limiting-burst-scenario-tests

Validation Date: 2026-04-28T00:00:00Z  
Story File: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md`  
Validator: OpenCode (`bmad-create-story` validate pass)

## Validation Verdict

Result: **PASS WITH FIXES APPLIED**

The story is implementation-ready after applying one targeted fix to remove a false-green E2E runtime ambiguity around disabled limiters.

## What Was Validated

- Story structure completeness (story, ACs, tasks, dev notes, references, agent record)
- Acceptance-criteria traceability into concrete implementation and verification tasks
- Alignment with the current rate-limit architecture (`authLimiter`, `protectedLimiter`, `scraperLimiter`, `skipTest`)
- Alignment with the current Playwright + fixture runtime contract (`playwright.config.ts`, `e2e/fixtures/org-fixture.ts`, `/test/*` gating)
- Feasibility of validating real burst behavior without drifting into broad rate-limit redesign work

## Issues Found and Fixed

1. **False-green E2E runtime ambiguity caused by `NODE_ENV=test`**
- Risk: The story referenced the existing fixture-backed Playwright runtime, but did not make it explicit that `server/src/middleware/rate-limit.ts` disables all real limiters when `NODE_ENV=test`. A dev could run the new burst spec against a test-mode backend, keep `/test/*` fixture routes available, and still never exercise the actual limiter behavior required by AC #1 and AC #3.
- Fix applied in story:
  - Added an explicit task requiring the burst spec to run against a fixture-enabled non-test backend such as `NODE_ENV=development` with `E2E_ENABLE_ORG_FIXTURE=true`.
  - Added current-code notes documenting the `skipTest` behavior and why test-mode backend runs are invalid for this story.
  - Added testing and pitfalls guidance so verification commands do not silently bypass the real middleware.

## Coverage Check (Post-Fix)

- AC #1 (3 successful login attempts are not rate limited): covered by real `/api/auth/login` burst tasks plus explicit non-test runtime guidance
- AC #2 (5 rapid refreshes do not strand the user): covered by authenticated protected-page refresh tasks under the real middleware stack
- AC #3 (11th protected request gets 429 + visible UI message): covered by protected-endpoint exhaustion tasks, minimal 429 UI seam guidance, and deterministic-threshold notes
- Runtime-validity risk from `skipTest`: now explicitly covered by task, notes, and pitfalls guidance
- Scope control risk from broad client/server redesign: still constrained by minimal-seam and no-reinvention guardrails

## Ready-for-Dev Confirmation

Status remains `ready-for-dev`.  
No additional blocker found for moving to `bmad-dev-story`.

## Recommended Next Step

- Run `DS` (`bmad-dev-story`) for `3-5-rate-limiting-burst-scenario-tests`.
