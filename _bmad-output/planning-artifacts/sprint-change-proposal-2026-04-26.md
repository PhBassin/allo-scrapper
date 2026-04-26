# Sprint Change Proposal — Story 2.6 DLQ API Endpoints

**Date:** 2026-04-26
**Author:** OpenCode (bmad-correct-course)
**Mode:** Batch
**Trigger story:** `_bmad-output/implementation-artifacts/2-6-dlq-api-endpoints-api-only-no-ui.md`
**Scope classification:** **Moderate** — spec reconciliation + alias mount + one new endpoint. No rollback. No MVP scope change.

---

## Section 1 — Issue Summary

Story 2.6 was authored as if Story 2.1 (DLQ infrastructure, PR #904, status: done) had not shipped. Validation surfaced a **three-way contract conflict** between:

1. **The story file** — proposes `/api/admin/dlq/jobs/*` paths, 202 Accepted on retry, 401 on auth failure, renamed/dropped fields (`failed_at` instead of `timestamp`; no `cinema_id`/`org_id`), pagination cap of 100.
2. **`epics.md:800–841`** (Epic 2.6 spec) — commits to `/api/admin/scraper/dlq/*` paths, 200 OK, 403 Forbidden, full `DlqJobEntry` shape, pagination cap of 50.
3. **Shipped code** (Story 2.1) — implements `/api/scraper/dlq` (no `/admin/` segment), `GET` list at `server/src/routes/scraper.ts:214`, `POST /:jobId/retry` at `:242`, returns 200 OK, throws `AuthError('Permission denied', 403)`, max page size 50, full `DlqJobEntry` shape including `cinema_id` and `org_id`.

**How discovered:** Validation pass during `bmad-create-story` checklist, before dev-story handoff.

**Evidence:**
- `server/src/routes/scraper.ts:214,242` — endpoints already live
- `server/src/services/redis-client.ts:143,173` — service methods live
- `server/src/routes/scraper.test.ts:294,333` — tests live and passing
- Story 2.1 dev notes (`_bmad-output/implementation-artifacts/2-1-implement-dead-letter-queue-for-failed-scraper-jobs.md`): *"Keep response metadata explicit and deterministic so later Story 2.6 can build on it without breaking contract"* — handoff was explicit and was missed.

**Coverage gap that remains genuine:** AC 2 (single-job detail endpoint) is **not** implemented — `RedisClient.getDlqJob(jobId, orgId?)` does not exist and there is no route at `GET /api/scraper/dlq/:jobId`.

**Secondary issues found in story:**
- Tasks "Apply auth middleware" and "scope DLQ queries to current tenant org" duplicate work already done by `requireAuth` + `canManageScraper` + `req.user?.is_system_role ? undefined : req.user?.org_id` (already wired in 2.1).
- Reference to `server/src/routes/admin.ts` is broken — file does not exist (only `server/src/routes/admin/` folder).
- SaaS mount task `/api/org/:slug/admin/dlq/*` would fork org-scoping logic; org filter is already enforced by `RedisClient` in standalone mode.
- Pagination cap mismatch (story 100 vs. shipped/epic 50).
- OpenAPI annotation task is unanchored — no existing OpenAPI file in `server/`.

---

## Section 2 — Impact Analysis

### Epic Impact
- **Epic 2 (Scraper Job Queue Reliability):** No scope change. 5/6 done; 2.6 remains as the closing story.
- **`epics.md:800–841` (Story 2.6 spec section):** Needs edits to (a) match shipped URL path with alias note, (b) align field shape to `DlqJobEntry`, (c) confirm 200/403 codes, (d) confirm 50-row cap.

### Story Impact
- **Story 2.6:** Major rewrite — 4 of 4 ACs need text changes; 5 of 6 task groups need rewriting; references and dev notes need updating.
- **No other story affected.** Story 2.1 already shipped and is locked.

### Artifact Conflicts
- `_bmad-output/implementation-artifacts/2-6-dlq-api-endpoints-api-only-no-ui.md` — rewrite required.
- `_bmad-output/planning-artifacts/epics.md` lines 800–841 — targeted edits.
- No PRD section conflict (DLQ not in PRD body).
- No architecture doc conflict.
- No UX impact (API-only).

### Technical Impact
- **New code required (small):**
  - `RedisClient.getDlqJob(jobId, orgId?): Promise<DlqJobEntry | null>` — sibling to `retryDlqJob` minus mutation
  - `GET /api/scraper/dlq/:jobId` route in `server/src/routes/scraper.ts`
  - `GET /api/admin/scraper/dlq` and `GET /api/admin/scraper/dlq/:jobId` and `POST /api/admin/scraper/dlq/:jobId/retry` **alias routes** (per user decision — same handlers, mounted at admin path)
- **New tests required:**
  - `RedisClient.getDlqJob` unit tests (found / not-found / org-scoped found / org-scoped denied)
  - Route tests for `GET /api/scraper/dlq/:jobId` (200, 404, 403)
  - Route tests proving the `/api/admin/scraper/dlq*` aliases reach the same handlers
- **No infrastructure / deployment changes.**
- **No Redis key changes** — reuses `scrape:dlq` ZSET from 2.1.
- **No SaaS package changes** — org-scoping already works via `RedisClient` filter in standalone mounts (verified: `packages/saas` contains no DLQ code).

---

## Section 3 — Recommended Approach

**Path: Direct Adjustment** — modify story 2.6 and epic spec rows; no rollback; no MVP scope cut.

**Rationale:**
- Shipped code is correct and well-tested. Conflicts originate in the story author's outdated context, not in implementation drift.
- The user-chosen alias strategy (`/api/admin/scraper/dlq*` mirrors `/api/scraper/dlq*`) closes the epic-spec gap **without breaking existing consumers** of the shipped path.
- Only one new endpoint (single-job GET) is genuinely missing — small, well-scoped delta.
- SaaS mount can be deferred or simplified: org-scoping already works through `req.user.org_id` injected by existing auth middleware.

**Effort estimate:** 0.5–1 dev-day. Most cost is test coverage and OpenAPI doc work, not implementation.

**Risk:** Low. No breaking changes to shipped contract. Alias adds surface area but reuses validated handlers.

**Timeline impact:** None — Story 2.6 was already the next sprint slot.

---

## Section 4 — Detailed Change Proposals

### Change 4.1 — Story 2.6 file: rewrite

**File:** `_bmad-output/implementation-artifacts/2-6-dlq-api-endpoints-api-only-no-ui.md`

**Changes (full replacement of body, status remains `ready-for-dev`):**

#### Acceptance Criteria

- **AC 1 OLD:** `GET /api/admin/dlq/jobs` … `failed_at timestamp, cinema_name if available` … `cap 100`
- **AC 1 NEW:** `GET /api/scraper/dlq` (or alias `GET /api/admin/scraper/dlq`) returns `DlqJobListResult { jobs, total, page, pageSize }` where each `jobs[]` entry is the canonical `DlqJobEntry` (including `job_id`, `job`, `failure_reason`, `retry_count`, `timestamp`, `cinema_id`, `org_id`). Sort by `timestamp` desc. Pagination defaults `page=1, pageSize=50`, max `pageSize=50`. **Rationale:** match shipped contract from Story 2.1.
- **AC 2 OLD:** `GET /api/admin/dlq/jobs/:job_id`
- **AC 2 NEW:** `GET /api/scraper/dlq/:jobId` (or alias `GET /api/admin/scraper/dlq/:jobId`) returns the full `DlqJobEntry` for the requested job, scoped to the caller's `org_id` unless `is_system_role`. Returns 404 if not found in the DLQ or out-of-scope. **Rationale:** this is the genuinely-missing endpoint.
- **AC 3 OLD:** `POST /api/admin/dlq/jobs/:job_id/retry` … `202 Accepted`
- **AC 3 NEW:** `POST /api/scraper/dlq/:jobId/retry` (or alias `POST /api/admin/scraper/dlq/:jobId/retry`) returns **200 OK** with the republished `DlqJobEntry`. 404 if job not found. **Rationale:** match shipped contract; `retryDlqJob` is synchronous and returns the entry — 200 is correct.
- **AC 4 OLD:** unauthenticated → 401
- **AC 4 NEW:** Requests without a valid session → **401 Unauthorized**. Authenticated callers without scraper-management permission (per `canManageScraper`) → **403 Forbidden** with `{ success: false, error: 'Permission denied' }`. Both standalone and alias paths enforce this. **Rationale:** match shipped behaviour and `AuthError('Permission denied', 403)`.

#### Tasks / Subtasks

- [ ] Add RED test coverage before implementation (AC: 1, 2, 3, 4)
  - [ ] `redis-client.test.ts`: add tests for new `getDlqJob` method (found, not-found, org-scoped match, org-scoped miss)
  - [ ] `scraper.test.ts`: add tests for `GET /api/scraper/dlq/:jobId` (200 found, 404 missing, 403 lacks permission)
  - [ ] `scraper.test.ts`: add tests proving `/api/admin/scraper/dlq*` aliases reach the same handlers and return identical responses (one happy-path test per alias is sufficient)
  - [ ] Confirm existing list (`scraper.test.ts:294`) and retry (`:333`) tests still pass unchanged
- [ ] Implement single-job GET (AC: 2)
  - [ ] Add `RedisClient.getDlqJob(jobId: string, orgId?: number): Promise<DlqJobEntry | null>` in `server/src/services/redis-client.ts` mirroring the lookup half of `retryDlqJob` (no mutation, same `matchesDlqOrg` filter)
  - [ ] Add `GET /dlq/:jobId` to `server/src/routes/scraper.ts` using `requireAuth` + `canManageScraper` + `getSingleRouteParam` (same pattern as `POST /dlq/:jobId/retry`); return 404 via `NotFoundError('DLQ job not found')` when service returns null
- [ ] Mount admin alias routes (AC: 1, 2, 3)
  - [ ] In `server/src/index.ts` (or wherever `/api/scraper` is mounted), add a parallel mount of the same router (or a thin alias router that delegates to the same handlers) at `/api/admin/scraper`. Both list, single-GET, and retry must be reachable via both prefixes.
  - [ ] Document in code comment that aliases exist for spec/epic alignment; canonical path remains `/api/scraper/dlq`
- [ ] Reuse existing auth — DO NOT add new middleware (AC: 4)
  - [ ] Verify `requireAuth` + `canManageScraper` already cover both 401 and 403 cases (they do — see `server/src/routes/scraper.ts:44,214,242`)
  - [ ] Do not add tenant-scoping logic; `RedisClient` already filters by `req.user.org_id` for non-system roles
- [ ] Documentation
  - [ ] If an OpenAPI/Swagger surface exists, annotate the three canonical routes and the three aliases. If not, add a short `docs/api/dlq.md` with request/response examples and a note that aliases exist for admin-prefix consumers. (Confirm with PM if a doc location already exists.)
  - [ ] Cross-reference PR #904 (DLQ infra) and PR #919 (reconnect hardening)

#### Out of Scope (unchanged)
- DLQ Admin UI
- Bulk retry
- DLQ auto-purge

#### Dev Notes (replace existing)
- DLQ Redis keys (`scrape:dlq`) and the `DlqJobEntry` shape are owned by Story 2.1 / PR #904. **Do not redefine.**
- The shipped list and retry endpoints at `/api/scraper/dlq` and `/api/scraper/dlq/:jobId/retry` are the canonical contract. Story 2.6 only **adds** the single-job GET and **mirrors** all three under `/api/admin/scraper/dlq*` per Sprint Change Proposal 2026-04-26.
- Org-scoping is already enforced inside `RedisClient.listDlqJobs` and `RedisClient.retryDlqJob` via `req.user?.is_system_role ? undefined : req.user?.org_id`. The new `getDlqJob` method must follow the same pattern.
- No SaaS package changes are required for MVP. If `packages/saas` later mounts admin routes, it can simply reuse the same router; org filtering is server-side.
- `canManageScraper` (in `server/src/routes/scraper.ts:44`) is the permission gate for both 403 and the alias mount.

#### References (replace)
- `server/src/routes/scraper.ts:214` — shipped `GET /dlq` handler (extend pattern for `:jobId`)
- `server/src/routes/scraper.ts:242` — shipped `POST /dlq/:jobId/retry` handler
- `server/src/routes/scraper.ts:44` — `canManageScraper` permission gate
- `server/src/services/redis-client.ts:143` — `listDlqJobs` (template for `getDlqJob`)
- `server/src/services/redis-client.ts:173` — `retryDlqJob` (template for `getDlqJob` lookup)
- `server/src/routes/scraper.test.ts:294,333` — existing DLQ route tests (must remain green)
- PR #904 — DLQ infrastructure (Story 2.1)
- PR #919 — Redis reconnect recovery
- This Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-26.md`

---

### Change 4.2 — `epics.md` Story 2.6 row reconciliation

**File:** `_bmad-output/planning-artifacts/epics.md` (lines ~800–841)

**Changes:** edit the Story 2.6 spec block to:
1. Replace `/api/admin/scraper/dlq` with: *"Canonical path `/api/scraper/dlq` (shipped in Story 2.1). Alias path `/api/admin/scraper/dlq` is added by Story 2.6 for admin-routing consistency. Both reach the same handlers."*
2. Confirm pagination cap **50** (already correct in epic; just align with story).
3. Confirm response shape is `DlqJobListResult` / `DlqJobEntry` exported from `server/src/services/redis-client.ts`.
4. Confirm 200 OK (list, single, retry) and 403 (no permission) / 401 (no session).
5. Add a one-line note: *"Story 2.1 dev notes already handed contract forward; Story 2.6 only adds the missing single-job GET plus admin alias."*

---

### Change 4.3 — No code changes in this proposal

All code edits will happen during the `bmad-dev-story` execution that follows this approval. This proposal **only** updates planning artifacts.

---

## Section 5 — Implementation Handoff

**Scope classification:** **Moderate** — planning artifacts edited (this skill) + dev-story implementation (next skill).

**Handoff plan:**

1. **Now (this workflow):**
   - Apply Change 4.1 to the story file.
   - Apply Change 4.2 to `epics.md`.
   - Status of Story 2.6 stays `ready-for-dev`.

2. **Next (separate fresh-context session):**
   - Run `bmad-dev-story` against the rewritten Story 2.6.
   - Recommended TDD order: write RED tests first (`redis-client.test.ts` `getDlqJob`, then `scraper.test.ts` for new GET and aliases), then implement, then green.

3. **After dev-story:**
   - Run `bmad-code-review` on the resulting PR.
   - Update `sprint-status.yaml` to mark 2.6 done.
   - Optionally run `bmad-retrospective` on Epic 2 (closes the epic).

**Success criteria for the dev-story phase:**
- `cd server && npm run test:run` green, including new tests for `getDlqJob` and alias routes
- `cd server && npm run test:integration` green (DLQ Testcontainers tests still pass)
- All 4 ACs in the rewritten story verifiable via the new + existing route tests
- No changes to `packages/saas` required
- No changes to `server/src/routes/scraper.test.ts:294` and `:333` other than additions

---

## Approvals

- [ ] User approves this proposal → proceed to apply Changes 4.1 and 4.2.
- [ ] Then route to `bmad-dev-story` in fresh context.
