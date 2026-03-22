# Scraper System Architecture

Detailed architecture and design of the cinema showtimes scraping system.

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

The scraper system fetches cinema showtimes from AlloCiné and stores them in PostgreSQL. It supports **two operational modes**:

1. **Legacy Mode (In-Process)**: Scraping runs inside the Express API server
2. **Microservice Mode (Redis Queue)**: Scraping runs in a standalone container

Both modes share the same core scraping logic but differ in orchestration and communication.

---

## Scraper Modes

### Mode Comparison

| Feature | Legacy (In-Process) | Microservice (Redis) |
|---------|---------------------|----------------------|
| **Deployment** | Single container | Two containers (API + scraper) |
| **Dependencies** | PostgreSQL only | PostgreSQL + Redis |
| **Scalability** | Limited (one process) | High (multiple workers) |
| **Fault Isolation** | Low (scraper crash = API crash) | High (independent processes) |
| **Progress Tracking** | Direct SSE events | Via Redis pub/sub |
| **Best For** | Development, small deployments | Production, high traffic |
| **Configuration** | `USE_REDIS_SCRAPER=false` | `USE_REDIS_SCRAPER=true` |

---

### Mode Selection

**Use Legacy Mode when:**
- Running locally for development
- Managing < 10 cinemas
- Simplicity is prioritized over scalability
- Redis is not available

**Use Microservice Mode when:**
- Running in production with multiple cinemas
- Need horizontal scalability (multiple scraper workers)
- Want fault isolation (scraper failures don't affect API)
- Already using Redis for other purposes

---

## Architecture Components

### 1. Scraper Orchestrator

**File**: `scraper/src/scraper/index.ts`

**Responsibilities**:
- Load cinema configurations from database
- Identify the correct **Scraper Strategy** based on the cinema's source (e.g., "allocine")
- Iterate through cinemas and dates, delegating to strategies
- Coordinate progress reporting via Redis
- Handle errors and generate scrape summary

**Key Functions**:
```typescript
// Main entry point
export async function runScraper(
  progress: ProgressPublisher,
  options: ScrapeOptions
): Promise<ScrapeSummary>

// Add a new cinema by URL
export async function addCinemaAndScrape(
  db: DB,
  url: string,
  progress?: ProgressPublisher
): Promise<Cinema>
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
  extractCinemaId(url: string): string | null;
  cleanCinemaUrl(url: string): string;
  loadTheaterMetadata(db: DB, cinema: CinemaConfig): Promise<{ availableDates: string[]; cinema: Cinema }>;
  scrapeTheater(db: DB, cinema: CinemaConfig, date: string, movieDelayMs: number, progress?: ProgressPublisher): Promise<{ filmsCount: number; showtimesCount: number }>;
}
```

**Available Strategies**:
- `AllocineScraperStrategy`: The default strategy for AlloCiné (encapsulates existing v2.x logic).

**Strategy Selection**:
- **By URL**: When adding a new cinema, `StrategyFactory.getStrategyByUrl(url)` finds the matching strategy.
- **By Source**: During a full scrape, `StrategyFactory.getStrategyBySource(cinema.source)` retrieves the strategy stored in the database.

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
  cinemaId: string,
  date: string
): Promise<ShowtimesApiResponse>

// Fetch film details page
export async function fetchFilmPage(
  filmId: string
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

**Purpose**: Extract cinema metadata from the main theater page

**Input**: HTML from `https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html`

**Output**:
```typescript
{
  cinema: {
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

**Input**: JSON from `https://www.allocine.fr/_/showtimes?d=<date>&t=<cinemaId>`

**Output**:
```typescript
Array<{
  film: Film;
  showtimes: Showtime[];
}>
```

**Parsing Method**: Direct JSON parsing (no HTML involved)

**This is the primary data source** for showtimes (fast, reliable, JSON-based).

---

#### C. Film Page Parser

**File**: `server/src/services/scraper/film-parser.ts`

**Purpose**: Extract film metadata (duration, director, synopsis)

**Input**: HTML from `https://www.allocine.fr/film/fichefilm_gen_cfilm=<id>.html`

**Output**:
```typescript
{
  duration_minutes: number | null;
  director: string | null;
  synopsis: string | null;
}
```

**Parsing Method**: Cheerio

**Usage**: Only fetched if film doesn't exist in DB or lacks duration

---

### 4. Database Queries

**File**: `server/src/db/queries.ts` (legacy) or `scraper/src/db/queries.ts` (microservice)

**Key Operations**:
```typescript
// Upsert cinema (INSERT or UPDATE)
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void>

// Upsert film
export async function upsertFilm(db: DB, film: Film): Promise<void>

// Upsert showtimes (batch insert)
export async function upsertShowtimes(db: DB, showtimes: Showtime[]): Promise<number>

// Get existing film (to check if details already scraped)
export async function getFilm(db: DB, filmId: string): Promise<Film | null>

// Get cinema configurations (enabled cinemas only)
export async function getCinemaConfigs(db: DB): Promise<CinemaConfig[]>
```

**Upsert Strategy**:
- Uses PostgreSQL `ON CONFLICT` clause
- Updates only if data changed
- Prevents duplicate entries

---

### 5. Progress Tracker

**File**: `server/src/services/progress-tracker.ts`

**Purpose**: Stream real-time progress updates to frontend

**Two Implementations**:

#### A. Direct SSE (Legacy Mode)
```typescript
export class DirectProgressTracker implements ProgressTracker {
  emit(event: ProgressEvent): void {
    // Send directly to SSE connection
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
```

#### B. Redis Publisher (Microservice Mode)
```typescript
export class RedisProgressPublisher implements ProgressTracker {
  emit(event: ProgressEvent): void {
    // Publish to Redis channel
    await redis.publish('scrape:progress', JSON.stringify(event));
  }
}
```

**Event Types**:
```typescript
type ProgressEvent =
  | { type: 'cinema_started'; cinema_name: string; cinema_id: string }
  | { type: 'date_started'; date: string; cinema_name: string }
  | { type: 'film_started'; film_title: string; film_id: string }
  | { type: 'showtimes_saved'; count: number }
  | { type: 'cinema_completed'; cinema_name: string; success: boolean }
  | { type: 'scrape_completed'; summary: ScrapeSummary }
  | { type: 'error'; message: string; cinema_name?: string };
```

---

### 6. Redis Job Queue (Microservice Mode Only)

**Files**:
- `server/src/services/redis-client.ts` - Job publisher (API server)
- `scraper/src/redis/client.ts` - Job consumer (scraper microservice)

**Job Structure**:
```typescript
interface ScrapeJob {
  reportId: string;           // Database scrape_sessions.id
  triggerType: 'manual' | 'cron' | 'api';
  options: {
    cinemaIds?: string[];     // Optional: specific cinemas
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

### Legacy Mode (In-Process)

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
│  2. Start scraper in-process     │
│  3. Open SSE connection          │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  Scraper Orchestrator             │
│  server/src/services/scraper/     │
│                                   │
│  For each cinema:                 │
│    - Fetch theater page (HTML)    │
│    - Parse cinema metadata        │
│    - For each date:               │
│      - Fetch showtimes JSON       │
│      - Parse showtimes            │
│      - For each film:             │
│        - Fetch film page (if new) │
│        - Parse film metadata      │
│        - Upsert to PostgreSQL     │
│      - Delay (rate limit)         │
│    - Emit progress events via SSE │
└───────┬───────────────────────────┘
        │
        ↓
┌───────────────────────────────────┐
│  PostgreSQL Database              │
│  - cinemas                        │
│  - films                          │
│  - showtimes                      │
│  - scrape_sessions                │
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
- Cinema metadata (name, address, coordinates) - from theater page
- Film metadata (duration, director, synopsis) - from film page
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

**Per-cinema errors don't stop the entire scrape**:

```typescript
for (const cinema of cinemas) {
  try {
    await scrapeCinema(cinema);
  } catch (error) {
    logger.error(`Cinema ${cinema.name} failed:`, error);
    summary.failed_cinemas++;
    // Continue to next cinema
  }
}
```

**Final status**:
- `success`: All cinemas succeeded
- `partial_success`: Some cinemas failed
- `failed`: All cinemas failed

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
# Delay between cinemas (after all dates scraped)
SCRAPE_THEATER_DELAY_MS=3000  # 3 seconds (recommended)

# Delay between film detail fetches
SCRAPE_MOVIE_DELAY_MS=500     # 0.5 seconds
```

**Why delays matter**:
- AlloCiné rate-limits aggressive scrapers (429 errors)
- Respectful scraping: avoid overloading their servers
- Recommended minimum: 3 seconds between cinemas

---

### Concurrency Model

**Current**: Sequential (one cinema at a time, one date at a time)

```typescript
for (const cinema of cinemas) {
  for (const date of dates) {
    await scrapeDate(cinema, date);
    await delay(SCRAPE_THEATER_DELAY_MS);
  }
}
```

**Future**: Parallel scraping (not yet implemented)
- Multiple cinemas in parallel
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
1. { type: 'cinema_started', cinema_name: 'UGC Montparnasse' }
2. { type: 'date_started', date: '2026-03-06', cinema_name: 'UGC Montparnasse' }
3. { type: 'film_started', film_title: 'Dune: Part Two' }
4. { type: 'showtimes_saved', count: 12 }
5. { type: 'cinema_completed', cinema_name: 'UGC Montparnasse', success: true }
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
