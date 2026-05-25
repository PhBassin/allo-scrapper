---
story_key: 9-3-hot-reload-rate-limits
epic: 9-security-audit-remediation
status: ready-for-dev
created: 2026-05-25
---

# Story 9.3: Hot-Reload Rate Limit Configuration

**As a** security operator,
**I want** rate limit configuration changes to take effect without server restart,
**So that** DoS protection can be adjusted dynamically during incidents.

---

## Acceptance Criteria

### AC1: In-memory config refreshes after DB update
**Given** an admin updates rate limits via `PUT /api/admin/rate-limits`
**When** the update is committed to the database
**Then** the in-memory rate limiter instances pick up the new values
**And** no server restart is required

### AC2: Existing counters are preserved
**Given** a rate limit window is active with existing request counters
**When** the max limit is changed from 100 to 50
**Then** clients who already exceeded 50 get a 429 on their NEXT request
**And** clients under the new threshold continue normally
**And** the IP-keyed maps are NOT cleared (state preserved)

### AC3: Graceful degradation on DB unavailability
**Given** the rate limit config is periodically refreshed from DB
**When** the database is temporarily unavailable
**Then** the last known good configuration continues to be used
**And** the server logs a warning: "Failed to refresh rate limits from DB, using cached config"

### AC4: No performance regression
**Given** the hot-reload mechanism is active
**When** a request hits a rate-limited endpoint
**Then** the rate limit check overhead is < 1ms vs current (no DB call per request)
**And** the existing `rate-limit.ts` test suite continues to pass

---

## Tasks / Subtasks

### T1: Implement config refresh mechanism
- **File:** `server/src/middleware/rate-limit.ts` (or new file `server/src/services/rate-limit-refresher.ts`)
- **Action:** Create a periodic refresh that reads rate limit config from DB (using existing `getRateLimits()` from `rate-limit-queries.ts`) and updates the live rate limiter instances
- **Existing infrastructure:** 
  - `server/src/db/rate-limit-queries.ts` — `getRateLimits()` already queries the `rate_limit_configs` table
  - `server/src/config/rate-limits.ts` — `invalidateRateLimitCache()` exists but invalidates cache, doesn't push to live instances
- **Approach options:**
  - **A)** Use `express-rate-limit`'s `store` interface to back limits with refreshable DB config
  - **B)** Create a wrapper that recreates limiters when config changes
  - **C)** Poll the DB every 60s and push new limits into existing instances
- **Recommendation:** Option C — simplest, least disruptive. Create a `RateLimitRefresher` service that reads DB every 60s and updates the exported limiter instances
- **AC:** AC1, AC3

### T2: Update rate limit instances to support mutation
- **File:** `server/src/middleware/rate-limit.ts`
- **Action:** Export a function `refreshRateLimits(config)` that updates `max` and `windowMs` on each limiter instance without clearing the internal hit counters
- **Note:** The `express-rate-limit` library stores hits in a `MemoryStore` keyed by IP. Changing `max`/`windowMs` on the fly requires modifying the stored options. Check if the library supports this; if not, wrap the limiters in a custom store.
- **AC:** AC2

### T3: Wire refresh into the admin update route
- **File:** `server/src/routes/admin/rate-limits.ts`
- **Action:** After `PUT /api/admin/rate-limits` updates the DB, also trigger an immediate config refresh (don't wait for 60s poll)
- **Current:** `invalidateRateLimitCache()` is called → extend to also refresh in-memory limiters
- **AC:** AC1

### T4: Add tests
- **File:** New `server/src/services/rate-limit-refresher.test.ts`
- **Test 1:** After DB update, limiter respects new max
- **Test 2:** Counters preserved across refresh
- **Test 3:** DB unavailable → cache used, warning logged
- **Test 4:** Manual refresh after admin PUT
- **AC:** AC1, AC2, AC3

### T5: Run existing rate limit tests
```bash
cd server && npx vitest run src/middleware/rate-limit.test.ts src/middleware/rate-limiter.test.ts
```
- All existing tests must pass
- **AC:** AC4

---

## Dev Notes

### Current architecture
```
rate-limit.ts (module load)
  → reads env vars RATE_LIMIT_*_MAX, RATE_LIMIT_WINDOW_MS
  → evaluates parseEnvInt() once at startup
  → creates express-rate-limit instances (immutable)
  → DB-backed admin CRUD exists (rate_limit_configs table)
  → BUT changes require restart (comment lines 15-28 in rate-limit.ts)
```

### Target architecture
```
rate-limit.ts (module load)
  → creates limiter instances with initial env var values
  → RateLimitRefresher starts on app init
    → poll DB every 60s
    → if config changed, push new limits into live instances
    → on error, log + keep cached
  → PUT /api/admin/rate-limits → DB write + immediate refresh trigger
```

### express-rate-limit compatibility
- `express-rate-limit` v7+ has a `store` option. A custom store can be backed by a mutable config.
- Alternative: Use `rate-limit-flexible` which supports runtime config changes natively, but this would be a larger refactor.
- **Simpler approach:** Check if the library's internal options are mutable. If `limiter.max` is a getter, create new instances and swap references while preserving hit state.

### Fallback values (from current code)
| Limiter | Env var | Default |
|---------|---------|---------|
| General | RATE_LIMIT_GENERAL_MAX | 100 |
| Auth | RATE_LIMIT_AUTH_MAX | 5 |
| Protected | RATE_LIMIT_PROTECTED_MAX | 60 |
| Scraper | RATE_LIMIT_SCRAPER_MAX | 10 |
| Public | RATE_LIMIT_PUBLIC_MAX | 100 |
| Health | RATE_LIMIT_HEALTH_MAX | 10 |
| Window | RATE_LIMIT_WINDOW_MS | 900000 (15 min) |

---

## Files to Modify

| File | Change |
|------|--------|
| `server/src/middleware/rate-limit.ts` | Add `refreshRateLimits()` export; make instances mutable |
| `server/src/routes/admin/rate-limits.ts` | Call refresh after DB update |
| `server/src/app.ts` | Start `RateLimitRefresher` on app init |
| `server/src/services/rate-limit-refresher.ts` | **NEW** — periodic DB poll + config push |

---

## Rollback Strategy

Remove the refresher service and revert to startup-only config. Rate limits continue working with last-known values from env vars.

---

## References

- Epic: `_bmad-output/planning-artifacts/epics.md` — Epic 9, Story 9.3
- Current rate-limit.ts: `server/src/middleware/rate-limit.ts`
- Admin rate-limits route: `server/src/routes/admin/rate-limits.ts`
- DB queries: `server/src/db/rate-limit-queries.ts`
- Config cache: `server/src/config/rate-limits.ts`
- Migration: `migrations/017_add_rate_limit_configs.sql`
- express-rate-limit docs: https://express-rate-limit.mintlify.app/

---

## Dev Agent Record

<!-- Filled by dev agent during DS -->
- **Branch:** 
- **Commits:** 
- **PR:** 
- **Test results:** 
- **Deviations:** 
