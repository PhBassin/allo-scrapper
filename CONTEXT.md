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

The number of screens in a venue is **not a domain attribute** of a Theater here. It was historically collected and displayed, but is being removed — see ADR 0002.

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
- Not a **Session**. "Session" is reserved for user-auth (cookie sessions, SSE subscriber sessions). Using "session" for a movie showing will collide.
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

---

## Process & runtime terms

These terms describe how a scrape actually runs end-to-end — the lifecycle of a single attempt, the wire contract between server and scraper, the stream of progress events, and the rate-limit configuration that protects the API. They complement the entity glossary above.

### ScrapeAttempt

One attempt to scrape one (theater, date) pair within one ScrapeReport. It is the **unit of resumability**: a report can be partially failed, and the Resume flow re-queues the not-yet-successful attempts.

Canonical type & transitions:

```ts
// server/src/db/scrape-attempt-queries.ts:4-16
status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted'
```

State machine:

| From            | To              | Triggered by                                                                                  |
| --------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `(none)`        | `pending`       | `createScrapeAttempt` at the start of `processOneDate` (`scraper/src/scraper/index.ts:35-48`) |
| `pending`       | `success`       | Normal completion of the date (`updateScrapeAttempt({ status: 'success' })`)                  |
| `pending`       | `failed`        | Non-429 error (network, parse, 5xx, …)                                                        |
| `pending`       | `rate_limited`  | 429 from source — `handleRateLimit` (`scraper/src/scraper/index.ts:462`)                      |
| `pending`       | `not_attempted` | Date filtered out (not published yet, or filtered by `filterDatesForScrape`)                  |

**Terminal states:** `success`, `failed`, `rate_limited`, `not_attempted`. There is no retry inside one report — recovery is via the Resume flow, which creates a new report and re-queues only the `failed` / `rate_limited` / `not_attempted` rows of the parent.

The set of "pending" attempts from the perspective of the Resume route is defined as the terminal-but-not-success states: `getPendingScrapeAttempts` (`server/src/db/scrape-attempt-queries.ts:97-109`) filters on `status IN ('failed', 'rate_limited', 'not_attempted')`.

**Anchors:**
- Type: `server/src/db/scrape-attempt-queries.ts:4-16`
- FSM transitions: `scraper/src/scraper/index.ts` (`handleRateLimit` at 462, `processOneDate` at 360, `filterDatesForScrape` at 632)
- Resume consumer: `server/src/services/scraper-service.ts:53-77` (`triggerResume`)

### ScrapeSummary

The end-of-run totals published on the `completed` ProgressEvent. One canonical definition; consumer code may extend it for UI display only.

Canonical shape (the producer side):

```ts
// scraper/src/types/scraper.ts:113-130
interface ScrapeSummary {
  total_theaters: number;
  successful_theaters: number;
  failed_theaters: number;
  total_movies: number;
  total_showtimes: number;
  total_dates: number;
  duration_ms: number;
  errors: Array<{
    theater_name: string;
    theater_id: string;
    date?: string;
    error: string;
    error_type?: 'http_429' | 'http_5xx' | 'http_4xx' | 'network' | 'parse' | 'timeout';
    http_status_code?: number;
  }>;
  status?: 'success' | 'partial_success' | 'failed' | 'rate_limited';
}
```

**Known collision:** `server/src/services/progress-tracker.ts:19-36` declares a structurally identical `ScrapeSummary`. It exists because the SSE subscriber needs the type locally and the scraper protocol package is not yet extracted (tracked separately — see `packages/scraper-protocol` work). When the protocol package lands, this duplicate disappears and the canonical type lives there. Until then: **the canonical is `scraper/src/types/scraper.ts`** (the producer); the progress-tracker copy is a tolerated drift, listed in `.fallowrc.json` `ignoreExports`.

The `status` field is the canonical extension point — `success` means all attempts succeeded, `partial_success` means some failed but at least one succeeded, `failed` means none succeeded, `rate_limited` means a 429 short-circuited the run.

**Anchors:**
- Producer: `scraper/src/types/scraper.ts:113-130`
- Consumer (tolerated drift): `server/src/services/progress-tracker.ts:19-36`
- Orchestrator mutations: `scraper/src/scraper/index.ts` (`summarizeTheater` at 670, `finalizeScrape` at 785)

### Resume (`resumeMode`, `pendingAttempts`)

One concept, three names that appear in different layers of the stack. They must move together — if any one is renamed without the others, the wire breaks silently.

| Name              | Layer                                | What it is                                                                                                                 |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Resume**        | UI / API                             | The button on a rate-limited report (`client/src/pages/ReportsPage/ReportRateLimitedNotice.tsx`) and the `POST /api/scraper/resume/:reportId` route (`server/src/routes/scraper.ts:84-129`). |
| `resumeMode`      | Wire (ScrapeJob.options)             | The boolean flag the server sets on the re-issued job (`server/src/services/scraper-service.ts:71`).                      |
| `pendingAttempts` | Wire (ScrapeJob.options payload)     | The list of `{ theater_id, date }` pairs to retry (`server/src/services/scraper-service.ts:72`).                            |

**Semantics:** when the scraper receives a `scrape` job with `resumeMode: true`, it intersects the originally-requested dates with `pendingAttempts` for each theater before scraping (`scraper/src/scraper/index.ts:632-661` — `filterDatesForScrape`). Attempts that already succeeded in the parent report are excluded from the list and therefore not re-scraped.

**Drift hazard:** the server's `ScrapeJobScrape.options` (`server/src/services/redis-client.ts:30-37`) declares `resumeMode` and `pendingAttempts`; the scraper's `ScrapeJobScrape.options` (`scraper/src/redis/client.ts:30-35`) does not. The scraper reads the fields anyway (`scraper/src/scraper/index.ts:146-148`, `:632-660`) — the compiler doesn't catch it. This is the canonical example of why the `packages/scraper-protocol` extraction is the project's highest-leverage refactor.

**Anchors:**
- Route: `server/src/routes/scraper.ts:84-129`
- Service: `server/src/services/scraper-service.ts:53-77`
- Wire (server): `server/src/services/redis-client.ts:30-37`
- Wire (scraper, drifted): `scraper/src/redis/client.ts:30-35`
- Consumer: `scraper/src/scraper/index.ts` (`ScrapeOptions` at 140-148, `filterDatesForScrape` at 632-661)

### ScrapeJob

The discriminated-union payload published by the server onto the Redis `scrape:jobs` list and consumed by the scraper microservice. Two variants today:

```ts
// server/src/services/redis-client.ts:27-50
type ScrapeJob = ScrapeJobScrape | ScrapeJobAddTheater;

interface ScrapeJobScrape extends BaseScrapeJob {
  type: 'scrape';
  triggerType: 'manual' | 'cron';
  options?: {
    mode?: 'weekly' | 'from_today' | 'from_today_limited';
    days?: number;
    theaterId?: string;
    movieId?: number;
    resumeMode?: boolean;          // see Resume above
    pendingAttempts?: Array<{ theater_id: string; date: string }>;
  };
}

interface ScrapeJobAddTheater extends BaseScrapeJob {
  type: 'add_theater';
  triggerType: 'manual';
  url: string;
}
```

The `type` field is the discriminant. Every consumer narrows on it before reading fields (`scraper/src/redis/client.ts:101-116`).

**Where this lives — pending refactor.** Today the type is duplicated on both sides of the wire (`server/src/services/redis-client.ts:9-50` and `scraper/src/redis/client.ts:21-50`) and has already drifted — see the `resumeMode` / `pendingAttempts` row in the Resume section above. The canonical home is the planned `packages/scraper-protocol` workspace. Until that lands, treat `server/src/services/redis-client.ts:27-50` as the canonical definition (the producer) and the scraper's local copy as a tolerated drift listed in `.fallowrc.json`.

**What a ScrapeJob is *not*:**
- Not a **ScrapeReport**. A ScrapeReport is the persistent row that groups one run's ScrapeAttempts; a ScrapeJob is the transient wire payload that triggers a run. The `reportId` on the job becomes the `id` of the ScrapeReport that the scraper creates on startup.
- Not a **ScrapeSchedule**. A ScrapeSchedule is a cron row that *triggers* the publishing of ScrapeJobs on a schedule. The schedule lives in the DB (`server/src/db/schedule-queries.ts`); the job is the consequence.

**Anchors:**
- Producer: `server/src/services/redis-client.ts:9-50`
- Consumer: `scraper/src/redis/client.ts:21-50`, `:77-137`
- Job routing: `scraper/src/index.ts` (the four `RUN_MODE` call sites)

### ProgressEvent

The discriminated-union stream of status updates the scraper publishes to Redis `scrape:progress`, the server subscribes to, and forwards to the SPA via SSE.

```ts
// scraper/src/types/scraper.ts:98-111
type ProgressEvent =
  | { type: 'started'; total_theaters: number; total_dates: number }
  | { type: 'theater_started'; theater_name: string; theater_id: string; index: number }
  | { type: 'date_started'; date: string; theater_name: string }
  | { type: 'date_stale'; date: string; theater_name: string; actual_date: string }
  | { type: 'date_failed'; date: string; theater_name: string; error: string }
  | { type: 'movie_started'; movie_title: string; movie_id: number }
  | { type: 'movie_completed'; movie_title: string; showtimes_count: number }
  | { type: 'movie_failed'; movie_title: string; error: string }
  | { type: 'date_completed'; date: string; movies_count: number }
  | { type: 'theater_completed'; theater_name: string; total_movies: number }
  | { type: 'theater_failed'; theater_name: string; error: string }
  | { type: 'completed'; summary: ScrapeSummary }
  | { type: 'failed'; error: string };
```

The producer is the scraper orchestrator (`scraper/src/scraper/index.ts` — every `progress?.emit(...)` call site). The consumer is `server/src/services/redis-client.ts:95-107`, which fans events out to the `ProgressTracker` SSE singleton (`server/src/services/progress-tracker.ts:39-135`). The SPA connects to `/api/scraper/progress` and receives these events as `data: {json}\n\n` SSE frames.

**Drift hazard:** like `ScrapeJob` and `ScrapeSummary`, `ProgressEvent` is duplicated on producer and consumer sides (`scraper/src/types/scraper.ts:98-111` vs `server/src/services/progress-tracker.ts:4-17`). Same mitigation — when `packages/scraper-protocol` lands, the canonical lives there. The duplicated copies have not yet drifted in field shape, but the file count is two and the drift hazard is the same.

**Anchors:**
- Producer: `scraper/src/types/scraper.ts:98-111`, emitted from `scraper/src/scraper/index.ts`
- Consumer: `server/src/services/redis-client.ts:95-107`, fanned out via `server/src/services/progress-tracker.ts`
- Wire: Redis channel `scrape:progress`

### ScheduleChangeEvent

The discriminated-union payload the server publishes onto Redis `scraper:schedule:changed` when an admin creates, updates, or deletes a ScrapeSchedule, so the scraper microservice can refresh its in-memory schedule list.

```ts
// server/src/services/redis-client.ts:15-25
interface ScheduleChangeEvent {
  action: 'created' | 'updated' | 'deleted';
  scheduleId: number;
  schedule?: {
    id: number;
    name: string;
    cron_expression: string;
    enabled: boolean;
    target_theaters?: string[] | null;
  };
}
```

The `action` field is the discriminant; the `schedule` payload is included on `created` and `updated` so the scraper can update its in-memory copy without an extra DB roundtrip. On `deleted`, only `scheduleId` is needed.

**Anchors:**
- Producer: `server/src/services/redis-client.ts:15-25`, published via `publishScheduleChange` at `:115`
- Consumer: `scraper/src/redis/client.ts:143-169` (`RedisScheduleSubscriber`)

### RateLimitConfig

The set of buckets the API applies to incoming requests — general, auth, register, protected, scraper, public, health. Each bucket is `(windowMs, max)`; the rest of the fields are per-bucket overrides.

```ts
// server/src/config/rate-limits.ts:10-21
interface RateLimitConfig {
  windowMs: number;
  generalMax: number;
  authMax: number;
  registerMax: number;
  registerWindowMs: number;
  protectedMax: number;
  scraperMax: number;
  publicMax: number;
  healthMax: number;
  healthWindowMs: number;
}
```

The **flat shape above is the canonical** — this is what the middleware consumes on every request (`server/src/middleware/rate-limit.ts:7-10` `MutableConfig`, applied via `createRefreshableLimiter` at `:87-107`).

**Audit wrapper (not the canonical):** `server/src/db/rate-limit-queries.ts:28-45` declares a `RateLimitConfig` with the same fields wrapped under a `config` key, plus `source`, `updatedAt`, `updatedBy`, `environment` metadata. This is the shape the admin route returns for display and the audit log captures for history — *not* the shape the middleware reads.

**`source` discriminator is audit-only.** It records *where the active values came from* (`'database' | 'env' | 'default'`) and exists so the admin UI can show "currently using DB values" vs "no DB row, falling back to env". It must **not** leak onto the per-request hot path — the middleware reads only the flat fields. Putting `source` on the domain object is a known leak; the convergence to a single `RateLimitSource` module is tracked separately.

**Drift hazard:** two interfaces with the same name and different shapes. A `grep` for `RateLimitConfig` returns hits in both files; the "duplication is intentional" comments (`server/src/config/rate-limits.ts:3-9`, `server/src/db/rate-limit-queries.ts:20-27`) document the split. Listed in `.fallowrc.json` `ignoreExports` until the single-source refactor lands.

**Resolution order at boot / refresh:** the 60s `rate-limit-refresher` polls the DB (`getRateLimitConfig` at `server/src/config/rate-limits.ts:48-115`); on DB miss it falls back to `process.env.RATE_LIMIT_*` (parsed twice today — once at module load in the middleware, once here). The DB value wins.

**Anchors:**
- Canonical flat type: `server/src/config/rate-limits.ts:10-21`
- Audit wrapper: `server/src/db/rate-limit-queries.ts:28-45`
- Middleware consumer: `server/src/middleware/rate-limit.ts:7-10`, `:87-107`
- Boot / refresh: `server/src/services/rate-limit-refresher.ts:6-31`
- Admin CRUD: `server/src/routes/admin/rate-limits.ts`
