# Story 2.4: Redis Reconnection Handling During Job Processing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want the job processor to handle Redis disconnections gracefully,
so that in-flight jobs are resumed after reconnection.

## Acceptance Criteria

1. **Given** Redis disconnects while a job is processing  
   **When** the disconnection is detected  
   **Then** the job processor pauses and attempts to reconnect  
   **And** reconnection retries with exponential backoff (`1s`, `2s`, `4s`)  
   **And** in-flight jobs are not marked as failed during the reconnection window

2. **Given** Redis reconnects successfully  
   **When** the connection is restored  
   **Then** the job processor resumes processing jobs  
   **And** jobs that were paused are resumed from the existing checkpoint model (`resumeMode` + `pendingAttempts`, or the original job if no resume checkpoint exists)  
   **And** no jobs are duplicated or lost

3. **Given** Redis fails to reconnect after 3 attempts  
   **When** the final reconnection attempt fails  
   **Then** all tracked in-flight jobs are moved to DLQ exactly once  
   **And** the job processor logs a critical structured error  
   **And** any operator alert remains log/observability-driven unless a concrete alert transport already exists in code

## Tasks / Subtasks

- [x] Add RED coverage for Redis disconnect and reconnect behavior before implementation (AC: 1, 2, 3)
  - [x] Extend `scraper/src/redis/client.test.ts` with unit tests around connection lifecycle events (`close`, `reconnecting`, `ready`, `end`) and the consumer's reaction to them
  - [x] Add or extend `scraper/tests/integration/redis-load.integration.test.ts` with a real-Redis reconnection scenario that proves no job loss or duplication across a disconnect window
  - [x] Add a focused `executeJob`/resume-path regression in `scraper/tests/unit/index.test.ts` only if a new hook is introduced to republish or resume paused work
  - [x] Use fake timers for reconnection backoff assertions; keep any real container-based reconnection test bounded and CI-safe

- [x] Introduce explicit consumer-side connection state handling without replacing ioredis reconnect behavior (AC: 1, 2, 3)
  - [x] Reuse ioredis auto-reconnect on both Redis connections instead of building a second socket-reconnect framework
  - [x] Configure reconnect timing to align with the shared story contract (`1s`, `2s`, `4s`) and stop after the terminal attempt for this story's failure path
  - [x] Track whether the consumer is in a paused reconnection state so queue polling and retry persistence do not create duplicate recovery work
  - [x] Keep blocking reads isolated from command writes, preserving the two-client design added in Story 2.3

- [x] Track in-flight jobs explicitly enough to support recovery and terminal DLQ handoff (AC: 1, 2, 3)
  - [x] Record the currently executing job before invoking the handler and clear it only after success, terminal DLQ movement, or explicit recovery handoff
  - [x] On disconnect, keep in-flight jobs out of the normal handler-failure path so they are not immediately marked failed just because Redis became unavailable
  - [x] On reconnect success, resume each tracked in-flight job exactly once using the existing checkpoint semantics where available
  - [x] On reconnect exhaustion, move each tracked in-flight job to DLQ exactly once with preserved trace metadata and a failure reason that distinguishes reconnect exhaustion from business-logic failure

- [x] Reuse the existing scrape checkpoint model instead of inventing a new persistence layer (AC: 2, 3)
  - [x] Treat `scrape_attempts` plus `resumeMode`/`pendingAttempts` as the resume checkpoint for scrape jobs that already persist partial date-level progress
  - [x] For job types that do not have resumable partial state, resume by re-running the original job payload once after reconnection instead of introducing a new checkpoint table
  - [x] If a helper is needed to derive pending attempts for a running report, add it in the existing scraper DB/service seams rather than creating ad hoc Redis state
  - [x] Keep Story 2.4 scoped to reconnection recovery; do not redesign report schemas or add a new queue technology

- [x] Keep operators informed with structured observability only (AC: 1, 3)
  - [x] Log reconnect start, retry delay, reconnect success, and reconnect exhaustion with `job_id`, `reportId`, `retry_count`, `timestamp`, and tenant trace context when available
  - [x] Emit a critical log on reconnect exhaustion; do not claim Slack/PagerDuty/email delivery unless code for that transport is added in this story
  - [x] Preserve the existing Winston-based structured logging style and avoid `console.log`

- [x] Verify with focused scraper commands after implementation (AC: 1, 2, 3)
  - [x] Run `cd scraper && npm run test:run -- src/redis/client.test.ts tests/unit/index.test.ts`
  - [x] Run `cd scraper && npm run test:integration`
  - [x] Run `cd scraper && npm run test:run`
  - [x] Run `npm run build --workspaces --if-present` if shared queue contracts or cross-workspace types change

## Dev Notes

### Scope and Guardrails

- This story is about graceful Redis disconnection recovery for the scraper consumer, not a queue architecture rewrite. Keep the implementation anchored to the existing Redis list + DLQ model from Stories 2.1-2.3.
- The current code already has the key seam for safe recovery: `executeJob()` can rethrow failures in consumer mode, and scrape execution already persists date-level progress into `scrape_attempts`. Build on those seams instead of adding a new processing-state store. [Source: `scraper/src/index.ts:63-67`, `scraper/src/index.ts:148-165`, `scraper/src/index.ts:230-232`, `scraper/src/scraper/index.ts:235-358`]
- There is no separate architecture document in `_bmad-output/planning-artifacts` for this project snapshot. Use the current codebase and `project-context.md` as the architecture source of truth for this story.

### Reinvention Prevention

- Reuse the shared queue contracts and retry constants already owned by `@allo-scrapper/logger`:
  - `SCRAPE_JOBS_KEY`
  - `SCRAPE_DLQ_KEY`
  - `MAX_SCRAPE_JOB_RETRY_ATTEMPTS`
  - `SCRAPE_JOB_RETRY_DELAYS_MS`
  - `getScrapeJobRetryDelayMs()`
  - `createDlqJobEntry()`
  [Source: `packages/logger/src/index.ts:48-104`]
- Reuse `RedisJobConsumer` as the only consumer loop. Do not create a second worker abstraction, sidecar recovery daemon, or new Redis recovery queue. [Source: `scraper/src/redis/client.ts:47-269`]
- Reuse ioredis reconnect capabilities (`retryStrategy`, connection events, re-send of unfulfilled blocking commands) rather than writing custom socket reconnect code from scratch. Align the configured delays with this story's `1s`, `2s`, `4s` contract. [Source: ioredis auto-reconnect docs]
- Reuse the existing resume mechanism already present in scrape jobs: `resumeMode` and `pendingAttempts`. That is the project's current notion of a checkpoint. [Source: `packages/logger/src/index.ts:18-25`, `server/src/services/scraper-service.ts:130-176`, `scraper/src/scraper/index.ts:212-226`, `scraper/src/db/scrape-attempt-queries.ts:95-108`]

### Previous Story Intelligence (Story 2.3)

- Story 2.3 intentionally deferred reconnect-and-resume behavior to this story. Do not fold load-testing-only assertions back into the implementation unless they are required to prove reconnection semantics. [Source: `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md:59-63`, `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md:144-148`]
- Story 2.3 introduced and validated the two-client consumer split (`blockingClient` for `BLPOP`, `commandClient` for writes). Preserve that design when adding reconnect handling; it is the current protection against retry writes being blocked behind `BLPOP`. [Source: `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md:185-188`, `scraper/src/redis/client.ts:56-63`, `scraper/src/redis/client.ts:183-248`]
- Story 2.3 already proved one important recovery invariant: other jobs continue moving while retry delays are pending. Story 2.4 should extend that by proving disconnect pauses do not create job loss or duplicate completions. [Source: `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md:117-122`, `scraper/tests/integration/redis-load.integration.test.ts:88-177`]

### Current Code Reality That This Story Must Extend

- `RedisJobConsumer` currently has no explicit reconnect event handling. It catches polling errors, logs them, and sleeps `1000ms`, but it does not track in-flight jobs or distinguish connection loss from handler failure. [Source: `scraper/src/redis/client.ts:176-245`]
- `RedisJobConsumer` currently knows about pending delayed retry operations, but not about active handler executions. Story 2.4 needs a narrow in-flight tracking seam to support pause/resume and terminal DLQ movement. [Source: `scraper/src/redis/client.ts:52-54`, `scraper/src/redis/client.ts:169-174`, `scraper/src/redis/client.ts:247-248`]
- The scraper already records per-date progress in `scrape_attempts`, marking pending, success, failed, rate-limited, and not-attempted states. This is the best existing checkpoint data to use when resuming a partially completed scrape report. [Source: `scraper/src/db/scrape-attempt-queries.ts:17-108`, `scraper/src/scraper/index.ts:235-358`]
- `ScraperService.triggerResume()` already queues a new scrape job using `resumeMode: true` and a derived `pendingAttempts` list. If Story 2.4 needs to resume from a checkpoint after reconnect, prefer reusing this shape or a close internal equivalent. [Source: `server/src/services/scraper-service.ts:130-176`]
- `runScraper()` already supports resumable pending-attempt execution. It filters dates using `pendingAttempts` and therefore can continue a partial report without starting from scratch when that state exists. [Source: `scraper/src/scraper/index.ts:212-226`, `scraper/src/scraper/index.ts:402-529`]
- The current non-scrape `add_cinema` job path has no partial checkpoint model. For that job type, reconnect recovery should be idempotent re-execution of the original job payload or terminal DLQ on reconnect exhaustion, not a new persistence scheme. [Source: `packages/logger/src/index.ts:28-34`, `scraper/src/index.ts:85-113`]

### Architecture Compliance Notes

- Keep all queue behavior in the existing Redis structures:
  - active queue: `scrape:jobs`
  - dead-letter queue: `scrape:jobs:dlq`
  [Source: `packages/logger/src/index.ts:61-64`]
- Keep consumer changes in `scraper/src/redis/client.ts` and resume/checkpoint support in existing scraper DB/service files only if needed. Do not move reconnection orchestration into route handlers or frontend code. [Source: `_bmad-output/project-context.md:101-107`, `_bmad-output/project-context.md:146-150`]
- Preserve strict TypeScript, ESM imports, and structured logging. Avoid `any` in new queue state or reconnect metadata types. [Source: `_bmad-output/project-context.md:60-79`, `_bmad-output/project-context.md:197-203`]
- Keep reconnection tests isolated to scraper unit/integration suites so server/client feedback loops stay fast. Existing scraper scripts already support `test:integration`. [Source: `scraper/package.json:7-15`]

### Suggested Test Matrix

- Unit reconnect-backoff test: simulate consumer connection `close`/`reconnecting` events and assert retry delays follow `1s`, `2s`, `4s`.
- In-flight preservation test: disconnect Redis while a handler is still running, assert the job is not immediately requeued, marked failed, or written to DLQ during the reconnect window.
- Resume-success test: restore Redis before terminal exhaustion and assert the tracked in-flight job resumes exactly once, with no duplicate completion.
- Resume-from-checkpoint test: for a scrape job with partial `scrape_attempts` state, resume using `resumeMode`/`pendingAttempts` so only unfinished work is retried.
- Terminal reconnect exhaustion test: after the third reconnect failure, assert each tracked in-flight job is written to DLQ exactly once with a reconnect-specific failure reason.
- Load-adjacent integration test: prove that a disconnect window does not lose queued jobs and does not produce duplicate report completions across reconnect.

### LLM-Dev Implementation Strategy

1. RED: add unit tests for reconnect state transitions and one integration test for disconnect/reconnect behavior with a real Redis container.
2. GREEN: add the smallest possible in-flight tracking plus reconnect event handling in `RedisJobConsumer`.
3. CHECKPOINT: reuse `resumeMode`/`pendingAttempts` and existing `scrape_attempts` data rather than inventing new persistent recovery state.
4. HARDEN: make terminal reconnect exhaustion move tracked jobs to DLQ once, with critical structured logs.
5. VERIFY: run focused scraper suites first, then broader workspace build/tests only if shared types changed.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/2-4-redis-reconnection-handling-during-job-processing.md`
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`
- `scraper/src/index.ts` only if a narrow recovery hook is needed around `executeJob`
- `scraper/src/db/scrape-attempt-queries.ts` only if a minimal helper is needed to derive pending attempts for resume
- `scraper/tests/unit/index.test.ts` only if a new execution/resume seam is introduced
- `scraper/tests/integration/redis-load.integration.test.ts` or a sibling integration file for disconnect/reconnect validation
- `docs/reference/api/scraper.md` only if externally visible operator behavior changes
- `AGENTS.md` only if reconnect handling introduces a durable repo gotcha for future agents

### Pitfalls to Avoid

- Do not add a new Redis "processing" sorted set, lock table, or checkpoint queue just to model in-flight work.
- Do not treat a transient Redis disconnect as a job handler failure and send the job down the existing retry path immediately.
- Do not claim an alert was sent to DevOps unless a real alert transport is implemented; logging a critical event is the current minimum truthful behavior.
- Do not resume scrape jobs by blindly re-running full jobs when `scrape_attempts` already contains enough state to continue partially completed work.
- Do not rely only on `BLPOP` retry loops; explicit connection-state handling is required so reconnection is observable and testable.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:739-763`
- Planning notes for Story 2.4: `_bmad-output/planning-artifacts/notes-epics-stories.md:140-145`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:73-80`
- Previous story file: `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md:91-163`
- Shared queue contracts: `packages/logger/src/index.ts:15-115`
- Current consumer implementation: `scraper/src/redis/client.ts:47-269`
- Consumer execution seam: `scraper/src/index.ts:63-67`, `scraper/src/index.ts:209-232`
- Existing resume publisher flow: `server/src/services/scraper-service.ts:130-176`
- Existing checkpoint persistence: `scraper/src/db/scrape-attempt-queries.ts:17-108`
- Existing scrape resume behavior: `scraper/src/scraper/index.ts:212-226`, `scraper/src/scraper/index.ts:235-358`
- Existing real-Redis integration harness: `scraper/tests/integration/redis-load.integration.test.ts:88-177`
- Project implementation guardrails: `_bmad-output/project-context.md:17-52`, `_bmad-output/project-context.md:56-87`, `_bmad-output/project-context.md:110-137`, `_bmad-output/project-context.md:165-203`
- Scraper test commands: `scraper/package.json:7-15`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 2.4 based on Epic 2 planning artifacts, Story 2.3 implementation context, current Redis consumer code, resume/checkpoint seams, and recent scraper Redis commits
- `git log --oneline -5`
- `git diff --name-only HEAD~5..HEAD`
- `ioredis` auto-reconnect documentation review
- `cd scraper && npm run test:run -- src/redis/client.test.ts tests/unit/index.test.ts`
- `cd scraper && npm run test:integration`
- `cd scraper && npm run test:run`
- `npm run build --workspaces --if-present`

### Completion Notes List

- Story file created for Epic 2 Story 2.4 with reconnection handling anchored to the existing two-client consumer, shared queue contracts, and the current resume/checkpoint model.
- Captured the real implementation gap: there is no in-flight job tracking or explicit Redis connection-state handling in `RedisJobConsumer` yet.
- Clarified that "resume from checkpoint" should reuse `scrape_attempts` plus `resumeMode`/`pendingAttempts`, not a new persistence layer.
- Narrowed the acceptance criterion about DevOps alerts so the future implementation stays truthful: critical structured logs are required, external alert transport is optional unless actually implemented.
- Implemented reconnect-aware consumer state in `RedisJobConsumer` with ioredis-backed retry strategy, explicit in-flight tracking, reconnect gating, recovery requeue, and terminal DLQ handoff.
- Added `buildRecoveryJob()` in the scraper runtime so reconnect recovery reuses existing `scrape_attempts` checkpoint data through `resumeMode` and `pendingAttempts`.
- Added unit coverage for reconnect lifecycle handling and integration coverage proving a disconnect window resumes work without queue loss or duplicate completion.
- Re-verified the full scraper suite and workspace build after the reconnect changes.

### File List

- `_bmad-output/implementation-artifacts/2-4-redis-reconnection-handling-during-job-processing.md`
- `scraper/src/index.ts`
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`
- `scraper/tests/integration/redis-load.integration.test.ts`
- `scraper/tests/unit/index.test.ts`

## Change Log

- 2026-04-23: Created implementation-ready story file for Epic 2 Story 2.4 with concrete reconnect, resume, DLQ, and testing guardrails based on the current scraper queue architecture.
- 2026-04-23: Implemented Redis reconnect handling with in-flight recovery, checkpoint-based resume job rebuilding, reconnect exhaustion DLQ handoff, and scraper test coverage for reconnect scenarios.
