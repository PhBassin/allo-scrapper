# Story 2.6: Dead-Letter Queue API Endpoints (API-only, no UI)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want REST API endpoints to query and manage dead-letter queue jobs,
so that admins have programmatic visibility into failed scrape jobs without needing a UI in MVP.

## Acceptance Criteria

1. **Given** the dead-letter queue has failed jobs  
   **When** I call `GET /api/admin/dlq/jobs` (with proper admin authentication)  
   **Then** I receive a paginated list of failed jobs  
   **And** each entry includes: job_id, original payload (truncated), failure reason, retry count, failed_at timestamp, cinema_name if available  
   **And** results are sorted by failed_at descending  
   **And** pagination includes total count and page metadata

2. **Given** I have a specific failed job ID from the DLQ  
   **When** I call `GET /api/admin/dlq/jobs/:job_id`  
   **Then** I receive the full job details including the complete original payload and failure context  
   **And** the response includes metadata about how many retry attempts were exhausted

3. **Given** I have a failed job ID from the DLQ  
   **When** I call `POST /api/admin/dlq/jobs/:job_id/retry` (admin only)  
   **Then** the job is removed from the DLQ and republished to the main job queue  
   **And** the response returns 202 Accepted with the republished job details  
   **And** the retry attempt is logged for audit purposes

4. **Given** I am not an authenticated admin  
   **When** I attempt to access any `/api/admin/dlq/*` endpoint  
   **Then** I receive 401 Unauthorized

## Tasks / Subtasks

- [ ] Add RED test coverage for DLQ API endpoints before implementation (AC: 1, 2, 3, 4)
  - [ ] Create unit tests for DLQ route handlers with mocked Redis client
  - [ ] Test pagination logic with varying page sizes and offsets
  - [ ] Test retry endpoint verifies job is republished to main queue
  - [ ] Test auth guard rejects non-admin requests with 401

- [ ] Implement DLQ GET list endpoint (AC: 1)
  - [ ] Add `/api/admin/dlq/jobs` GET with pagination (default limit=20, max=100)
  - [ ] Read from existing DLQ Redis key structure
  - [ ] Format response with cinema_name, failure_reason, retry_count, failed_at
  - [ ] Sort by failed_at descending

- [ ] Implement DLQ GET single endpoint (AC: 2)
  - [ ] Add `/api/admin/dlq/jobs/:job_id` GET
  - [ ] Return full payload and failure context
  - [ ] Return 404 if job not found in DLQ

- [ ] Implement DLQ retry endpoint (AC: 3)
  - [ ] Add `/api/admin/dlq/jobs/:job_id/retry` POST
  - [ ] Remove job from DLQ, republish to main queue
  - [ ] Log the retry action for audit trail

- [ ] Implement auth middleware integration (AC: 4)
  - [ ] Apply existing admin auth middleware to all DLQ routes
  - [ ] In SaaS mode: scope DLQ queries to current tenant org

- [ ] Document DLQ API endpoints
  - [ ] Add OpenAPI/Swagger annotations
  - [ ] Example request/response payloads
  - [ ] Document error cases (401, 404, 409)
  - [ ] Reference existing DLQ scraper docs from PR #904

## Out of Scope

- **DLQ Admin UI**: Table with filters/pagination/retry buttons — future epic if needed
- **Bulk retry**: Retry all DLQ jobs at once — v2 enhancement
- **DLQ auto-purge**: Auto-cleanup oldest entries after N days — deferred

## Dev Notes

- DLQ Redis key structure was established in PR #904 (Story 2.1). Reuse same `scrape:dlq:*` keys.
- Admin auth middleware: `server/src/middleware/auth.ts`. SaaS variant: `packages/saas/src/middleware/tenant.ts`.
- In SaaS mode, DLQ queries must be org-scoped.
- DLQ endpoints should mount under `/api/admin/dlq/*` for standalone and `/api/org/:slug/admin/dlq/*` for SaaS.

## References

- `server/src/routes/admin.ts` — existing admin routes
- `packages/saas/src/routes/org.ts` — tenant-scoped admin routes
- PR #904: feat(scraper): add dead-letter queue support
- PR #919: fix(scraper): harden Redis reconnect recovery (DLQ consumption on reconnection failure)
- DLQ docs under `docs(scraper)` from original PR #904
