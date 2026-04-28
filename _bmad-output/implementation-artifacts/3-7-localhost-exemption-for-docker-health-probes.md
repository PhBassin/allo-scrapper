# Story 3.7: Localhost Exemption for Docker Health Probes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a DevOps engineer,
I want localhost requests to be exempt from rate limiting,
so that Docker health probes don't trigger 429 errors.

## Acceptance Criteria

1. **Given** a Docker health probe sends requests to `/api/health` every 10 seconds
   **When** the requests originate from `127.0.0.1` or `::1`
   **Then** no rate limiting is applied
   **And** the health probe never receives 429 errors
   **And** health checks succeed continuously

2. **Given** a request is made from a non-localhost IP
   **When** the request is sent to `/api/health`
   **Then** rate limiting is applied (10 req/min)
   **And** the 11th request within 60 seconds receives 429
   **And** localhost exemption does NOT apply

3. **Given** I run integration tests for health check endpoint
   **When** I send 20 requests in 10 seconds from localhost
   **Then** all 20 requests succeed
   **And** no rate limiting is triggered
   **And** the exemption logic is validated

## Tasks / Subtasks

- [x] Add RED coverage for the full `/api/health` request path before changing middleware behavior (AC: 1, 2, 3)
  - [x] Extend `server/src/app.test.ts` with an app-level regression proving repeated localhost requests to `/api/health` never hit a 429 through the real middleware stack
  - [x] Extend `server/src/app.test.ts` or `server/src/middleware/rate-limit.test.ts` with an external-IP regression proving `/api/health` still returns 429 on the 11th request within the 60-second window
  - [x] Keep `trust proxy` enabled in tests and drive IP identity through `X-Forwarded-For`, matching the real app configuration
  - [x] Avoid false-green coverage caused by `NODE_ENV=test`: if the test exercises `generalLimiter`, use a non-test-like harness or re-import path that does not trigger `skipTest`

- [x] If RED proves a stack-level leak, fix localhost exemption at the correct seam in the stack (AC: 1, 2, 3)
  - [x] Prevent any broader `/api` limiter behavior from rate-limiting localhost health probes before the request reaches `healthCheckLimiter`
  - [x] Preserve the dedicated `healthCheckLimiter` as the owner of the health endpoint's external-IP limit contract unless a failing test proves a narrower change is required
  - [x] If the current production behavior already satisfies all ACs, keep the implementation test-first and do not force an unnecessary production-code change
  - [x] Do not add a second health route, bypass middleware with ad hoc conditionals in the handler, or duplicate rate-limit configuration in multiple places

- [x] Preserve non-localhost protection and existing proxy/IP behavior (AC: 2)
  - [x] Keep `/api/health` protected for external IPs at 10 req/min
  - [x] Preserve localhost variants already recognized by the repo (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`)
  - [x] Keep behavior aligned with Express `trust proxy` and `req.ip`; do not switch to raw socket address parsing

- [x] Keep the change deployment-safe for Docker and local runtime (AC: 1, 3)
  - [x] Reuse the existing Docker health check target `http://localhost:3000/api/health`; do not change compose healthcheck commands unless implementation evidence requires it
  - [x] Keep the change code-only unless documentation needs a narrow clarification of localhost exemption behavior
  - [x] Avoid broad rate-limiter refactors or rate-limit config redesign in this story; Epic 3 stories 3.5, 3.6, and 3.8 own the broader rate-limiting work

- [x] Verify with focused server commands after implementation (AC: 1, 2, 3)
  - [x] Run `cd server && npm run test:run -- src/app.test.ts src/middleware/rate-limit.test.ts`
  - [x] Run `cd server && npm run test:run` if shared middleware behavior changes beyond the health path

### Review Findings

- [x] [Review][Patch] Spoofable localhost bypass through trusted proxy headers [server/src/app.ts:107]
- [x] [Review][Patch] App-level regression does not prove `/api/health` is isolated from `generalLimiter` for external callers [server/src/app.test.ts:265]

## Dev Notes

### Scope and Guardrails

- This story is the first implementation step of Epic 3 and is explicitly marked as the blocker that must ship before other rate-limiting changes.
- The repo already documents localhost exemption as desired behavior, and `healthCheckLimiter` already skips known localhost IPs. The remaining validation risk is the full request stack: `/api/health` first passes through the app-wide `generalLimiter`, but with current defaults (`100 req/15min`) Docker-style probes may already stay below that threshold. Prove the real gap before changing production behavior.
- Keep this story focused on the health-probe path only. Do not absorb heartbeat, SSE reconnect, burst-scenario validation, or rate-limit documentation work from other Epic 3 stories.

### Reinvention Prevention

- Reuse the current rate-limiting middleware seams instead of introducing a second mechanism:
  - `server/src/middleware/rate-limit.ts`
  - `server/src/app.ts`
  - `server/src/middleware/rate-limit.test.ts`
  - `server/src/app.test.ts`
- Reuse Express `req.ip` and the existing `trust proxy` configuration in `createApp()`. Do not invent custom IP parsing from headers or sockets.
- Reuse the existing localhost IP set already present in the repo rather than redefining a different exemption list.
- Reuse the existing Docker healthcheck URL. The compose files already probe `http://localhost:3000/api/health`; the story should make the application honor that contract, not move the probe elsewhere.

### Previous Story Intelligence (Epic 2 Story 2.6)

- Story 2.6 showed that route-level behavior can look correct while the full mounted surface still has subtle mismatches. The admin DLQ alias trailing-slash issue was only caught when the full routed surface was exercised. Apply that same lesson here: validate `/api/health` through the actual app stack, not only a standalone limiter instance.
- Story 2.6 also reinforced the value of small, contract-focused fixes and avoiding duplication. The same approach fits this story: fix the real middleware seam with the smallest correct change.

### Current Code Reality That This Story Must Address

- `createApp()` applies `generalLimiter` to all `/api` routes before defining `/api/health`. That means localhost health probes can still be affected by the app-wide limiter before `healthCheckLimiter` runs. [Source: `server/src/app.ts:107-108`, `server/src/app.ts:140-142`, `server/src/app.ts:158-168`]
- `healthCheckLimiter` already exempts `127.0.0.1`, `::1`, and `::ffff:127.0.0.1`, and enforces `10 req/min` for other IPs. [Source: `server/src/middleware/rate-limit.ts:152-168`]
- `generalLimiter` currently allows `100` requests per `15` minutes, so the Epic 3 acceptance scenarios may already pass in production even though localhost is not explicitly exempt at the broader `/api` layer. [Source: `server/src/middleware/rate-limit.ts:80-92`]
- The Docker runtime already depends on this exact health endpoint from localhost. [Source: `docker-compose.yml:82-87`, `docker-compose.build.yml:55-56`]
- Existing tests already cover the dedicated health limiter behavior, but they do not currently prove the full app-level `/api` middleware chain under non-test limiter behavior. In `NODE_ENV=test`, generic limiters are skipped via `skipTest`, which can hide stack-ordering bugs. [Source: `server/src/middleware/rate-limit.ts:27-29`, `server/src/middleware/rate-limit.test.ts:319-445`, `server/src/app.test.ts:131-227`]

### Architecture Compliance Notes

- Keep the implementation in the existing Express middleware structure: generic middleware in `server/src/middleware/`, route/mount orchestration in `server/src/app.ts`, and request-path verification in existing server tests.
- Preserve current proxy-aware IP resolution. `app.set('trust proxy', 1)` is already part of the app contract and should remain the source of truth for `req.ip`. [Source: `server/src/app.ts:107-108`]
- Preserve the project rule that the health endpoint stays rate limited for external callers while localhost remains exempt for Docker probes. [Source: `_bmad-output/project-context.md:214-217`]
- Keep the change additive and low-risk. This story is a blocker because infrastructure depends on it, but the intended behavior is already documented as safe and additive.

### Library / Framework Requirements

- Continue using `express-rate-limit` and the existing repo patterns around `skip` and `req.ip`. Do not swap libraries or create a custom limiter framework. [Source: `server/src/middleware/rate-limit.ts:1-4`, `server/src/middleware/rate-limit.ts:81-168`]
- Continue using Vitest + Supertest for verification in the server workspace. [Source: `_bmad-output/project-context.md:110-136`, `server/src/app.test.ts`, `server/src/middleware/rate-limit.test.ts`]

### Testing Requirements

- Prefer app-level tests for the real `/api/health` middleware chain, because the risk is stack ordering, not only limiter configuration in isolation.
- Ensure at least one regression bypasses the `skipTest` shortcut used by generic limiters in test mode; otherwise the test cannot prove the end-to-end stack behavior that this story is about.
- Preserve existing unit-style limiter tests that prove external IPs still see rate-limit headers and 429 behavior.
- Keep localhost assertions explicit for both IPv4 and IPv6 loopback forms already used by the repo.
- Avoid broad end-to-end infra tests in this story unless a focused server test cannot prove the bug.

### Suggested Implementation Strategy

1. RED: add a regression that proves the real app-stack behavior under non-test limiter conditions.
2. Decide whether a production-code change is actually needed or whether the story resolves by locking current behavior with regression coverage.
3. If needed, make the smallest middleware-stack change that preserves the dedicated health limiter for external callers.
4. HARDEN: verify external-IP limiting still trips on the 11th request and localhost variants remain exempt.
5. VERIFY: run focused server tests first, then the broader server suite only if the shared limiter contract changed.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md`
- `server/src/app.ts`
- `server/src/middleware/rate-limit.ts`
- `server/src/app.test.ts`
- `server/src/middleware/rate-limit.test.ts`
- `README.md` only if a narrow clarification of localhost exemption becomes necessary

### Pitfalls to Avoid

- Do not treat this as a greenfield feature; the repo already has partial localhost exemption behavior.
- Do not assume a production-code bug exists without first proving it under a harness that does not skip generic limiters in test mode.
- Do not fix only `healthCheckLimiter` and miss the earlier `/api` middleware layer if RED proves the broader layer is relevant.
- Do not disable rate limiting for `/api/health` globally; external IPs must still be limited.
- Do not replace `req.ip`/`trust proxy` behavior with manual `X-Forwarded-For` parsing.
- Do not fold Story 3.5 or Story 3.8 scope into this change.

### Project Structure Notes

- No separate architecture, PRD, or UX shard files were found in `planning-artifacts`; this story is grounded in `epics.md`, readiness notes, project context, and the current codebase.
- Server middleware changes should stay in `server/src/middleware/`; app-wide mount ordering remains in `server/src/app.ts`.

### Git Intelligence Summary

- Recent work shows a pattern of fixing subtle routed-surface and documentation mismatches after the core feature lands: `fix(server): accept trailing slash on DLQ admin alias`, `feat(server): add DLQ job detail endpoint`, `docs(bmad): sync story 2.6 artifacts`. This story should follow the same small-correct-fix approach and prefer full-stack request-path tests over isolated assumptions.

### Project Context Reference

- The project context explicitly calls out the health endpoint contract: `10 req/min per IP (localhost exempt for Docker probes)`. This story is primarily about making the code fully match that existing rule in the real app stack. [Source: `_bmad-output/project-context.md:214-217`]

### References

- Epic 3 implementation order and blocker rationale: `_bmad-output/planning-artifacts/epics.md:239-255`
- Story 3.7 definition and deployment impact: `_bmad-output/planning-artifacts/epics.md:1058-1089`
- Story 3.7 notes: `_bmad-output/planning-artifacts/notes-epics-stories.md:229-237`
- Readiness report ordering: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md:640-658`
- App proxy and middleware order: `server/src/app.ts:107-108`, `server/src/app.ts:140-142`, `server/src/app.ts:158-168`
- Existing health limiter contract: `server/src/middleware/rate-limit.ts:152-168`
- Generic limiter contract and test-mode skip behavior: `server/src/middleware/rate-limit.ts:27-29`, `server/src/middleware/rate-limit.ts:80-92`
- Existing limiter tests: `server/src/middleware/rate-limit.test.ts:319-445`
- Existing app health tests: `server/src/app.test.ts:131-227`
- Docker healthcheck target: `docker-compose.yml:82-87`, `docker-compose.build.yml:55-56`
- Project rule for localhost exemption: `_bmad-output/project-context.md:214-217`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- `git log --oneline -5`
- story source and readiness notes from Epic 3 planning artifacts
- current `server/src/app.ts`, `server/src/middleware/rate-limit.ts`, and existing server tests
- `cd server && npm run test:run -- src/app.test.ts src/middleware/rate-limit.test.ts`
- `cd server && npm run test:run`
- `cd server && npm run test:run -- src/app.test.ts src/middleware/rate-limit.test.ts` (post-review fixes)
- `cd server && npm run test:run` (post-review fixes)

### Completion Notes List

- Created the first Epic 3 story intentionally as `3-7`, even though `3-1` appears earlier numerically in sprint tracking, because the epic plan explicitly requires `3.7 -> 3.1 -> 3.5` order.
- Anchored the story to the real app-stack risk: localhost exemption already exists in `healthCheckLimiter`, but `/api/health` is still behind the app-wide `/api` limiter.
- Scoped the work to a minimal, deployment-safe fix for Docker/Kubernetes health probes without absorbing broader rate-limiting or SSE work.
- Kept verification focused on server-level middleware-stack tests rather than speculative infrastructure changes.
- Added app-level regressions in `server/src/app.test.ts` that reload the app module under non-test limiter settings, proving localhost loopback traffic stays exempt while external callers hit `429` on the 11th `/api/health` request.
- Moved `/api/health` ahead of the app-wide `/api` limiter in `server/src/app.ts` so `healthCheckLimiter` remains the only limiter controlling the health endpoint contract.
- Updated the existing health-header test to assert rate-limit headers using an external IP, matching the intended localhost-exemption behavior.
- Verified the change with `npm run test:run -- src/app.test.ts src/middleware/rate-limit.test.ts` and the full server suite `npm run test:run` (839 passing tests).
- Hardened the localhost exemption by requiring both `req.ip` and the socket remote address to be loopback before skipping the health limiter, which closes the proxy-header spoof path identified in review.
- Strengthened the app-level external-IP regression by dropping `RATE_LIMIT_GENERAL_MAX` below the health limit so the test now proves `/api/health` bypasses `generalLimiter` and is owned only by `healthCheckLimiter`.
- Added targeted limiter coverage in `server/src/middleware/rate-limit.test.ts` and reran both focused tests and the full server suite after review fixes (840 passing tests).

### File List

- `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/src/app.ts`
- `server/src/app.test.ts`
- `server/src/middleware/rate-limit.ts`
- `server/src/middleware/rate-limit.test.ts`

## Change Log

- 2026-04-28: Created implementation-ready story file for Epic 3 Story 3.7 with explicit guardrails around the real app-stack limiter ordering issue, proxy-aware IP handling, and focused server-side regression coverage.
- 2026-04-28: Implemented Story 3.7 by proving the app-stack limiter leak, moving `/api/health` ahead of `generalLimiter`, and adding full-stack regressions for localhost exemption and external-IP enforcement.
- 2026-04-28: Addressed code review findings by hardening the localhost probe exemption against spoofed proxy headers and proving external `/api/health` traffic no longer depends on `generalLimiter` thresholds.
