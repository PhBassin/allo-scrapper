# Story 1.4: E2E Multi-Tenant User Management Isolation Test

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that validate user data isolation between organizations,
so that admins cannot view or edit users from other organizations.

## Acceptance Criteria

1. **Given** organization A has users [Alice, Admin A]  
   **And** organization B has users [Bob, Admin B]  
   **When** Admin A views the user management page  
   **Then** only Alice and Admin A are displayed in `data-testid="user-management-table"`  
   **And** Bob and Admin B are NOT visible

2. **Given** Admin A is authenticated  
   **When** they attempt to edit user Bob (org B) via the tenant-scoped user update API  
   **Then** the API returns `403 Forbidden`  
   **And** Bob's user data is NOT modified  
   **And** the attempt is logged as a security violation

3. **Given** Admin A is authenticated  
   **When** they attempt to delete user Bob (org B) via the tenant-scoped user delete API  
   **Then** the API returns `403 Forbidden`  
   **And** Bob's user account is NOT deleted  
   **And** a security alert is generated in logs

4. **Performance & Cleanup**  
   **Given** this test runs with Playwright `workers: 4`  
   **When** the test executes  
   **Then** the test completes in `<2 minutes` (single worker)  
   **And** parallel execution with 4 workers completes in `<5 minutes` total  
   **And** test cleanup removes all seeded organizations within `500ms`  
   **And** no orphan user accounts remain after test completion

## Tasks / Subtasks

- [x] Add RED E2E spec for user-management isolation between two tenant orgs (AC: 1, 2, 3)
  - [x] Create `e2e/multi-tenant-user-management-isolation.spec.ts` as a dedicated spec; do not overload `e2e/user-management.spec.ts`
  - [x] Use the shared org fixture layer: `import { test, expect } from './fixtures/org-fixture'`
  - [x] Seed two orgs with `seedTestOrg()` and store both org admin credentials plus user identifiers needed for negative assertions
  - [x] Keep the scenario deterministic by using known usernames for org A and org B fixture users, or by deriving them from fixture payloads without hardcoding global `admin/admin`

- [x] Implement tenant-authenticated navigation and list assertions for org A admin (AC: 1)
  - [x] Log in with org A admin credentials returned by the fixture seed, not the legacy global admin account
  - [x] Navigate to the real tenant admin route shape: `/org/:slug/admin?tab=users`
  - [x] Assert the user management table is rendered via `data-testid="user-management-table"`
  - [x] Assert org A users are visible and org B users are absent in the rendered table

- [x] Validate API-level edit denial for cross-tenant target user (AC: 2)
  - [x] Capture the tenant-scoped update request triggered for an org B user while authenticated as org A
  - [x] Assert the request receives `403` rather than a silent success or ambiguous `404`
  - [x] Assert the org B user record remains unchanged after the denied update attempt
  - [x] Assert the denial is enforced by the API/server contract, not by hiding UI controls alone
  - [x] Assert the denied mutation is logged with enough tenant/user context to satisfy the security-violation requirement

- [x] Validate API-level delete denial for cross-tenant target user (AC: 3)
  - [x] Trigger a delete attempt against an org B user while authenticated as org A
  - [x] Assert the request receives `403`
  - [x] Assert the org B user still exists after the denied delete attempt
  - [x] Add a negative assertion guarding against cross-tenant user leakage in follow-up user list responses
  - [x] Assert the denied delete attempt emits the expected security log/alert signal for investigation

- [x] Close UX testability gaps required by this story (AC: 1)
  - [x] Add `data-testid="user-management-table"` to the actual users table container in `client/src/pages/admin/UsersPage.tsx` if it does not already exist
  - [x] Add stable row/item selectors if needed for deterministic per-user assertions without relying only on broad text matches
  - [x] Preserve existing admin tab behavior and avoid inventing removed routes such as `/admin/users`

- [x] Close backend contract gaps required by this story (AC: 2, 3)
  - [x] Confirm the real SaaS handlers under `packages/saas/src/routes/org.ts` are the routes under test for tenant user edit/delete behavior
  - [x] Reconcile the current client user API shape with SaaS route topology: `client/src/api/users.ts` still targets standalone-style `/users` and `/users/:id/role`, while the org router currently exposes `/api/org/:slug/users` and `PUT /api/org/:slug/users/:id`
  - [x] If current schema scoping returns `404 User not found` for cross-tenant user IDs, add the minimal explicit org-boundary/security path needed so cross-tenant access is surfaced as `403 Forbidden` per acceptance criteria
  - [x] Add or extend route tests in `packages/saas/src/routes/org.test.ts` to lock the chosen `403` contract before relying on it in Playwright

- [x] Keep fixture cleanup and parallel safety intact (AC: 4)
  - [x] Reuse `e2e/fixtures/org-fixture.ts`, `e2e/fixtures/org-cleanup.ts`, and `e2e/global-teardown.ts`
  - [x] Do not add ad-hoc SQL cleanup or manual tenant deletion inside the spec
  - [x] Reuse the shared runtime and cleanup assertions already added for story 1.3 where applicable

- [x] Update tests and docs for the new E2E contract (AC: 1, 2, 3, 4)
  - [x] Add or update client tests for any new user-management test IDs/selectors
  - [x] Add or update server/SaaS route tests for cross-tenant `403` enforcement on user mutation endpoints
  - [x] Confirm `docs/guides/development/testing.md` does not require changes because the fixture-backed E2E workflow is already documented

## Dev Notes

### Scope and Guardrails

- This story is a tenant-isolation regression for user management only; do not widen scope into role-management redesign or generic admin navigation refactors.
- Keep implementation minimal: prefer a dedicated Playwright spec, targeted selector instrumentation, and the smallest backend contract fix required to satisfy the `403` isolation behavior.
- Story 1.3 already covered cinema isolation; follow its fixture, selector, and anti-flake patterns rather than inventing new test infrastructure.

### Reinvention Prevention

- Reuse existing fixture and cleanup utilities already delivered in Epic 0:
  - `e2e/fixtures/org-fixture.ts`
  - `e2e/fixtures/org-cleanup.ts`
  - `e2e/global-teardown.ts`
- Reuse current Playwright project settings in `playwright.config.ts`; do not add a separate Playwright config.
- Reuse the existing tenant route shell in `client/src/App.tsx` and admin tab model in `client/src/pages/admin/AdminPage.tsx`.
- Do not extend the old broad `e2e/user-management.spec.ts` unless strictly necessary; it still contains legacy assumptions (`/admin/users`, `admin/admin`) that this story should avoid copying.

### Previous Story Intelligence (from 1.3)

- Story 1.3 established the pattern for fixture-backed tenant login: use seeded org-admin credentials, not hardcoded global admin credentials.
- Story 1.3 also added measurable fixture runtime and cleanup assertions in `e2e/fixtures/org-fixture.ts`; reuse those thresholds instead of duplicating performance logic.
- Story 1.3 discovered that explicit forbidden-state contracts matter: avoid relying on incidental `not found` behavior when the acceptance criteria require `403 Forbidden`.
- Follow the recent repo pattern of fixing uncovered regression blockers only when directly surfaced by the story's test execution.

### Architecture Compliance Notes

- Monorepo ESM + strict TypeScript conventions remain mandatory. Avoid `any` in security-sensitive tenant isolation code. [Source: `_bmad-output/project-context.md:49-87`]
- Frontend server state uses the shared axios client and relative `/api` base URL. Tenant-scoped requests are still made through the same client and must resolve to org routes via the active app/runtime pathing. [Source: `client/src/api/client.ts:15-24`]
- Tenant routes live under `/org/:slug/*`, and admin user management is rendered inside `/org/:slug/admin?tab=users`, not `/admin/users`. [Source: `client/src/App.tsx:175-205`, `client/src/pages/admin/AdminPage.tsx:112-189`, `client/src/App.test.tsx:112-129`]
- The user-management UI currently renders a plain table without `data-testid="user-management-table"`; this story can add the minimal stable selector required for E2E assertions. [Source: `client/src/pages/admin/UsersPage.tsx:237-305`]
- In SaaS mode, org-scoped user handlers are implemented inline in `packages/saas/src/routes/org.ts`, not reused from `server/src/routes/users.ts`. Those are the handlers that must enforce tenant-safe edit/delete behavior. [Source: `packages/saas/src/routes/org.ts:109-347`]
- Tenant isolation in SaaS is primarily delivered through `resolveTenant` + tenant-scoped `req.dbClient`; this can hide cross-tenant records as `404`. The acceptance criteria here require an explicit `403` contract for forbidden cross-tenant mutation attempts, so do not assume schema scoping alone is sufficient. [Source: `packages/saas/src/routes/org.ts:2-13`, `server/src/utils/db-from-request.ts:4-15`]
- The current shared client user API still uses standalone-style endpoints (`/users`, `/users/:id/role`, `/users/:id`) while the SaaS org router exposes org-scoped user endpoints. The implementation must verify how tenant admin UI reaches the correct backend path before writing E2E expectations. [Source: `client/src/api/users.ts:40-125`, `packages/saas/src/routes/org.ts:109-305`]

### LLM-Dev Implementation Strategy

1. RED: add failing tenant-isolation tests for the users page and cross-tenant update/delete attempts.
2. GREEN: add only the missing selector hooks and the smallest backend enforcement needed to produce a stable `403` contract.
3. HARDEN: add negative assertions for post-attempt user list responses and org B record survival.
4. VERIFY: run the dedicated Playwright spec, then the impacted client and SaaS route/unit tests.
5. DOCS: update testing guidance only if the dedicated spec changes the documented E2E workflow.

### Suggested Test Matrix

- Happy path: org A admin logs in and opens `/org/:slug/admin?tab=users`; only org A users are visible.
- Negative path: org A admin triggers an update attempt against an org B user; response is `403` and org B user data is unchanged.
- Negative path: org A admin triggers a delete attempt against an org B user; response is `403` and org B user remains present.
- Network assertion: follow-up org A user-list payload contains no org B usernames or IDs.
- Parallel/cleanup sanity: repeated runs with workers=4 do not leak or orphan tenant fixture data.

### Concrete File Targets

- `e2e/multi-tenant-user-management-isolation.spec.ts` (new dedicated spec)
- `e2e/fixtures/org-fixture.ts` (reuse only unless helper ergonomics require a minimal addition)
- `client/src/pages/admin/UsersPage.tsx` (add `user-management-table` and any stable row hooks if missing)
- `client/src/pages/admin/UsersPage.test.tsx` (lock new selectors/behavior if UI changes)
- `packages/saas/src/routes/org.ts` (tenant-scoped user update/delete enforcement)
- `packages/saas/src/routes/org.test.ts` (route-level regression coverage for tenant user mutation isolation)
- `docs/guides/development/testing.md` (only if the new spec needs documentation)

### Pitfalls to Avoid

- Do not use `/admin/users`; that route was removed. Use the admin tab query-param model.
- Do not hardcode `admin/admin` or rely on the legacy user-management E2E helper that logs in with global credentials.
- Do not write assertions only against hidden UI state; capture and verify the actual network/API denial.
- Do not accept `404 User not found` as good enough if the story still requires `403 Forbidden` for cross-tenant mutation attempts.
- Do not assume the current shared client user API already targets the correct org-scoped SaaS endpoints; verify the actual request path first.
- Do not bypass fixture cleanup with direct SQL or tenant-schema deletes inside tests.
- Do not refactor standalone user-management routes unless the change is required for shared behavior and proven safe.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:546`
- Epic dependency context: `_bmad-output/planning-artifacts/epics.md:448`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:64`
- Previous story context: `_bmad-output/implementation-artifacts/1-3-e2e-multi-tenant-cinema-isolation-test.md`
- Planning notes for story 1.4: `_bmad-output/planning-artifacts/notes-epics-stories.md:89-95`
- Risk/test mapping: `_bmad-output/test-artifacts/test-design/test-design-qa.md:215-223`
- Test handoff selectors: `_bmad-output/test-artifacts/test-design/allo-scrapper-handoff.md:96-114`
- Tenant route shell: `client/src/App.tsx:175-205`
- Admin tab implementation: `client/src/pages/admin/AdminPage.tsx:112-189`
- Removed old route note: `client/src/App.test.tsx:112-129`
- Current users page implementation: `client/src/pages/admin/UsersPage.tsx:97-354`
- Shared API base client: `client/src/api/client.ts:15-24`
- Current client user API shape: `client/src/api/users.ts:40-125`
- Fixture runtime/cleanup helpers: `e2e/fixtures/org-fixture.ts:5-138`
- SaaS org user handlers: `packages/saas/src/routes/org.ts:109-347`
- Tenant-scoped DB injection: `server/src/utils/db-from-request.ts:4-15`
- Existing org route tests: `packages/saas/src/routes/org.test.ts:365-426`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 1.4 based on sprint auto-discovery after marking story 1.3 done
- `PLAYWRIGHT_BASE_URL=http://localhost:5174 E2E_ENABLE_ORG_FIXTURE=true npx playwright test e2e/multi-tenant-user-management-isolation.spec.ts --project=chromium --no-deps`
- `npm run test:run --workspace=client -- src/api/users.test.ts src/pages/admin/UsersPage.test.tsx`
- `npx vitest run src/services/auth-service.test.ts` (server)
- `npx vitest run src/routes/org.test.ts src/routes/test-fixtures.test.ts` (packages/saas)

### Completion Notes List

- Added dedicated Playwright coverage in `e2e/multi-tenant-user-management-isolation.spec.ts` for tenant-scoped login, user list isolation, and cross-tenant update/delete denial.
- Updated the users admin UI with stable `data-testid="user-management-table"` coverage and aligned client user API calls with tenant org routes when browsing `/org/:slug/admin`.
- Extended SaaS route coverage to lock the `403` contract for org-mismatched user update/delete requests and kept the denial API-driven through `requireOrgAuth`.
- Fixed fixture seeding to resolve a valid non-admin tenant role dynamically, which keeps seeded users stable across corrected tenant bootstrap states.
- Fixed tenant authentication to prefer tenant user lookup before public user lookup and to return org context without incorrectly granting `scope: superadmin`.
- Hardened local SaaS E2E runtime wiring by fixing `/test` proxying, Playwright base URL handling, Docker compose test env overrides, Redis-backed SaaS env, and runtime-safe workspace import/path resolution in `packages/saas`.
- Verified the dedicated E2E flow and impacted client, server, and SaaS route tests locally; story is ready for review.

### File List

- `_bmad-output/implementation-artifacts/1-4-e2e-multi-tenant-user-management-isolation-test.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `e2e/multi-tenant-user-management-isolation.spec.ts`
- `client/src/api/users.ts`
- `client/src/api/users.test.ts`
- `client/src/pages/admin/UsersPage.tsx`
- `client/src/pages/admin/UsersPage.test.tsx`
- `client/vite.config.ts`
- `playwright.config.ts`
- `docker-compose.dev.yml`
- `packages/saas/src/plugin.ts`
- `packages/saas/src/routes/org.ts`
- `packages/saas/src/routes/org.test.ts`
- `packages/saas/src/routes/test-fixtures.ts`
- `packages/saas/src/routes/test-fixtures.test.ts`
- `packages/saas/src/services/org-service.ts`
- `packages/saas/src/types/express.d.ts`
- `server/src/db/user-queries.ts`
- `server/src/services/auth-service.ts`
- `server/src/services/auth-service.test.ts`

## Change Log

- 2026-04-20: Implemented multi-tenant user-management isolation with dedicated Playwright coverage, tenant-aware client user API routing, `user-management-table` test instrumentation, SaaS route tests for `403` org-mismatch user mutations, fixture seeding/auth fixes, and local SaaS E2E runtime wiring needed to execute the story end to end.
