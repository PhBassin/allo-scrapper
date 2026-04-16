# Story 0.2: Implement Multi-Tenant Test Fixture API

Status: done

## Story

As a QA engineer,
I want a test fixture API to seed and cleanup multi-tenant organizations,
so that I can write cross-tenant isolation tests without manual database setup.

## Acceptance Criteria

1. **Given** the server is running in test mode  
   **When** I call `POST /test/seed-org` with organization data  
   **Then** a new organization is created with isolated test data (users, cinemas, showtimes)  
   **And** the API returns the `org_id` and admin user credentials  
   **And** the organization includes at least 2 test users, 3 test cinemas, and 10 test schedules

2. **Given** a test organization exists  
   **When** I call `DELETE /test/cleanup-org/:id`  
   **Then** all org-scoped data is removed (users, cinemas, showtimes, settings)  
   **And** no orphaned data remains in the database  
   **And** the operation completes in <500ms

3. **Given** the application is in production mode  
   **When** I attempt to call `/test/seed-org`  
   **Then** the endpoint returns 404 Not Found  
   **And** no test data can be created in production

4. **Given** Playwright runs with `workers: 4`  
   **When** 4 tests call `/test/seed-org` simultaneously  
   **Then** 4 organizations are created without conflicts  
   **And** each organization has unique `org_id`, usernames, and cinema names  
   **And** no database deadlocks or constraint violations occur  
   **And** each seed operation completes in <500ms

5. **Given** multiple tests are running in parallel  
   **When** each test calls `/test/cleanup-org/:id`  
   **Then** only the specified org data is deleted  
   **And** other parallel tests' data remains intact  
   **And** cleanup completes in <200ms per organization

6. **Given** the fixture API is implemented  
   **When** a developer reads the documentation  
   **Then** docs include endpoint signatures, request/response examples, cleanup strategy, parallel-safety guarantees, and troubleshooting guidance.

## Tasks / Subtasks

- [ ] Add test-only fixture routes and guards (AC: 1, 2, 3)
  - [ ] Create a dedicated router at `packages/saas/src/routes/test-fixtures.ts`
  - [ ] Mount it from SaaS plugin only when `NODE_ENV === 'test'`
  - [ ] Expose canonical endpoints as `/test/seed-org` and `/test/cleanup-org/:id` (optionally mirror `/api/test/*` only if needed by existing tooling)
  - [ ] Ensure routes are **not registered** outside test mode (404 behavior by absence)

- [ ] Implement `POST /test/seed-org` fixture flow (AC: 1, 4)
  - [ ] Validate input payload (`slug` optional; generate unique fallback)
  - [ ] Create org via existing SaaS org provisioning service (`createOrg`)
  - [ ] Create an admin user and at least one additional user in tenant schema
  - [ ] Use a dedicated `pool.connect()` client + explicit `SET search_path TO "org_<slug>", public` for fixture inserts (do not assume tenant middleware)
  - [ ] Seed >=3 cinemas and >=10 showtimes (seed minimal films first to satisfy FK constraints)
  - [ ] Ensure collision-proof data (`<base>-w<worker>-t<timestamp>-r<rand>`) for usernames/cinema IDs/showtime IDs
  - [ ] Return stable response contract with `org_id`, `org_slug`, `schema_name`, `seeded_counts`, and admin credentials

- [ ] Implement `DELETE /test/cleanup-org/:id` cleanup flow (AC: 2, 5)
  - [ ] Resolve org by id in `public.organizations`
  - [ ] In one transaction: lock/fetch org row (`schema_name`), delete org record, then `DROP SCHEMA IF EXISTS "<schema_name>" CASCADE`
  - [ ] Do not rely only on FK cascade; explicitly remove tenant schema objects
  - [ ] Return summary payload (`deleted`, `org_id`, timing)

- [ ] Add concurrency and safety tests first (RED), then implementation (GREEN) (AC: 1-5)
  - [ ] Add Vitest API integration tests in `packages/saas/src/routes/test-fixtures.test.ts`
  - [ ] Add a parallel creation test using `Promise.all` for 4 seed calls
  - [ ] Add a parallel cleanup isolation test
  - [ ] Add production-mode negative test (route unavailable)

- [ ] Add performance assertions and observability hooks (AC: 2, 4, 5)
  - [ ] Measure operation duration with explicit timers in tests
  - [ ] Assert `<500ms` seed and `<200ms` cleanup targets in CI-tolerant way (with bounded jitter allowance)
  - [ ] Emit structured logs for seed/cleanup with org id and duration

- [ ] Add fallback cleanup for failed tests (AC: 2, 5)
  - [ ] Track created org ids in test scope
  - [ ] Run safety cleanup in `afterAll` for any orphaned orgs

- [ ] Documentation updates (AC: 6)
  - [ ] Update `README.md` test section with fixture endpoint usage
  - [ ] Add examples used by Playwright workers
  - [ ] Add troubleshooting notes for orphaned data and duplicate slug collisions

### Review Findings

- [x] [Review][Decision] Scope drift in `org` routes vs Story 0.2 intent — Decision: keep the `org.ts` changes in this story scope.
- [x] [Review][Patch] Cleanup flow now uses a dedicated pool client for a single transaction [packages/saas/src/routes/test-fixtures.ts:145]
- [x] [Review][Patch] `/api/test/*` compatibility alias validated by route tests [packages/saas/src/routes/test-fixtures.test.ts:79]
- [x] [Review][Patch] Added non-test mount-behavior 404 test (route not mounted) [packages/saas/src/routes/test-fixtures.test.ts:109]
- [x] [Review][Patch] Added fallback orphan cleanup tracking scaffold in tests (`afterAll`) [packages/saas/src/routes/test-fixtures.test.ts:13]
- [x] [Review][Patch] README updated with fixture endpoint usage [README.md:801]
- [x] [Review][Patch] Removed duplicate `protectedLimiter` on `/org/:slug/scraper/trigger` path [packages/saas/src/routes/org.ts:136]

## Dev Notes

### Scope and Architecture Guardrails

- This story is SaaS-scoped. Implement fixture endpoints in `packages/saas`, not in `server/src/routes`.
- The server already loads SaaS routes conditionally from plugin registration; reuse this extension point.
- Core app mounts generic `/api/*` routes first, then plugin routes; keep fixture path explicit and test-only.
- Use existing org provisioning primitives instead of re-implementing org/schema bootstrap logic.

### Existing Reusable Building Blocks (Do Not Reinvent)

- `createOrg(...)` already creates org record + schema + bootstrap tables in one transaction.
- `SaasAuthService.createAdminUser(...)` already creates tenant admin with proper hashing.
- Tenant schema bootstrap already provides `roles`, `users`, `org_settings` and defaults.
- SaaS plugin already mounts routes under `/api` and can mount another router.

### Reuse vs New Code

- Reuse: `createOrg`, `SaasAuthService.createAdminUser`, org bootstrap SQL, plugin mount pattern.
- New: test-fixture router, fixture-specific seeding helper, fixture cleanup helper, route tests.

### Suggested Endpoint Contract

- `POST /test/seed-org`
  - Request example:
    ```json
    {
      "slug": "test-org-001",
      "name": "Test Org 001",
      "adminEmail": "admin+001@test.local",
      "adminPassword": "P@ssw0rd-Seed-001",
      "seed": {
        "users": 2,
        "cinemas": 3,
        "showtimes": 10
      }
    }
    ```
  - Response example:
    ```json
    {
      "success": true,
      "data": {
        "org_id": 123,
        "org_slug": "test-org-001",
        "schema_name": "org_test_org_001",
        "admin": {
          "id": 1,
          "username": "admin+001@test.local",
          "password": "P@ssw0rd-Seed-001"
        },
        "seeded_counts": {
          "users": 2,
          "cinemas": 3,
          "showtimes": 10
        },
        "duration_ms": 214
      }
    }
    ```

- `DELETE /test/cleanup-org/:id`
  - Response example:
    ```json
    {
      "success": true,
      "data": {
        "org_id": 123,
        "deleted": true,
        "duration_ms": 87
      }
    }
    ```

### Security and Environment Rules

- Fixture routes must be unavailable in production by design (not just blocked in handler).
- Add a runtime defense-in-depth check in handler as well (`if NODE_ENV !== 'test' -> 404`).
- Do not expose fixture credentials in non-test logs.
- Keep JWT and auth requirements unchanged for existing routes; this story adds separate fixture routes.
- If `/api/test/*` alias is added, keep behavior identical and test both paths once.

### Data Model Constraints Relevant to Seeding

- Organizations live in `public.organizations` with `schema_name = org_<slug>`.
- Tenant tables are created by org schema bootstrap SQL.
- `org_settings` row `id=1` is auto-seeded in each tenant schema.
- Role ids are seeded with `admin/editor/viewer`; admin creation can assume role_id=1.
- Showtimes require valid `film_id` and `cinema_id`; seed films/cinemas before showtimes.
- There is no dedicated tenant `scrape_schedules` table in current bootstrap; use cinema/film/showtime fixtures for this story.

### Testing Strategy

- Package focus: `packages/saas` tests (not server-only route tests).
- Prefer integration tests with Express app + mounted `saasPlugin` in test mode.
- Use unique slug/name/email generators to avoid cross-test collisions in parallel workers.
- Add deterministic cleanup in `afterEach`/`afterAll` to delete any created orgs if a test fails mid-run.
- Verify route absence in non-test mode returns 404 by mount behavior (not just handler branch).

### Previous Story Intelligence (0.1)

- Parallel execution is now enabled in Playwright; new fixtures must be explicitly race-safe.
- Prior review found hidden race/conflict risks around shared mutable state; avoid globals in seed/cleanup logic.
- Benchmark-driven acceptance was required in 0.1; do the same here for seed/cleanup timings.

### Git Intelligence Summary

- Recent commits show focus on E2E parallel reliability and isolation (`feat(e2e)` + `fix(e2e)` chain).
- Current branch history indicates this story should preserve that trajectory: deterministic fixtures + collision-proof naming.

### Project Structure Notes

- Add code under `packages/saas/src/routes/` and `packages/saas/src/services/` if helper extraction is needed.
- Keep shared server routes untouched unless a narrow utility extraction is genuinely needed.
- If database helper additions are needed, place them in `packages/saas/src/db/` with typed interfaces.

### Implementation Order (Mandatory)

1. RED: add failing tests for seed, cleanup, non-test 404, and parallel safety.
2. GREEN: implement minimal fixture router + seeding/cleanup helpers to satisfy tests.
3. HARDEN: add timing assertions/logs and concurrency collision-proof generators.
4. DOCS: update README test docs with endpoint examples and troubleshooting.

### References

- Story definition and ACs: `_bmad-output/planning-artifacts/epics.md:329`
- Epic 0 status and ordering: `_bmad-output/implementation-artifacts/sprint-status.yaml:49`
- Previous story learnings: `_bmad-output/implementation-artifacts/0-1-enable-playwright-parallel-execution.md:87`
- SaaS plugin mounting: `packages/saas/src/plugin.ts:50`
- Org creation service: `packages/saas/src/services/org-service.ts:57`
- Admin creation in tenant schema: `packages/saas/src/services/saas-auth-service.ts:32`
- Tenant bootstrap tables: `packages/saas/migrations/org_schema/000_bootstrap.sql:5`
- Org route + tenant middleware pattern: `packages/saas/src/routes/org.ts:65`
- Core route mount order and API fallback: `server/src/app.ts:127`
- Project rules and versions: `_bmad-output/project-context.md:17`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- Create-story execution in this session (artifact discovery + sprint-status routing)

### Completion Notes List

- Story file created from Epic 0.2 with implementation guardrails.
- Reuse constraints documented to prevent reinvention and wrong file placement.
- Concurrency, security, and test-mode-only requirements made explicit.

### File List

- `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md`
