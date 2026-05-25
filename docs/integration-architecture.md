# Integration Architecture — allo-scrapper

> Generated: 2026-05-21 | Multi-part monorepo integration analysis

## System Overview

Allo-scrapper is a **microservices architecture** with 4 parts communicating over HTTP and Redis.

```
┌──────────────┐     HTTP/REST      ┌──────────────┐
│   CLIENT     │ ──────────────────► │   SERVER     │
│  (React SPA) │ ◄────────────────── │ (Express API) │
│  Port: 5173  │     JSON API        │  Port: 3001  │
└──────────────┘                     └──────┬───────┘
                                            │
                                      Redis │ BullMQ
                                            │
                                     ┌──────▼───────┐
                                     │   SCRAPER    │
                                     │ (Microservice)│
                                     │  Port: 3002  │
                                     └──────────────┘
```

---

## Communication Channels

### Client ↔ Server (HTTP/REST)
| Direction | Protocol | Description |
|-----------|----------|-------------|
| Client → Server | HTTPS + JSON | API requests (CRUD, auth) |
| Server → Client | HTTPS + JSON | API responses, error payloads |
| Auth | JWT Bearer tokens | Access + refresh token flow |

**API Base URL:** `http://localhost:3001/api` (configured in `client/src/api/client.ts`)

### Server ↔ Scraper (Redis/BullMQ)
| Direction | Mechanism | Description |
|-----------|-----------|-------------|
| Server → Scraper | BullMQ Job | Scrape job (theater ID, mode) |
| Scraper → Server | BullMQ Event | Progress updates, completion |
| Scraper → Server | Redis Pub/Sub | Status notifications |

**Redis Keys:**
- `scrape-jobs` — Job queue
- `scrape-progress:*` — Progress tracking
- `scrape-results:*` — Result delivery

---

## Data Flow (Full Cycle)

```
1. Admin creates theater via Client → Server API
2. Server stores theater config → PostgreSQL
3. Server publishes ScrapeJob → Redis (BullMQ)
4. Scraper consumes job → fetches theater page (HTTP/Cheerio/Puppeteer)
5. Scraper parses HTML → extracts movies + showtimes
6. Scraper publishes results → Redis
7. Server consumes results → saves to PostgreSQL
8. Client queries API → displays showtimes to users
```

---

## Database Sharing

| Database | Used By | Purpose |
|----------|---------|---------|
| PostgreSQL (main) | Server | Primary data store |
| PostgreSQL (scraper) | Scraper | Scrape state, temp results |
| Redis | Server + Scraper | Job queue, cache, pub/sub |

---

## Docker Orchestration

```yaml
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
  
  redis:
    image: redis:7
    ports: ["6379:6379"]
  
  server:
    build: ./server
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
  
  scraper:
    build: ./scraper
    depends_on: [postgres, redis]
  
  client:
    build: ./client
    ports: ["5173:5173"]
    depends_on: [server]
```

**Orchestration file:** `docker-compose.yml` at project root.

---

## Shared Dependencies

| Package | Server | Scraper | Client |
|---------|--------|---------|--------|
| TypeScript 6.0 | ✓ | ✓ | ✓ |
| Drizzle ORM | ✓ | ✓ | — |
| Winston (logger) | ✓ | ✓ | — |
| Zod (validation) | ✓ | — | — |
| OpenTelemetry | — | ✓ | — |
| TanStack Query | — | — | ✓ |
| React 19 | — | — | ✓ |
