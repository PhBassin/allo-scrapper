# CONTEXT

Domain glossary for allo-scrapper. Devoid of implementation details — this is what things *mean*, not how they're stored.

## Core entities

### Theater

A cinema venue that screens movies. One Theater is one physical venue, identified by a stable external id.

A Theater has:
- a **name** (which may begin with a brand prefix such as "UGC" or "Pathé")
- an **address**, a city, a postal code
- an **image** and a **booking URL**
- exactly one **Source** it is scraped from (today, `'allocine'` for nearly all rows — see the Source concept below)

The number of screens in a venue is **not a domain attribute** of a Theater here. It was historically collected and displayed, but has been removed — see ADR 0002.

**What a Theater is *not*:**
- A Theater is not a brand. "UGC" is a name prefix; "UGC Bercy" is one Theater. There is no `Brand` entity in this model.
- A Theater is not a data source. The source website is a property of a Theater, not the other way around.
- A Theater is not a count of screens. The number of physical screens in a venue is not a domain attribute here — see ADR 0002.

**Lifecycle:** A Theater is either *active* (row present, scraped on schedule) or it does not exist (row deleted, all history lost via `ON DELETE CASCADE`). There is no soft-delete / closed-state concept: closing a Theater means deleting the row, and all its historical Showtimes and WeeklyPrograms are removed with it. See ADR 0001 for the rationale.

### Showtime

One specific scheduled showing of a Movie at a Theater. A Showtime has a date, a start time, a combined `datetime_iso`, a format (e.g. IMAX, 3D), and a list of "experiences" (e.g. Dolby Atmos, 4DX).

**"Showtimes" (plural) is not a separate concept.** It is the plural of Showtime — used for the table name, query results, and UI page names. The domain has one concept: a Showtime.

**What a Showtime is *not*:**
- Not a **Screening**. The codebase has no entity called Screening. The word appears in docs only as an adjective ("screening schedules"). The canonical term is **Showtime**.
- Not a **Session**. "Session" is reserved for user-auth (cookie sessions, SSE subscriber sessions) — see the *Session* entry under Authentication. Using "session" for a movie showing will collide.
- Not a **Séance**. The table was historically named `seances` (French) and was deliberately renamed to `showtimes` (English) — see `docs/project/white-label-plan.md:580, 596`. The team chose the English word. French comments still say "séance" but that's a comment-language choice, not a domain concept.

### WeeklyProgram

A week-level programming fact: "Movie X is programmed at Theater Y in week W." A WeeklyProgram has a `week_start` date, an `is_new_this_week` flag (true if the movie was newly added to that Theater's program that week), and a `scraped_at` timestamp (when this fact was last confirmed).

**WeeklyProgram is a first-class concept, not derived from Showtimes.** The two entities overlap on `(theater_id, movie_id, week_start)` but carry different facts:
- A Showtime answers *"at what times does this movie screen at this Theater?"*
- A WeeklyProgram answers *"is this movie programmed at this Theater this week, and is it new?"*

The `is_new_this_week` flag cannot be derived from current `showtimes` alone — it requires comparing against prior weeks. The `scraped_at` timestamp records when the programming fact was last confirmed, which is independent of when individual Showtimes were last scraped.

### Source

An external website that publishes showtime data and from which one or more Theaters are scraped. Examples today: `'allocine'`. A Source is an **identity** (a stable string), not a parser.

**Source and Theater:** every Theater has exactly one Source. Today, one Source is used to scrape many Theaters; the data model does not require a Source to be 1:1 with Theaters.

**What a Source is *not*:**
- Not a **Strategy**. A Strategy is the *code* that knows how to scrape a given Source — the parser/adapter. Source is the identity; Strategy is the implementation. The two are 1:1 in the current code, but they are distinct concepts (the strategy can change while the source name stays the same; the source name identifies *what* is being scraped, the strategy identifies *how*).
- Not a **Parser**. A Parser is a helper function inside a Strategy that handles a specific data shape (an HTML page, a JSON blob). Parsers are implementation detail of Strategies, not domain entities.

**Practical note:** "Add support for a new Source" = add a new Strategy whose `sourceName` matches a new Source string. The Source identity is what Theater rows reference; the Strategy is what the scraper wires up.

## Scraping

The terms in this section name the recurring concepts of one end-to-end scrape run. A run is initiated by a ScrapeJob on the Redis queue, executed by the scraper microservice which emits ProgressEvents during the run, and tracked in the database via a ScrapeReport (the run-level record) holding many ScrapeAttempts (one per `(theater, date)` pair). One concept — Resume — lets a stopped/incomplete run be re-issued scoped to only its unfinished attempts. RateLimitConfig governs the API-side request throttling that protects AlloCiné responses from being overwhelmed.

### ScrapeAttempt

One per-`(theater, date)` outcome inside a ScrapeReport. A ScrapeAttempt is the unit of "did we get data for this theater on this date for this run?". Lives at `server/src/db/scrape-attempt-queries.ts:4` and is also persisted under that name in the scraper's local DB copy.

A ScrapeAttempt has a **status** drawn from a small finite state machine. Two creation paths exist; once created, the row is terminal (a Resume creates a NEW ScrapeAttempt on a fresh `report_id`, it does not re-open an old one):

- **Created as `pending`** at the moment a date is about to be scraped. Transitions:
  - `pending → success` — the date's scrape returned data; counts `movies_scraped` and `showtimes_scraped` are stamped.
  - `pending → failed` — a non-rate-limit error (parse, 5xx, network, timeout); `error_type`, `error_message`, `http_status_code` are stamped.
  - `pending → rate_limited` — a `RateLimitError` (HTTP 429 from the source); the cascade described below fires.
- **Created as `not_attempted` directly**, without going through `pending`. The triggers are inside `handleRateLimit` (`scraper/src/scraper/index.ts:462`):
  - For the current theater, the remaining dates *after* the rate-limited one.
  - For every theater processed *after* the rate-limited one (the "cascade"), every planned date.

Terminal states: `success`, `failed`, `rate_limited`, `not_attempted`. There is no `pending → not_attempted` and no transitions out of any terminal state.

**What a ScrapeAttempt is *not*:**
- Not the **run-level** record of a scrape. One ScrapeReport holds many ScrapeAttempts; see `getScrapeAttemptsByReport` at `server/src/db/scrape-attempt-queries.ts:112`.
- Not the **rate-limit configuration**. A `rate_limited` attempt is one *instance* of being throttled; see `RateLimitConfig` below for the configuration.
- Not the **dataset of what was scraped**. A `success` attempt does not hold the movies and showtimes themselves — those are written straight to the main tables; the attempt holds only counts and timestamps.

### ScrapeSummary

The structured result of one scrape run, attached to the final `'completed'` (or `'failed'`) ProgressEvent. Carries run-level counters (theaters / movies / showtimes / dates / duration / per-error list) and a final `status`. **Canonical home is `packages/scraper-protocol/src/events.ts`** (issue #1212). The server-side copy at `server/src/services/progress-tracker.ts:19` and the scraper-side copy at `scraper/src/types/scraper.ts:113` are now re-exports from the protocol package; the duplicate declarations are gone.

### ScrapeRun

The scraper-internal runtime object that drives one end-to-end scrape run. A `ScrapeRun` owns the mutable run state — the `ScrapeSummary` it builds up, the `ScrapeConfig` read once at construction, and the optional progress publisher — and exposes the run as a deep module: coherent operations (`prepare`, `runTheater`, `runDate`, `loadAvailability`, `filterDates`, `finalize`) plus controlled mutators (`recordError`, `incrementSuccessfulTheater`, …). It lives at `scraper/src/scraper/scrape-run.ts`. The thin `runScraper` entry in `scraper/src/scraper/index.ts` constructs a `ScrapeRun` and drives it; it is not consumed outside the scraper microservice.

**What a ScrapeRun is *not*:**
- Not a **Session**. "Session" is reserved for user-auth (cookie sessions, SSE subscriber sessions) — see the *Session* entry under Authentication. A ScrapeRun is a single scrape execution, not a user/auth session.
- Not a **ScrapeReport**. A ScrapeReport is the persisted, server-side run-level record in the database. A ScrapeRun is the transient scraper-process object whose final `ScrapeSummary` feeds the `'completed'` ProgressEvent; it is not written to a row.
- Not a **ScrapeSummary**. The ScrapeSummary is the structured result (counts + status) attached to the final event. A ScrapeRun *produces* a ScrapeSummary; it is not itself the summary.

### Resume

Re-issuing a stopped or incomplete scrape scoped to only the (theater, date) pairs that did not reach `success`. The UI exposes it as the "Reprendre le scraping" button (`client/src/pages/ReportsPage/ReportRateLimitedNotice.tsx:38`) wired through the `resume` function (`client/src/pages/ReportsPage.tsx:90`); the API path is `POST /api/scraper/resume/:reportId` (`server/src/routes/scraper.ts:85`); the scraper-runtime flag is `options.resumeMode: true` and the payload list is `options.pendingAttempts: Array<{ theater_id; date }>` (`scraper/src/scraper/index.ts:146-147`).

A Resume always produces a **new** ScrapeReport with `parent_report_id` set to the original. The server reads `getPendingScrapeAttempts(parentReportId)` (any attempt in `failed | rate_limited | not_attempted`), translates them into the `pendingAttempts` payload, and publishes a new ScrapeJob in resume mode. `filterDatesForScrape` then narrows each theater's plan to only its pending dates.

**Resume is not free retry.** It does not re-scrape dates that already reached `success` in the parent report. It is also not idempotent on the receiving theater: a date that was `not_attempted` in the parent becomes a brand new `pending` → `success/failed/...` sequence under the new report id.

### ScrapeJob

A unit of work submitted by the server over the Redis `scrape:jobs` list for the scraper microservice to execute. A ScrapeJob is a **discriminated union**: `{ type: 'scrape' }` for a standard run and `{ type: 'add_theater' }` for fetching metadata for a new AlloCiné URL and scraping everything it publishes. Every job carries a `reportId` and an optional OpenTelemetry `traceContext`.

**Canonical home is `packages/scraper-protocol/src/jobs.ts`** (issue #1212). Both `server/src/services/redis-client.ts` and `scraper/src/redis/client.ts` re-export the type and the `serializeJob` / `parseJob` helpers from the protocol package; the previous duplicate declarations are gone. `parseJob` validates the discriminated union at the parse boundary — the safety net that catches any future drift.

The `ScrapeJobScrape.options` shape now has a single canonical declaration that includes `resumeMode` and `pendingAttempts` for the Resume case. Both sides of the wire agree, and the scraper's local `ScrapeOptions` (`scraper/src/scraper/index.ts:140`) is now a scraper-internal type that no longer needs to redeclare wire fields.

### ProgressEvent

A discrete event published by the scraper onto the Redis `scrape:progress` pub/sub channel during a run, fanned out by the server to connected SSE clients. The union covers run start (`started`), per-theater and per-date lifecycle (`theater_started`, `date_started`, `date_completed`, `date_failed`, `date_stale`), per-movie lifecycle (`movie_started`, `movie_completed`, `movie_failed`), run completion (`completed` with the ScrapeSummary), and fatal failure (`failed`).

**Canonical home is `packages/scraper-protocol/src/events.ts`** (issue #1212). The scraper's local declaration at `scraper/src/types/scraper.ts:98` and the server's re-declaration at `server/src/services/progress-tracker.ts:4` are now re-exports from the protocol package.

### ScheduleChangeEvent

A fire-and-forget pub/sub notification on the Redis `scraper:schedule:changed` channel telling the scraper to reload its local cron registrations after the admin has created, updated, or deleted a `schedules` row. The event carries `action: 'created' | 'updated' | 'deleted'`, `scheduleId`, and the optional denormalized `schedule` snapshot. The **server is the source of truth** for the schedules table; the scraper subscribes and re-evaluates its in-process cron jobs in response.

**Canonical home is `packages/scraper-protocol/src/events.ts`** (issue #1212). The previous scraper-side declaration at `scraper/src/redis/client.ts:9` and server-side declaration at `server/src/services/redis-client.ts:15` are now re-exports from the protocol package.

**ScheduleChangeEvent is not Schedule.** A `Schedule` is the persisted row in the `schedules` table (server-admin CRUD via `routes/scraper-schedules.ts`); a `ScheduleChangeEvent` is the live pub/sub notification that one of those rows changed. The event's optional `schedule` snapshot is a payload convenience, NOT a redefinition of the row — readers should fetch the row from the DB if they need canonical state.

### RateLimitConfig

The configured thresholds that govern the server's per-endpoint HTTP rate-limit middleware. Lives at `server/src/services/rate-limit-source.ts` as the **flat runtime shape** consumed by the limiter: per-endpoint `*_Max` caps and `*_WindowMs` windows for general, auth, register, protected, scraper, public, and health routes. Resolution order (DB row in `rate_limit_configs` → env vars (e.g. `RATE_LIMIT_GENERAL_MAX`) → built-in defaults) lives in one place. The source is initialized once at boot (`loadFromDb(db)`) and the middleware subscribes to invalidation events so its limiter delegates are rebuilt whenever the DB row changes — either from the 60-second poller (`services/rate-limit-refresher.ts`) or the admin write path.

The **admin-facing shape** `RateLimitAuditInfo` (same file) wraps the flat config under a `config` key and tacks on audit-only metadata: `source` (`'database' | 'env' | 'default'` — the layer that produced the values), `updatedAt`, `updatedBy` (the admin who last edited), and `environment`. The `source` discriminator is **audit metadata** about provenance of the row — it is NOT a domain property of the limit set itself, and it never reaches the per-request hot path. Admin GET returns `RateLimitAuditInfo`; the middleware sees only the flat `RateLimitConfig`.

**What RateLimitConfig is *not*:**
- Not a per-request decision. The limiter decides per-request allow/deny; the config sets the thresholds.
- Not the source-side rate limiter that protects AlloCiné (`RateLimitError`). Those are separate concerns: `RateLimitConfig` protects this service's HTTP surface; `RateLimitError` reports when the upstream source has throttled us.
- Not the same across services. Only the server has an HTTP surface to rate-limit; the scraper has no equivalent shape.

## Authentication

### Session

A user-auth **Session** is the server-side credential-issuance lifecycle for one logged-in user: the short-lived access token (HS256 JWT), the rotating refresh token (an httpOnly cookie backed by the `refresh_tokens` table), the double-submit CSRF token cookie, and the permission resolution that feeds the access token's claims. One user holds many Sessions at once — one per device — and changing the password revokes all of them, as does an admin password reset or role change on that user (`UserService.resetPassword` / `updateUserRole` in `services/user-service.ts`).

The concept is implemented as a single deep module: `server/src/services/session-service.ts` (`SessionService`). Route handlers under `routes/auth.ts` (`/login`, `/refresh`, `/logout`, `/change-password`, `/me`) are thin shims over it; the cookie, refresh-token, and CSRF surface never appears inline in a route. `SessionService` composes `AuthService` (the access-token minter + password-validation primitive) and the refresh-token repository. The refresh-token lifetime is declared in **exactly one place** — `parseRefreshTokenExpiry` in `repositories/refresh-token-repository.ts`, driven by `REFRESH_TOKEN_EXPIRY` — and both the persisted token expiry and the refresh cookie's `maxAge` read from it.

**Rotated vs revoked.** A refresh token is *rotated* when `/refresh` replaces it: it gets `revoked_at` **and** `replaced_by_id` (its successor, migration 026). It is *revoked* when a deliberate action ends it — logout, password change, admin reset or role change — which sets only `revoked_at`. Only rotated tokens take part in reuse detection; presenting a revoked one is a plain 401.

**Refresh-token reuse.** `validateRefreshToken` returns a `RefreshTokenCheck` (`valid` / `race` / `rejected`, in `repositories/refresh-token-repository.ts`). Presenting a rotated token more than `REUSE_GRACE_MS` (30 s) after its rotation is a replay: if its successor was itself rotated, two parties hold diverging copies of the Session — a theft signal, so every refresh token of the user is revoked and a security event is logged; if the successor was never used (a refresh response lost on the network, or a thief that has not refreshed yet), only that successor is revoked, so the replayed branch dies and the user's other Sessions live on. Inside the grace window it is the legitimate concurrent-refresh race (`race`); a rotation that loses the same race (`rotateRefreshToken` returns `null`) is one too. A race yields a 401 with `code: "REFRESH_RACE"` that, unlike every other refresh 401, does **not** clear the cookie surface — the winner's response carries the fresh cookies — and the client treats it as a successful refresh. On the client, `client/src/api/core.ts` also serializes refreshes across tabs with the Web Locks API (lock `auth-refresh`) so tabs sharing one cookie jar never present the same refresh token twice.

**Admin revocation.** `UserService.resetPassword` / `updateUserRole` revoke the target's refresh tokens in the same transaction as the change. Re-assigning a user's current role is a no-op and revokes nothing. The access token already issued keeps its permissions until it expires — the auth middleware is stateless.

**What a Session is *not*:**
- Not the **access token** itself. The access token is one credential *inside* a Session; `AuthService.mintAccessToken` is the canonical minter, and `SessionService` is its sole caller in the request cycle.
- Not an **SSE subscriber session**. The word "session" is reused loosely for a live SSE subscriber connection (see `attachProgressStream` in `services/sse-bridge.ts`); that is a transport-lifetime concept, unrelated to user-auth Sessions. The two share only the word.
- Not a **ScrapeRun** (one scrape execution) or a **Showtime** (a movie showing) — see those entries.