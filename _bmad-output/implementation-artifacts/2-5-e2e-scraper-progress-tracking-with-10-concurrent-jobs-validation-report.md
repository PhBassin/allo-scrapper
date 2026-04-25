# Story Validation Report: 2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs

Validation Date: 2026-04-24T00:00:00Z  
Story File: `_bmad-output/implementation-artifacts/2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs.md`  
Validator: OpenCode (`bmad-create-story` validate pass)

## Validation Verdict

Result: **PASS WITH FIXES APPLIED**

The story is implementation-ready after applying two targeted fixes to remove route-topology ambiguity and deterministic-data setup risk.

## What Was Validated

- Story structure completeness (story, ACs, tasks, dev notes, references, agent record)
- Acceptance-criteria traceability into concrete implementation and verification tasks
- Alignment with the current scrape progress architecture (`ScrapeProgress`, `useScrapeProgress`, `/api/scraper/progress`, `ProgressTracker`)
- Alignment with the tenant SaaS route topology and admin route shape
- Deterministic E2E setup feasibility using the current org fixture contract and quota model

## Issues Found and Fixed

1) **Tenant scraper route ambiguity in SaaS mode**
- Risk: The story referenced current scrape internals but did not make it explicit enough that tenant-mode scraping is mounted under `/api/org/:slug/scraper` and navigated from `/org/:slug/admin?tab=cinemas`. A dev could incorrectly build or test against standalone-only `/api/scraper` or a non-tenant admin route.
- Fix applied in story:
  - Added explicit guidance to use the real tenant route shape for setup and triggering.
  - Added route-topology guardrails and references to `packages/saas/src/routes/org.ts`, tenant route tests, and the admin shell route.

2) **10-cinema deterministic setup gap under current fixture/quota contract**
- Risk: The story asked for a fixture-backed org with 10 target cinemas, but the current fixture contract only guarantees 3 cinemas and the default free SaaS plan has `max_cinemas=3`. Without calling this out, the story could lead to an implementation that assumes test data exists or fails against quota limits.
- Fix applied in story:
  - Reworded the setup task to require expanding the fixture-backed org to 10 cinemas through the real tenant flow.
  - Added explicit guardrails documenting the current 3-cinema fixture guarantee and plan/quota constraint so the developer handles setup intentionally.

## Coverage Check (Post-Fix)

- AC #1 (10 jobs show progress via SSE): covered by RED Playwright task, per-card UI tasks, and SSE/event-model extension guidance
- AC #2 (all jobs complete within 2 minutes): covered by deterministic/CI-safe execution tasks and per-job completion markers
- AC #3 (one job fails without blocking others): covered by controlled failure-path tasks and failure-isolation validation
- Tenant route fidelity: now explicitly covered by SaaS route-topology notes and references
- Deterministic 10-cinema setup: now explicitly covered by fixture expansion + quota-awareness tasks

## Ready-for-Dev Confirmation

Status remains `ready-for-dev`.  
No additional blocker found for moving to `bmad-dev-story`.

## Recommended Next Step

- Run `DS` (`bmad-dev-story`) for `2-5-e2e-scraper-progress-tracking-with-10-concurrent-jobs`.
