# Story 2.3: Redis Job Queue Load Testing (100+ Concurrent Jobs)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want integration tests that enqueue 100+ jobs simultaneously,
so that I can validate zero job loss under high load.

## Acceptance Criteria

1. **Given** the Redis job queue is running  
   **When** I enqueue 100 scraper jobs simultaneously  
   **Then** all 100 jobs are processed without loss  
   **And** the load-test scenario explicitly configures scraper concurrency to `5` and verifies the job processor respects that `p-limit` cap without changing the production default  
   **And** all jobs complete within 5 minutes

2. **Given** 100 jobs are processing  
   **When** I monitor Redis queue depth  
   **Then** the queue depth decreases steadily  
   **And** no jobs remain effectively stuck in the active queue or retry loop for more than 2 minutes under the test harness, without introducing a new Redis processing-state store  
   **And** completed jobs are removed from the queue

3. **Given** a job fails midway during load test  
   **When** the failure is detected  
   **Then** the job is marked as failed using the existing Redis retry and DLQ semantics  
   **And** the job enters retry logic with exponential backoff  
   **And** other jobs continue processing without interruption

## Tasks / Subtasks

- [x] Add RED integration tests for high-volume queue processing before implementation (AC: 1, 2, 3)
  - [x] Create or extend a scraper-focused integration test file that uses a real Redis instance rather than ioredis mocks
  - [x] Seed 100+ scrape jobs into `scrape:jobs` and assert all are eventually handled without loss
  - [x] Add one controlled failure case that exercises the existing Story 2.2 retry + DLQ behavior under concurrent load
  - [x] Use deterministic test doubles around job execution latency so the suite is bounded and not flaky

- [x] Build the load-test harness around existing scraper seams (AC: 1, 2, 3)
  - [x] Reuse `RedisJobConsumer.start()` as the queue-consumption seam instead of inventing a parallel worker harness
  - [x] Reuse the existing shared Redis queue keys and retry/DLQ contracts from `@allo-scrapper/logger`
  - [x] Keep concurrency assertions anchored to the existing `p-limit` concurrency control used by scraper processing
  - [x] Add only the minimum observability hooks needed for test assertions; do not redesign production queue architecture

- [x] Validate concurrency and queue-drain behavior under load (AC: 1, 2)
  - [x] Set `SCRAPER_CONCURRENCY=5` within the test harness and assert the active processing count never exceeds that configured cap
  - [x] Assert queue depth trends downward as work is consumed rather than stalling indefinitely
  - [x] Assert successful jobs are not requeued or left behind in `scrape:jobs` after completion
  - [x] Assert the load test finishes within a bounded timeout compatible with CI

- [x] Validate failure isolation under load (AC: 3)
  - [x] Inject a small number of deterministic handler failures while the rest of the batch succeeds
  - [x] Assert failed jobs follow the existing retry schedule and DLQ terminal path from Story 2.2
  - [x] Assert unrelated jobs continue progressing while retries are happening
  - [x] Assert no infinite retry loops or duplicate completions appear in the batch results

- [x] Keep story boundaries aligned with Epic 2 sequencing (AC: 1, 2, 3)
  - [x] Do not implement Redis disconnect/reconnect orchestration here; Story 2.4 owns reconnection handling
  - [x] Do not add a new persistent "processing" state store just for load testing
  - [x] Do not redesign queue APIs or add admin UI for load metrics in this story
  - [x] Keep the work focused on automated verification and any narrow supporting seams required to make the test reliable

- [x] Verify with focused commands after implementation (AC: 1, 2, 3)
  - [x] Run scraper integration or package tests that exercise the new 100-job scenario
  - [x] Run the existing scraper unit tests that cover concurrency-sensitive paths if shared seams change
  - [x] Run any server-side Redis integration coverage only if the implementation touches shared queue contracts outside the scraper workspace

## Dev Notes

### Scope and Guardrails

- This story is about proving queue reliability under load, not re-architecting the queue. The implementation should stay inside the existing Redis list + DLQ flow that Stories 2.1 and 2.2 already established.
- Favor one realistic integration-style harness over broad synthetic infrastructure changes. The goal is evidence that the current queue semantics hold at 100+ jobs.
- Keep the solution deterministic enough for CI. If the test depends on real browser scraping, it will be too slow and too flaky for the purpose of this story.

### Reinvention Prevention

- Reuse the queue contracts and retry helpers that already exist in `@allo-scrapper/logger`:
  - `SCRAPE_JOBS_KEY`
  - `SCRAPE_DLQ_KEY`
  - `MAX_SCRAPE_JOB_RETRY_ATTEMPTS`
  - `getScrapeJobRetryDelayMs()`
  - `createDlqJobEntry()`
  [Source: `packages/logger/src/index.ts:48-104`]
- Reuse `RedisJobConsumer.start()` for the queue-consumption loop instead of writing a second ad hoc consumer just for tests. [Source: `scraper/src/redis/client.ts:47-212`]
- Reuse the existing concurrency seam in scraper execution. The scraper already uses `p-limit` and reads `SCRAPER_CONCURRENCY`; this story should validate that seam rather than replace it. [Source: `scraper/src/scraper/index.ts:425-488`, `scraper/tests/unit/scraper/concurrency.test.ts:32-115`]
- Reuse the Redis Testcontainers direction established in Story 0.3 for any real-Redis integration setup. Do not require developers or CI to manually bring up Redis for this story’s automated verification. [Source: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:13-27`, `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:61-108`]

### Previous Story Intelligence (Story 2.2)

- Story 2.2 already made retry timing explicit and shared. Load tests in this story should treat those retry semantics as the contract under test, not as something to redefine. [Source: `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md:44-66`]
- Story 2.2 also hardened the consumer so jobs popped from Redis are not silently lost when retry or DLQ persistence hits transient Redis write failures. This story should include at least one failure-in-load assertion that protects that guarantee under concurrency. [Source: `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md:195-205`, `scraper/src/redis/client.ts:64-129`]
- Keep Story 2.2’s `retryCount` + DLQ semantics as the only source of truth for failed jobs. Do not invent a second status model just to measure load progress. [Source: `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md:56-66`]

### Current Code Reality That This Story Must Exercise

- The consumer loop processes one dequeued job at a time from Redis using `BLPOP`, and failed jobs now requeue with bounded exponential backoff or move to DLQ. [Source: `scraper/src/redis/client.ts:132-199`]
- `executeJob()` is the seam that updates report state and calls `runScraper()` with `rethrowOnFailure` in consumer mode. That makes consumer-mode execution the correct layer for load-test coverage. [Source: `scraper/src/index.ts:59-167`, `scraper/src/index.ts:209-232`]
- The scraper engine already uses `p-limit` based concurrency internally, with `SCRAPER_CONCURRENCY` read from environment. The load test should assert against that mechanism instead of inferring concurrency indirectly from wall-clock time alone. [Source: `scraper/src/scraper/index.ts:425-488`, `scraper/tests/unit/scraper/concurrency.test.ts:45-83`]
- The current default scraper concurrency is `2`, not `5`. The story should therefore require the load-test harness to set concurrency explicitly for the scenario rather than nudging the implementation toward changing application defaults just to satisfy the test. [Source: `scraper/src/scraper/index.ts:423-425`]
- Existing unit Redis tests are mock-based and do not prove real Redis queue behavior under load. This story should add higher-confidence coverage rather than overextending current unit mocks. [Source: `scraper/tests/unit/redis-client.test.ts:1-98`, `scraper/src/redis/client.test.ts:1-250`]

### Architecture Compliance Notes

- Keep all queue behavior within the current Redis structures:
  - active jobs: `scrape:jobs`
  - dead-letter jobs: `scrape:jobs:dlq`
  [Source: `packages/logger/src/index.ts:61-70`]
- Keep the load-test implementation in the scraper workspace unless a shared queue contract truly needs cross-workspace adjustment. The queue consumer and concurrency logic both live there today. [Source: `scraper/src/index.ts:209-232`, `scraper/src/redis/client.ts:47-212`]
- Preserve strict TypeScript, ESM imports, and structured logging. Avoid ad hoc scripts or one-off debugging code in production modules. [Source: `_bmad-output/project-context.md:60-79`, `_bmad-output/project-context.md:146-162`]
- If a real Redis container is required for automated verification, keep setup isolated to dedicated tests so existing fast unit suites stay fast. [Source: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:63-80`]

### Suggested Test Matrix

- Happy-path load test: enqueue 100 scrape jobs, consume them, assert all 100 complete and the queue drains to zero.
- Concurrency guard test: instrument active handler count and assert it never exceeds 5 during the batch.
- Failure-isolation load test: inject one or a few deterministic handler failures, assert retries occur, successful jobs still complete, and only terminal failures reach DLQ.
- Queue-depth trend test: sample queue depth during the run and assert it decreases over time rather than remaining flat or oscillating without progress.
- No-loss test: assert the total processed successes + retried terminal failures + DLQ entries equals the original number of enqueued jobs.
- No-infinite-loop test: assert failed jobs stop retrying at the existing terminal boundary.

### LLM-Dev Implementation Strategy

1. RED: add a failing real-Redis or integration-style test harness for 100+ queued jobs and a controlled failure case.
2. GREEN: add the smallest supporting seam needed to observe concurrency and queue-drain behavior without changing queue architecture.
3. HARDEN: verify failure isolation, no-loss accounting, and DLQ/retry behavior under load.
4. VERIFY: run the focused scraper test commands first; only expand to broader suites if shared seams changed.
5. DOCS: only update docs if the developer workflow for running load/integration tests changes materially.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md`
- `scraper/src/redis/client.ts` only if a narrow observability seam is required for testability
- `scraper/src/index.ts` only if a narrow hook is required to drive consumer-mode execution deterministically in tests
- `scraper/tests/unit/redis-client.test.ts` if existing unit coverage needs to be extended for shared retry/counting seams
- `scraper/tests/unit/scraper/concurrency.test.ts` if the existing concurrency assertions can be strengthened or reused
- `scraper/tests/integration/**` or equivalent dedicated scraper integration test location if a real Redis/Testcontainers harness is introduced
- `server/tests/README.md` or scraper testing docs only if a new explicit test command/workflow is added

### Pitfalls to Avoid

- Do not require real Puppeteer/browser scraping for the 100-job verification path.
- Do not implement Story 2.4’s reconnect-and-resume behavior here.
- Do not add a new Redis sorted set, lock key, or processing table just to make assertions easier.
- Do not rely only on elapsed wall-clock timing for concurrency proof when direct instrumentation is possible.
- Do not make the new load test so slow or flaky that it becomes unusable in CI.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:713-737`
- Planning notes for Story 2.3: `_bmad-output/planning-artifacts/notes-epics-stories.md:133-138`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:73-80`
- Previous story file: `_bmad-output/implementation-artifacts/2-2-add-exponential-backoff-retry-logic-for-redis-failures.md:44-205`
- Shared queue contracts: `packages/logger/src/index.ts:48-104`
- Consumer retry and DLQ behavior: `scraper/src/redis/client.ts:47-212`
- Consumer-mode execution seam: `scraper/src/index.ts:59-167`, `scraper/src/index.ts:209-232`
- Existing scraper concurrency control: `scraper/src/scraper/index.ts:425-488`
- Existing concurrency tests: `scraper/tests/unit/scraper/concurrency.test.ts:32-115`
- Existing mocked Redis unit tests: `scraper/tests/unit/redis-client.test.ts:1-98`
- Redis Testcontainers precedent: `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:13-27`, `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md:61-108`
- Project implementation guardrails: `_bmad-output/project-context.md:17-52`, `_bmad-output/project-context.md:110-137`, `_bmad-output/project-context.md:165-187`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- CS execution for story 2.3 based on Epic 2 planning artifacts, Story 2.2 implementation context, current scraper queue code, and existing concurrency tests
- `git log --oneline -5`
- `cd scraper && npm run test:run -- src/redis/client.test.ts tests/unit/scraper/concurrency.test.ts`
- `cd scraper && npm run test:integration`
- `cd scraper && npm run test:run`
- `npm run build --workspaces --if-present`

### Completion Notes List

- Story file created for Epic 2 Story 2.3 with load-testing scope centered on real queue behavior, no-loss guarantees, and bounded failure isolation under 100+ queued jobs.
- Anchored the work to existing `p-limit` concurrency seams and Story 2.2 retry/DLQ behavior instead of proposing new queue state models.
- Added guardrails to keep the future implementation deterministic and CI-friendly, with real Redis/Testcontainers usage as the preferred high-confidence path.
- Added a real-Redis scraper integration test that enqueues 100 jobs, verifies queue drain/no-loss accounting, and proves retries do not block unrelated jobs under load.
- Updated `RedisJobConsumer` to isolate blocking queue reads from retry/DLQ writes so delayed retries are not stalled behind `BLPOP`.
- Made delayed retry and DLQ persistence loops shutdown-aware so consumer disconnects do not hang on pending retry timers or Redis write retries.
- Hardened the load integration test cleanup path and strengthened concurrency regression coverage so the configured `p-limit` cap is actually enforced by tests.
- Added scraper-side `test:integration` support and documented the new Testcontainers-backed load test workflow.
- Verified the story with focused Redis consumer regressions, the full scraper suite, and a full workspace build.

### File List

- `_bmad-output/implementation-artifacts/2-3-redis-job-queue-load-testing-100-concurrent-jobs.md`
- `scraper/package.json`
- `scraper/src/redis/client.ts`
- `scraper/src/redis/client.test.ts`
- `scraper/tests/integration/redis-load.integration.test.ts`
- `scraper/tests/unit/scraper/concurrency.test.ts`
- `README.md`
- `docs/guides/development/testing.md`

## Change Log

- 2026-04-21: Added real-Redis scraper load integration coverage, background delayed requeue handling in the consumer, scraper integration test command support, and testing docs for the new workflow.
- 2026-04-21: Fixed code review findings by separating blocking Redis reads from retry writes, making retry shutdown deterministic, hardening integration cleanup, strengthening concurrency assertions, and re-verifying with scraper tests plus workspace builds.
