# Story 1.2: Add org_id to All Observability Traces

Status: done

## Story

As a DevOps engineer,
I want all OpenTelemetry traces to include org_id as a span attribute,
so that I can filter traces by organization when debugging issues.

## Acceptance Criteria

1. **Given** a request is made by a user with `org_id=A`  
   **When** the request is traced via OpenTelemetry  
   **Then** the trace span includes attribute `org_id=A`  
   **And** the attribute is present on all child spans  
   **And** the trace is exportable to Tempo with org_id metadata

2. **Given** a scraper job is triggered for `org_id=A`  
   **When** the job executes  
   **Then** all scraper trace spans include `org_id=A`  
   **And** the Redis job metadata includes org_id  
   **And** SSE progress events include org_id in trace context

3. **Given** an error occurs during a request  
   **When** the error is logged via Winston  
   **Then** the log entry includes `org_id` field  
   **And** the log is structured JSON with `{ org_id, user_id, endpoint, error }`  
   **And** Loki can filter logs by org_id

## Tasks / Subtasks

- [x] Add RED tests for org-aware observability behavior before implementation (AC: 1, 2, 3)
  - [x] Add/extend unit tests in `server/src/services/scraper-service.test.ts` to fail when queued jobs do not carry tenant trace metadata
  - [x] Add/extend route/service tests in `server/src/routes/scraper.test.ts` for org-aware trigger paths and error logging payload shape
  - [x] Add focused tests for trace metadata propagation in scraper queue handling (`scraper/src/redis/client.ts` and/or related tests)
  - [x] Add test assertions for structured log metadata containing `org_id`, `user_id`, `endpoint`, and `error`

- [x] Implement org-aware trace context propagation from API to scraper jobs (AC: 1, 2)
  - [x] Extend server job publish path to include tenant context in `traceContext` metadata (`org_id`, `org_slug`, request path, actor id)
  - [x] Keep payload typed (`Record<string, string>`) and deterministic across `trigger` and `resume` flows
  - [x] Ensure scraper job consumer preserves and uses incoming trace metadata during execution paths
  - [x] Do not introduce a second job envelope format; extend existing `ScrapeJob` contract in-place

- [x] Enrich structured logging with tenant context in observability-critical paths (AC: 3)
  - [x] Add/standardize org-aware log fields in request paths that already log security or operational events (notably scraper trigger/resume/status and error handler)
  - [x] Ensure logs include `org_id`, `user_id`, and endpoint path when a tenant-scoped user is present
  - [x] Keep standalone compatibility: tokens without `org_id` remain valid and log `org_id` as absent/undefined without throwing
  - [x] Preserve Winston structured JSON format in production (no `console.log` in server or scraper code paths)

- [x] Align SSE progress context with tenant trace metadata (AC: 2)
  - [x] Ensure progress publishing path can carry org-aware trace context from queued job metadata
  - [x] Validate that SSE-progress related diagnostics can be correlated to tenant context for Tempo/Loki triage
  - [x] Keep existing SSE event schema backward compatible for client consumers

- [x] Validate OpenTelemetry integration boundaries and avoid scope creep (AC: 1, 2)
  - [x] Reuse current tracing entry points in scraper (`scraper/src/utils/tracer.ts`) and existing `traceContext` fields in queue job types
  - [x] If server-side span instrumentation is incomplete, implement org-aware metadata propagation without introducing unplanned framework migration
  - [x] Document any deferred gap explicitly in completion notes (e.g., full child-span enforcement in packages without active spans)

- [x] Documentation updates for observability contracts (AC: 1, 2, 3)
  - [x] Update `README.md` observability/security sections with org-aware logging/tracing guarantees
  - [x] Add or update test guidance for validating `org_id` in logs/traces for multi-tenant requests

### Review Findings

- [x] [Review][Patch] Span-level OpenTelemetry propagation is still missing for `org_id` — AC1/AC2 require `org_id` on request spans and child spans (including scraper spans), but current implementation only propagates queue/log metadata (`traceContext`) and does not set span attributes.
- [x] [Review][Patch] SSE progress events still do not carry tenant trace context — AC2 requires progress events to include `org_id` trace context, but only connection lifecycle logs were enriched; emitted SSE payloads remain unchanged.
- [x] [Review][Patch] Missing observability context in schedule immediate-trigger path [`server/src/routes/scraper.ts:391`]
- [x] [Review][Patch] `traceparent` is forwarded without validation or size bounds [`server/src/routes/scraper.ts:52`]
- [x] [Review][Patch] Scraper failure logs lost error object/stack detail after refactor [`scraper/src/index.ts:89`]
- [x] [Review][Patch] Logging `originalUrl` can leak query-string data; prefer sanitized path fields [`server/src/middleware/error-handler.ts:12`]

## Dev Notes

### Scope and Guardrails

- This story is the observability companion to Story 1.1 security boundary enforcement. Keep scope focused on `org_id` trace/log propagation, not broader auth redesign.
- Reuse existing `traceContext` fields in queue contracts; do not invent new transport layers for scraper context.
- Keep multi-tenant behavior additive and backward compatible with standalone mode where JWT may not contain `org_id`.
- Do not add `any` in auth, trace, or log contexts; security-sensitive typing must remain strict.

### Reinvention Prevention

- Extend these existing locations instead of creating parallel systems:
  - `server/src/services/scraper-service.ts`
  - `server/src/services/redis-client.ts`
  - `server/src/routes/scraper.ts`
  - `server/src/middleware/error-handler.ts`
  - `scraper/src/redis/client.ts`
  - `scraper/src/index.ts`
- Keep logger creation centralized via `server/src/utils/logger.ts` and `packages/logger/src/index.ts`.
- Reuse JWT org context from `AuthRequest` (`org_id`, `org_slug`) instead of reparsing tokens.

### Previous Story Intelligence (from 1.1)

- Story 1.1 established strict org-boundary behavior with stable 403 contract (`Cross-tenant access denied`) and structured security logs; preserve field naming consistency (`org_id`, `requested_org_id`, `user_id`).
- Route-chain ordering is already guarded in tests (limiter -> auth -> permission -> org-boundary -> handler). Keep this intact while adding observability fields.
- Prior fixes addressed falsy-org edge handling; avoid introducing truthiness regressions when mapping optional `org_id` into metadata.
- Org-scoped SaaS routing in `packages/saas/src/routes/org.ts` remains the primary tenant-aware path; observability coverage must include this usage pattern.

### Git Intelligence Summary

- Recent commits show completed tenant fixture APIs and org boundary middleware enforcement; this story should leverage those foundations, not duplicate tenancy checks.
- Current commit style and implementation pattern favor focused route/service updates with test expansion in-place; follow that pattern for observability enrichment.

### Architecture Compliance Notes

- Keep ESM imports and strict TypeScript conventions.
- Preserve middleware and service separation: routes orchestrate, services handle queue/tracking logic.
- Respect production logging requirements (Winston JSON in production for Loki ingestion).
- Keep compatibility with current OpenTelemetry footprint (scraper instrumentation active, server instrumentation limited).

### Suggested Test Matrix

- `POST /api/scraper/trigger` with org-aware JWT publishes job containing tenant trace metadata
- `POST /api/scraper/resume/:reportId` carries same tenant metadata contract
- Scraper job consumer receives trace metadata and maintains tenant correlation
- Error handling paths produce structured log metadata with `org_id`, `user_id`, `endpoint`, `error`
- Standalone JWT (no `org_id`) still succeeds while producing safe, non-crashing log output

### Concrete File Targets

- `server/src/services/scraper-service.ts` - include org-aware trace metadata in queued jobs
- `server/src/services/redis-client.ts` - keep typed queue payload support for trace context
- `server/src/routes/scraper.ts` - pass authenticated org context into service trigger/resume flows
- `server/src/middleware/error-handler.ts` - enrich structured error logs with request tenant metadata
- `server/src/services/scraper-service.test.ts` - RED/GREEN tests for trace context propagation
- `server/src/routes/scraper.test.ts` - route-level observability and payload regression tests
- `scraper/src/redis/client.ts` - consume/preserve org-aware trace metadata contract
- `scraper/src/index.ts` - include tenant metadata in operational logs where available
- `README.md` - document org-aware observability guarantees

### Implementation Order (Mandatory)

1. RED: add failing tests for org-aware trace/log propagation and structured error metadata.
2. GREEN: minimally wire org context through route -> service -> Redis job metadata.
3. HARDEN: ensure scraper-side usage + error-path logging includes tenant fields consistently.
4. DOCS: update README/testing guidance for org-aware observability assertions.

### Pitfalls to Avoid

- Do not trust client-provided org identifiers in body/query for trace metadata; source from authenticated JWT context.
- Do not break existing SSE payload contract while adding trace correlation fields.
- Do not add heavy server-side tracing framework migrations in this story unless absolutely required by failing AC coverage.
- Do not omit `org_id` from error logs in tenant-scoped requests.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md:479`
- Epic dependency context: `_bmad-output/planning-artifacts/epics.md:448`
- Sprint tracker row: `_bmad-output/implementation-artifacts/sprint-status.yaml:62`
- Previous story intelligence: `_bmad-output/implementation-artifacts/1-1-implement-org-id-validation-middleware.md`
- Project rules: `_bmad-output/project-context.md:56`
- Test architecture handoff (RISK-007): `_bmad-output/test-artifacts/test-design/test-design-architecture.md:116`
- QA coverage mapping (RISK007-INT-002): `_bmad-output/test-artifacts/test-design/test-design-qa.md:310`
- Auth org context shape: `server/src/middleware/auth.ts:16`
- Queue trace metadata contract (server): `server/src/services/redis-client.ts:9`
- Queue trace metadata contract (scraper): `scraper/src/redis/client.ts:21`
- Scraper trigger service: `server/src/services/scraper-service.ts:16`
- SSE route integration point: `server/src/routes/scraper.ts:146`
- Logger implementation: `packages/logger/src/index.ts:12`

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

- CS execution for story 1.2 using sprint tracker + epic context + Story 1.1 learnings
- `cd server && npm run test:run -- src/services/scraper-service.test.ts src/routes/scraper.test.ts src/middleware/error-handler.test.ts`
- `cd server && npm run test:run`
- `cd server && npx tsc --noEmit`
- `cd scraper && npm run test:run -- src/redis/client.test.ts tests/unit/tracer.test.ts`
- `cd scraper && npx tsc --noEmit`
- `cd scraper && npm run test:run` (known pre-existing unrelated failure in `tests/unit/scraper/concurrency.test.ts`)

### Completion Notes List

- Added org-aware trace context propagation from API routes to Redis scraper jobs for trigger/resume flows (`org_id`, `org_slug`, `user_id`, `endpoint`, `method`, optional `traceparent`).
- Extended scraper route observability logging for trigger/resume/status requests with structured tenant fields.
- Enriched API error-handler structured logs with request context (`org_id`, `user_id`, `endpoint`, `error`) for Loki filtering.
- Added scraper worker-side trace-context correlation logs in queue consumer/executor paths while preserving existing job contracts.
- Added RED/GREEN tests covering trace metadata propagation, route observability context forwarding, and error log payload structure.
- Updated README and testing guide with org-aware observability validation guidance.
- Deferred full server-side span attribute propagation to child spans because server-wide OpenTelemetry span instrumentation is not currently present; implemented safe metadata propagation path without framework migration.

### File List

- `_bmad-output/implementation-artifacts/1-2-add-org-id-to-all-observability-traces.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/src/services/scraper-service.ts`
- `server/src/routes/scraper.ts`
- `server/src/middleware/error-handler.ts`
- `server/src/services/scraper-service.test.ts`
- `server/src/routes/scraper.test.ts`
- `server/src/middleware/error-handler.test.ts`
- `scraper/src/redis/client.ts`
- `scraper/src/index.ts`
- `scraper/src/redis/client.test.ts`
- `README.md`
- `server/tests/README.md`

## Change Log

- 2026-04-18: Implemented org-aware observability context propagation from API to scraper queue metadata, enriched structured tenant logging in API and worker paths, added focused tests for trace/log context propagation, and documented observability assertions.
