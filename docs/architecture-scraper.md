# Architecture — Scraper (Microservice)

## Executive Summary
Standalone **Node.js microservice** that consumes scrape jobs from Redis, parses Allociné theater pages, and writes movie/showtime data to PostgreSQL. Supports cron scheduling and OpenTelemetry observability.

## Technology Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | >=24.0.0 |
| Language | TypeScript | ~6.0.2 |
| HTML Parsing | Cheerio | 1.0 |
| Browser Automation | Puppeteer | 24.39.1 |
| Scheduling | node-cron | 4.2.1 |
| Database | pg | 8.20.0 |
| Queue | ioredis | 5.10.0 |
| Tracing | OpenTelemetry | 0.213.0 |
| Metrics | prom-client | 15.1.0 |
| Logging | Winston | 3.11.0 |
| HTML Entities | he | 1.2.0 |
| Testing | Vitest | 4.1.1 |

## Architecture Pattern
**Event-driven microservice** with Redis-backed job queue:
```
┌─────────┐     ┌──────────────┐     ┌────────────────┐
│  Redis  │────▶│ Job Consumer │────▶│ Scraper Engine │
│  Queue  │     │ (BLPOP)      │     │ (Strategy)     │
└─────────┘     └──────────────┘     └───────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                   ┌────────────┐    ┌────────────┐    ┌────────────┐
                   │  Theater   │    │  Theater   │    │   Movie    │
                   │  Parser    │    │  JSON      │    │   Parser   │
                   │ (Cheerio)  │    │  Parser    │    │ (Cheerio)  │
                   └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
                         │                 │                  │
                         └─────────┬───────┴──────────────────┘
                                   ▼
                          ┌────────────────┐
                          │  PostgreSQL 15 │
                          └────────────────┘
```

## Parser Strategy
### AllocineScraperStrategy (`IScraperStrategy`)
1. **Metadata phase**: Puppeteer loads theater page → Cheerio parses HTML → upsert theater
2. **Showtimes phase**: For each date in range, fetch JSON API → parse movies + showtimes → upsert
3. **Enrichment phase**: If movie lacks details → MovieParser fetches detail page
4. **Rate limit handling**: HTTP 429 → abort remaining theaters, mark as not_attempted

## Run Modes
| Mode | ENV | Behavior |
|------|-----|----------|
| `consumer` | RUN_MODE=consumer | Long-running BLPOP loop, processes jobs from Redis |
| `cron` | RUN_MODE=cron | Runs on schedule, BLPOP for manual triggers between ticks |
| `oneshot` | RUN_MODE=oneshot | LPOP single job, process, exit |

## Observability
- **Traces**: OpenTelemetry SDK → OTLP gRPC → Tempo (HTTP + pg instrumentation)
- **Metrics**: prom-client on port 9091 (scrape_jobs_total, scrape_duration_seconds, movies_scraped_total, showtimes_scraped_total, redis_queue_depth_total)
- **Logs**: Winston JSON → stdout → Loki (via Docker Promtail)
