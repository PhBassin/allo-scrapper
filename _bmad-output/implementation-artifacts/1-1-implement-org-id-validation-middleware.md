# Story 1.1: Implement org_id Validation Middleware

Status: done

## Story

As a security engineer,
I want all API requests to validate org_id from JWT against resource ownership,
so that users cannot access data from other organizations.

## Acceptance Criteria

1. **Given** a user is authenticated with `org_id=A`  
   **When** they request `GET /api/cinemas?org_id=B`  
   **Then** the API returns `403 Forbidden`  
   **And** the response includes error message "Cross-tenant access denied"  
   **And** the attempt is logged with `org_id`, `user_id`, and requested `org_id`

2. **Given** a user is authenticated with `org_id=A`  
   **When** they request `GET /api/cinemas` (no `org_id` query param)  
   **Then** the API returns only cinemas where `org_id=A`  
   **And** the query is automatically filtered by middleware  
   **And** no cross-tenant data is leaked

3. **Given** a user attempts to manipulate `org_id` in request body  
   **When** they send `POST /api/cinemas` with `{ "name": "Cinema", "org_id": "B" }`  
   **Then** the API forces `org_id` to the authenticated user's org_id  
   **And** the cinema is created with `org_id=A` (from JWT)  
   **And** the manipulation attempt is logged as a security event

## Tasks / Subtasks

- [x] Add org boundary enforcement middleware and request typing (AC: 1, 2, 3)
  - [x] Extend existing `enforceOrgBoundary` middleware in `server/src/middleware/org-boundary.ts` (do not create duplicate middleware) to keep JWT org boundary enforcement centralized
  - [x] Reject org mismatch with `403` and stable message `Cross-tenant access denied`
  - [x] For create payloads, sanitize/override forged `org_id` with JWT org context before DB write path
  - [x] Keep TypeScript strict typing (`AuthRequest`) and avoid `any` in security-critical checks

- [x] Integrate enforcement at org-sensitive entry points (AC: 1, 2, 3)
  - [x] Keep middleware wired on cinema read/write endpoints used in SaaS org context first (`GET /cinemas`, `POST /cinemas`) and verify no route regression
  - [x] Preserve middleware order: limiter -> auth -> permission -> org boundary middleware -> handler
  - [x] Keep standalone routes unchanged where explicitly public; enforce tenant checks in org-scoped flow (`/api/org/:slug/*`)

- [x] Add security logging for mismatch/manipulation attempts (AC: 1, 3)
  - [x] Use structured logger (`server/src/utils/logger.ts`) and include: `org_id`, `requested_org_id`, `user_id`, `method`, `path`, `event`
  - [x] Log both denied reads and body-manipulation attempts as security events
  - [x] Keep field naming aligned with Story 1.2 observability enrichment

- [x] Add automated tests (RED first, then GREEN) (AC: 1, 2, 3)
  - [x] Add/extend route-level tests for query mismatch -> `403` + message using current route topology (`/api/org/:slug/cinemas`)
  - [x] Add tests for implicit org scoping when query `org_id` is absent
  - [x] Add tests for forged body `org_id` handling on create path
  - [x] Add regression assertion that org B data never appears in org A response path
  - [x] Confirm middleware-chain order for protected mutation routes remains intact, including org-scoped mount in SaaS router

- [x] Documentation updates (security behavior change) (AC: 1, 2, 3)
  - [x] Update `README.md` API security section with tenant boundary behavior
  - [x] Add note in test docs for how to assert cross-tenant denial and expected error payload

### Review Findings

- [x] [Review][Patch] Truthiness guard can bypass org boundary for falsy tenant id [server/src/middleware/org-boundary.ts:45]
- [x] [Review][Patch] Middleware chain test does not assert required execution order [server/src/routes/cinemas.security.test.ts:97]
- [x] [Review][Defer] Org-scoped cinema detail route remains public and may expose tenant data if not separately guarded [server/src/routes/cinemas.ts:147] — deferred, pre-existing

## Dev Notes

### Scope and Guardrails

- Focus this story on middleware + cinemas route integration as first enforcement slice.
- Do not broaden scope to full observability enrichment (reserved for Story 1.2).
- Keep current RBAC/auth behavior unchanged; this adds tenant boundary validation.
- Do not introduce new `org_id` columns/migrations in this story; this is request-boundary enforcement.

### Reinvention Prevention

- Reuse existing middleware and tests before adding new files:
  - `server/src/middleware/org-boundary.ts`
  - `server/src/middleware/org-boundary.test.ts`
  - `server/src/routes/cinemas.ts`
- Do not create a second org-boundary middleware with overlapping behavior; extend current implementation and keep a single enforcement path.

### Existing Architecture Signals

- SaaS mode already carries org context in authenticated user payload and tenant routing patterns.
- Existing route tests provide a baseline for auth/permission assertions; extend them for org boundary checks.
- New E2E cleanup utilities from Story 0.4 can support future tenant isolation E2Es (Stories 1.3+).
- Existing org routing is mounted via `packages/saas/src/routes/org.ts` and reuses server routers.
- DB scoping in SaaS is primarily search-path based (`getDbFromRequest`), so boundary checks must happen before handlers.

### Security Behavior Contract

- Mismatch contract: any explicit `org_id` not matching JWT org -> `403` with stable message.
- Implicit contract: missing `org_id` -> enforced/org-scoped automatically from JWT.
- Manipulation contract: body `org_id` cannot elevate/switch tenant; server enforces JWT org.
- Contract applies to org-scoped SaaS flows; avoid breaking intended standalone public read behavior.

### Suggested Test Matrix

- `GET /api/cinemas?org_id=other` -> 403 + security log
- `GET /api/cinemas` -> filtered to caller org only
- `POST /api/cinemas` with forged `org_id` -> created under caller org, manipulation logged
- control case: correct org id explicitly provided -> success path unchanged
- org-scoped path check: `/api/org/:slug/cinemas` enforces the same boundary guarantees

### Concrete File Targets

- `server/src/middleware/org-boundary.ts` - extend existing org boundary middleware (no duplicate file)
- `server/src/routes/cinemas.ts` - middleware wiring on cinema endpoints
- `packages/saas/src/routes/org.ts` - verify auth + org-scoped middleware chain behavior
- `server/src/routes/cinemas.test.ts` and/or `server/src/routes/cinemas.security.test.ts` - RED/GREEN route tests
- `server/src/middleware/org-boundary.test.ts` - middleware behavior and security logging assertions
- `packages/saas/src/routes/org.test.ts` - org-scoped integration expectations

### Implementation Order (Mandatory)

1. RED: add failing route tests for mismatch/filter/override behavior.
2. GREEN: implement middleware and route wiring minimally to pass tests.
3. HARDEN: add structured security logging and regression assertions.
4. DOCS: update README/testing docs.

### Pitfalls to Avoid

- Do not trust client-provided `org_id` even when slug/path looks valid.
- Do not weaken existing permission checks while inserting tenant middleware.
- Do not silently ignore mismatch; always return deterministic `403` contract.
- Do not rely on rate-limiter bucketing as security isolation.

### References

- Story definition: `_bmad-output/planning-artifacts/epics.md:453`
- Epic dependencies context: `_bmad-output/planning-artifacts/epics.md:448`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:61`
- Prior tenant fixture groundwork: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md`
- Prior cleanup groundwork: `_bmad-output/implementation-artifacts/0-4-create-auto-cleanup-test-utilities.md`
- Existing boundary middleware: `server/src/middleware/org-boundary.ts:42`
- Existing middleware tests: `server/src/middleware/org-boundary.test.ts:37`
- Org-scoped router composition: `packages/saas/src/routes/org.ts:91`
- Current cinema route middleware chain: `server/src/routes/cinemas.ts:17`
- Auth payload org fields: `server/src/middleware/auth.ts:9`
- Tenant DB injection helper: `server/src/utils/db-from-request.ts:13`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 1.1 after merge of story 0.4
- `npm run test:run -- src/routes/cinemas.test.ts src/routes/cinemas.security.test.ts src/middleware/org-boundary.test.ts`
- `npm run test:run`
- `npx tsc --noEmit`

### Completion Notes List

- Story file created with AC-aligned middleware scope and enforcement matrix.
- Included explicit RED/GREEN/HARDEN/DOCS order and logging requirements.
- Scoped to cinemas enforcement slice to keep implementation atomic.
- Enforced org-boundary middleware on cinema read/write paths and kept standalone public behavior intact.
- Added org-scoped route tests for cross-tenant query mismatch (`403`), implicit org-scoped reads, and forged body `org_id` sanitization behavior.
- Verified middleware-chain protections in route security tests, including org-boundary middleware presence on mutation and org-aware read wrappers.
- Updated README and server testing guide with explicit tenant-boundary enforcement and expected error payload contract.
- Addressed code-review patch findings: explicit null/undefined guard for `authenticatedOrgId` and deterministic middleware-order assertion in route security tests.

### File List

- `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md`
- `server/src/routes/cinemas.ts`
- `server/src/middleware/org-boundary.ts`
- `server/src/middleware/org-boundary.test.ts`
- `server/src/routes/cinemas.test.ts`
- `server/src/routes/cinemas.security.test.ts`
- `README.md`
- `server/tests/README.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-17: Implemented org-boundary enforcement for cinemas org-scoped read/write paths, added security logging assertions and middleware-chain tests, and documented tenant-boundary API/testing behavior.
- 2026-04-17: Applied code-review fixes for boundary guard correctness and middleware-order verification in security tests.
