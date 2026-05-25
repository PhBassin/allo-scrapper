---
story_key: 9-1-protect-exposed-endpoints
epic: 9-security-audit-remediation
status: ready-for-dev
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

### T1: Add requireAuth to /metrics endpoint
- **File:** `server/src/app.ts` (line ~207)
- **Action:** Add `requireAuth` middleware before the `/metrics` handler
- **Pattern:** Same pattern as other protected routes: `app.get('/metrics', requireAuth, async (_req, res) => {...})`
- **AC:** AC1, AC3

### T2: Add requireAuth to /api/scraper/status endpoint
- **File:** `server/src/routes/scraper.ts` (line ~125)
- **Action:** Add `requireAuth` middleware after `scraperLimiter`
- **Current:** `router.get('/status', scraperLimiter, async (req, res, next) => {...})`
- **Target:** `router.get('/status', scraperLimiter, requireAuth, async (req: AuthRequest, res, next) => {...})`
- **Note:** Type the `req` parameter as `AuthRequest` to match pattern
- **AC:** AC2, AC4

### T3: Add/update tests
- **File:** `server/src/routes/scraper.test.ts` — verify `/status` returns 401 without token
- **File:** `server/src/app.test.ts` (or new test) — verify `/metrics` returns 401 without token
- **AC:** AC1, AC2

### T4: Update integration/E2E tests if needed
- Any existing test that calls `/metrics` or `/api/scraper/status` without auth must be updated
- Check `e2e/` directory and integration test files

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

| File | Change |
|------|--------|
| `server/src/app.ts` | Add `requireAuth` to `/metrics` route + import |
| `server/src/routes/scraper.ts` | Add `requireAuth` to `/status` route |
| `server/src/routes/scraper.test.ts` | Add test for 401 on unauthenticated `/status` |
| Test file for /metrics (TBD) | Add test for 401 on unauthenticated `/metrics` |

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
- **Branch:** 
- **Commits:** 
- **PR:** 
- **Test results:** 
- **Deviations:** 
