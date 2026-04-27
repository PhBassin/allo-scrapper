# 🎯 Scraper Troubleshooting

Scraping failures, parser errors, and debugging guide for Allo-Scrapper.

**Related Documentation:**
- [Scraper Configuration](../reference/scraper.md) - Scraper setup
- [API Reference](../reference/api/scraper.md) - Scraper API endpoints
- [Common Issues](./common-issues.md) - General troubleshooting

---

## Table of Contents

- [HTTP Errors](#http-errors)
- [Parser Failures](#parser-failures)
- [Input Validation Errors](#input-validation-errors)
- [Error Propagation](#error-propagation)
- [Progress Tracking](#progress-tracking)
- [Redis Queue Issues](#redis-queue-issues)
- [Browser Issues](#browser-issues)
- [Debugging](#debugging)
- [Common Error Messages](#common-error-messages)

---

## HTTP Errors

### Timeout Errors (60 seconds)

**Error:**

```
TimeoutError: page.goto: Timeout 60000ms exceeded
```

**Cause:** AlloCiné page took longer than 60 seconds to load.

**Configuration:** Playwright timeout set to 60 seconds in `fetchTheaterPage()`.

**Solution:**

```bash
# Check network connectivity
docker compose exec ics-web ping www.allocine.fr

# Check if AlloCiné is accessible
curl -I https://www.allocine.fr/

# Retry scrape
curl -X POST http://localhost:3000/api/scraper/scrape \
  -H "Authorization: Bearer <token>"
```

**Note:** Timeout not configurable via environment variable.

---

### HTTP 403 Forbidden

**Error:**

```
Failed to fetch showtimes JSON for C0072 on 2026-03-05: 403 Forbidden
```

**Causes:**
1. AlloCiné blocking automated requests
2. Rate limiting (too many requests)
3. User-agent detection

**Solution:**

```bash
# Increase delays between requests
echo "SCRAPE_THEATER_DELAY_MS=5000" >> .env  # 5 seconds
echo "SCRAPE_MOVIE_DELAY_MS=1000" >> .env    # 1 second

# Restart scraper
docker compose restart ics-web

# Monitor logs for rate limiting
docker compose logs -f ics-web | grep "Failed to fetch"
```

**⚠️ Graceful Shutdown on 429/403** - If rate limiting is detected, the scraper will immediately abort all in-flight and pending cinema tasks to avoid an IP ban.

---

### HTTP 404 Not Found

**Error:**

```
Failed to fetch showtimes JSON for C0072 on 2026-03-05: 404 Not Found
```

**Causes:**
1. Cinema ID invalid or removed from AlloCiné
2. Date out of range (AlloCiné only shows ~2 weeks ahead)
3. URL structure changed

**Solution:**

```bash
# Verify cinema exists on AlloCiné
curl https://www.allocine.fr/seance/salle_gen_csalle=C0072.html

# Check cinema in database
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT cinema_id, name, url FROM cinemas WHERE cinema_id='C0072';"

# Remove invalid cinema
curl -X DELETE http://localhost:3000/api/cinemas/C0072 \
  -H "Authorization: Bearer <token>"
```

---

### HTTP 429 Too Many Requests

**Behavior (Phase 1 - Implemented):**
- Scraper **detects HTTP 429** automatically
- Scrape **stops immediately** to avoid further rate limiting
- Report status set to `rate_limited` (not `failed`)
- Remaining cinemas marked as "not attempted"

**What happens when 429 is detected:**

1. **Immediate shutdown**: Scraper stops the current and all remaining cinemas
2. **Report marked**: Status changed from `running` → `rate_limited`
3. **Error details**: Error includes `error_type: "http_429"` and `http_status_code: 429`
4. **UI feedback**: Orange badge in admin panel with explanation

**If you see rate_limited status in reports:**

```bash
# Wait before retrying (recommended: 10-30 minutes)
# Check when last scrape ran
curl http://localhost:3000/api/reports?page=1 \
  -H "Authorization: Bearer <token>"

# Increase delays permanently to avoid future 429s
echo "SCRAPE_THEATER_DELAY_MS=10000" >> .env  # 10 seconds
echo "SCRAPE_MOVIE_DELAY_MS=2000" >> .env     # 2 seconds

# Restart server
docker compose restart ics-web

# Retry scrape after cooldown period
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer <token>"
```

**Phase 2 (Planned - Not Yet Implemented):**
- Resume capability: Will scrape only cinemas that were not attempted
- Exponential backoff: Automatic retry with increasing delays
- Per-cinema tracking: Database records which cinemas were attempted

**See also:** [Rate Limiting Guide](../guides/advanced/scraper-rate-limiting.md)

---

## Parser Failures

### HTML Structure Changes

**Error:**

```
Could not parse theater data JSON
Could not parse showtimes dates
```

**Cause:** AlloCiné changed HTML structure, breaking parser.

**Diagnosis:**

```bash
# Download current HTML to check structure
curl "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html" > cinema-page.html

# Check for data-theater attribute
grep 'data-theater' cinema-page.html

# Check for data-showtimes-dates attribute  
grep 'data-showtimes-dates' cinema-page.html
```

**Solution:** Parser update required in `server/src/services/scraper/theater-parser.ts`.

---

### Film ID Extraction Failure

**Warning:**

```
Could not extract film ID from: /film/fichefilm-XXXXX.html
```

**Cause:** Film link format changed on AlloCiné.

**Current expected format:**

```
/film/fichefilm_gen_cfilm=12345.html
```

**Diagnosis:**

```bash
# Check film links in downloaded HTML
grep -o 'href="/film/[^"]*"' cinema-page.html | head -10
```

**Impact:**
- Film skipped (not inserted into database)
- Logged as warning
- Scraper continues to next film

---

### Showtimes API Error Response

**Warning:**

```
Showtimes API returned error for C0072 on 2026-03-05
```

**Cause:** AlloCiné internal API returned `{"error": true}`.

**Possible reasons:**
1. Cinema closed on that date
2. No showtimes available
3. Invalid date
4. API temporarily unavailable

**Behavior:**
- Returns empty array (no showtimes inserted)
- Logs warning
- Continues to next date

---

### Invalid Runtime/Rating Values

**Warning:**

```
Invalid runtime value detected: NaN
Invalid rating value detected: Infinity
Rating out of range (0-5): 6.7
```

**Cause:** AlloCiné returned non-numeric or out-of-range values.

**Behavior:**
- Sets field to `undefined` (becomes `NULL` in database)
- Logs warning
- Film still inserted without that field

**Check affected films:**

```bash
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT title, duration_minutes, press_rating, audience_rating 
   FROM films 
   WHERE duration_minutes IS NULL 
      OR press_rating IS NULL 
      OR audience_rating IS NULL 
   LIMIT 10;"
```

---

## Input Validation Errors

### Invalid Cinema ID Format

**Error:**

```
Invalid cinema ID format: C12345
```

**Valid formats:**
- `C` + 4-5 digits (e.g., `C0072`, `C12345`)
- `W` + 4-5 digits (e.g., `W7517`)
- `P` + 4-5 digits (e.g., `P1234`)

**Regex:** `/^[A-Z]\d{4,5}$/`

**Solution:**

```bash
# Extract cinema ID from AlloCiné URL manually
# https://www.allocine.fr/seance/salle_gen_csalle=C0072.html
#                                              ^^^^^^
# Cinema ID is C0072

# Or use API to add cinema by URL (auto-extracts ID)
curl -X POST http://localhost:3000/api/cinemas \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"}'
```

---

### Invalid Date Format

**Error:**

```
Invalid date format: 2026-3-5
Invalid date: 2026-02-30
```

**Required format:** `YYYY-MM-DD` (ISO 8601)

**Valid examples:**
- `2026-03-05` ✅
- `2026-12-31` ✅

**Invalid examples:**
- `2026-3-5` ❌ (month/day must be zero-padded)
- `2026-02-30` ❌ (invalid date)
- `05/03/2026` ❌ (wrong format)

---

### Invalid Film ID

**Error:**

```
Invalid film ID: -123
Invalid film ID: abc
```

**Valid:** Positive integer (e.g., `12345`, `294421`)

---

### SSRF Protection

**Error:**

```
SSRF guard: unexpected host in constructed URL https://evil.com/...
Invalid Allocine URL. Must be https://www.allocine.fr/...
```

**Cause:** Application only allows requests to `www.allocine.fr`.

**This is a security feature** - cannot be disabled.

---

## Error Propagation

### Error Handling Strategy

**Film-level error:**
```
Error processing film "Dune: Part Two": ...
```
- **Logged** + **emitted** as `film_failed` event
- **CONTINUES** to next film
- Cinema scrape NOT aborted

**Date-level error:**
```
Error scraping UGC Les Halles for 2026-03-05: ...
```
- **Logged** + **recorded** in summary
- **Emitted** as `date_failed` event
- **CONTINUES** to next date

**Cinema metadata error:**
```
Failed to load theater metadata for UGC Les Halles: ...
```
- **Logged** + **recorded** in summary
- **SKIPS entire cinema**
- Continues to next cinema

**System error:**
```
Fatal error: ...
```
- **Logged** + **recorded** in summary
- **ABORTS entire scrape**
- Browser closed, cleanup performed

---

### Partial Failure Behavior

**Scenario:** Scraping 3 cinemas, 7 days each.

**Example failure:**
- Cinema 1: 5 successful dates, 2 failed dates → **SUCCESS** (partial)
- Cinema 2: Metadata load failed → **SKIPPED** (entire cinema)
- Cinema 3: 7 successful dates → **SUCCESS**

**Result:**
- 2 cinemas processed
- 1 cinema skipped
- 12 successful dates
- 2 failed dates

---

## Progress Tracking

### SSE Connection

**Endpoint:** `GET /api/scraper/progress`

**Test connection:**

```bash
# Connect to progress stream
curl -N http://localhost:3000/api/scraper/progress

# Expected heartbeat (every 15 seconds)
: heartbeat

# Expected events during scrape
event: cinema_started
data: {"type":"cinema_started","cinema_name":"UGC Ciné Cité Les Halles"}

event: date_started
data: {"type":"date_started","cinema_name":"UGC Ciné Cité Les Halles","date":"2026-03-05"}

event: film_scraped
data: {"type":"film_scraped","film_title":"Dune: Part Two","showtime_count":8}

event: film_failed
data: {"type":"film_failed","film_title":"Unknown","error":"Parser error"}

event: date_completed
data: {"type":"date_completed","cinema_name":"UGC Ciné Cité Les Halles","date":"2026-03-05"}
```

---

### No Events Received

**Possible causes:**

1. **No active scrape:**

```bash
# Check scraper status
curl http://localhost:3000/api/scraper/status

# Response if idle:
# {"active":false,"progress":null}
```

2. **SSE client buffering:**
   - Check reverse proxy configuration
   - Add `proxy_buffering off;` to nginx

3. **Client timeout:**
   - Heartbeat sent every 15 seconds
   - Client must handle keep-alive

---

### Connection Drops

**Behavior:**
- Disconnected clients **removed silently**
- No automatic reconnection
- No error emitted to remaining clients

**Client responsibility:**
- Detect connection drop
- Reconnect manually
- Handle reconnection logic

**Example (JavaScript):**

```javascript
function connectSSE() {
  const eventSource = new EventSource('/api/scraper/progress');
  
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 5000);  // Reconnect after 5s
  };
}
```

---

## Redis Queue Issues

### Job Parsing Failure (Microservice Mode)

**Error in scraper logs:**

```
[RedisJobConsumer] Failed to parse job
```

**Cause:** Invalid JSON in Redis queue.

**Behavior:**
- Job skipped
- Error logged
- Consumer continues to next job

**Check Redis queue:**

```bash
# View pending jobs
docker compose exec ics-redis redis-cli LRANGE scraper:jobs 0 -1

# Clear queue (if corrupted)
docker compose exec ics-redis redis-cli DEL scraper:jobs
```

---

### Handler Failure

**Error:**

```
[RedisJobConsumer] Job handler failed: Error: ...
```

**Cause:** Exception during job execution.

**Behavior:**
- Error logged with full context
- Job NOT re-queued (lost)
- Consumer continues to next job

**⚠️ No automatic retry** for failed jobs.

---

### Redis Connection Loss

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:** Redis not running or wrong `REDIS_URL`.

**Solution:**

```bash
# Check Redis status
docker compose ps ics-redis

# Check environment variable
cat .env | grep REDIS_URL

# Should be:
REDIS_URL=redis://ics-redis:6379  # Not localhost!

# Test connection
docker compose exec ics-redis redis-cli ping
# Expected: PONG

# Restart scraper microservice
docker compose --profile scraper restart ics-scraper
```

**⚠️ No automatic reconnection** - scraper must be restarted.

---

### Queue Polling Error Loop

**Error in logs:**

```
[RedisJobConsumer] Error polling queue: ...
```

**Behavior:**
- 1-second pause before retry
- Prevents tight error loop
- Continues polling after pause

---

## Browser Issues

### Playwright Browser Crashes

**Error:**

```
Browser closed unexpectedly
```

**Cause:** Browser process crashed or OOM killed.

**Behavior:**
- Browser relaunched on next request
- Shared browser instance managed by `getBrowser()`

**Manual cleanup:**

```javascript
// In code (not user-accessible)
await closeBrowser();  // Closes shared browser instance
```

**Check logs:**

```bash
docker compose logs ics-web | grep -i playwright
docker compose logs ics-web | grep -i chromium
```

---

### Memory Issues

**Symptoms:**
- Slow scraping
- Browser crashes
- Container killed (OOMKilled)

**Check memory:**

```bash
# Container memory usage
docker stats ics-web

# Check if OOM killed
docker inspect ics-web --format='{{.State.OOMKilled}}'
```

**Solution:**

```bash
# Add memory limits to docker-compose.yml
services:
  ics-web:
    deploy:
      resources:
        limits:
          memory: 2G

# Or increase Docker Desktop memory limit
# Settings > Resources > Memory > 4GB+
```

**⚠️ No memory safeguards in scraper code** - can exhaust available memory.

---

### Browser Context Cleanup

**How it works:**
- New context created per `fetchTheaterPage()` call
- Context closed in `finally` block
- Shared browser instance reused

**Manual verification:**

```bash
# Check running Chromium processes
docker compose exec ics-web ps aux | grep chromium
```

---

## Debugging

### Check Scraper Status

```bash
# Get current scraper status
curl http://localhost:3000/api/scraper/status

# Response examples:

# Idle:
# {"active":false,"progress":null}

# Active:
# {
#   "active": true,
#   "progress": {
#     "current_cinema": "UGC Ciné Cité Les Halles",
#     "completed_cinemas": 2,
#     "total_cinemas": 5,
#     "current_date": "2026-03-05"
#   }
# }
```

---

### Monitor Progress (SSE)

```bash
# Real-time progress stream
curl -N http://localhost:3000/api/scraper/progress

# Or with event parsing
curl -N http://localhost:3000/api/scraper/progress 2>&1 | \
  grep -E "^(event:|data:)"
```

---

### View Scraper Logs

```bash
# In-process mode (default)
docker compose logs -f ics-web | grep -i scrap

# Microservice mode
docker compose logs -f ics-scraper

# Filter for errors
docker compose logs ics-web | grep -E "(Error|Failed|Warning)"
```

---

### Test Single Cinema Scrape

```bash
# Scrape specific cinema
curl -X POST http://localhost:3000/api/scraper/scrape \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId":"C0072"}'

# Scrape all cinemas
curl -X POST http://localhost:3000/api/scraper/scrape \
  -H "Authorization: Bearer <token>"
```

---

### Check Scrape History

```bash
# View recent scrape reports
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>"

# Database query for scrape history
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT id, cinema_id, scraped_at, status, films_count, showtimes_count 
   FROM scrape_reports 
   ORDER BY scraped_at DESC 
   LIMIT 10;"
```

---

### Verify Scraped Data

```bash
# Check cinemas
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT cinema_id, name, address FROM cinemas;"

# Check films
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT id, title, duration_minutes FROM films LIMIT 10;"

# Check showtimes
docker compose exec ics-db psql -U postgres -d ics -c \
  "SELECT s.id, c.name, f.title, s.showtime_datetime 
   FROM showtimes s 
   JOIN cinemas c ON s.cinema_id = c.cinema_id 
   JOIN films f ON s.film_id = f.id 
   ORDER BY s.showtime_datetime DESC 
   LIMIT 10;"
```

---

## Common Error Messages

### Validation Errors

```
Invalid cinema ID format: C12345
Invalid date format: 2026-3-5
Invalid date: 2026-02-30
Invalid film ID: -123
Invalid Allocine URL. Must be https://www.allocine.fr/...
Could not extract cinema ID from URL. URL format should be like https://www.allocine.fr/seance/...
SSRF guard: unexpected host in constructed URL https://example.com/...
```

---

### HTTP Errors

```
Failed to fetch showtimes JSON for C0072 on 2026-03-05: 403 Forbidden
Failed to fetch showtimes JSON for C0072 on 2026-03-05: 404 Not Found
Failed to fetch film page 12345: 500 Internal Server Error
TimeoutError: page.goto: Timeout 60000ms exceeded
```

---

### Parser Warnings

```
Could not parse theater data JSON
Could not parse showtimes dates
Could not extract film ID from: /film/fichefilm-XXXXX.html
Showtimes API returned error for C0072 on 2026-03-05
Invalid runtime value detected: NaN
Invalid rating value detected: Infinity
Rating out of range (0-5): 6.7
```

---

### System Errors

```
Cinema with ID C0072 not found in configuration
Cinema not found in database: C0072
Cinema not configured for scraping: C0072
A scrape is already in progress
Error parsing film card: SyntaxError: Unexpected token
Error scraping UGC Les Halles for 2026-03-05: TimeoutError
Error processing film "Dune: Part Two": TypeError: Cannot read property
Failed to load theater metadata for UGC Les Halles: 404 Not Found
Fatal error: Database connection lost
```

---

### Redis Errors (Microservice Mode)

```
[RedisClient] Failed to parse progress event
[RedisJobConsumer] Failed to parse job
[RedisJobConsumer] Job handler failed: Error: ...
[RedisJobConsumer] Error polling queue: connect ECONNREFUSED
```

---

## Environment Variables

### Scraper Configuration

```bash
# Scrape planning is configured in app settings
# via the admin UI or settings API

# Delay between cinemas (milliseconds)
SCRAPE_THEATER_DELAY_MS=3000

# Delay between film detail fetches (milliseconds)
SCRAPE_MOVIE_DELAY_MS=500

# Redis connection for queue-backed scraping
REDIS_URL=redis://ics-redis:6379

# Worker mode
RUN_MODE=consumer
```

---

### Apply Configuration

```bash
# Edit .env file
nano .env

# Restart server
docker compose restart ics-web

# Restart scraper workers
docker compose restart ics-scraper ics-scraper-cron
```

---

## Metrics (Microservice Mode Only)

**Prometheus metrics endpoint:** `http://localhost:9091/metrics`

**Available metrics:**

```
# Total scrape jobs
scrape_jobs_total{status="success|failure",trigger="manual|cron"}

# Scrape duration per cinema
scrape_duration_seconds{cinema="C0072"}

# Films scraped per cinema
films_scraped_total{cinema="C0072"}

# Showtimes scraped per cinema
showtimes_scraped_total{cinema="C0072"}
```

**Query metrics:**

```bash
# View metrics
curl http://localhost:9091/metrics

# Filter for scrape jobs
curl http://localhost:9091/metrics | grep scrape_jobs_total
```

---

## Related Documentation

- [Scraper Configuration](../reference/scraper.md) - Configuration guide
- [Scraper API](../reference/api/scraper.md) - API endpoints
- [Database Troubleshooting](./database.md) - Database issues
- [Docker Troubleshooting](./docker.md) - Container issues
- [Common Issues](./common-issues.md) - General troubleshooting

---

[← Back to Troubleshooting](./README.md)
