# Comprehensive Analysis — Scraper (allo-scrapper)

> Generated: 2026-05-21 | Cheerio + Puppeteer microservice analysis

## Design Patterns

### Strategy Pattern
The core scraping logic uses the **Strategy pattern**:
- `IScraperStrategy` interface defines the contract
- `AllocineScraperStrategy` is the current implementation
- `StrategyFactory` resolves the correct strategy by URL/source
- Adding a new theater source = implementing a new strategy

### Factory Pattern
`strategy-factory.ts` provides:
- `getStrategyByUrl(url)` — Resolves strategy from URL pattern
- `getStrategyBySource(source)` — Resolves strategy from source identifier

### Orchestrator Pattern
`scraper/index.ts` acts as the orchestrator:
1. Receives job (theater ID, scrape mode)
2. Fetches theater config from DB
3. Resolves strategy via factory
4. Executes scrape with progress reporting
5. Saves results to DB
6. Publishes completion to Redis

---

## Parsing Pipeline

```
Raw HTML (AlloCiné page)
  │
  ├─► theater-parser.ts
  │   Parse theater metadata (name, address, cinema info)
  │   Technology: Cheerio (static HTML)
  │
  ├─► movie-parser.ts
  │   Parse movie listings, schedules, showtimes
  │   Technology: Cheerio
  │
  └─► theater-json-parser.ts
      Fallback parser for JSON-LD structured data
      Technology: JSON parsing
```

### HTTP Client (`http-client.ts`)
- **Puppeteer** for JavaScript-rendered pages
- Browser instance pooling
- Configurable timeouts and delays
- User-agent rotation
- Cookie/session management

---

## Data Storage (Local DB)

The scraper maintains its own PostgreSQL connection for:
- Theater configurations
- Scrape attempt history
- Scraped movie/showtime data (before sync to server)
- Schedule configurations
- Reports

This local DB serves as a buffer/cache, decoupling the scraper from the server.

---

## Resilience Patterns

### Rate Limiting
- `RateLimitError` thrown when detected
- Exponential backoff with jitter
- Configurable max retries

### Graceful Degradation
- JSON-LD fallback when HTML parsing fails
- Partial data saved on partial failures
- Individual movie failures don't block the batch

### Connection Recovery
- Redis reconnection with backoff
- PostgreSQL connection pooling
- Browser crash recovery (Puppeteer)

---

## Performance

| Optimization | Implementation |
|-------------|---------------|
| Browser pooling | Puppeteer browser reuse |
| Concurrent scraping | Configurable parallelism |
| HTML caching | Raw HTML cached for retry |
| DB batching | Bulk inserts for showtimes |
| Delay tuning | Configurable inter-request delays |

---

## Security

| Concern | Mitigation |
|---------|-----------|
| HTML Injection | `html-decode.ts` for entity decoding |
| URL Validation | URL parsing before fetch |
| Rate Limiting | Respect robots.txt, configurable delays |
| Credential Storage | Environment variables only |

---

## Testing

| Type | Framework | Location |
|------|-----------|----------|
| Unit tests | Vitest | `scraper/src/**/*.test.ts` |
| Parser tests | Vitest + HTML fixtures | `scraper/tests/` |
| Integration tests | Vitest | `scraper/tests/` |

**Test Fixtures:** `scraper/tests/fixtures/` — Real HTML snapshots from AlloCiné for parser testing.

---

## Configuration

| Env Variable | Purpose |
|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `SCRAPE_INTERVAL` | Cron schedule (e.g., `0 6 * * *`) |
| `PUPPETEER_HEADLESS` | Headless mode toggle |
| `MAX_CONCURRENT_SCRAPES` | Parallelism limit |
| `REQUEST_DELAY_MS` | Inter-request delay |
| `NODE_ENV` | Environment |

---

## Dependencies (Key)

| Package | Version | Purpose |
|---------|---------|---------|
| cheerio | ^1.0 | HTML parsing |
| puppeteer | ^24 | Browser automation |
| bullmq | latest | Redis job queue |
| @opentelemetry/api | latest | Observability |
| node-cron | ^4 | Scheduling |
| drizzle-orm | latest | ORM |
| winston | latest | Logging |
