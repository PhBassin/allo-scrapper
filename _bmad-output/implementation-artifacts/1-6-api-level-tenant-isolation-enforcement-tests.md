# Story 1.6: API-Level Tenant Isolation Enforcement Tests

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want integration tests that validate tenant isolation at the API and database-client injection level,
so that org-scoped requests always execute against the correct tenant context and cannot leak cross-tenant data.

## Acceptance Criteria

1. **Given** a database query for cinemas is executed through an org-scoped SaaS route  
   **When** the request is handled via the shared router/query stack  
   **Then** the request uses the tenant-scoped database client attached by middleware  
   **And** the effective query scope is bound to the authenticated tenant context  
   **And** developers cannot accidentally bypass tenant scoping by falling back to the global DB client on org routes

2. **Given** a user with `org_id=A` and `org_slug=org-a` makes a request  
   **When** the request handler queries cinema or schedule data through `/api/org/:slug/*`  
   **Then** all reads execute in org A context  
   **And** cross-tenant access attempts are rejected with a stable `403` contract before data is returned  
   **And** no org B data is returned to the caller

3. **Given** a database change introduces a shared `public` table that stores multi-tenant rows in this area  
   **When** that table is queried via the API  
   **Then** the implementation includes explicit tenant filtering by authenticated org context  
   **And** the migration defines `org_id` as `NOT NULL`  
   **And** the migration defines an index on `org_id` for performance

## Tasks / Subtasks

- [x] Add RED integration coverage for tenant-scoped DB injection and route isolation invariants (AC: 1, 2)
  - [x] Extend `packages/saas/src/middleware/tenant.test.ts` to assert `resolveTenant()` sets `SET search_path TO "<org_schema>", public` and attaches `req.dbClient` for active orgs
  - [x] Extend `server/src/utils/db-from-request.test.ts` to lock the invariant that org-scoped requests always use `req.dbClient` and never silently fall back to `req.app.get('db')`
  - [x] Add or extend `packages/saas/src/routes/org.test.ts` assertions that org-scoped cinema reads use the scoped client, not the global DB, for both list and schedule-detail requests
  - [x] Keep tests focused on the current architecture: tenant schema isolation via `search_path` plus boundary checks, not a fictional ORM auto-filter layer

- [x] Lock cross-tenant denial behavior for org-scoped cinema and schedule reads (AC: 2)
  - [x] Extend `server/src/routes/cinemas.test.ts` to cover org-mismatch denial on both `/api/org/:slug/cinemas` and `/api/org/:slug/cinemas/:id`
  - [x] Preserve the stable `403` contract from Story 1.1: response error `Cross-tenant access denied` when `?org_id=` conflicts with JWT org context
  - [x] Extend `packages/saas/src/routes/org.test.ts` to keep `requireOrgAuth` denial stable when JWT `org_slug` does not match route `:slug`
  - [x] Add a regression assertion that denied cross-tenant requests do not call the downstream shared query/service path

- [x] Validate that shared routers remain tenant-safe under SaaS mounting (AC: 1, 2)
  - [x] Add a focused test proving `/api/org/:slug/cinemas` and `/api/org/:slug/cinemas/:id` reuse `server/src/routes/cinemas.ts` safely through `getDbFromRequest()`
  - [x] Assert the shared cinema route chain still includes org-aware auth/permission wrappers plus `enforceOrgBoundary`
  - [x] Verify no org-scoped request path can bypass `resolveTenant` and hit the global shared DB client during normal routing
  - [x] Keep standalone `/api/cinemas*` behavior unchanged; this story is about SaaS org routes only

- [x] Codify query-level expectations at the right abstraction layer (AC: 1, 2, 3)
  - [x] Do not add brittle SQL-string tests for `WHERE org_id = ...` against tenant-schema tables such as `cinemas` or `showtimes`; those tables are isolated by schema selection, not by shared-row filtering
  - [x] Where the app still uses shared/public multi-tenant tables, document and test explicit `org_id` filtering only if this story touches those code paths
  - [x] If no new shared/public org-row table is introduced by the implementation, do not create an artificial migration solely to satisfy AC 3
  - [x] If implementation does introduce a new shared/public org-row table, add migration and migration/inventory tests for `org_id NOT NULL` plus `org_id` indexing

- [x] Keep observability and security behavior aligned with Epic 1 patterns (AC: 2)
  - [x] Preserve the structured tenant-boundary logging contract established in Story 1.1 when requests are denied before handler execution
  - [x] Reuse existing error messages and auth semantics rather than introducing alternate denial wording such as `404` or HTML error pages
  - [x] Keep TypeScript strict typing in auth and tenant middleware paths; avoid `any` in org-sensitive assertions or helpers

- [x] Update documentation only if behavior or contribution guidance materially changes (AC: 1, 2, 3)
  - [x] Update `docs/guides/development/testing.md` only if the new tests introduce a workflow other contributors must follow
  - [x] Update `README.md` or `AGENTS.md` only if the story changes externally visible tenant-isolation behavior or introduces a new migration rule

## Dev Notes

### Scope and Guardrails

- This story is an integration-test hardening story for tenant isolation behavior already implemented across Stories 1.1-1.5.
- The real isolation model in this codebase is not a generic ORM middleware that injects `WHERE org_id = :authenticated_org_id` into every query.
- In SaaS org routes, isolation is primarily enforced by `resolveTenant()` setting PostgreSQL `search_path` to the tenant schema, `getDbFromRequest()` returning `req.dbClient`, and `requireOrgAuth` / `enforceOrgBoundary` rejecting mismatched tenant access before data reaches the caller.
- Keep the implementation minimal and test-focused. Do not redesign the tenant architecture, introduce a new ORM abstraction, or refactor all query helpers.

### Reinvention Prevention

- Reuse existing tenant-isolation coverage and helper seams before creating new abstractions:
  - `packages/saas/src/middleware/tenant.ts`
  - `packages/saas/src/middleware/tenant.test.ts`
  - `server/src/utils/db-from-request.ts`
  - `server/src/utils/db-from-request.test.ts`
  - `server/src/middleware/org-boundary.ts`
  - `server/src/routes/cinemas.ts`
  - `server/src/routes/cinemas.test.ts`
  - `server/src/routes/cinemas.security.test.ts`
  - `packages/saas/src/routes/org.ts`
  - `packages/saas/src/routes/org.test.ts`
- Do not invent a second tenant-scoping helper if `getDbFromRequest()` already covers the required shared-router behavior.
- Do not add fake `org_id` columns to tenant-schema tables like `cinemas` or `showtimes`; those tables are already isolated by schema and `search_path`.

### Previous Story Intelligence (from 1.1, 1.4, and 1.5)

- Story 1.1 already established the stable cross-tenant denial contract `Cross-tenant access denied` and wired `enforceOrgBoundary` into cinema read/write paths. Reuse that contract instead of introducing a new error shape. [Source: `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md:13-29`, `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md:91-105`]
- Story 1.4 showed that tenant schema scoping can otherwise collapse forbidden access into `404`; tests should keep the explicit `403` contract where acceptance criteria require it. [Source: `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md:74-79`, `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md:121-123`]
- Story 1.5 verified that the tenant cinema schedule path is the real shared route `/api/org/:slug/cinemas/:id`, and that JSON `403` handling matters for plugin-mounted org routes. Reuse those route and denial assumptions instead of inventing a new schedule endpoint. [Source: `_bmad-output/implementation-artifacts/1-5-e2e-multi-tenant-schedule-isolation-test.md:47-52`, `_bmad-output/implementation-artifacts/1-5-e2e-multi-tenant-schedule-isolation-test.md:116-118`, `_bmad-output/implementation-artifacts/1-5-e2e-multi-tenant-schedule-isolation-test.md:193-196`]

### Architecture Compliance Notes

- `resolveTenant()` is the primary tenant-isolation entry point for SaaS org routes. It resolves the org by slug, rejects inactive orgs, runs `SET search_path TO "<org_schema>", public`, and attaches both `req.org` and `req.dbClient`. [Source: `packages/saas/src/middleware/tenant.ts:20-65`]
- `getDbFromRequest()` is the critical shared-router seam: it returns `req.dbClient` when present, otherwise the global app DB. Shared routes mounted under `/api/org/:slug/*` rely on this helper to stay tenant-safe without being duplicated. [Source: `server/src/utils/db-from-request.ts:4-15`]
- `createOrgRouter()` mounts shared server routers beneath `/api/org/:slug/*` after `resolveTenant`, `optionalAuth`, and `requireOrgAuth`, so route-level safety depends on preserving that middleware order and scoped DB injection. [Source: `packages/saas/src/routes/org.ts:1-10`, `packages/saas/src/routes/org.ts:73-111`]
- `server/src/routes/cinemas.ts` already uses `getDbFromRequest()` and `enforceOrgBoundary()` on both list and detail GET routes; this story should harden tests around that behavior, not replace it. [Source: `server/src/routes/cinemas.ts:36-52`, `server/src/routes/cinemas.ts:146-165`]
- The actual cinema and showtime query helpers do not filter on `org_id`; they query tenant-local tables such as `cinemas` and `showtimes` directly. This is correct under tenant schema isolation and is the reason AC interpretation must remain architecture-aware. [Source: `server/src/db/cinema-queries.ts:15-29`, `server/src/db/showtime-queries.ts:253-321`]

### Query-Level Interpretation for This Story

- Treat “API-level tenant isolation enforcement” in this repo as the combination of:
  - tenant resolution to the correct organization,
  - schema scoping via `SET search_path`,
  - shared route reuse through `req.dbClient`, and
  - explicit cross-tenant rejection for mismatched JWT org context.
- Do not write misleading tests that assert every cinema/showtime SQL statement must contain `WHERE org_id = ...`; that is not how this brownfield architecture isolates tenant data.
- For truly shared/public multi-tenant tables, explicit `org_id` filtering remains required. Only add those tests if this story actually touches such a table.

### LLM-Dev Implementation Strategy

1. RED: add failing tests that prove org-scoped requests use `req.dbClient`, keep `search_path` tenant-scoped, and reject cross-tenant route/JWT mismatches with `403`.
2. GREEN: make only the smallest fixes required to preserve the current tenant-scoping architecture under test.
3. HARDEN: add regression assertions ensuring denied requests do not hit downstream query/service calls and that scoped client usage remains explicit.
4. VERIFY: run targeted server and `packages/saas` Vitest suites; only add broader docs changes if contributor workflow changes.

### Suggested Test Matrix

- `resolveTenant()` active org -> attaches `req.org`, attaches `req.dbClient`, executes `SET search_path`, releases client once.
- `getDbFromRequest()` with `req.dbClient` -> returns scoped client and never touches `req.app.get('db')`.
- `/api/org/acme/cinemas` with org A JWT -> reads through scoped client and returns org A data only.
- `/api/org/org-b/cinemas` or `/api/org/org-b/cinemas/:id` with org A JWT or conflicting `?org_id=` -> `403` with stable error contract, no downstream query call.
- Shared-router regression -> standalone `/api/cinemas*` behavior unchanged.
- Migration guard -> only if new shared/public org-row table is introduced, verify `org_id NOT NULL` and `org_id` index.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/1-6-api-level-tenant-isolation-enforcement-tests.md`
- `packages/saas/src/middleware/tenant.test.ts`
- `server/src/utils/db-from-request.test.ts`
- `packages/saas/src/routes/org.test.ts`
- `server/src/routes/cinemas.test.ts`
- `server/src/routes/cinemas.security.test.ts`
- `docs/guides/development/testing.md` (only if contributor workflow changes)
- `migrations/*.sql` and `server/src/db/system-queries.test.ts` only if a new shared/public org-row table is introduced

### Git Intelligence Summary

- Recent commits show the team is still actively hardening tenant schedule isolation and fixture/runtime safety, so keep this story tightly aligned with the current SaaS isolation architecture rather than reopening it. [Source: `git log -5 --oneline` -> `2920397`, `67dfc51`, `47e24d5`, `cb9375f`, `9747fff`]
- The most recent merged work focused on schedule isolation, fixture runtime restrictions, and tenant-scoped client queries; that strongly suggests Story 1.6 should be a low-surface regression/contract story, not a new feature slice.

### Pitfalls to Avoid

- Do not assert a nonexistent ORM/middleware feature that auto-injects `WHERE org_id` into tenant-schema table queries.
- Do not create a synthetic migration or dummy table just to “check the box” for AC 3.
- Do not weaken the existing `403` contracts by letting cross-tenant cases regress to `404` or Express HTML responses.
- Do not refactor shared routers away from `getDbFromRequest()` unless a test proves a real flaw.
- Do not change standalone route behavior while hardening SaaS org-scoped guarantees.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:614-638`
- Planning notes for story 1.6: `_bmad-output/planning-artifacts/notes-epics-stories.md:103-108`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:66`
- Readiness dependency note: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:636-638`
- Story 1.1 context: `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md:13-29`
- Story 1.4 context: `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md:115-123`
- Story 1.5 context: `_bmad-output/implementation-artifacts/1-5-e2e-multi-tenant-schedule-isolation-test.md:110-118`
- Tenant resolution middleware: `packages/saas/src/middleware/tenant.ts:20-65`
- Tenant middleware tests: `packages/saas/src/middleware/tenant.test.ts:47-173`
- Shared DB injection helper: `server/src/utils/db-from-request.ts:4-15`
- Shared DB injection tests: `server/src/utils/db-from-request.test.ts:9-38`
- Org router composition: `packages/saas/src/routes/org.ts:1-10`, `packages/saas/src/routes/org.ts:73-111`
- Org router tests: `packages/saas/src/routes/org.test.ts:247-274`
- Cinema route boundary enforcement: `server/src/routes/cinemas.ts:36-52`, `server/src/routes/cinemas.ts:146-165`
- Cinema route tests: `server/src/routes/cinemas.test.ts:109-138`, `server/src/routes/cinemas.test.ts:230-241`
- Cinema route security tests: `server/src/routes/cinemas.security.test.ts:108-142`
- Tenant boundary middleware: `server/src/middleware/org-boundary.ts:36-67`
- Auth request tenant fields: `server/src/middleware/auth.ts:9-20`, `server/src/middleware/auth.ts:23-84`
- Cinema queries: `server/src/db/cinema-queries.ts:15-29`
- Showtime queries: `server/src/db/showtime-queries.ts:253-321`
- Testing guide: `docs/guides/development/testing.md:179-220`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 1.6 after user confirmed story 1.5 is already merged
- `git log -5 --oneline`
- Artifact review: `epics.md`, `notes-epics-stories.md`, `implementation-readiness-report-2026-04-15.md`, stories `1-1`, `1-4`, `1-5`
- `gh issue create --title "test(saas): add API-level tenant isolation enforcement tests" ...` -> created issue `#900`
- `git checkout -b test/900-api-level-tenant-isolation-tests`
- `npm run test:run --workspace=server -- src/utils/db-from-request.test.ts`
- `npm run test:run --workspace=@allo-scrapper/saas -- src/middleware/tenant.test.ts src/routes/org.test.ts`
- `npm run test:run --workspace=server -- src/routes/cinemas.test.ts src/routes/cinemas.security.test.ts src/utils/db-from-request.test.ts`
- `npm run test:run --workspace=@allo-scrapper/saas -- src/middleware/tenant.test.ts src/routes/org.test.ts`

### Completion Notes List

- Story file created with architecture-aware guidance that matches the actual tenant isolation model used by the repo.
- Clarified that SaaS tenant isolation for cinemas/showtimes is schema-based (`search_path`) plus boundary middleware, not universal `WHERE org_id` injection.
- Added explicit guardrails to avoid writing false-positive SQL-string tests or synthetic migrations.
- Pointed implementation toward the highest-value existing regression seams: `resolveTenant`, `getDbFromRequest`, shared cinema routes, and org router tests.
- Added regression coverage proving `resolveTenant()` attaches the scoped DB client and executes the expected `SET search_path` command for active org requests.
- Added helper coverage proving org-scoped requests prefer `req.dbClient` over the global app DB client.
- Added org-router coverage proving cinema schedule detail requests under `/api/org/:slug/cinemas/:id` use the scoped tenant DB client and leave the global DB untouched.
- Added explicit denial-path regression assertions proving cross-tenant `403` responses stop before downstream cinema query execution in both shared-route and org-router test seams.
- Re-ran targeted server and SaaS tenant-isolation suites; all tests passed without requiring production-code changes.

### File List

- `_bmad-output/implementation-artifacts/1-6-api-level-tenant-isolation-enforcement-tests.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/saas/src/middleware/tenant.test.ts`
- `packages/saas/src/routes/org.test.ts`
- `server/src/routes/cinemas.test.ts`
- `server/src/utils/db-from-request.test.ts`

## Change Log

- 2026-04-21: Created implementation-ready story file for API-level tenant isolation enforcement tests with architecture-correct guardrails around tenant schema scoping, shared DB injection, and cross-tenant `403` contracts.
- 2026-04-21: Implemented story 1.6 by adding tenant-isolation regression coverage for `resolveTenant`, `getDbFromRequest`, and org-scoped cinema detail routing; no production-code changes were required because the architecture already satisfied the story invariants.
- 2026-04-21: Addressed code-review follow-up by adding explicit denial-path assertions that cross-tenant cinema requests stop before downstream query execution.
