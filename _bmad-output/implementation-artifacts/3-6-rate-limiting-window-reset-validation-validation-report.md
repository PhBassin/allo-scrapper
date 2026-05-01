# Story Validation Report: 3-6-rate-limiting-window-reset-validation

Validation Date: 2026-04-30T18:04:14Z  
Story File: `_bmad-output/implementation-artifacts/3-6-rate-limiting-window-reset-validation.md`  
Validator: OpenCode (`bmad-create-story` validate pass)

## Validation Verdict

Result: **PASS WITH FIXES APPLIED**

The story is implementation-ready after applying two targeted fixes to remove acceptance-criteria ambiguity around the reset-window runtime contract and the multi-user isolation setup.

## What Was Validated

- Story structure completeness (story, ACs, tasks, dev notes, references, agent record)
- Acceptance-criteria traceability into concrete implementation and verification tasks
- Alignment with the current rate-limit architecture (`protectedLimiter`, `authenticatedKeyGenerator`, retry-after metadata, tenant-scoped 429 UI)
- Alignment with the current Playwright + fixture runtime contract (`playwright.config.ts`, `e2e/fixtures/org-fixture.ts`, `/test/*` gating)
- Feasibility of validating reset-window behavior without drifting into production default changes or false-positive tenant isolation

## Issues Found and Fixed

1. **Reset-window runtime could drift away from the 60-second AC contract**
- Risk: The story correctly noted that shipped defaults are `60` requests per `15 minutes`, but its task wording still allowed a dev to validate reset behavior with any shorter arbitrary window. That would let the story false-green while never proving the acceptance criteria requiring `Retry-After: 60` and a 60-second reset countdown.
- Fix applied in story:
  - Tightened the verification-runtime task to require a controlled 60-second / 10-request contract via env overrides or an equivalent dedicated seam.
  - Updated current-code notes and testing guidance so the dev keeps production defaults intact while still validating the exact AC semantics.

2. **Multi-user independence could be proven with different tenants instead of shared-route users**
- Risk: The original task wording allowed "same org or otherwise," which could let a dev use different orgs. Because the limiter key already includes `org_slug`, that would prove tenant separation rather than the intended per-user independence on a shared endpoint.
- Fix applied in story:
  - Tightened the task to require two authenticated users in the same org on the same protected route.
  - Added a pitfall and completion note clarifying that AC #3 is about per-user bucketing, not cross-tenant routing.

## Coverage Check (Post-Fix)

- AC #1 (request succeeds after reset and user gets a fresh full burst): covered by explicit 60-second / 10-request verification-runtime guidance plus post-reset success/burst assertions
- AC #2 (`Retry-After: 60` plus visible countdown): covered by transport-contract tasks, `rate-limit-reset-timer` UI seam guidance, and per-second update requirements
- AC #3 (user A blocked while user B on the same endpoint still succeeds): covered by same-org, same-route, dual-user tasks and existing JWT-based keying guardrails
- False-green risk from `NODE_ENV=test`: still explicitly blocked by non-test runtime guidance
- Scope-control risk from broad limiter redesign: still constrained by reuse and minimal-seam guardrails

## Ready-for-Dev Confirmation

Status remains `ready-for-dev`.  
No additional blocker found for moving to `bmad-dev-story`.

## Recommended Next Step

- Run `DS` (`bmad-dev-story`) for `3-6-rate-limiting-window-reset-validation`.
