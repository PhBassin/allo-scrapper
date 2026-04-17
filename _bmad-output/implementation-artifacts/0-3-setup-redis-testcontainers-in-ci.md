# Story 0.3: Setup Redis Testcontainers in CI

Status: done

## Story

As a QA engineer,
I want Redis Testcontainers configured in the CI pipeline,
so that integration tests can run against a real Redis instance without manual setup.

## Acceptance Criteria

1. **Given** the GitHub Actions workflow exists  
   **When** integration tests run in CI  
   **Then** a Redis container is automatically started via Testcontainers  
   **And** the container is accessible from tests via runtime host/port mapping (`getHost()` + `getMappedPort(6379)`)  
   **And** the container is automatically cleaned up after tests complete

2. **Given** Redis Testcontainers is configured  
   **When** I run integration tests locally with `npm run test:integration --workspace=allo-scrapper-server`  
   **Then** Redis Testcontainers starts automatically  
   **And** developers do not need to manually run `docker compose up redis`

3. **Given** a Redis integration test fails  
   **When** I inspect the CI logs  
   **Then** Redis container logs are included in the test output  
   **And** I can debug connection issues without re-running CI

## Tasks / Subtasks

- [ ] Add Redis Testcontainers dependencies and test script routing (AC: 1, 2)
  - [ ] Add Node Testcontainers dependency in `server/package.json` (dev dependency)
  - [ ] Add an explicit integration test command in `server/package.json` (ex: `test:integration` with `*.integration.test.ts` pattern)
  - [ ] Keep current unit test command unchanged to avoid CI regressions

- [ ] Implement Redis Testcontainers integration tests (RED first, then GREEN) (AC: 1, 2)
  - [ ] Add failing integration test file in `server/src/services/` for Redis-backed behavior (queue publish/read)
  - [ ] Start Redis via Testcontainers in test setup (`beforeAll`) and pass runtime `REDIS_URL` using dynamic mapping (`redis://<host>:<mapped-port>`)
  - [ ] Ensure cleanup (`afterAll`) always stops container and resets Redis singleton state
  - [ ] Assert real connectivity to mapped Redis endpoint from test process (no hardcoded `6379`)
  - [ ] Add deterministic timeout bounds for container startup and Redis connect handshake

- [ ] Wire CI workflow to run Redis integration tests with actionable logs (AC: 1, 3)
  - [ ] Update `.github/workflows/ci.yml` to run integration tests as a dedicated step
  - [ ] On failure, print Redis Testcontainer logs and test diagnostics (including effective `REDIS_URL`)
  - [ ] Ensure CI still runs existing TS build + unit tests

- [ ] Local developer workflow and docs updates (AC: 2, 3)
  - [ ] Document local integration test command and behavior in `docs/guides/development/testing.md`
  - [ ] Add concise README note pointing to integration testing docs
  - [ ] Add troubleshooting section for common Testcontainers issues (Docker daemon unavailable, port conflicts)

- [ ] Validate in pipeline-like conditions (AC: 1, 2, 3)
  - [ ] Run integration tests locally end-to-end (`server` workspace)
  - [ ] Verify container teardown even on test failures
  - [ ] Verify log capture path by forcing one failing integration case
  - [ ] Verify no residual Redis Testcontainers remain after run (teardown proof)

## Dev Notes

### Scope and Architecture Guardrails

- This story targets infrastructure/testing in the `server` workspace and CI workflow.
- Do not replace existing `ioredis` mocks in unit tests; add separate integration coverage.
- Keep testcontainers setup isolated to integration tests to avoid slowing all test runs.

### Existing Codebase Signals

- CI currently runs TypeScript build and server unit tests only; no Redis integration stage yet.
- Redis client is lazy-singleton (`getRedisClient`) and supports `resetRedisClient()` for test isolation.
- Current scraper route/service tests mock Redis and validate behavior, but not real Redis connectivity.

### Suggested Test Design

- Prefer one focused integration file around `RedisClient` behavior:
  - `publishJob`/`getQueueDepth`
  - `publishProgress`/`subscribeToProgress`
  - connection lifecycle (`disconnect`)
- Use deterministic timeout guards to avoid flaky CI.
- Ensure tests fail fast in CI if Docker/Testcontainers is unavailable, and provide explicit local guidance (optional local skip only if explicitly configured).

### Docker Availability Policy

- CI: Docker/Testcontainers unavailable => **hard fail** with clear actionable error.
- Local dev: default is fail with guidance; optional skip may be supported behind an explicit env flag (documented), never enabled by default.

### CI Logging Guidance

- Capture integration output as separate step.
- On integration failure, emit:
  - container logs (from Redis Testcontainer before teardown),
  - effective `REDIS_URL`,
  - integration test summary.
- Keep logs concise but sufficient for first-pass debugging.

### Definition of Done Alignment (Epic 0)

- ACs validated with real Redis container in CI and local.
- No manual Redis startup required for integration test command.
- Failure logs sufficient for debugging without rerun.
- Documentation updated for local + CI testcontainers workflow.

### Implementation Order (Mandatory)

1. RED: add failing integration tests expecting real Redis connectivity.
2. GREEN: add Testcontainers setup/teardown and pass tests locally.
3. CI: add dedicated workflow step and failure log capture.
4. DOCS: update testing docs + README reference.

### References

- Story definition: `_bmad-output/planning-artifacts/epics.md:380`
- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml:52`
- CI workflow baseline: `.github/workflows/ci.yml:21`
- Redis client singleton/reset hooks: `server/src/services/redis-client.ts:133`
- Existing mocked Redis tests: `server/src/services/scraper-service.test.ts:11`
- Existing scraper route tests with Redis mock: `server/src/routes/scraper.test.ts:50`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 0.3 (epic lookup + CI/test surface discovery)

### Completion Notes List

- Story file created with AC-aligned tasks and CI/local testcontainers strategy.
- Added guardrails to preserve fast unit tests and isolate integration setup.
- Included concrete references for implementation entry points.

### File List

- `_bmad-output/implementation-artifacts/0-3-setup-redis-testcontainers-in-ci.md`
