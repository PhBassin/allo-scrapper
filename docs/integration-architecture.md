# Integration Architecture — allo-scrapper

## System Overview
```
┌──────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│  localhost:5173 (dev) / :3000 (prod, static serve)              │
└──────────┬──────────────────────────────┬───────────────────────┘
           │ REST + SSE                    │
           ▼                               ▼
┌──────────────────────┐        ┌─────────────────────────┐
│   CLIENT (React)     │        │   SERVER (Express API)  │
│   Port 5173 (Vite)   │──REST─▶│   Port 3000              │
│                      │        │                          │
│  - AuthContext        │        │  - JWT Auth              │
│  - React Query        │        │  - RBAC Permissions      │
│  - SettingsContext    │        │  - Rate Limiting         │
│  - SSE (progress)     │◀─SSE──│  - SSE (ProgressTracker) │
└──────────────────────┘        │  - Dynamic CSS (theme)    │
                                └──────┬──────┬────────────┘
                                       │      │
                              LPUSH    │      │  PUBLISH
                                       ▼      ▼
                                ┌─────────────────┐
                                │     REDIS 7     │
                                │                 │
                                │  scrape:jobs    │──BLPOP──▶
                                │  scrape:progress│◀─PUBLISH─
                                │  scraper:       │
                                │    schedule:    │
                                │      changed    │
                                └─────────────────┘
                                       │
                                       ▼
                                ┌─────────────────────────┐
                                │  SCRAPER (Microservice) │
                                │  Port 9091 (metrics)    │
                                │                         │
                                │  - TheaterParser        │
                                │  - TheaterJsonParser    │
                                │  - MovieParser          │
                                │  - AllocineStrategy     │
                                │  - Cron Scheduler       │
                                │  - OpenTelemetry        │
                                └───────────┬─────────────┘
                                            │
                                ┌───────────▼─────────────┐
                                │    PostgreSQL 15         │
                                │                          │
                                │  theaters, movies,       │
                                │  showtimes, scrape_*,    │
                                │  users, roles, settings  │
                                └──────────────────────────┘
```

## Integration Points

### Client → Server (REST)
| From | To | Protocol | Details |
|------|----|----------|---------|
| client (Axios) | server (Express) | HTTPS/REST | 47 endpoints via JWT Bearer auth |
| client (EventSource) | server (SSE) | SSE | `/api/scraper/progress` — real-time scrape events |

### Server → Scraper (Redis Queue)
| From | To | Protocol | Details |
|------|----|----------|---------|
| server (redis-client) | scraper (redis-consumer) | Redis List (LPUSH/BLPOP) | `scrape:jobs` — job dispatch |
| scraper (redis-publisher) | server (progress-tracker) | Redis Pub/Sub | `scrape:progress` — real-time events |

### Server → Scraper (Schedule Sync)
| From | To | Protocol | Details |
|------|----|----------|---------|
| server (redis-client) | scraper (redis-subscriber) | Redis Pub/Sub | `scraper:schedule:changed` — live schedule updates |

### Server → PostgreSQL
| From | To | Protocol | Details |
|------|----|----------|---------|
| server (pg) | PostgreSQL 15 | TCP/5432 | All CRUD operations, migrations |

### Scraper → PostgreSQL
| From | To | Protocol | Details |
|------|----|----------|---------|
| scraper (pg) | PostgreSQL 15 | TCP/5432 | Write operations (movies, showtimes, reports, attempts) |

### Scraper → Allociné (External)
| From | To | Protocol | Details |
|------|----|----------|---------|
| scraper (Cheerio) | allocine.fr | HTTPS | HTML theater pages |
| scraper (Fetch) | allocine.fr API | HTTPS | JSON showtimes API |
| scraper (Puppeteer) | allocine.fr | HTTPS | Headless browser for metadata |
| scraper (Cheerio) | allocine.fr | HTTPS | Movie detail pages (supplementary) |

### Observability
| Component | Destination | Protocol | Details |
|-----------|------------|----------|---------|
| scraper (OTLP) | Tempo | gRPC/4317 | Distributed traces |
| server (OTLP) | Tempo | gRPC/4317 | Distributed traces |
| scraper (Winston) | Loki | stdout→Promtail | Structured logs |
| server (Winston) | Loki | stdout→Promtail | Structured logs |
| server (prom-client) | Prometheus | HTTP/metrics | App metrics |
| scraper (prom-client) | Prometheus | HTTP/metrics | Scrape metrics |

## Data Flow: Scrape Job (End-to-End)
```
1. User clicks "Scrape" in Admin UI
2. Client POST /api/scraper/trigger → server
3. Server creates scrape_reports row (status: running)
4. Server LPUSHes ScrapeJob to scrape:jobs
5. Scraper BLPOPs job → executeJob()
6. For each theater:
   a. Puppeteer loads theater page → extract metadata
   b. Fetch JSON API for each date in range
   c. Parse movies, showtimes, weekly_programs
   d. Upsert to PostgreSQL
   e. Track attempt in scrape_attempts
   f. PUBLISH ProgressEvent to scrape:progress
7. Server's ProgressTracker receives event → fans out to SSE subscribers
8. Client's useScrapeProgress hook updates UI in real-time
9. Scraper finalizes: updates scrape_reports (completed_at, stats)
10. Client receives "completed" event → refreshes data
```
