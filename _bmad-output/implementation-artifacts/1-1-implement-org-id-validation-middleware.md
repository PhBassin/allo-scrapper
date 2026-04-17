# Story 1.1: Implement org_id Validation Middleware

Status: ready-for-dev

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

- [ ] Add org_id validation middleware and request typing (AC: 1, 2, 3)
  - [ ] Add middleware in `server/src/middleware/` for tenant org enforcement
  - [ ] Normalize source of authenticated org id from JWT user context
  - [ ] Enforce query/body org_id mismatch rejection with 403 + canonical error
  - [ ] Ensure absent query org_id is auto-inferred from JWT context

- [ ] Integrate middleware into protected org-sensitive routes (AC: 1, 2, 3)
  - [ ] Apply to cinemas read/write routes first (`GET`, `POST`)
  - [ ] Preserve existing auth and permission middleware order
  - [ ] Avoid changing non-tenant/system routes

- [ ] Add security logging for mismatch/manipulation attempts (AC: 1, 3)
  - [ ] Log structured event including `org_id`, `requested_org_id`, `user_id`, endpoint, method
  - [ ] Use existing server logger/error conventions
  - [ ] Keep logs consistent with future observability enrichment (Story 1.2)

- [ ] Add automated tests (RED first, then GREEN) (AC: 1, 2, 3)
  - [ ] Route-level tests for query mismatch -> 403 + message
  - [ ] Route-level tests for implicit org filtering when query missing
  - [ ] Route-level tests for body org_id override on create
  - [ ] Ensure regression tests confirm no cross-tenant leakage in responses

- [ ] Documentation updates (security behavior change) (AC: 1, 2, 3)
  - [ ] Update README/API docs with org_id enforcement behavior
  - [ ] Add concise developer note in testing docs for tenant enforcement assertions

## Dev Notes

### Scope and Guardrails

- Focus this story on middleware + cinemas route integration as first enforcement slice.
- Do not broaden scope to full observability enrichment (reserved for Story 1.2).
- Keep current RBAC/auth behavior unchanged; this adds tenant boundary validation.

### Existing Architecture Signals

- SaaS mode already carries org context in authenticated user payload and tenant routing patterns.
- Existing route tests provide a baseline for auth/permission assertions; extend them for org boundary checks.
- New E2E cleanup utilities from Story 0.4 can support future tenant isolation E2Es (Stories 1.3+).

### Security Behavior Contract

- Mismatch contract: any explicit `org_id` not matching JWT org -> `403` with stable message.
- Implicit contract: missing `org_id` -> enforced/org-scoped automatically from JWT.
- Manipulation contract: body `org_id` cannot elevate/switch tenant; server enforces JWT org.

### Suggested Test Matrix

- `GET /api/cinemas?org_id=other` -> 403 + security log
- `GET /api/cinemas` -> filtered to caller org only
- `POST /api/cinemas` with forged `org_id` -> created under caller org, manipulation logged
- control case: correct org id explicitly provided -> success path unchanged

### Implementation Order (Mandatory)

1. RED: add failing route tests for mismatch/filter/override behavior.
2. GREEN: implement middleware and route wiring minimally to pass tests.
3. HARDEN: add structured security logging and regression assertions.
4. DOCS: update README/testing docs.

### References

- Story definition: `_bmad-output/planning-artifacts/epics.md:453`
- Epic dependencies context: `_bmad-output/planning-artifacts/epics.md:448`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:61`
- Prior tenant fixture groundwork: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md`
- Prior cleanup groundwork: `_bmad-output/implementation-artifacts/0-4-create-auto-cleanup-test-utilities.md`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 1.1 after merge of story 0.4

### Completion Notes List

- Story file created with AC-aligned middleware scope and enforcement matrix.
- Included explicit RED/GREEN/HARDEN/DOCS order and logging requirements.
- Scoped to cinemas enforcement slice to keep implementation atomic.

### File List

- `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md`
