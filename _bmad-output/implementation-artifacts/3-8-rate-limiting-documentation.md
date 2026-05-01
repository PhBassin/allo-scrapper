# Story 3.8: Rate Limiting Documentation

Status: done

## Story

As a developer,
I want rate limiting windows documented per endpoint in README.md,
so that API consumers understand limits and avoid hitting 429 errors.

## Acceptance Criteria

1. **Given** the README.md file exists
   **When** I navigate to the "Rate Limiting" section
   **Then** a table lists all endpoints with their rate limits
   **And** the table columns include: Endpoint, Limit, Window, Exemptions
   **And** examples include `/api/auth/login: 5 req / 15 min, no exemptions`

2. **Given** the documentation is complete
   **When** I read the rate limiting section
   **Then** the documentation explains retry-after behavior
   **And** the documentation includes a code example for handling 429 errors
   **And** the documentation lists the localhost/private-IP exemption rules

3. **Given** a developer integrates with the API
   **When** they read the rate limiting docs
   **Then** they understand how to implement exponential backoff
   **And** they know which endpoints have exemptions
   **And** they can test rate limiting in a dev environment

## Tasks / Subtasks

- [x] Add a "Rate Limiting" section to `README.md` (AC: 1, 2, 3)
  - [x] Insert after the existing API/Authentication section; scan README for the best anchor point
  - [x] Write a Markdown table with columns: **Endpoint pattern**, **Limiter**, **Default limit**, **Window**, **Key**, **Exemptions**
  - [x] Populate all six limiters from `server/src/middleware/rate-limit.ts` (see Dev Notes for exact values)
  - [x] Add a subsection explaining `Retry-After` header and `retryAfterSeconds` JSON field
  - [x] Add a JavaScript/TypeScript code snippet showing exponential backoff on 429
  - [x] Add a subsection on localhost / private-IP exemptions (`healthCheckLimiter` skips via `isTrustedLocalHealthProbe`)
  - [x] Add a subsection on local dev testing: env vars to override limits, and the `NODE_ENV=test` skip behavior

- [x] Verify the new section renders correctly (AC: 1, 2, 3)
  - [x] `npm run build` in `client/` passes (no README import errors)
  - [x] No broken Markdown links introduced

## Dev Notes

### Exact Rate Limit Contracts (source: `server/src/middleware/rate-limit.ts`)

All limiters share a single configurable window (`RATE_LIMIT_WINDOW_MS`, default **15 minutes**) except where noted.

| Limiter export | Env override for max | Default max | Window env override | Default window | Key strategy | Applied to |
|---|---|---|---|---|---|---|
| `generalLimiter` | `RATE_LIMIT_GENERAL_MAX` | **100** | `RATE_LIMIT_WINDOW_MS` | 15 min | JWT (`authenticatedKeyGenerator`) or IP | `app.use('/api', …)` — all `/api/*` routes globally; also static SPA fallback |
| `authLimiter` | `RATE_LIMIT_AUTH_MAX` | **5** | `RATE_LIMIT_WINDOW_MS` | 15 min | IP (default `express-rate-limit`) | `POST /api/auth/login`, `POST /api/auth/change-password` — `skipSuccessfulRequests: true` for login |
| `registerLimiter` | `RATE_LIMIT_REGISTER_MAX` | **3** | `RATE_LIMIT_REGISTER_WINDOW_MS` | **1 hour** | IP | `POST /api/auth/register` |
| `protectedLimiter` | `RATE_LIMIT_PROTECTED_MAX` | **60** | `RATE_LIMIT_WINDOW_MS` | 15 min | JWT (`authenticatedKeyGenerator`) | Reports, cinemas CRUD write, scraper status/progress/DLQ read, users CRUD, settings, system endpoints |
| `scraperLimiter` | `RATE_LIMIT_SCRAPER_MAX` | **10** | `RATE_LIMIT_WINDOW_MS` | 15 min | JWT (`authenticatedKeyGenerator`) | `POST /api/scraper/trigger`, `POST /api/scraper/resume/:id`, DLQ read/retry |
| `publicLimiter` | `RATE_LIMIT_PUBLIC_MAX` | **100** | `RATE_LIMIT_WINDOW_MS` | 15 min | IP | `GET /api/cinemas`, `GET /api/cinemas/:id` — unauthenticated read |
| `healthCheckLimiter` | `RATE_LIMIT_HEALTH_MAX` | **10** | *(fixed 1-minute window)* | 1 min | IP | `GET /api/health` — **exempts localhost + private IPs via `isTrustedLocalHealthProbe`** |

**Key generator details** (`authenticatedKeyGenerator`, line 53-90):
- Decodes JWT without verification → builds compound key: `scope:<s>|org:<slug>|username:<u>|id:<id>`
- Falls back to `req.ip` for unauthenticated requests or JWT decode failures
- Purpose: prevents cross-tenant limiter collisions (tenant users often share small integer `id` values)

**`Retry-After` response contract** (line 134-146):
- `protectedLimiter` sets `Retry-After: <seconds>` header and `retryAfterSeconds` JSON field on 429
- Other limiters use default `express-rate-limit` headers (`RateLimit-*` standard headers enabled where `standardHeaders: true`)
- `generalLimiter` and `protectedLimiter` have `standardHeaders: true, legacyHeaders: false`

### Localhost / Private IP Exemption Rules (source: lines 5-117)

`isTrustedLocalHealthProbe(req)` exempts a request when ALL three conditions hold:
1. `req.ip` resolves to `127.0.0.1` or `::1`
2. The socket's `remoteAddress` is loopback **or** a private range (`10.x`, `192.168.x`, `172.16-31.x`, link-local, ULA IPv6)
3. Every IP in the `X-Forwarded-For` chain is also loopback

This means Docker internal health probes bypass the limiter; external probes routed through a public IP do not.

### `NODE_ENV=test` Behavior

`skipTest` disables ALL limiter middleware when `NODE_ENV=test` (line 40). Rate-limit tests that use real limiters must run in `development` or `production`. This is intentional to prevent test flakiness.

### Environment Variable Overrides for Local Dev Testing

```bash
# Tighten limits for faster manual testing (development mode)
RATE_LIMIT_WINDOW_MS=60000          # 1-minute window instead of 15 min
RATE_LIMIT_PROTECTED_MAX=10         # 10 req instead of 60
RATE_LIMIT_GENERAL_MAX=20
RATE_LIMIT_AUTH_MAX=3
```

### Admin API (Dynamic Configuration)

`server/src/routes/admin/rate-limits.ts` exposes CRUD endpoints for `rate_limit_configs` (migration `017_add_rate_limit_configs.sql`). Changes take effect on server restart; limiters are initialized at module load time.

### Previous Story Context

- Story 3.5 established the `Retry-After` / `retryAfterSeconds` contract on `protectedLimiter` and the tenant-scoped 429 UI. [Source: `_bmad-output/implementation-artifacts/3-5-rate-limiting-burst-scenario-tests.md`]
- Story 3.6 added the countdown timer to `TenantProvider`. [Source: `_bmad-output/implementation-artifacts/3-6-rate-limiting-window-reset-validation.md`]
- Story 3.7 added `isTrustedLocalHealthProbe` for Docker health probes. [Source: `_bmad-output/implementation-artifacts/3-7-localhost-exemption-for-docker-health-probes.md`]

### Reinvention Prevention

- **Do not** add a new documentation file — write directly into `README.md`.
- **Do not** add a Storybook, JSDoc, or separate API spec file for this story; the epic explicitly targets `README.md`.
- **Do not** change any source code. This is a documentation-only story.
- **Do not** duplicate content that already exists in `README.md`; scan first, then insert or extend.

### Architecture Compliance

- `README.md` is at the repo root. Keep the new section consistent with the existing Markdown style (ATX headings, fenced code blocks, GFM tables).
- Deployment impact: 🟢 DOCUMENTATION-ONLY — no build, migration, or runtime changes.

### References

- Rate limit middleware: `server/src/middleware/rate-limit.ts:1-233`
- Route applications: `server/src/app.ts:14,150,198`, `server/src/routes/auth.ts:29,55,84`, `server/src/routes/reports.ts:16,62,89`, `server/src/routes/cinemas.ts:37,55,104,129,147`, `server/src/routes/scraper.ts:56,114,188,214,304`, `server/src/routes/users.ts:38,87,130,220,300,362`
- Epic definition: `_bmad-output/planning-artifacts/epics.md:1091-1121`
- Story notes: `_bmad-output/planning-artifacts/notes-epics-stories.md:238-245`
- Project context: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

github-copilot/claude-sonnet-4.6

### Debug Log References

None — documentation-only story, no runtime code changed.

### Completion Notes List

- Added `## Rate Limiting` section to `README.md` after `## Runtime Notes`.
- Table covers all 7 limiters with exact default values sourced from `server/src/middleware/rate-limit.ts`.
- `Retry-After` / `retryAfterSeconds` contract documented with a TypeScript exponential-backoff snippet.
- Localhost / private-IP exemption rules for `healthCheckLimiter` explained (all 3 conditions of `isTrustedLocalHealthProbe`).
- `NODE_ENV=test` skip behaviour and local dev env-var overrides documented.
- Admin API note added (restart required for `rate_limit_configs` changes).
- `client/` build passes with no errors or new warnings.

### File List

- `README.md`

### Change Log

- 2026-05-01: Added Rate Limiting section to README.md (Story 3.8)
