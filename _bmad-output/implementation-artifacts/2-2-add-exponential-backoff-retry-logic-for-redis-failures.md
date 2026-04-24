# Story 2.2: Add Exponential Backoff Retry Logic for Redis Failures

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want Redis connection failures to retry with exponential backoff,
so that transient Redis issues don't cause immediate job failures.

## Acceptance Criteria

1. **Given** a Redis connection timeout occurs when enqueuing a job  
   **When** the timeout is detected  
   **Then** the operation retries after 1 second  
   **And** if the 2nd attempt fails, retry after 2 seconds  
   **And** if the 3rd attempt fails, retry after 4 seconds or reach the terminal DLQ threshold according to the shared retry-attempt contract  
   **And** the final DLQ threshold is made explicit and consistent across backend enqueue, scraper consumer retry, and existing Story 2.1 behavior

2. **Given** a job is being dequeued from Redis  
   **When** Redis crashes mid-dequeue  
   **Then** the job is marked as failed in Redis  
   **And** the failure is logged with structured metadata (`job_id`, `error`, `timestamp`)  
   **And** the job is retried with exponential backoff  
   **And** this failed state maps to the existing Redis queue semantics (`retryCount` requeue or DLQ), not a new processing-state store

3. **Given** exponential backoff is implemented  
   **When** I run unit tests for retry logic  
   **Then** delays are calculated correctly: `[1s, 2s, 4s]`  
   **And** the test validates that after 3 failures, DLQ is invoked  
   **And** the chosen attempt-count semantics are asserted from a single shared source of truth  
   **And** no infinite retry loops occur

## Tasks / Subtasks

- [x] Add RED tests for enqueue and consumer retry behavior before implementation (AC: 1, 2, 3)
  - [x] Extend `server/src/services/redis-client.test.ts` to fail when `publishJob` and `publishAddCinemaJob` do not retry Redis write failures with delays `[1000, 2000, 4000]`
  - [x] Extend `scraper/src/redis/client.test.ts` to fail when handler failures are requeued immediately instead of after exponential backoff
  - [x] Add or extend `scraper/tests/unit/index.test.ts` only if the `executeJob`/consumer seam needs a higher-level guard against infinite retry loops or duplicate failure handling
  - [x] Use fake timers for backoff assertions; do not create slow real-time sleeps in test suites

- [x] Add a single reusable backoff helper for scraper job retry timing (AC: 1, 2, 3)
  - [x] Centralize delay calculation so both backend enqueue retry and scraper-side job retry use the same `[1s, 2s, 4s]` policy
  - [x] Keep the helper small, typed, and colocated with the Redis queue implementation rather than introducing a generic retry framework for the whole codebase
  - [x] Enforce a hard terminal boundary at 3 attempts to satisfy DLQ handoff and prevent infinite loops
  - [x] Make attempt semantics explicit in code and tests so the `[1s, 2s, 4s]` schedule and terminal DLQ behavior agree with the shared retry contract used by Story 2.1

- [x] Apply exponential backoff to backend Redis enqueue paths (AC: 1, 3)
  - [x] Update `RedisClient.publishJob` so transient Redis enqueue failures retry with backoff before surfacing terminal failure
  - [x] Update `RedisClient.publishAddCinemaJob` to follow the same retry contract instead of forking queue semantics
  - [x] If the 3rd enqueue attempt still fails, persist the job to the existing DLQ using the existing DLQ metadata shape rather than inventing a second failure sink
  - [x] Preserve `traceContext` and job payload fidelity when an enqueue failure ends in DLQ

- [x] Apply exponential backoff to scraper-side failed job requeue behavior (AC: 2, 3)
  - [x] Replace the current immediate `rpush` requeue path in `RedisJobConsumer.start()` with delayed retries at `[1s, 2s, 4s]`
  - [x] Keep the existing `retryCount` contract as the single source of truth for attempt state
  - [x] Interpret “marked as failed in Redis” as persisted retry state through the existing requeue/DLQ structures; do not invent a second processing-state structure without a planning change
  - [x] On terminal failure, continue using the current DLQ path and preserve tenant trace metadata
  - [x] Ensure dequeue/polling failures do not spin in a tight loop; keep retry behavior bounded and observable

- [x] Keep failure handling structured and operator-debuggable (AC: 1, 2)
  - [x] Log retry attempts with structured metadata including `job_id`, `retry_count`, error message, and timestamp context
  - [x] Distinguish retryable Redis failures from terminal DLQ movement in logs so operators can tell whether the system recovered or gave up
  - [x] Reuse existing logger conventions; do not add `console.log` or ad hoc error text

- [x] Keep story boundaries aligned with Epic 2 sequencing (AC: 1, 2, 3)
  - [x] Do not implement the 100+ concurrent load test matrix here; Story 2.3 owns load validation
  - [x] Do not implement reconnection-and-resume orchestration for in-flight jobs beyond bounded retry handling; Story 2.4 owns full disconnection recovery semantics
  - [x] Do not redesign the existing DLQ API surface added in Story 2.1 unless a narrow contract fix is required by the new retry logic
  - [x] Do not introduce database-backed retry persistence or a new queue technology; stay within the existing Redis list + sorted-set design

- [x] Verify with focused package-level commands after implementation (AC: 3)
  - [x] Run targeted server tests for Redis enqueue retry behavior
  - [x] Run targeted scraper tests for consumer retry timing and DLQ handoff
  - [x] Run broader package suites only if the changed seams touch shared logger/job contracts

## Dev Notes

### Scope and Guardrails

- This story is the second reliability slice of Epic 2. It should add retry timing behavior, not redesign the queue architecture established in Story 2.1.
- The existing Redis-backed DLQ and API contracts already exist. The job here is to make transient Redis failures retry predictably before terminal DLQ movement.
- Keep the implementation minimal and local to the current queue seams. A repo-wide generic retry abstraction would be unnecessary scope.

### Reinvention Prevention

- Reuse the current queue contract and helpers before adding anything new:
  - `packages/logger/src/index.ts`
  - `server/src/services/redis-client.ts`
  - `scraper/src/redis/client.ts`
  - `scraper/src/index.ts`
- Reuse `MAX_SCRAPE_JOB_RETRY_ATTEMPTS`, `SCRAPE_JOBS_KEY`, `SCRAPE_DLQ_KEY`, `createDlqJobEntry`, and the existing `retryCount` field instead of introducing parallel attempt counters or queue metadata. [Source: `packages/logger/src/index.ts:9-13`, `packages/logger/src/index.ts:48-63`, `packages/logger/src/index.ts:74-108`]
- Reuse the DLQ entry format and retry-from-DLQ reset semantics already shipped in Story 2.1. This story should complement them, not fork them. [Source: `server/src/services/redis-client.ts:74-142`, `docs/reference/api/scraper.md:400-524`]
- If one shared helper or retry constant is needed by both `server` and `scraper`, extend `packages/logger/src/index.ts`, because that package already owns queue keys, retry constants, and shared job typing for both runtimes. Avoid cross-workspace relative imports. [Source: `packages/logger/src/index.ts:7-63`]

### Previous Story Intelligence (Story 2.1)

- Story 2.1 deliberately stopped short of implementing the backoff engine and left that responsibility to this story. Do not re-open 2.1 scope around new APIs or UI. [Source: `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:59-63`, `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:141-145`]
- The previous story anchored failure handling on the existing Redis queue seams and preserved tenant trace metadata in DLQ payloads. Maintain that same continuity here. [Source: `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:83-93`, `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:100-107`]
- The previous story’s suggested test matrix already identified the terminal failure, metadata, and retry path expectations. This story should extend that with timing assertions rather than inventing a new test strategy. [Source: `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:108-123`]

### Current Code Reality That This Story Must Fix

- Backend enqueue paths currently do a single direct `rpush` with no retry logic:
  - `publishJob()` directly calls `rpush` once. [Source: `server/src/services/redis-client.ts:58-61`]
  - `publishAddCinemaJob()` directly calls `rpush` once. [Source: `server/src/services/redis-client.ts:63-67`]
- Scraper consumer job failures are currently requeued immediately with no delay calculation. The only branch today is immediate requeue vs immediate DLQ movement based on `retryCount`. [Source: `scraper/src/redis/client.ts:90-123`]
- Queue polling errors currently sleep a fixed `1000ms` before retrying. This story should avoid creating conflicting retry semantics between polling errors and failed job requeue behavior. [Source: `scraper/src/redis/client.ts:125-130`]
- `executeJob()` already supports propagated failures when `rethrowOnFailure` is requested by consumer mode. That makes the consumer the correct seam for bounded retry scheduling, not the job executor itself. [Source: `scraper/src/index.ts:63-66`, `scraper/src/index.ts:148-165`, `scraper/src/index.ts:230-232`]
- The current shared attempt contract is `MAX_SCRAPE_JOB_RETRY_ATTEMPTS = 3`, while the planning text asks for delays `[1s, 2s, 4s]`. Implementation must resolve that explicitly in one source of truth and update any Story 2.1-aligned tests together instead of silently changing only one side. [Source: `packages/logger/src/index.ts:61-63`, `server/src/services/redis-client.test.ts:52-184`, `scraper/src/redis/client.test.ts:124-165`, `_bmad-output/planning-artifacts/epics.md:695-710`]

### Architecture Compliance Notes

- Keep all queue behavior inside the existing Redis list + sorted-set architecture:
  - active jobs: `scrape:jobs`
  - dead-letter jobs: `scrape:jobs:dlq`
  [Source: `packages/logger/src/index.ts:61-63`]
- Backend publishing still flows through the server-side Redis client singleton; do not bypass it from route or service code. [Source: `server/src/services/scraper-service.ts:99-112`, `server/src/services/scraper-service.ts:132-145`]
- Scraper-side queue consumption still belongs in `RedisJobConsumer.start()`. Avoid moving retry orchestration into unrelated cron, route, or DB code. [Source: `scraper/src/redis/client.ts:54-145`]
- The current DLQ API routes are already exposed via `server/src/routes/scraper.ts`. This story should not create a second admin route family just for retry timing behavior. [Source: `server/src/routes/scraper.ts:213-270`]
- Preserve ESM, strict typing, and the structured logging conventions captured in project context. [Source: `_bmad-output/project-context.md:60-87`, `_bmad-output/project-context.md:101-107`, `_bmad-output/project-context.md:197-203`]

### Suggested Test Matrix

- Enqueue retry path: mock Redis write failure on `publishJob`, assert retries occur after `1000ms`, `2000ms`, then `4000ms` and succeed if Redis recovers before terminal failure.
- Terminal enqueue path: after the 3rd failed enqueue attempt, assert the original job is persisted to DLQ with preserved `traceContext` and no extra retries occur.
- Add-cinema parity path: `publishAddCinemaJob` follows the same backoff and terminal behavior as `publishJob`.
- Consumer retry path: failed handler execution increments `retryCount`, waits with exponential delay, and only then requeues the job.
- Consumer terminal path: a failed job at the final attempt lands in DLQ exactly once, with no extra requeue.
- Infinite-loop guard: once the terminal attempt is reached, there is no further retry scheduling.
- Logging path: retry logs include structured metadata that distinguishes retry attempts from terminal DLQ movement.

### LLM-Dev Implementation Strategy

1. RED: write timer-controlled tests around server enqueue retry and scraper consumer retry behavior.
2. GREEN: add one small backoff utility plus the minimal call-site changes in server and scraper Redis clients.
3. HARDEN: preserve existing `retryCount`/DLQ semantics and structured log context.
4. VERIFY: run targeted tests first, then broader package suites only where shared contracts changed.
5. DOCS: update only if externally visible API or operator workflow changed; retry timing internals alone do not require README churn.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md`
- `packages/logger/src/index.ts`
- `server/src/services/redis-client.ts`
- `server/src/services/redis-client.test.ts`
- `server/src/services/scraper-service.ts` only if a narrow hook is required to surface enqueue failure handling cleanly
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`
- `scraper/tests/unit/index.test.ts` only if higher-level retry invariants need coverage
- `docs/reference/api/scraper.md` only if endpoint contract or visible operator behavior changes

### Pitfalls to Avoid

- Do not implement unbounded recursive retry logic or background retry workers.
- Do not duplicate retry state in both job payload and a second Redis structure.
- Do not move route/service callers to manual retry loops outside `RedisClient`.
- Do not silently swallow terminal enqueue failures; they must remain observable through DLQ and logs.
- Do not rework the existing DLQ API contract unless a failing test proves a necessary adjustment.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:687-711`
- Planning notes for Story 2.2: `_bmad-output/planning-artifacts/notes-epics-stories.md:126-131`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:73-80`
- Previous story file: `_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md:74-186`
- Queue publisher seams: `server/src/services/redis-client.ts:58-89`
- Existing trigger/resume publisher calls: `server/src/services/scraper-service.ts:76-145`
- Current DLQ API surface: `server/src/routes/scraper.ts:213-270`
- Current consumer retry/DLQ behavior: `scraper/src/redis/client.ts:58-145`
- Job execution seam: `scraper/src/index.ts:63-66`, `scraper/src/index.ts:148-165`, `scraper/src/index.ts:230-232`
- Existing DLQ tests: `server/src/services/redis-client.test.ts:52-184`, `scraper/src/redis/client.test.ts:124-165`
- Existing operator docs for DLQ endpoints: `docs/reference/api/scraper.md:400-524`
- Workflow and implementation guardrails: `_bmad-output/project-context.md:60-87`, `_bmad-output/project-context.md:167-217`
- Redis Testcontainers expectations: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:82-108`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 2.2 based on sprint tracker, Epic 2 planning artifacts, implemented Story 2.1, and recent Redis/DLQ commits
- `git log --oneline -5`
- `git show --stat --oneline --summary HEAD~4..HEAD`
- `cd server && npm run test:run -- src/services/redis-client.test.ts src/services/scraper-service.test.ts`
- `cd server && npm run test:run`
- `cd scraper && npm run test:run -- src/redis/client.test.ts`
- `cd scraper && npm run test:run`

### Completion Notes List

- Story file created for Epic 2 Story 2.2 with implementation guardrails centered on bounded exponential backoff for Redis enqueue and consumer retry failures.
- Anchored the work to the already-shipped DLQ architecture so this story extends existing behavior instead of redesigning it.
- Captured the current code gap explicitly: direct enqueue without retries, immediate consumer requeue, and fixed 1s poll error sleep.
- Kept Story 2.3 load testing, Story 2.4 reconnection orchestration, and broader DLQ API redesign out of scope.
- Implemented bounded exponential backoff on server-side Redis enqueue paths and scraper-side failed job requeue paths using the shared 3-attempt contract.
- Preserved terminal DLQ behavior and tenant trace metadata, while adding structured retry vs terminal-failure logs for operators.
- Hardened `ScraperService` so reports are marked `failed` if job publication exhausts retries and never actually reaches the queue.
- Added timer-based regression tests for enqueue retry, terminal enqueue failure to DLQ, delayed consumer requeue, and terminal consumer DLQ movement.

### File List

- `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/logger/src/index.ts`
- `server/src/services/redis-client.ts`
- `server/src/services/redis-client.test.ts`
- `server/src/services/scraper-service.ts`
- `server/src/services/scraper-service.test.ts`
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`

## Change Log

- 2026-04-21: Created implementation-ready story file for Epic 2 Story 2.2 with concrete guidance around bounded retry timing, reuse of existing DLQ/job contracts, and focused test expectations for enqueue and consumer failure paths.
- 2026-04-21: Implemented bounded Redis enqueue and consumer retry backoff with terminal DLQ handoff, added targeted timer-based regression coverage, and marked failed reports when publication exhausts retries.
