# Story 0.2: Implement Multi-Tenant Test Fixture API

Status: done

## Story

As a QA engineer,
I want a test fixture API to seed and cleanup multi-tenant organizations,
so that I can write cross-tenant isolation tests without manual database setup.

## Acceptance Criteria

1. **Given** the server is running in test mode  
   **When** I call `POST /test/seed-org` with organization data  
   **Then** a new organization is created with isolated test data (users, cinemas, schedules)  
   **And** the API returns the `org_id` and admin user credentials  
   **And** the organization includes at least 2 test users, 3 test cinemas, and 10 test schedules

2. **Given** a test organization exists  
   **When** I call `DELETE /test/cleanup-org/:id`  
   **Then** all org-scoped data is removed (users, cinemas, schedules, settings)  
   **And** no orphaned data remains in the database  
   **And** the operation completes in <500ms

3. **Given** the application is in production mode  
   **When** I attempt to call `/test/seed-org`  
   **Then** the endpoint returns `404 Not Found`  
   **And** no test data can be created in production

4. **Given** Playwright runs with `workers: 4`  
   **When** 4 tests call `POST /test/seed-org` simultaneously  
   **Then** 4 organizations are created without conflicts  
   **And** each organization has unique `org_id`, usernames, and cinema names  
   **And** no database deadlocks or constraint violations occur  
   **And** each seed operation completes in <500ms

5. **Given** multiple tests are running in parallel  
   **When** each test calls `DELETE /test/cleanup-org/:id`  
   **Then** only the specified `org_id` data is deleted  
   **And** other parallel tests' data remains intact  
   **And** cleanup completes in <200ms per organization

6. **Given** the fixture API is implemented  
   **When** a developer reads the documentation  
   **Then** documentation includes endpoint signatures, request/response examples, cleanup strategy, parallel safety guarantees, and troubleshooting notes

## Tasks / Subtasks

- [x] Add RED tests for fixture endpoints and constraints (AC: 1, 2, 3, 4, 5)
  - [x] Add integration tests under `packages/saas/src/routes/` for `POST /test/seed-org` and `DELETE /test/cleanup-org/:id`
  - [x] Add assertions for minimum seeded data shape (>=2 users, >=3 cinemas, >=10 schedules)
  - [x] Add test-mode guard assertions (`NODE_ENV=production` or non-test runtime => endpoint unavailable/404)
  - [x] Add parallel safety assertions using unique slugs and concurrent requests (`Promise.all`)
  - [x] Add cleanup idempotency assertion (`404`/safe skip for already-deleted org)

- [x] Implement test fixture route module in SaaS package (AC: 1, 2, 3)
  - [x] Create `packages/saas/src/routes/test-fixtures.ts`
  - [x] Implement `POST /test/seed-org` using existing org creation/auth building blocks
  - [x] Implement `DELETE /test/cleanup-org/:id` with strict org-id scoped delete
  - [x] Ensure all SQL is parameterized and wrapped in transactions where needed
  - [x] Ensure responses are deterministic and include fields expected by Playwright fixture (`org_id`, `org_slug`, `schema_name`, `admin`)

- [x] Wire route mounting and runtime guardrails (AC: 3)
  - [x] Mount fixture routes only when safe runtime flag is true (default: only `NODE_ENV === "test"`)
  - [x] In non-test runtimes, add explicit deny route for `/test/*` returning `404` (do not rely on implicit unmounted behavior)
  - [x] Add regression test covering production fallback path (`registerFallbackHandlers`) to ensure `/test/seed-org` does not return SPA `index.html`
  - [x] Keep route path unprefixed (`/test/*`) to match current Playwright fixture usage

- [x] Seed realistic tenant-scoped test data (AC: 1, 4)
  - [x] Reuse org bootstrap flow (`public.organizations` + tenant schema setup)
  - [x] Insert deterministic baseline records for users/cinemas/schedules in the tenant schema
  - [x] Generate worker-safe uniqueness in slug/usernames/cinema IDs to prevent collisions in parallel runs
  - [x] Return seeded admin credentials suitable for E2E login flow

- [x] Implement safe cleanup flow with orphan prevention (AC: 2, 5)
  - [x] Delete by org identifier with cascade-safe ordering
  - [x] Ensure both public-level and tenant-schema data are removed
  - [x] Verify org no longer exists in `public.organizations` after cleanup
  - [x] Ensure no broad "delete all test orgs" behavior in endpoint scope

- [x] Add structured security and diagnostics logging (AC: 2, 4, 5)
  - [x] Log seed/cleanup success/failure with `org_id`, `org_slug`, duration, and caller metadata
  - [x] Log collision/conflict and DB exceptions with actionable context
  - [x] Keep logs concise and JSON-structured for CI debugging

- [x] Update documentation (AC: 6)
  - [x] Update `docs/guides/development/testing.md` with fixture endpoint contract and examples
  - [x] Add README pointer to fixture API section for contributors
  - [x] Document troubleshooting: Docker/DB connectivity, duplicate slug conflicts, cleanup retries

### Review Findings

- [x] [Review][Patch] Ensure tenant `search_path` is always restored on error paths in fixture seeding [`packages/saas/src/routes/test-fixtures.ts:61`]
- [x] [Review][Patch] Replace hardcoded `seeded` counts with derived insert/count results to avoid false-positive success payloads [`packages/saas/src/routes/test-fixtures.ts:171`]
- [x] [Review][Patch] Restrict destructive cleanup to fixture organizations only before `DROP SCHEMA ... CASCADE` (e.g., slug/prefix guard) [`packages/saas/src/routes/test-fixtures.ts:201`]
- [x] [Review][Patch] Extend concurrency tests to assert AC4/AC5 fully (admin/cinema uniqueness + parallel cleanup isolation) [`packages/saas/src/routes/test-fixtures.test.ts:88`]
- [x] [Review][Patch] Replace mocked-plugin production fallback assertion with a regression path that validates real `/test/*` gating behavior [`server/src/app.test.ts:14`]
- [x] [Review][Defer] `getSaasMigrationDir()` runtime branch can resolve wrong path for non-production built environments [`packages/saas/src/plugin.ts:89`] — deferred, pre-existing

## Dev Notes

### Epic Context and Dependencies

- Epic 0 is a technical blocker; this story unblocks all Epic 1 isolation tests.
- Story 0.1 is done (parallel Playwright enabled) and validates we must be safe with concurrent fixture calls.
- Story 0.4 currently relies on these endpoints from `e2e/fixtures/org-fixture.ts`; implementing 0.2 finalizes that contract.

### Existing Code Intelligence (Reuse, Do Not Reinvent)

- **SaaS plugin load path:** `server/src/index.ts` dynamically imports `@allo-scrapper/saas` when `SAAS_ENABLED=true`.
- **Route mount location:** `packages/saas/src/plugin.ts` is the correct place to mount a new fixture router.
- **Org creation primitives:** reuse `createOrg()` from `packages/saas/src/services/org-service.ts` and schema helpers from `packages/saas/src/db/org-queries.ts`.
- **Tenant route precedent:** `packages/saas/src/routes/org.ts` demonstrates scoped DB client usage and middleware expectations.
- **Current E2E contract already in use:** `e2e/fixtures/org-fixture.ts` expects:
  - `POST /test/seed-org` response payload with `data.org_id`, `data.org_slug`, `data.schema_name`, `data.admin`
  - `DELETE /test/cleanup-org/:id` as cleanup endpoint.

### Implementation Guardrails

- Keep all implementation in SaaS package + plugin registration to avoid leaking test-only behavior into standalone core routes.
- Never mount fixture endpoints in production. Unmounted route is required to satisfy 404 acceptance criteria.
- In production, unmounted `/test/*` may be swallowed by SPA fallback and return `200` HTML. Add explicit `/test/*` deny handler outside test mode to enforce `404`.
- Keep strict TypeScript typing (no `any`) for request/response payloads and DB interactions.
- Keep cleanup org-scoped; do not use dangerous wildcard deletion patterns.
- Keep endpoint behavior deterministic for Playwright retries and parallel worker stability.

### Suggested Endpoint Contracts

- `POST /test/seed-org`
  - Request (suggested): `{ slug?: string; name?: string; adminEmail?: string; adminPassword?: string }`
  - Behavior: creates a test org + seeds baseline users/cinemas/schedules.
  - Response (required shape):
    - `data.org_id: number`
    - `data.org_slug: string`
    - `data.schema_name: string`
    - `data.admin: { id: number; username: string; password: string }`

- `DELETE /test/cleanup-org/:id`
  - Request param: org id (integer)
  - Behavior: removes only that org's scoped data and parent org record.
  - Include tenant schema cleanup (`DROP SCHEMA ... CASCADE` for target org schema) within transaction-safe flow.
  - Response: success boolean + deletion summary metadata.

### Test Design Requirements

- Integration tests must cover:
  - test-mode only exposure
  - minimum seeded entity counts
  - parallel seed/cleanup safety
  - cleanup orphan prevention
  - response schema expected by Playwright fixture utilities
- Performance assertions:
  - seed path under 500ms target (per org)
  - cleanup path under 200ms target (per org)
  - use CI-tolerant thresholds and capture timing diagnostics.

### Git Intelligence Summary

- Recent work already established org-fixture and auto-cleanup utilities; this story should complete that missing backend API contract rather than introducing a second fixture mechanism.
- Keep naming and structure aligned with recent E2E utility additions in `e2e/fixtures/`.

### Project Context Reference

- Follow strict TS and security rules from `_bmad-output/project-context.md`:
  - strict mode, no `any` in security-sensitive flows
  - structured logging only (no `console.log` in production paths)
  - ESM import patterns
  - RED -> GREEN mandatory commit sequencing

### References

- Story source: `_bmad-output/planning-artifacts/epics.md`
- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Previous story context: `_bmad-output/implementation-artifacts/0-1-enable-playwright-parallel-execution.md`
- Existing fixture consumer: `e2e/fixtures/org-fixture.ts`
- Cleanup utility context: `e2e/fixtures/org-cleanup.ts`
- SaaS plugin mount point: `packages/saas/src/plugin.ts`
- Org service primitives: `packages/saas/src/services/org-service.ts`
- QA dependency source: `_bmad-output/test-artifacts/test-design/test-design-qa.md`
- Architecture blocker source: `_bmad-output/test-artifacts/test-design/test-design-architecture.md`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 0.2 using sprint tracker + epics + existing fixture/runtime analysis

### Completion Notes List

- Implemented test-only fixture router with `POST /test/seed-org` and `DELETE /test/cleanup-org/:id`.
- Mounted `/test` routes conditionally in SaaS plugin (`NODE_ENV=test`) and explicit 404 deny router otherwise.
- Added regression test ensuring `/test/*` does not fall through to production SPA fallback.
- Added seeded tenant fixture data generation (2 users, 3 cinemas, 10 showtimes) and deterministic response payload for Playwright fixtures.
- Added cleanup flow that drops tenant schema and deletes organization in transaction.
- Updated testing docs and README with fixture API usage and troubleshooting.
- Verified by running `npm run test:run --workspace=@allo-scrapper/saas -- src/routes/test-fixtures.test.ts` and `npm run test:run --workspace=allo-scrapper-server -- src/app.test.ts`.

### File List

- `packages/saas/src/routes/test-fixtures.ts`
- `packages/saas/src/routes/test-fixtures.test.ts`
- `packages/saas/src/plugin.ts`
- `server/src/app.test.ts`
- `docs/guides/development/testing.md`
- `README.md`
- `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md`
