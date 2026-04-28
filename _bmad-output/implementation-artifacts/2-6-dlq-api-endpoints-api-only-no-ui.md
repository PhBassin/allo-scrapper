# Story 2.6: Dead-Letter Queue API Endpoints (API-only, no UI)

Status: done

<!-- Note: Corrected by bmad-correct-course 2026-04-26. See sprint-change-proposal-2026-04-26.md for full rationale. -->

## Story

As a backend developer,
I want REST API endpoints to query and manage dead-letter queue jobs,
so that admins have programmatic visibility into failed scrape jobs without needing a UI in MVP.

## Acceptance Criteria

1. **Given** the dead-letter queue has failed jobs
   **When** I call `GET /api/scraper/dlq` (or the alias `GET /api/admin/scraper/dlq`) with a valid admin session
   **Then** I receive `{ success: true, data: DlqJobListResult }` where `DlqJobListResult` is `{ jobs: DlqJobEntry[], total, page, pageSize }`
   **And** each `DlqJobEntry` includes: `job_id`, `job` (full payload), `failure_reason`, `retry_count`, `timestamp`, `cinema_id`, `org_id`
   **And** results are sorted by `timestamp` descending
   **And** pagination defaults to `page=1, pageSize=50`, max `pageSize=50`
   **And** non-system-role callers only receive jobs belonging to their `org_id`

2. **Given** I have a specific failed job ID from the DLQ
   **When** I call `GET /api/scraper/dlq/:jobId` (or the alias `GET /api/admin/scraper/dlq/:jobId`) with a valid admin session
   **Then** I receive `{ success: true, data: DlqJobEntry }` with the full entry for that job
   **And** the response is org-scoped for non-system-role callers (403 if out-of-scope)
   **And** a 404 `NotFoundError` is returned if the job does not exist in the DLQ or is out-of-scope for the caller

3. **Given** I have a failed job ID from the DLQ
   **When** I call `POST /api/scraper/dlq/:jobId/retry` (or the alias `POST /api/admin/scraper/dlq/:jobId/retry`) with a valid admin session
   **Then** the job is removed from the DLQ and republished to the main scrape queue
   **And** the response returns **200 OK** with `{ success: true, data: DlqJobEntry }` (the republished entry)
   **And** a 404 is returned if the job is not found or is out-of-scope

4. **Given** I make a request to any DLQ endpoint (canonical or alias)
   **When** I have no valid session
   **Then** I receive **401 Unauthorized**
   **When** I have a valid session but lack scraper-management permission
   **Then** I receive **403 Forbidden** with `{ success: false, error: 'Permission denied' }`

## Tasks / Subtasks

- [x] Write RED tests before implementation (TDD) (AC: 1, 2, 3, 4)
  - [x] `server/src/services/redis-client.test.ts`: add tests for new `getDlqJob(jobId, orgId?)` method
    - [x] Found: system role, returns entry
    - [x] Found: org-scoped role, matching org, returns entry
    - [x] Not found: job ID absent, returns null
    - [x] Org-scoped miss: job belongs to different org, returns null
  - [x] `server/src/routes/scraper.test.ts`: add tests for `GET /api/scraper/dlq/:jobId`
    - [x] 200 with full `DlqJobEntry` when job exists
    - [x] 404 when job not found
    - [x] 403 when authenticated but no permission
  - [x] `server/src/routes/scraper.test.ts`: add alias smoke tests — one happy-path request each to `GET /api/admin/scraper/dlq`, `GET /api/admin/scraper/dlq/:jobId`, `POST /api/admin/scraper/dlq/:jobId/retry` confirming they return identical responses to the canonical paths
  - [x] Confirm existing tests at lines 294 (list) and 333 (retry) remain green unchanged

- [x] Implement `RedisClient.getDlqJob` (AC: 2)
  - [x] Add `getDlqJob(jobId: string, orgId?: number): Promise<DlqJobEntry | null>` to `server/src/services/redis-client.ts`
  - [x] Mirror the lookup half of `retryDlqJob` (`:173`): scan ZSET, find by `job_id`, apply `matchesDlqOrg` filter, return parsed entry or null
  - [x] No mutation — read-only

- [x] Implement `GET /api/scraper/dlq/:jobId` route (AC: 2)
  - [x] Add handler in `server/src/routes/scraper.ts` following the same pattern as `POST /dlq/:jobId/retry`
  - [x] Use `requireAuth` + `canManageScraper` (403 path) + `getSingleRouteParam`
  - [x] Return 404 via `NotFoundError('DLQ job not found')` when service returns null
  - [x] Place handler between the existing list handler (`:214`) and the retry handler (`:242`)

- [x] Mount admin alias routes (AC: 1, 2, 3)
  - [x] In `server/src/app.ts`, mount the existing scraper router at `/api/admin/scraper` in addition to its current `/api/scraper` mount
  - [x] Add code comment: *"Alias mount per Sprint Change Proposal 2026-04-26; canonical path remains /api/scraper/dlq"*
  - [x] Confirm both mounts share the same `requireAuth` and `canManageScraper` guards (they will if the same router instance is reused)

- [x] Documentation
  - [x] Add `docs/api/dlq.md` with request/response examples for all three canonical routes and note the admin aliases
  - [x] Cross-reference PR #904 (DLQ infra) and PR #919 (reconnect hardening)
  - [x] No Swagger/OpenAPI surface exists; markdown doc is sufficient for MVP

## Out of Scope

- **DLQ Admin UI**: Table with filters/pagination/retry buttons — future epic
- **Bulk retry**: Retry all DLQ jobs at once — v2 enhancement
- **DLQ auto-purge**: Auto-cleanup oldest entries after N days — deferred
- **SaaS package changes**: Org-scoping is fully handled server-side by `RedisClient`; no changes to `packages/saas` are needed for MVP

## Dev Notes

- **Contract owner:** Story 2.1 / PR #904. The `DlqJobEntry` shape and `scrape:dlq` Redis key are **not ours to redefine**. Reuse the existing exports from `server/src/services/redis-client.ts`.
- **Shipped endpoints (reuse, do not recreate):**
  - `GET /api/scraper/dlq` → `server/src/routes/scraper.ts:214` — `listDlqJobs`
  - `POST /api/scraper/dlq/:jobId/retry` → `server/src/routes/scraper.ts:242` — `retryDlqJob`
- **New endpoint to add:**
  - `GET /api/scraper/dlq/:jobId` — single-job detail; needs new `RedisClient.getDlqJob` method
- **Auth gate:** `canManageScraper(req)` at `server/src/routes/scraper.ts:44`. Do not add new middleware.
- **Org-scoping:** Already wired in every `RedisClient` DLQ method via `req.user?.is_system_role ? undefined : req.user?.org_id`. The new `getDlqJob` must follow the same pattern.
- **Alias mount strategy:** Reuse the same router instance or handler refs. Do not copy-paste handler bodies. The alias is a routing concern, not an implementation concern.
- **Pagination cap:** `pageSize` max is **50** (enforced in `RedisClient.listDlqJobs:144`). Do not raise to 100.
- **Status codes:** 200 OK for all success responses. 401 (no session), 403 (no permission), 404 (not found). Retry returns 200, not 202.

## References

- `server/src/routes/scraper.ts:44` — `canManageScraper` permission gate
- `server/src/routes/scraper.ts:214` — shipped `GET /dlq` handler (list)
- `server/src/routes/scraper.ts:242` — shipped `POST /dlq/:jobId/retry` handler
- `server/src/services/redis-client.ts:143` — `listDlqJobs` (template for `getDlqJob`)
- `server/src/services/redis-client.ts:173` — `retryDlqJob` (template for `getDlqJob` lookup half)
- `server/src/routes/scraper.test.ts:294` — existing list route test
- `server/src/routes/scraper.test.ts:333` — existing retry route test
- `packages/saas/src/routes/org.ts` — no DLQ code; no changes needed
- PR #904 — DLQ infrastructure (Story 2.1)
- PR #919 — Redis reconnect hardening
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-26.md` — full change rationale

## Dev Agent Record

### Implementation Plan

- Added `getDlqJob(jobId, orgId?)` to `RedisClient` — read-only ZSET scan mirroring `retryDlqJob` lookup logic, with `matchesDlqOrg` filter for org-scoping.
- Added `GET /api/scraper/dlq/:jobId` route handler in `scraper.ts` between the list and retry handlers; uses same `canManageScraper` gate and org-scope pattern.
- Mounted scraper router at `/api/admin/scraper` alias in `app.ts` (same router instance, no handler duplication).
- Created `docs/api/dlq.md` documenting all three canonical endpoints with request/response examples and alias note.
- TDD: RED tests written and confirmed failing before implementation; all 835 tests pass GREEN.

### Completion Notes

All tasks and subtasks complete. 835 tests pass, TypeScript strict-mode clean. Story moved to `review`.

### Review Findings

- [x] [Review][Patch] Admin DLQ alias rejects trailing-slash forms that the canonical routes accept [server/src/app.ts:90]
- [x] [Review][Defer] DLQ single-job lookup depends on `job_id = report-${reportId}`, which is only safe while `scrape_reports.id` remains globally unique across all tenants [server/src/routes/scraper.ts:253] — deferred, pre-existing

## File List

- `server/src/services/redis-client.ts` — added `getDlqJob` method
- `server/src/routes/scraper.ts` — added `GET /dlq/:jobId` handler
- `server/src/app.ts` — added `/api/admin/scraper` alias mount
- `server/src/services/redis-client.test.ts` — added 4 `getDlqJob` unit tests
- `server/src/routes/scraper.test.ts` — added 3 route tests + 3 alias smoke tests
- `docs/api/dlq.md` — new API documentation file

## Change Log

- 2026-04-26: Story 2.6 implemented — DLQ API endpoints (getDlqJob, GET /dlq/:jobId, admin alias mount, docs)
