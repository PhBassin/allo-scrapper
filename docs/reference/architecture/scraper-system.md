# Scraper System Architecture

Detailed architecture and design of the theater showtimes scraping system.

**Last updated:** March 6, 2026

**Related Documentation:**
- [System Design](./system-design.md) - High-level architecture
- [Scraper Reference](../scraper.md) - Scraper configuration
- [Troubleshooting Scraper](../../troubleshooting/scraper.md) - Common issues

---

## Table of Contents

- [Overview](#overview)
- [Scraper Modes](#scraper-modes)
- [Architecture Components](#architecture-components)
- [Data Flow](#data-flow)
- [Parsing Strategy](#parsing-strategy)
- [Error Handling](#error-handling)
- [Concurrency and Rate Limiting](#concurrency-and-rate-limiting)
- [Progress Tracking](#progress-tracking)
- [Memory Management](#memory-management)

---

## Overview

The scraper system fetches theater showtimes from AlloCiné and stores them in PostgreSQL. All scrape jobs are dispatched via Redis pub/sub to the standalone scraper microservice, which is always included in `docker-compose.yaml`.

> **Historical note:** Prior to v4.x, the scraper supported an in-process mode (`USE_REDIS_SCRAPER=false`) where scraping ran inside the Express API server. This mode has been removed in favor of the microservice architecture.

---

## Scraper Architecture

The scraper runs as a Redis-backed microservice, always included in `docker-compose.yaml`. There is no in-process mode — all scrape jobs are dispatched via Redis pub/sub.

```
Express API (ics-web)
 └─> Redis Publisher (scrape:jobs)
      └─> Redis Consumer (ics-scraper)
           └─> PostgreSQL (direct insert)
           └─> Redis Publisher (progress events)
                └─> Express API (SSE streaming)
```

**Benefits of the microservice architecture:**
- Isolates scraping workload from API server
- Enables horizontal scaling (multiple scraper workers via `--scale ics-scraper=N`)
- Independent fault isolation (scraper failures don't affect API availability)
- Better observability (per-service metrics, distributed tracing)

---

## Architecture Components

### 1. Scraper Orchestrator

**File**: `scraper/src/scraper/index.ts`

**Responsibilities**:
- Load theater configurations from database
- Identify the correct **Scraper Strategy** based on the theater's source (e.g., "allocine")
- Iterate through theaters and dates, delegating to strategies
- Coordinate progress reporting via Redis
- Handle errors and generate scrape summary

**Key Functions**:
```typescript
// Main entry point
export async function runScraper(
  progress: ProgressPublisher,
  options: ScrapeOptions
): Promise<ScrapeSummary>

// Add a new theater by URL
export async function addTheaterAndScrape(
  db: DB,
  url: string,
  progress?: ProgressPublisher
): Promise<Theater>
```

---

### 2. Scraper Strategies (Strategy Pattern)

**Directory**: `scraper/src/scraper/strategies/`

To support multiple movie data sources (AlloCiné, UGC, Pathé, etc.), the scraper uses the **Strategy Pattern**. Each source has its own implementation of the `IScraperStrategy` interface.

**IScraperStrategy Interface**:
```typescript
export interface IScraperStrategy {
  readonly sourceName: string;
  canHandleUrl(url: string): boolean;
  extractTheaterId(url: string): string | null;
  cleanTheaterUrl(url: string): string;
  loadTheaterMetadata(db: DB, theater: TheaterConfig): Promise<{ availableDates: string[]; theater: Theater }>;
  scrapeTheater(db: DB, theater: TheaterConfig, date: string, movieDelayMs: number, progress?: ProgressPublisher): Promise<{ moviesCount: number; showtimesCount: number }>;
}
```

**Available Strategies**:
- `AllocineScraperStrategy`: The default strategy for AlloCiné (encapsulates existing v2.x logic).

**Strategy Selection**:
- **By URL**: When adding a new theater, `StrategyFactory.getStrategyByUrl(url)` finds the matching strategy.
- **By Source**: During a full scrape, `StrategyFactory.getStrategyBySource(theater.source)` retrieves the strategy stored in the database.

---

### 3. HTTP Client

**File**: `server/src/services/scraper/http-client.ts`

**Responsibilities**:
- Fetch HTML pages from AlloCiné
- Fetch JSON from AlloCiné internal API
- Retry on failures (3 attempts)
- Rate limiting between requests
- User-Agent rotation
- Browser automation (Puppeteer) for JS-heavy pages

**Key Functions**:
```typescript
// Fetch theater page (HTML)
export async function fetchTheaterPage(
  url: string
): Promise<{ html: string; availableDates: string[] }>

// Fetch showtimes JSON (internal API)
export async function fetchShowtimesJson(
  theaterId: string,
  date: string
): Promise<ShowtimesApiResponse>

// Fetch movie details page
export async function fetchMoviePage(
  movieId: string
): Promise<string>

// Delay helper
export async function delay(ms: number): Promise<void>
```

**Retry Logic**:
- 3 attempts per request
- Exponential backoff: 1s, 2s, 4s
- Handles 429 (rate limit), 500 (server error), network errors

---

### 3. HTML/JSON Parsers

The scraper uses **three different parsers** depending on the data source:

#### A. Theater Page Parser

**File**: `server/src/services/scraper/theater-parser.ts`

**Purpose**: Extract theater metadata from the main theater page

**Input**: HTML from `https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html`

**Output**:
```typescript
{
  theater: {
    id: string;
    name: string;
    city: string;
    address: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    screen_count: number | null;
  }
}
```

**Parsing Method**: Cheerio (jQuery-like selector API)

---

#### B. Showtimes JSON Parser

**File**: `server/src/services/scraper/theater-json-parser.ts`

**Purpose**: Extract showtimes from AlloCiné's internal API

**Input**: JSON from `https://www.allocine.fr/_/showtimes?d=<date>&t=<theaterId>`

**Output**:
```typescript
Array<{
  movie: Movie;
  showtimes: Showtime[];
}>
```

**Parsing Method**: Direct JSON parsing (no HTML involved)

**This is the primary data source** for showtimes (fast, reliable, JSON-based).

---

#### C. Movie Page Parser

**File**: `server/src/services/scraper/movie-parser.ts`

**Purpose**: Extract movie metadata (duration, director, synopsis)

**Input**: HTML from `https://www.allocine.fr/movie/fichemovie_gen_cmovie=<id>.html`

**Output**:
```typescript
{
  duration_minutes: number | null;
  director: string | null;
  synopsis: string | null;
}
```

**Parsing Method**: Cheerio

**Usage**: Only fetched if movie doesn't exist in DB or lacks duration

---

### 4. Database Queries

**File**: `server/src/db/queries.ts` (legacy) or `scraper/src/db/queries.ts` (microservice)

**Key Operations**:
```typescript
// Upsert theater (INSERT or UPDATE)
export async function upsertTheater(db: DB, theater: Theater): Promise<void>

// Upsert movie
export async function upsertMovie(db: DB, movie: Movie): Promise<void>

// Upsert showtimes (batch insert)
export async function upsertShowtimes(db: DB, showtimes: Showtime[]): Promise<number>

// Get existing movie (to check if details already scraped)
export async function getMovie(db: DB, movieId: string): Promise<Movie | null>

// Get theater configurations (enabled theaters only)
export async function getTheaterConfigs(db: DB): Promise<TheaterConfig[]>
```

**Upsert Strategy**:
- Uses PostgreSQL `ON CONFLICT` clause
- Updates only if data changed
- Prevents duplicate entries

---

### 5. Progress Tracker

**File**: `server/src/services/progress-tracker.ts`

**Purpose**: Stream real-time progress updates to frontend via Redis pub/sub.

Progress events are published to a Redis channel by the scraper microservice and consumed by the API server, which forwards them to the frontend via SSE.

**Event Types**:
```typescript
type ProgressEvent =
  | { type: 'theater_started'; theater_name: string; theater_id: string }
  | { type: 'date_started'; date: string; theater_name: string }
  | { type: 'movie_started'; movie_title: string; movie_id: string }
  | { type: 'showtimes_saved'; count: number }
  | { type: 'theater_completed'; theater_name: string; success: boolean }
  | { type: 'scrape_completed'; summary: ScrapeSummary }
  | { type: 'error'; message: string; theater_name?: string };
```

---

### 6. Redis Job Queue

**Files**:
- `server/src/services/redis-client.ts` - Job publisher (API server)
- `scraper/src/redis/client.ts` - Job consumer (scraper microservice)

**Job Structure**:
```typescript
interface ScrapeJob {
  reportId: string;           // Database scrape_sessions.id
  triggerType: 'manual' | 'cron' | 'api';
  options: {
    theaterIds?: string[];     // Optional: specific theaters
    startDate?: string;       // Optional: custom start date
    days?: number;            // Optional: days to scrape
    mode?: ScrapeMode;        // 'weekly' | 'from_today' | 'from_today_limited'
  };
}
```

**Queue Flow**:
```
API Server                    Redis                    Scraper
    │                          │                          │
    ├─ Publish job ────────────>│                          │
    │                          │                          │
    │                          │<────── Poll for jobs ────┤
    │                          │                          │
    │                          │──────── Job data ──────> │
    │                          │                          │
    │                          │<──── Progress events ────┤
    │<─── Subscribe ───────────│                          │
    │                          │                          │
    │<─── Progress events ──────                          │
    │                          │                          │
```

---

## Data Flow

All scrape jobs follow the same flow through Redis:

```
User (Browser)
    │
    ↓
POST /api/scraper/trigger
    │
    ↓
┌───────────────────────────────────┐
│  Express API Server               │
│                                   │
│  1. Create scrape report         │
│  2. Publish job to Redis queue   │
│  3. Subscribe to progress events │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  Redis (scrape:jobs queue)        │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  Scraper Microservice             │
│  (ics-scraper container)          │
│                                   │
│  For each theater:                 │
│    - Fetch theater page (HTML)    │
│    - Parse theater metadata        │
│    - For each date:               │
│      - Fetch showtimes JSON       │
│      - Parse showtimes            │
│      - For each movie:             │
│        - Fetch movie page (if new) │
│        - Parse movie metadata      │
│        - Upsert to PostgreSQL     │
│      - Delay (rate limit)         │
│    - Emit progress events via Redis│
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  PostgreSQL Database              │
│  - theaters                        │
│  - movies                          │
│  - showtimes                      │
│  - scrape_reports                 │
└───────────────────────────────────┘
```

---

### Microservice Mode (Redis Queue)

```
User (Browser)
    │
    ↓
POST /api/scraper/trigger
    │
    ↓
┌───────────────────────────────────┐
│  Express API Server               │
│                                   │
│  1. Create scrape_sessions record│
│  2. Publish job to Redis queue   │
│  3. Subscribe to progress channel│
│  4. Stream progress via SSE      │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  Redis                            │
│  - Job queue: 'scrape:jobs'      │
│  - Progress channel: 'scrape:progress' │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  Scraper Microservice             │
│  scraper/src/                     │
│                                   │
│  1. Poll Redis queue              │
│  2. Execute scraping logic        │
│  3. Publish progress to Redis     │
│  4. Write data to PostgreSQL      │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  PostgreSQL Database              │
└───────────────────────────────────┘
```

---

## Parsing Strategy

### Why JSON-First?

**Previous approach (v1.x)**: Parse HTML theater pages for showtimes
**Current approach (v2.x)**: Fetch JSON from AlloCiné internal API

**Benefits**:
- **Faster**: JSON parsing vs. HTML DOM traversal
- **More reliable**: JSON structure is stable, HTML changes frequently
- **Less bandwidth**: JSON is smaller than full HTML page
- **Easier to test**: JSON fixtures are simpler than HTML fixtures

**HTML still used for**:
- Theater metadata (name, address, coordinates) - from theater page
- Movie metadata (duration, director, synopsis) - from movie page
- Available dates list - from theater page

---

## Error Handling

### Retry Strategy

All HTTP requests use exponential backoff:

```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await sleep(delay);
    }
  }
}
```

---

### Error Isolation

**Per-theater errors don't stop the entire scrape**:

```typescript
for (const theater of theaters) {
  try {
    await scrapeTheater(theater);
  } catch (error) {
    logger.error(`Theater ${theater.name} failed:`, error);
    summary.failed_theaters++;
    // Continue to next theater
  }
}
```

**Final status**:
- `success`: All theaters succeeded
- `partial_success`: Some theaters failed
- `failed`: All theaters failed
- `rate_limited`: HTTP 429 detected, scrape stopped early (Phase 1)

---

### Rate Limit Handling (Phase 1 - Implemented)

**Detection**: The scraper detects HTTP 429 (Too Many Requests) responses from AlloCiné.

**Behavior when 429 is detected**:

1. **Immediate stop**: Both date loop and theater loop break immediately
2. **Status change**: Summary status set to `rate_limited` (not `failed`)
3. **Error classification**: Errors include `error_type: "http_429"` and `http_status_code: 429`
4. **Remaining theaters**: Marked as "not attempted" (not failed)
5. **Progress event**: `theater_failed` event emitted with error details

**Implementation**:

```typescript
// In scraper/src/scraper/index.ts
let rateLimited = false;

for (const theater of theaters) {
  if (rateLimited) break; // Stop outer loop if rate limited
  
  for (const date of dates) {
    try {
      await scrapeDate(theater, date);
    } catch (error) {
      if (error instanceof RateLimitError) {
        summary.status = 'rate_limited';
        rateLimited = true; // Signal to break outer loop
        break; // Break date loop
      }
      // Handle other errors...
    }
  }
}
```

**Error structure**:

```typescript
{
  theater_name: "Example Theater",
  theater_id: "C0123",
  date: "2026-03-24",
  error: "HTTP 429 Too Many Requests",
  error_type: "http_429",
  http_status_code: 429
}
```

**UI feedback**:
- Orange badge in admin reports list
- Explanation card in report detail view
- Suggests waiting before retry

**Phase 2 (Planned)**:
- Resume capability: Track per-theater attempts in database
- Automatic retry: Exponential backoff for rate-limited scrapes
- Smart scheduling: Avoid rate limits by adjusting scrape frequency

**See also:** [Rate Limiting Guide](../../guides/advanced/scraper-rate-limiting.md)

---

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `429 Too Many Requests` | Rate limiting | Increase `SCRAPE_THEATER_DELAY_MS` |
| `ECONNREFUSED` | AlloCiné down | Retry later |
| `Timeout` | Slow network | Increase timeout, check connection |
| `Parse error` | HTML structure changed | Update parser |
| `Database constraint violation` | Invalid data | Fix validation logic |

See [Troubleshooting Scraper](../../troubleshooting/scraper.md) for detailed solutions.

---

### Job Queue Failure Recovery (Microservice Mode)

**Scenario: Scraper crashes during job execution**

When a job is popped from the Redis queue and the scraper crashes before completion:

1. **Job is removed from queue** - Redis LPOP removes the job atomically
2. **No automatic retry** - The job is lost (by design for message queue simplicity)
3. **Report status remains `running`** - The database `scrape_sessions` record stays in `running` state
4. **Manual retry required** - Admin must trigger a new scrape via API or wait for next cron run

**Why this design:**

- **Simplicity**: No job persistence or distributed transactions
- **Idempotent operations**: Rescraping the same data produces identical results (upserts, not appends)
- **Cron jobs**: Scheduled scrapes provide automatic recovery (e.g., daily cron runs)
- **Manual triggering**: Users can manually re-trigger failed scrapes

**To prevent data loss:**

1. Use **cron-triggered scraping** for critical data sources (daily/weekly automated runs)
2. Monitor `scrape_sessions` table for `running` status that lasts > 1 hour
3. Use Prometheus alerts on scraper process restarts (check container logs)

**Consumer mode resilience** (`RUN_MODE: consumer`):

- Long-running scraper polls Redis continuously
- If the job fails (exception), the error is logged and reported to DB
- Consumer remains running and ready for the next job
- Graceful shutdown on SIGTERM/SIGINT

---

## Concurrency and Rate Limiting

### Rate Limiting

**Two delay settings**:

```bash
# Delay between theaters (after all dates scraped)
SCRAPE_THEATER_DELAY_MS=3000  # 3 seconds (recommended)

# Delay between movie detail fetches
SCRAPE_MOVIE_DELAY_MS=500     # 0.5 seconds
```

**Why delays matter**:
- AlloCiné rate-limits aggressive scrapers (429 errors)
- Respectful scraping: avoid overloading their servers
- Recommended minimum: 3 seconds between theaters

---

### Concurrency Model

**Current**: Sequential (one theater at a time, one date at a time)

```typescript
for (const theater of theaters) {
  for (const date of dates) {
    await scrapeDate(theater, date);
    await delay(SCRAPE_THEATER_DELAY_MS);
  }
}
```

**Future**: Parallel scraping (not yet implemented)
- Multiple theaters in parallel
- Shared rate limiter across workers
- Requires Redis-based coordination

---

## Progress Tracking

### SSE Event Stream

Frontend subscribes to scrape progress:

```typescript
// Client-side
const eventSource = new EventSource('/api/scraper/progress');
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(progress);
};
```

**Event sequence**:
```
1. { type: 'theater_started', theater_name: 'UGC Montparnasse' }
2. { type: 'date_started', date: '2026-03-06', theater_name: 'UGC Montparnasse' }
3. { type: 'movie_started', movie_title: 'Dune: Part Two' }
4. { type: 'showtimes_saved', count: 12 }
5. { type: 'theater_completed', theater_name: 'UGC Montparnasse', success: true }
6. { type: 'scrape_completed', summary: {...} }
```

---

## Memory Management

### Batch Processing

Showtimes are inserted in batches to avoid memory issues:

```typescript
// Insert 1000 showtimes at a time
const BATCH_SIZE = 1000;
for (let i = 0; i < showtimes.length; i += BATCH_SIZE) {
  const batch = showtimes.slice(i, i + BATCH_SIZE);
  await upsertShowtimes(db, batch);
}
```

---

### Browser Cleanup

Puppeteer browsers are closed after each scrape:

```typescript
try {
  await runScraper();
} finally {
  await closeBrowser(); // Always cleanup
}
```

---

## Related Documentation

- [System Design](./system-design.md) - Overall architecture
- [Scraper Configuration](../scraper.md) - Environment variables
- [Scraper Troubleshooting](../../troubleshooting/scraper.md) - Common issues
- [Database Schema](../database/schema.md) - Data model

---

[← Back to Architecture](./README.md)
