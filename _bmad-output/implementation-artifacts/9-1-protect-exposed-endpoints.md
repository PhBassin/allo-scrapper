---
story_key: 9-1-protect-exposed-endpoints
epic: 9-security-audit-remediation
status: done
created: 2026-05-25
---

# Story 9.1: Protect Exposed Endpoints

**As a** security operator,
**I want** `/metrics` and `/api/scraper/status` to require authentication,
**So that** system metrics and scraper state are not publicly accessible.

---

## Acceptance Criteria

### AC1: /metrics requires authentication
**Given** an unauthenticated request to `GET /metrics`
**When** the server receives the request
**Then** the server returns `401 Unauthorized`
**And** the response body is `{ success: false, error: "Authentication required" }`

### AC2: /api/scraper/status requires authentication
**Given** an unauthenticated request to `GET /api/scraper/status`
**When** the server receives the request
**Then** the server returns `401 Unauthorized`

### AC3: Authenticated access to /metrics still works
**Given** a request with a valid `Authorization: Bearer <jwt>` header
**When** `GET /metrics` is called
**Then** the server returns `200 OK` with Prometheus metrics text

### AC4: Authenticated access to /api/scraper/status still works
**Given** a request with a valid `Authorization: Bearer <jwt>` header
**When** `GET /api/scraper/status` is called
**Then** the server returns `200 OK` with scraper status JSON

---

## Tasks / Subtasks

### T1: Add requireAuth to /metrics endpoint [x]
- [x] **File:** `server/src/app.ts` (line ~207)
- [x] **Action:** Add `requireAuth` middleware before the `/metrics` handler
- **AC:** AC1, AC3

### T2: Add requireAuth to /api/scraper/status endpoint [x]
- [x] **File:** `server/src/routes/scraper.ts` (line ~125)
- [x] **Action:** Add `requireAuth` middleware after `scraperLimiter`
- **Target:** `router.get('/status', scraperLimiter, requireAuth, async (req: AuthRequest, res, next) => {...})`
- **AC:** AC2, AC4

### T3: Add/update tests [x]
- [x] **File:** `server/src/routes/scraper.test.ts` — verify `/status` returns 401 without token
- [x] **File:** `server/src/app.test.ts` — verify `/metrics` returns 401 without token
- **AC:** AC1, AC2

### T4: Update integration/E2E tests if needed [x]
- [x] Checked `e2e/database-schema.spec.ts` — already uses JWT auth header for `/api/scraper/status`
- [x] Checked `e2e/add-theater.spec.ts` — mocks `/api/scraper/status` via playwright route
- [x] No other e2e/integration tests reference `/metrics`

---

### Review Findings

- [x] [Review][Patch] **Test mock error message mismatch** — Mock returns `'Authentication required'` but real `requireAuth` returns `'Authentication required. No token provided.'`. Tests should match the actual middleware output. [app.test.ts:14, scraper.test.ts:17]
- [x] [Review][Patch] **`shouldRejectAuth` lacks cleanup guard** — If `request()` call throws, `shouldRejectAuth` stays `true` and pollutes subsequent tests. Wrap in `try/finally`. [app.test.ts:234, scraper.test.ts:176]
- [x] [Review][Defer] **Missing rate limiter on `/metrics`** — Story marks as optional but CodeQL flagged High severity. Fixed: added `generalLimiter` before `requireAuth`. [app.ts:207]

---

## Dev Notes

### Pattern to follow (from scraper.ts)
```typescript
router.post('/trigger', scraperLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
```

### /metrics handler current location
`server/src/app.ts` line 207:
```typescript
app.get('/metrics', async (_req, res) => {
```

### Import already available
`requireAuth` is already imported in `server/src/routes/scraper.ts` (line 5)
In `server/src/app.ts`, `requireAuth` may need to be imported from `./middleware/auth.js`

### Rate limiter consideration
`/metrics` currently has no rate limiter. Consider adding `generalLimiter` to prevent metric scraping abuse, but this is optional and not required for this story.

---

## Files to Modify

| File | Change | Status |
|------|--------|--------|
| `server/src/app.ts` | Add `requireAuth` to `/metrics` route + import | Done |
| `server/src/routes/scraper.ts` | Add `requireAuth` to `/status` route | Done |
| `server/src/routes/scraper.test.ts` | Add test for 401 on unauthenticated `/status` | Done |
| `server/src/app.test.ts` | Add test for 401 on unauthenticated `/metrics` | Done |
| `server/package-lock.json` | Added `cookie-parser` dependency | Done |

---

## Rollback Strategy

Remove `requireAuth` middleware from both routes — zero code change needed beyond reverting the commit.

---

## References

- Epic: `_bmad-output/planning-artifacts/epics.md` — Epic 9
- Audit report in session `20260525_084726_887f109f`
- PR #1075 for prior security fixes (stories 3+4)
- Scraper routes: `server/src/routes/scraper.ts`
- App entry: `server/src/app.ts`

---

## Dev Agent Record

<!-- Filled by dev agent during DS -->
- **Branch:** feat/9-1-protect-exposed-endpoints
- **Commits:**
  - `test(scraper,api): add test for 401 on unauthenticated /metrics and /status`
  - `feat(api): add requireAuth to /metrics and /api/scraper/status endpoints`
- **PR:** 
- **Test results:** 755 tests pass (0 failures), including new 401 tests
- **Deviations:** None - followed story tasks exactly
- **Completion Notes:**
  - Added `requireAuth` import to `server/src/app.ts`
  - Added `requireAuth` middleware to `/metrics` and `/api/scraper/status` routes
  - Made `requireAuth` mock controllable via `shouldRejectAuth` in scraper tests
  - Added auth mock to app tests for consistency
  - Installed missing `cookie-parser` dependency needed by app tests
  - E2E tests already authenticated — no changes needed
  - Date: 2026-05-25
