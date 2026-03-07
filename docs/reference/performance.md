# Performance Optimization

Technical reference for performance optimization techniques, caching strategies, and performance monitoring in Allo-Scrapper.

**Last updated:** March 7, 2026

**Related Documentation:**
- [Configuration Guide](../getting-started/configuration.md) - Environment variables
- [System Design](./architecture/system-design.md) - Architecture overview
- [Monitoring Guide](../guides/deployment/monitoring.md) - Observability stack

---

## Table of Contents

- [Overview](#overview)
- [JSON Parse Caching](#json-parse-caching)
- [Database Query Optimization](#database-query-optimization)
- [Performance Monitoring](#performance-monitoring)
- [Tuning Guidelines](#tuning-guidelines)
- [Troubleshooting Performance Issues](#troubleshooting-performance-issues)

---

## Overview

Allo-Scrapper implements several performance optimizations to handle high-volume database queries and API requests efficiently. The primary optimization is **JSON parse caching**, which eliminates redundant JSON parsing for frequently repeated data.

### Key Performance Characteristics

- **API Response Time**: <100ms for typical queries (p95)
- **Database Query Volume**: 100-500 queries/second under load
- **JSON Parse Cache Hit Rate**: 95-99% in production
- **Memory Footprint**: ~50-100 MB baseline + cache overhead (1-20 MB)

---

## JSON Parse Caching

### Problem Statement

Database queries like `getWeeklyFilms()` return hundreds of rows where JSON-encoded fields are frequently duplicated:

- **Genres**: `'["Action","Thriller"]'` repeated across many action films
- **Actors**: `'[]'` (empty array) appears in multiple columns (`testExperiences`, `testActors`)
- **Experiences**: `'["IMAX","3D"]'` repeated for all IMAX films

Without caching, every row triggers a separate `JSON.parse()` call, even for identical strings.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Query                           │
│  getWeeklyFilms() → 500 rows × 4 JSON fields = 2000 parses │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
            ┌────────────────────────┐
            │  parseJSONMemoized()   │
            │  Check cache first     │
            └───────┬────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ↓ Cache Hit (99%)     ↓ Cache Miss (1%)
    Return cached          JSON.parse()
    deep clone             Store in cache
                          Return deep clone
```

### Implementation Details

**File**: `server/src/utils/json-parse-cache.ts`

**Key Features**:
1. **LRU Eviction**: Gradual turnover, no cache cliffs
2. **Deep Cloning**: Uses `structuredClone()` to prevent shared mutable state
3. **Configurable Size**: Environment variable `JSON_PARSE_CACHE_SIZE`
4. **Metrics Tracking**: Cache hits, misses, hit rate

### Usage

```typescript
import { parseJSONMemoized } from './utils/json-parse-cache.js';

// In database queries
const films = rows.map(row => ({
  id: row.id,
  title: row.title,
  genres: parseJSONMemoized(row.genres),        // Cached
  actors: parseJSONMemoized(row.actors),        // Cached
  experiences: parseJSONMemoized(row.experiences) // Cached
}));
```

### Performance Benchmarks

**Test Configuration**:
- 150,000 JSON.parse operations
- 16 unique JSON strings (realistic cinema data)
- Node.js 20.x on Apple M1

**Results**:
```
Metric                  Value
─────────────────────────────────────
Total parses            150,000
Unique strings          16
Cache hits              149,984 (99.9%)
Cache misses            16 (0.01%)
Throughput              ~2.4M parses/sec
Time saved              ~750ms
Memory overhead         ~1-2 MB
```

**Interpretation**:
- **99.9% hit rate**: Nearly all parses are cache hits
- **750ms saved**: Cumulative time saved across 150k operations
- **Minimal overhead**: <2 MB memory for 10,000 cache entries

### Configuration

Set cache size via environment variable:

```bash
# .env
JSON_PARSE_CACHE_SIZE=10000  # Default
```

**Sizing Guidelines**:

| Deployment Size | Recommended Size | Memory Impact |
|-----------------|------------------|---------------|
| Small (1-10 cinemas, <100 films) | 5,000 | ~0.5-1 MB |
| Medium (10-50 cinemas, 100-500 films) | 10,000 (default) | ~1-2 MB |
| Large (50+ cinemas, 500+ films) | 50,000 | ~5-10 MB |
| Very Large (100+ cinemas, 1000+ films) | 100,000 | ~10-20 MB |

**Memory Calculation**:
```
Typical JSON string: ~100 bytes (e.g., '["IMAX","3D"]')
Cache overhead: ~100 bytes per entry (LRU metadata)
Total per entry: ~200 bytes

10,000 entries × 200 bytes = 2 MB
50,000 entries × 200 bytes = 10 MB
```

### Monitoring Cache Effectiveness

```typescript
import { getJSONParseCacheStats } from './utils/json-parse-cache.js';

// Get current statistics
const stats = getJSONParseCacheStats();

console.log({
  size: stats.size,           // Current entries in cache
  maxSize: stats.maxSize,     // Max cache size
  hits: stats.hits,           // Total cache hits
  misses: stats.misses,       // Total cache misses
  hitRate: stats.hitRate      // Hit rate (0.0-1.0)
});

// Example output:
// {
//   size: 8432,
//   maxSize: 10000,
//   hits: 1498420,
//   misses: 8432,
//   hitRate: 0.9944
// }
```

**Recommended Actions**:

| Hit Rate | Action |
|----------|--------|
| >95% | Cache is working optimally |
| 85-95% | Monitor; consider increasing cache size |
| 70-85% | Increase `JSON_PARSE_CACHE_SIZE` by 2x |
| <70% | Data has high cardinality; caching may not help |

---

## Database Query Optimization

### Connection Pooling

Allo-Scrapper uses `pg` connection pooling to manage concurrent database connections efficiently.

**Configuration** (`server/src/db/index.ts`):
```typescript
const pool = new Pool({
  max: 20,              // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### Query Patterns

**Efficient Patterns**:
```sql
-- Good: Fetch only needed columns
SELECT id, title, genres, actors FROM films WHERE active = true;

-- Good: Use indexes
SELECT * FROM showtimes WHERE cinema_id = $1 AND date = $2;
-- Requires index on (cinema_id, date)
```

**Inefficient Patterns**:
```sql
-- Bad: SELECT * with large JSON columns
SELECT * FROM films;  -- Fetches unnecessary data

-- Bad: Missing WHERE clause on large tables
SELECT * FROM showtimes;  -- Full table scan
```

### Indexing Strategy

**Key Indexes** (see `migrations/001_initial_schema.sql`):
```sql
-- Cinemas
CREATE INDEX idx_cinemas_active ON cinemas(active);

-- Films
CREATE INDEX idx_films_allocine_id ON films(allocine_id);
CREATE INDEX idx_films_active ON films(active);

-- Showtimes
CREATE INDEX idx_showtimes_cinema_id ON showtimes(cinema_id);
CREATE INDEX idx_showtimes_film_id ON showtimes(film_id);
CREATE INDEX idx_showtimes_date ON showtimes(date);
CREATE INDEX idx_showtimes_date_cinema ON showtimes(date, cinema_id);
```

---

## Performance Monitoring

### Application Metrics

**Prometheus Metrics** (scraper microservice only):
- `scraper_cinema_scrape_duration_seconds` - Scrape duration per cinema
- `scraper_films_scraped_total` - Total films scraped
- `scraper_errors_total` - Total scrape errors

**Access**: `http://localhost:9091/metrics` (scraper container)

### Logging Performance Data

```typescript
import { logger } from './utils/logger.js';

// Log slow queries
const start = Date.now();
const results = await pool.query(query, params);
const duration = Date.now() - start;

if (duration > 100) {
  logger.warn('Slow query detected', { query, duration, rowCount: results.rowCount });
}
```

### Distributed Tracing

**OpenTelemetry** (optional, requires monitoring profile):
```bash
# Enable tracing
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317

# Start with monitoring
docker compose --profile monitoring up -d

# View traces in Grafana
open http://localhost:3001
# Explore → Tempo → Search traces
```

---

## Tuning Guidelines

### 1. Increase JSON Parse Cache

**Symptom**: Low cache hit rate (<90%) in logs

**Solution**:
```bash
# .env
JSON_PARSE_CACHE_SIZE=50000  # Increase from default 10000
```

**Verify**:
```typescript
const stats = getJSONParseCacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
// Expected: >95%
```

### 2. Optimize Database Queries

**Symptom**: Slow API responses (>200ms p95)

**Solution**:
1. Add missing indexes
2. Reduce `SELECT *` queries
3. Use query batching

**Example**:
```typescript
// Before: N+1 query problem
for (const cinema of cinemas) {
  const showtimes = await getShowtimesByCinema(cinema.id);
}

// After: Single batch query
const cinemaIds = cinemas.map(c => c.id);
const showtimes = await getShowtimesByIds(cinemaIds);
```

### 3. Adjust Connection Pool Size

**Symptom**: Connection timeout errors

**Solution**:
```typescript
// server/src/db/index.ts
const pool = new Pool({
  max: 50,  // Increase from default 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
```

**Trade-offs**:
- More connections = higher memory usage
- Too few connections = request queuing

**Formula**: `max connections ≈ (core count × 2) + effective_spindle_count`

### 4. Enable Response Compression

**Symptom**: Large response payloads (>100 KB)

**Solution**: Already enabled in `server/src/index.ts`:
```typescript
import compression from 'compression';
app.use(compression());
```

**Verification**:
```bash
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/films -I
# Look for: Content-Encoding: gzip
```

---

## Troubleshooting Performance Issues

### Slow API Responses

**Diagnosis**:
```bash
# Check query logs
docker compose logs ics-web | grep "duration"

# Monitor database connections
docker compose exec ics-db psql -U postgres -d ics -c "SELECT count(*) FROM pg_stat_activity;"
```

**Common Causes**:
1. Missing database indexes
2. Large result sets (no pagination)
3. N+1 query problem
4. Slow external API calls (scraping)

**Solutions**:
- Add indexes for frequent WHERE/JOIN conditions
- Implement pagination (`LIMIT`/`OFFSET`)
- Batch queries to avoid N+1 pattern
- Cache external API responses

### High Memory Usage

**Diagnosis**:
```bash
# Check container memory
docker stats --no-stream ics-web

# Check Node.js heap
docker compose exec ics-web node -e "console.log(process.memoryUsage())"
```

**Common Causes**:
1. Large JSON parse cache
2. Connection pool leaks
3. Large in-memory result sets

**Solutions**:
```bash
# Reduce cache size
JSON_PARSE_CACHE_SIZE=5000

# Reduce connection pool
# server/src/db/index.ts: max: 10

# Stream large queries instead of loading all at once
const cursor = pool.query(new Cursor(query));
```

### Low Cache Hit Rate

**Diagnosis**:
```typescript
import { getJSONParseCacheStats } from './utils/json-parse-cache.js';

const stats = getJSONParseCacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Cache utilization: ${stats.size}/${stats.maxSize}`);
```

**Common Causes**:
1. Cache size too small
2. High data cardinality (many unique values)
3. Cache recently cleared/restarted

**Solutions**:
```bash
# Double cache size
JSON_PARSE_CACHE_SIZE=20000

# Wait for cache to warm up (15-30 minutes after restart)

# Check if caching is appropriate for your data
# If hit rate remains <70%, data may have too many unique values
```

### Database Connection Timeouts

**Error**: `TimeoutError: ResourceRequest timed out`

**Solutions**:
```typescript
// Increase timeout
const pool = new Pool({
  connectionTimeoutMillis: 5000,  // Increase from 2000
  max: 30  // Increase pool size
});
```

```bash
# Check PostgreSQL max_connections
docker compose exec ics-db psql -U postgres -c "SHOW max_connections;"

# Increase if needed (postgresql.conf or docker-compose.yml)
```

---

## Best Practices

### 1. Always Monitor Cache Effectiveness

```typescript
// Log cache stats periodically
setInterval(() => {
  const stats = getJSONParseCacheStats();
  logger.info('JSON parse cache stats', {
    hitRate: (stats.hitRate * 100).toFixed(1) + '%',
    size: stats.size,
    maxSize: stats.maxSize
  });
}, 60000); // Every minute
```

### 2. Use Pagination for Large Result Sets

```typescript
// Good: Paginated query
async function getFilmsPaginated(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    'SELECT * FROM films LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}
```

### 3. Profile Slow Endpoints

```typescript
import { performance } from 'perf_hooks';

app.get('/api/films', async (req, res) => {
  const start = performance.now();
  
  const films = await getFilms();
  
  const duration = performance.now() - start;
  logger.info('GET /api/films', { duration: `${duration.toFixed(2)}ms`, count: films.length });
  
  res.json(films);
});
```

### 4. Reset Cache in Tests

```typescript
import { resetJSONParseCache } from './utils/json-parse-cache.js';

beforeEach(() => {
  resetJSONParseCache();  // Ensure clean state
});
```

---

## Related Documentation

- [Configuration Guide](../getting-started/configuration.md) - `JSON_PARSE_CACHE_SIZE` and other env vars
- [System Design](./architecture/system-design.md) - Overall architecture
- [Monitoring Guide](../guides/deployment/monitoring.md) - Prometheus, Grafana, Tempo
- [Database Schema](./database/schema.md) - Table structure and indexes

---

[← Back to Reference](./README.md)
