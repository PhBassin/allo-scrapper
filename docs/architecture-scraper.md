# Architecture — Scraper (allo-scrapper)

> Generated: 2026-05-21 | Cheerio 1.0 + Puppeteer 24 + BullMQ + OpenTelemetry

## Overview

The scraper is an **event-driven microservice** that fetches movie showtime data from external theater websites. It communicates with the server via Redis (BullMQ) and uses the **Strategy pattern** for extensible parsing.

**Tech Stack:**
| Technology | Version | Purpose |
|-----------|---------|---------|
| Cheerio | 1.0 | Static HTML parsing |
| Puppeteer | 24 | Dynamic page rendering |
| BullMQ | latest | Redis-backed job queue |
| OpenTelemetry | latest | Metrics, tracing, observability |
| node-cron | 4 | Scheduled scraping |
| TypeScript | 6.0 | Type safety |
| Drizzle ORM | latest | Local DB for scrape state |

---

## Directory Structure

```
scraper/src/
├── index.ts                    # Entry point — bootstrap, Redis, cron, telemetry
├── db/                         # Local database access
│   ├── client.ts               # PostgreSQL connection
│   ├── theater-queries.ts      # Theater config queries
│   ├── movie-queries.ts
│   ├── showtime-queries.ts
│   ├── schedule-queries.ts
│   ├── scrape-attempt-queries.ts
│   └── report-queries.ts
├── redis/
│   └── client.ts               # Redis (BullMQ) publisher/consumer
├── scraper/                    # Core scraping logic
│   ├── index.ts                # Scraper orchestration
│   ├── http-client.ts          # Puppeteer/Cheerio HTTP client
│   ├── theater-parser.ts       # HTML theater page parser
│   ├── movie-parser.ts         # Movie showtime parser
│   ├── theater-json-parser.ts  # JSON-LD structured data parser
│   ├── strategy-factory.ts     # Parser strategy factory
│   ├── utils.ts                # Scraper utilities
│   └── strategies/
│       ├── IScraperStrategy.ts      # Strategy interface
│       └── AllocineScraperStrategy.ts # AlloCiné-specific strategy
├── types/
│   └── scraper.ts              # TypeScript types for scrape jobs
└── utils/
    ├── logger.ts               # Winston logger
    ├── date.ts                 # Date utilities (scrape windows)
    ├── errors.ts               # Custom error types
    ├── error-classifier.ts     # Error categorization
    ├── html-decode.ts          # HTML entity decoding
    ├── metrics.ts              # OpenTelemetry metrics
    └── tracer.ts               # OpenTelemetry distributed tracing
```

---

## Architecture: Strategy Pattern

The scraper uses the **Strategy pattern** for extensible theater parsing:

```
ScraperOrchestrator
  └─► StrategyFactory.getStrategy(url)
       └─► IScraperStrategy
            └─► AllocineScraperStrategy (implements IScraperStrategy)
```

### IScraperStrategy Interface
Defined in `scraper/src/scraper/strategies/IScraperStrategy.ts`:
- `scrapeTheater(url)` → Theater data
- `scrapeMovie(url)` → Movie data
- `scrapeShowtimes(url, date)` → Showtime data

### AllocineScraperStrategy
Concrete implementation for AlloCiné.fr:
- Handles AlloCiné-specific HTML structure
- Manages pagination and date navigation
- Rate limiting aware

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    SCRAPER MICROSERVICE                   │
│                                                          │
│  Cron Schedule / Redis Job                                │
│         │                                                │
│         ▼                                                │
│  ScraperOrchestrator (index.ts)                          │
│         │                                                │
│         ├─► StrategyFactory.getStrategy(url)             │
│         │       │                                        │
│         │       ▼                                        │
│         │   AllocineScraperStrategy                      │
│         │       │                                        │
│         │       ├─► http-client.ts (Puppeteer/Cheerio)   │
│         │       │       │                                │
│         │       │       ▼                                │
│         │       │   AlloCiné Website                      │
│         │       │                                        │
│         │       ├─► theater-parser.ts (HTML → data)      │
│         │       ├─► movie-parser.ts (HTML → data)        │
│         │       └─► theater-json-parser.ts (JSON-LD)     │
│         │                                                │
│         ├─► DB Queries (save scraped data)               │
│         └─► Redis (publish status updates)               │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │ Redis (BullMQ)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    SERVER (Express API)                    │
│  RedisConsumer → Process scrape results → PostgreSQL      │
└─────────────────────────────────────────────────────────┘
```

---

## Job Queue (Redis/BullMQ)

Communication between server and scraper uses **BullMQ** over Redis:

| Queue Element | Direction | Purpose |
|--------------|-----------|---------|
| `ScrapeJob` | Server → Scraper | Trigger a scrape |
| `ScrapeJobScrape` | Server → Scraper | Scrape specific theater |
| `ScrapeJobAddTheater` | Server → Scraper | Add + scrape new theater |
| Progress Events | Scraper → Server | Real-time status updates |
| Results | Scraper → Server | Scraped data delivery |

**Redis Client:** `scraper/src/redis/client.ts`
- Publisher: Send results/progress to server
- Consumer: Receive scrape jobs from server
- Subscriber: Listen for control commands

---

## Scheduling

The scraper supports two execution modes:

1. **Cron-based** — Scheduled via `node-cron` (e.g., daily at 6 AM)
2. **Event-driven** — Triggered by Redis jobs from server API

Schedules are configured in the database (`schedules` table) and managed via the server admin panel.

---

## Observability

### OpenTelemetry Integration
| Component | File | Purpose |
|-----------|------|---------|
| Metrics | `utils/metrics.ts` | Prometheus metrics (scrape count, duration, movies scraped) |
| Tracing | `utils/tracer.ts` | Distributed tracing across server ↔ scraper |

### Key Metrics
- `scrapeJobsTotal` — Total scrape jobs executed
- `scrapeDurationSeconds` — Scrape job duration histogram
- `moviesScrapedTotal` — Movies extracted
- `showtimesScrapedTotal` — Showtimes extracted

### Logging
- **Winston** structured logger (`utils/logger.ts`)
- JSON format for log aggregation
- Log levels: error, warn, info, debug

---

## Error Handling

| Error Type | Handling |
|-----------|----------|
| Rate Limit | Exponential backoff via `RateLimitError` |
| Network Error | Retry with backoff |
| Parse Error | Skip and log, continue with next |
| Timeout | Puppeteer page timeout, graceful degradation |
| Invalid HTML | Fallback to JSON-LD parser |

**Error Classifier:** `utils/error-classifier.ts` — categorizes errors for metrics and alerting.
