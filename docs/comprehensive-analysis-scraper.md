# Comprehensive Analysis — Scraper (Microservice)

## Architecture Pattern
**Standalone Node.js microservice** consuming jobs from Redis queue, with cron scheduling and OpenTelemetry observability.

## Parsers (3)

### TheaterParser (`src/scraper/theater-parser.ts`)
- **Engine**: Cheerio (HTML)
- **Source**: Allociné theater pages (e.g. `allocine.fr/seance/salle_gen_csalle=C0089.html`)
- **Extracts**: Theater metadata via `data-theater` JSON attribute, movie cards (`.movie-card-theater`), showtimes (`.showtimes-version` blocks with version/format/experiences)
- **Date handling**: French date parsing

### TheaterJsonParser (`src/scraper/theater-json-parser.ts`)
- **Engine**: JSON API
- **Source**: Allociné internal API (`/_/showtimes/theater-{id}/d-{date}/`)
- **Extracts**: Movie credits by position (director/réalisateur, writer/scénariste, actor/acteur), ratings, runtime, diffusion versions (ORIGINAL→VO, LOCAL/DUBBED→VF)

### MovieParser (`src/scraper/movie-parser.ts`)
- **Engine**: Cheerio + JSON-LD
- **Source**: Allociné movie detail pages
- **Extracts**: Duration, trailer URL, director/screenwriters (from JSON-LD and visual HTML)
- **Trigger**: Only when existing movie record is missing details

## Queue Infrastructure

```
┌──────────┐   LPUSH    ┌──────────────┐   BLPOP    ┌──────────┐
│  Server  │ ────────→ │ scrape:jobs   │ ←──────── │ Scraper  │
│  API     │            │  (Redis List)  │           │ Consumer │
└──────────┘            └──────────────┘           └──────────┘
                               ↑
                        ┌──────┴──────┐
                        │ scrape:progress │ ←── Pub/Sub (SSE)
                        └──────────────┘
                        ┌──────────────────┐
                        │ scraper:schedule: │ ←── Schedule changes
                        │    changed        │
                        └──────────────────┘
```

### Components
- **Producer** (`RedisProgressPublisher`): Server API LPUSHes jobs → `scrape:jobs`
- **Consumer** (`RedisJobConsumer`): BLPOP with 5s timeout; LPOP for oneshot mode
- **Subscriber** (`RedisScheduleSubscriber`): Dynamic schedule updates via Pub/Sub
- **Job Types**: Discriminated union — `ScrapeJobScrape` (type:'scrape') with triggerType/options, `ScrapeJobAddTheater` (type:'add_theater') with URL. Legacy jobs default to 'scrape'.

## Scrape Strategy
**AllocineScraperStrategy** implements `IScraperStrategy`:
1. `loadTheaterMetadata()`: Puppeteer → HTML → Cheerio → upsert theater
2. `scrapeTheater()`: Fetch JSON API → parse → upsert movies + showtimes + weekly programs
3. Optional: `MovieParser` for missing movie details
4. Rate limit detection (HTTP 429) → global abort with `not_attempted` markers

## Schedules
- **Storage**: `scrape_schedules` PostgreSQL table
- **Engine**: `node-cron` with validated cron expressions
- **Live updates**: Redis Pub/Sub (`scraper:schedule:changed`) — no restart needed
- **Modes**: `cron` (scheduled, BLPOP consumer), `oneshot` (single LPOP + exit)

## Endpoints
| Method | Path | Port | Description |
|--------|------|------|-------------|
| GET | `/metrics` | 9091 | Prometheus metrics |

## Telemetry & Observability
- **Traces**: OpenTelemetry SDK → OTLP gRPC → Tempo (HTTP + PostgreSQL instrumentation)
- **Logs**: Winston JSON format → stdout → Loki (via Promtail/Docker)
- **Metrics**: prom-client (`scrape_jobs_total`, `scrape_duration_seconds`, `movies_scraped_total`, `showtimes_scraped_total`, `redis_queue_depth_total` + Node.js defaults)

## Data Flow (End-to-End)
```
1. Server API receives trigger request
2. Server creates scrape_report (status: running)
3. Server LPUSHes ScrapeJob to scrape:jobs queue
4. Scraper BLPOPs job → executeJob() → runScraper()
5. Strategy loads theater metadata (Puppeteer)
6. For each date in range:
   a. Fetch showtimes JSON from Allociné API
   b. Parse movies + showtimes + weekly programs
   c. Upsert to PostgreSQL (movies, showtimes, weekly_programs)
   d. Track attempt in scrape_attempts
   e. PUBLISH progress to scrape:progress channel
7. Server SSE subscribers receive real-time progress
8. Finalize: update scrape_report status + stats
9. On rate limit (429): abort remaining theaters, mark as not_attempted
```
