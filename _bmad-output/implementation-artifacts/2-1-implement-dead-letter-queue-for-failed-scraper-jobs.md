# Story 2.1: Implement Dead-Letter Queue for Failed Scraper Jobs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a DevOps engineer,
I want failed scraper jobs to move to a dead-letter queue after 3 retry attempts,
so that failed jobs do not block the queue and can be inspected or retried safely.

## Acceptance Criteria

1. **Given** a scraper job fails 3 times with exponential backoff (`1s`, `2s`, `4s`)  
   **When** the 3rd retry fails  
   **Then** the job is moved to the dead-letter queue (DLQ)  
   **And** the DLQ entry includes metadata: `job_id`, `failure_reason`, `retry_count`, `timestamp`, `cinema_id`, `org_id`  
   **And** the job is removed from the active queue

2. **Given** a job is in the DLQ  
   **When** I query `GET /api/scraper/dlq`  
   **Then** the API returns all DLQ jobs with metadata  
   **And** jobs are sorted by timestamp (most recent first)  
   **And** the response includes pagination (max 50 jobs per page)

3. **Given** a job is in the DLQ  
   **When** an admin retries it through the backend contract  
   **Then** the job is re-queued to the active queue  
   **And** the retry counter is reset to `0`  
   **And** the job executes with fresh attempts

## Tasks / Subtasks

- [ ] Add RED tests for DLQ persistence and queue behavior before implementation (AC: 1, 2, 3)
  - [ ] Add or extend unit/integration tests in `server/src/services/redis-client.test.ts` and/or a new focused DLQ service test to fail when failed jobs are not persisted separately from `scrape:jobs`
  - [ ] Add or extend route tests in `server/src/routes/scraper.test.ts` for `GET /api/scraper/dlq` response shape, ordering, pagination, and permission behavior
  - [ ] Add or extend scraper worker tests in `scraper/src/redis/client.test.ts` and/or `scraper/src/index.test.ts` to fail when 3 terminal failures do not end in DLQ movement
  - [ ] Keep the RED coverage focused on DLQ movement and inspection only; do not pull Story 2.2's retry-delay math into this story beyond contract assumptions

- [ ] Implement a single DLQ persistence path for failed scraper jobs (AC: 1)
  - [ ] Add a dedicated DLQ storage mechanism using the existing Redis architecture and naming conventions; do not invent a second queueing system outside Redis for this story
  - [ ] Ensure a job that reaches terminal failure is removed from `scrape:jobs` processing flow and written to DLQ with required metadata
  - [ ] Keep job metadata typed and compatible with existing `ScrapeJob` shape plus the minimum DLQ envelope needed for diagnostics
  - [ ] Preserve tenant observability context (`org_id`, `org_slug`, `user_id`, `endpoint`) when available so failed jobs remain traceable

- [ ] Add API read access for DLQ inspection (AC: 2)
  - [ ] Implement `GET /api/scraper/dlq` in the existing scraper route area, using current auth/permission patterns rather than introducing a parallel admin router
  - [ ] Return a paginated response capped at 50 items per page and sorted newest-first
  - [ ] Keep response metadata explicit and deterministic so later Story 2.6 can build on it without breaking contract
  - [ ] If a stricter admin-only endpoint is deferred to Story 2.6, document the chosen scope in completion notes and keep this story's route contract minimal and test-backed

- [ ] Add retry-from-DLQ backend contract without UI scope creep (AC: 3)
  - [ ] Implement the backend requeue path needed to retry a DLQ job and reset its retry counter
  - [ ] Do not build admin UI, filters, live updates, or table rendering in this story
  - [ ] Reuse existing job publication helpers where possible so retrying a DLQ item does not fork queue semantics
  - [ ] Ensure invalid or missing DLQ entries return deterministic not-found behavior instead of silent no-ops

- [ ] Keep story boundaries aligned with Epic 2 sequencing (AC: 1, 2, 3)
  - [ ] Do not fully implement the retry backoff engine in this story beyond the DLQ handoff contract; Story 2.2 owns the backoff calculation details
  - [ ] Do not implement the 100+ job load test matrix; Story 2.3 owns that
  - [ ] Do not implement Redis reconnection orchestration; Story 2.4 owns that
  - [ ] Do not add DLQ UI components; Story 2.6 is explicitly API-only for MVP and any UI is future work

- [ ] Preserve existing logging, error handling, and deployment patterns (AC: 1, 2, 3)
  - [ ] Use structured logger output for DLQ enqueue/retry/failure transitions
  - [ ] Keep ESM, strict typing, and existing route/service separation intact
  - [ ] Follow the project migration rules if DLQ storage requires schema changes: idempotent migration, verification step, and inventory update

- [ ] Update documentation only where the new backend contract becomes externally relevant (AC: 2, 3)
  - [ ] Update `README.md` or API docs if the DLQ endpoints become part of the contributor/operator workflow
  - [ ] Update testing guidance only if there is a new Redis/Testcontainers command or DLQ-specific test flow contributors must know

## Dev Notes

### Scope and Guardrails

- This story is the first reliability slice of Epic 2. Keep scope centered on DLQ storage, inspection, and backend retry contract.
- The story must not absorb Story 2.2, 2.3, 2.4, or 2.6 responsibilities.
- Stay API-first. The planning notes explicitly keep DLQ UI out of MVP scope.
- Prefer the smallest correct extension of the current Redis queue design rather than introducing new infra or database-first orchestration.

### Reinvention Prevention

- Reuse the existing queue infrastructure before adding anything new:
  - `server/src/services/redis-client.ts`
  - `server/src/routes/scraper.ts`
  - `server/src/services/scraper-service.ts`
  - `scraper/src/redis/client.ts`
  - `scraper/src/index.ts`
- Reuse the existing `ScrapeJob` contract and trace-context shape where possible.
- Reuse Redis/Testcontainers patterns already established in Story 0.3 rather than creating a separate integration harness.

### Previous Story Intelligence (from Epic 0 and Epic 1)

- Story 0.3 established the expectation that Redis-backed integration paths should be validated against real containers in CI/local where appropriate, with concise failure logging for first-pass debugging. [Source: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:82-108`]
- Story 0.2 showed the value of deterministic payloads, structured diagnostics, and explicit cleanup boundaries when building test-supporting backend contracts. The same discipline should apply to DLQ entries and retry flows. [Source: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md:81-89`, `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md:118-156`]
- Epic 1 reinforced a pattern that is relevant here too: boundary behavior should be locked through explicit denial-path and invariant tests rather than by assuming the architecture will behave correctly. [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-21.md:49-67`]

### Architecture Compliance Notes

- Backend job publication currently flows through `server/src/services/redis-client.ts`, which writes serialized `ScrapeJob` payloads into Redis list `scrape:jobs`. [Source: `server/src/services/redis-client.ts:65-83`]
- The scraper worker currently consumes `scrape:jobs` through `RedisJobConsumer` and executes jobs in `scraper/src/index.ts`. This is the correct seam to extend for terminal-failure -> DLQ behavior. [Source: `scraper/src/redis/client.ts:73-147`, `scraper/src/index.ts:58-152`]
- Current scraper routes already centralize scrape-related API contracts in `server/src/routes/scraper.ts`; keep DLQ inspection/retry in this existing route surface unless a later story explicitly moves it. [Source: `server/src/routes/scraper.ts:42-220`]
- Existing logging and observability patterns already include tenant trace context on scraper jobs; preserve that context in DLQ metadata instead of introducing a second tracing scheme. [Source: `server/src/services/redis-client.ts:9-14`, `scraper/src/index.ts:63-70`]
- If DLQ persistence requires a database migration, follow project migration rules strictly: idempotent SQL, verification step, and update `server/src/db/system-queries.test.ts`. [Source: `_bmad-output/project-context.md:204-207`]

### Suggested Test Matrix

- Terminal failure path: a job that exhausts 3 attempts ends in DLQ and is no longer active in the primary queue.
- DLQ metadata path: persisted entry includes `job_id`, `failure_reason`, `retry_count`, `timestamp`, `cinema_id`, and `org_id` when applicable.
- API read path: `GET /api/scraper/dlq?page=1` returns newest-first results with max 50 items.
- Retry path: retrying a DLQ job re-publishes it to `scrape:jobs` with reset retry count and removes or marks the DLQ entry appropriately.
- Failure path: unknown DLQ job id returns deterministic not-found response.
- Integration path: Redis-backed tests use the established Testcontainers flow rather than a mocked-only happy path.

### LLM-Dev Implementation Strategy

1. RED: write failing tests around DLQ persistence, listing, and retry behavior.
2. GREEN: add the smallest DLQ persistence/read/retry implementation that satisfies those tests.
3. HARDEN: preserve structured metadata, deterministic ordering, and clear error contracts.
4. VERIFY: run targeted server and scraper suites, plus Redis-backed integration tests if changed.
5. DOCS: update API/testing docs only if the contract becomes operator-facing.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md`
- `server/src/services/redis-client.ts`
- `server/src/services/redis-client.test.ts`
- `server/src/routes/scraper.ts`
- `server/src/routes/scraper.test.ts`
- `server/src/services/scraper-service.ts` (only if orchestration needs a minimal hook)
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`
- `scraper/src/index.ts`
- `migrations/*.sql` and `server/src/db/system-queries.test.ts` only if persistent DB-backed DLQ storage is introduced
- `README.md` and/or `docs/reference/api/scraper.md` only if the endpoint contract should be documented now

### Pitfalls to Avoid

- Do not implement DLQ UI in this story.
- Do not fully absorb exponential backoff policy logic from Story 2.2 into this story.
- Do not create a second parallel job contract for retried jobs if the existing `ScrapeJob` contract can be extended minimally.
- Do not lose tenant trace context when a job moves from active queue to DLQ.
- Do not add non-idempotent migrations or forget migration inventory updates if schema changes are introduced.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:661-685`
- Planning notes for Epic 2 / Story 2.1: `_bmad-output/planning-artifacts/notes-epics-stories.md:112-124`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:73-80`
- Epic 1 retrospective: `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-21.md`
- Redis Testcontainers guidance: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:82-108`
- Fixture/API contract discipline: `_bmad-output/implementation-artifacts/0-2-implement-multi-tenant-test-fixture-api.md:118-156`
- Queue publisher: `server/src/services/redis-client.ts:65-83`
- Scraper API route surface: `server/src/routes/scraper.ts:42-220`
- Redis job consumer: `scraper/src/redis/client.ts:73-147`
- Job execution flow: `scraper/src/index.ts:58-152`
- Workflow rules and migration gotchas: `_bmad-output/project-context.md:167-207`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 2.1 based on sprint tracker, Epic 2 planning artifacts, Epic 0 Redis/Testcontainers groundwork, and Epic 1 retrospective learnings
- `git log -5 --oneline`

### Completion Notes List

- Story file created for the first Epic 2 reliability slice, scoped to DLQ persistence, inspection, and backend retry behavior.
- Separated this story explicitly from Story 2.2 backoff logic, Story 2.3 load testing, Story 2.4 reconnection handling, and Story 2.6 API/UI expansion.
- Anchored the story in the existing Redis queue seams (`scrape:jobs`, `RedisJobConsumer`, `server/src/routes/scraper.ts`) to reduce implementation drift.
- Carried forward the Epic 1 retrospective lesson that boundary and failure contracts should be tested explicitly, not assumed.

### File List

- `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-21: Created implementation-ready story file for Epic 2 Story 2.1 with guardrails around Redis-backed DLQ storage, API-first scope, explicit separation from later retry/load/reconnection stories, and references to the existing queue architecture.
