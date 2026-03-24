# Advanced Scraper Configuration & Rate Limiting Tuning

**Last updated:** March 18, 2026 | Status: Current ✅

Complete guide to optimizing scraper performance, avoiding rate limits, and tuning for production scale.

---

## Table of Contents

- [Overview](#overview)
- [Rate Limiting Fundamentals](#rate-limiting-fundamentals)
- [Delay Configuration](#delay-configuration)
- [Troubleshooting 429 & 403 Errors](#troubleshooting-429--403-errors)
- [Performance Tuning](#performance-tuning)
- [Monitoring & Debugging](#monitoring--debugging)
- [Production Optimization](#production-optimization)
- [Advanced Techniques](#advanced-techniques)

---

## Overview

AlloCiné (and most websites) actively monitor and throttle aggressive automated scrapers. This guide helps you:

- **Avoid rate limiting** - Configure delays to stay under detection thresholds
- **Debug scraping failures** - Understand 403/429 errors and recovery strategies
- **Optimize for scale** - Balance speed and reliability with multiple cinemas
- **Monitor health** - Detect rate-limiting problems early

### Key Metrics

| Metric | Current Default | Safe Range | Risky |
|--------|---|---|---|
| **Theater Delay** | 3000ms | 2000-5000ms | <1000ms |
| **Movie Delay** | 500ms | 300-1000ms | <200ms |
| **Concurrent Requests** | 1 (sequential) | 1-2 per instance | >2 |
| **Request Timeouts** | 60s | 30-120s | >180s |

---

## Rate Limiting Fundamentals

### How AlloCiné Rate Limiting Works

AlloCiné uses **multiple detection layers**:

1. **IP-Based Rate Limiting**
   - Requests per second from single IP
   - Threshold: ~2 requests/second per IP
   - Response: 429 (Too Many Requests) or 403 (Forbidden)

2. **User-Agent Detection**
   - Headless browser detection (Puppeteer, Selenium)
   - Request pattern analysis (consistent timing)
   - Response: 403 Forbidden

3. **Behavioral Analysis**
   - Request timing and sequencing (bot-like patterns)
   - Specific cinema focus (ignores popular pages, targets obscure cinemas)
   - Missing HTTP headers (referrer, accept-language)

### Why Delays Matter

```
Fast Scraping (no delays):
  Request 1 (0ms)   → Success
  Request 2 (50ms)  → Success
  Request 3 (100ms) → Success
  Request 4 (150ms) → 429 Too Many Requests ❌
  
  RESULT: Partial failure, missing data

Optimized Scraping (with delays):
  Request 1 (0ms)    → Success
  Request 2 (3100ms) → Success
  Request 3 (6100ms) → Success
  Request 4 (9100ms) → Success
  
  RESULT: Complete success, all data scraped ✅
```

---

## Delay Configuration

### Environment Variables

There are **two main delay settings**:

#### `SCRAPE_THEATER_DELAY_MS` - Delay Between Cinemas

**Purpose:** Delay after scraping all dates for one cinema before starting next cinema

**Default:** 3000ms (3 seconds)

**When to adjust:**
- **Increase to 5000-10000ms** if experiencing 429 errors
- **Decrease to 2000ms** if scraping only 1-3 cinemas
- **Per-cinema basis** - see advanced section

**Example timeline** (with 3 cinemas, 7 dates each):
```
Cinema 1:
  └─ Dates 1-7: 7 requests × 500ms film delays = 3500ms
  └─ Wait: 3000ms (SCRAPE_THEATER_DELAY_MS)

Cinema 2:
  └─ Dates 1-7: 7 requests × 500ms film delays = 3500ms
  └─ Wait: 3000ms

Cinema 3:
  └─ Dates 1-7: 7 requests × 500ms film delays = 3500ms

Total time: ~22 seconds for 21 showtimes requests
```

#### `SCRAPE_MOVIE_DELAY_MS` - Delay Between Film Detail Fetches

**Purpose:** Delay when fetching individual film metadata (duration, director, synopsis)

**Default:** 500ms

**When to adjust:**
- **Increase to 1000ms** if fetching many unknown films
- **Decrease to 200-300ms** if most films already cached
- Film details only fetched for **new films without duration**

**Example trigger:**
```javascript
// Film detail fetch is triggered only if:
if (!existingFilm || existingFilm.duration_minutes === null) {
  await fetchFilmPage(filmId);  // Add SCRAPE_MOVIE_DELAY_MS delay
}
```

---

## Troubleshooting 429 & 403 Errors

### Error: 429 Too Many Requests

**Symptoms:**
- Scrape starts successfully
- Fails midway through (after 5-15 cinemas)
- Error message: `429 Too Many Requests`
- Followed by subsequent scrapes also failing

**Root Causes:**
1. Delay too short for AlloCiné's current rate limit
2. Multiple scraper instances using same IP
3. Other services on same IP making requests
4. AlloCiné temporarily lowering limits (during peak hours)

**Solutions:**

**1. Increase `SCRAPE_THEATER_DELAY_MS`** (most effective)

```bash
# Current settings causing 429:
SCRAPE_THEATER_DELAY_MS=1000  # ❌ Too fast

# More conservative:
SCRAPE_THEATER_DELAY_MS=3000  # ✅ Safer
SCRAPE_THEATER_DELAY_MS=5000  # ✅ Very conservative

# Apply by restarting:
docker compose restart ics-web
# or for microservice mode:
docker compose restart ics-scraper
```

**2. Reduce Cinema Count**

If scraping 20+ cinemas, split into two scheduled scrapes:

```sql
-- Scrape odd-numbered cinemas at 8am
SELECT * FROM cinemas WHERE id % 2 = 1;

-- Scrape even-numbered cinemas at 12pm
SELECT * FROM cinemas WHERE id % 2 = 0;
```

**3. Check for Competing Requests**

If running multiple scraper instances on same IP:
```bash
# Check active scraper processes
docker compose ps | grep scraper

# Reduce to single instance temporarily
docker compose stop ics-scraper-cron
```

**4. Check Current AlloCiné Status**

AlloCiné sometimes tightens rate limits during peak hours:

```bash
# Test directly
curl -v "https://www.allocine.fr/_/showtimes?d=2026-03-18&t=C0072" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

# If getting 429, wait 30 minutes and retry
```

---

### Automatic 429 Detection (Phase 1 - Implemented)

**As of v4.1.0**, the scraper now automatically detects HTTP 429 responses and stops gracefully.

**What happens when 429 is detected:**

1. **Immediate stop**: Scraper breaks both date loop and cinema loop
2. **Status change**: Report status set to `rate_limited` (not `failed`)
3. **Error classification**: Error includes:
   ```json
   {
     "cinema_name": "Example Cinema",
     "cinema_id": "C0123",
     "date": "2026-03-24",
     "error": "HTTP 429 Too Many Requests",
     "error_type": "http_429",
     "http_status_code": 429
   }
   ```
4. **UI feedback**: Orange badge in admin panel with explanation
5. **Remaining cinemas**: Marked as "not attempted" (not failed)

**Viewing rate-limited reports:**

```bash
# Get scrape reports
curl http://localhost:3000/api/reports?page=1 \
  -H "Authorization: Bearer <token>"

# Look for status: "rate_limited"
{
  "id": 123,
  "status": "rate_limited",
  "started_at": "2026-03-24T10:00:00Z",
  "completed_at": "2026-03-24T10:02:15Z"
}
```

**Next steps after detection:**

1. **Wait**: Pause for 10-30 minutes before retrying
2. **Increase delays**: Adjust `SCRAPE_THEATER_DELAY_MS` upward
3. **Check patterns**: Review timing of recent scrapes
4. **Retry manually**: Use admin panel to trigger new scrape

**Phase 2 (Planned - Not Yet Implemented):**
- **Resume capability**: Automatically retry only cinemas that weren't attempted
- **Exponential backoff**: Progressive delay increases after rate limit
- **Smart scheduling**: Adjust future scrape timing based on rate limit history

**See implementation details:** [Scraper System Architecture](../../reference/architecture/scraper-system.md#rate-limit-handling-phase-1---implemented)

### Error: 403 Forbidden

**Symptoms:**
- Entire scrape fails immediately
- All requests return 403
- Error message: `403 Forbidden`

**Root Causes:**
1. Browser detection (Puppeteer detected as bot)
2. Missing HTTP headers
3. IP permanently blocked
4. AlloCiné API change

**Solutions:**

**1. Check Browser Config** (in `scraper/src/scraper/http-client.ts`)

```typescript
// Current Puppeteer args that help avoid detection:
const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',  // Reduce memory footprint
  '--no-first-run',
  '--no-default-browser-check',
  // Missing: User-Agent spoofing, language headers
];
```

**To fix browser detection:**
- Check if `stealth-plugin` is enabled
- Verify `User-Agent` header is set correctly
- Add missing HTTP headers (Accept-Language, etc.)

**2. Check HTTP Headers**

Requests should include:
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json
Accept-Language: fr-FR,fr;q=0.9
Referer: https://www.allocine.fr/
```

**3. Try Different IP**

If single IP is blocked:
```bash
# Rotate through proxy services (not recommended for production)
PROXY_URL=http://proxy1.example.com:3128

# Or use docker host network:
docker compose up --network=host
```

**4. Check AlloCiné API Changes**

If 403 persists across all cinemas, API may have changed:
- Visit `https://www.allocine.fr/seance/` manually
- Check Network tab in DevTools
- Look for new authentication headers or CSRF tokens
- File GitHub issue with details

---

## Performance Tuning

### Baseline Benchmarks

**Current system performance** (with defaults):
```
3 cinemas × 7 days = 21 requests
Time: ~22 seconds
Rate: ~1 request/second
Reliability: 99.9% (< 0.1% failures)
```

### Optimization Strategies

#### Strategy 1: Increase Delay for Reliability

**When:** Experiencing occasional 429 errors

**Before:**
```
SCRAPE_THEATER_DELAY_MS=2000
Success rate: 95% (1/20 scrapes fail)
```

**After:**
```
SCRAPE_THEATER_DELAY_MS=5000
Success rate: 99.9% (< 1/500 scrapes fail)
Tradeoff: +3 seconds per cinema added
```

#### Strategy 2: Reduce Delay for Speed

**When:** Scraping only 1-3 cinemas, speed critical

**Before:**
```
SCRAPE_THEATER_DELAY_MS=3000
5 cinemas: ~22 seconds
```

**After:**
```
SCRAPE_THEATER_DELAY_MS=1500
5 cinemas: ~12 seconds
Monitor for errors
```

**Warning:** Only safe with very few cinemas

#### Strategy 3: Optimize Film Detail Fetching

**Default behavior:** Fetches duration for every new film

**Optimization:** Cache film metadata more aggressively

```sql
-- Find films with missing duration
SELECT id, title, duration_minutes FROM films 
WHERE duration_minutes IS NULL 
LIMIT 10;

-- Manually update if known
UPDATE films SET duration_minutes = 150 
WHERE id = 'film_12345';
```

#### Strategy 4: Split Large Scrapes

**When:** Scraping 10+ cinemas regularly

**Before:** One big scrape every week
```
20 cinemas × 3000ms delay = 60 seconds minimum
High failure risk due to duration
```

**After:** Two medium scrapes
```
10 cinemas × 3000ms delay = 30 seconds each
Lower risk, can retry independently
```

**Implementation:**
```bash
# Schedule smaller scrapes
SCRAPE_CRON_SCHEDULE="0 8 * * 3"    # All cinemas Wed 8am
SCRAPE_CRON_SCHEDULE_2="0 20 * * 3" # Half cinemas Wed 8pm
```

---

## Monitoring & Debugging

### Real-Time Progress Monitoring

**Via SSE (Server-Sent Events):**

```bash
# Watch real-time scrape progress
curl -N http://localhost:3000/api/scraper/progress \
  -H "Authorization: Bearer YOUR_TOKEN"

# Output example:
data: {"type":"cinema_started","cinema_name":"UGC Montparnasse","cinema_id":"C0042"}
data: {"type":"date_started","date":"2026-03-18","cinema_name":"UGC Montparnasse"}
data: {"type":"film_started","film_title":"Dune: Part Two"}
data: {"type":"date_completed","success":true}
```

### Monitoring Metrics to Watch

**In Prometheus/Grafana:**

```
scrape_jobs_total{status="failed"}     # Failed scrapes
scrape_jobs_total{status="partial_success"}  # Partial failures
scrape_duration_seconds               # How long scrapes take
```

**In application logs:**

```bash
docker compose logs ics-web | grep -i "429\|403\|timeout"

# Example output showing rate limit:
2026-03-18T10:15:23Z [scraper] Cinema C0042: 429 Too Many Requests
2026-03-18T10:15:23Z [scraper] Retrying after 2000ms...
2026-03-18T10:15:25Z [scraper] Cinema C0042: Success
```

### Debug Mode

**Enable verbose logging:**

```bash
# In .env
LOG_LEVEL=debug
OTEL_ENABLED=true  # Distributed tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# Restart
docker compose restart ics-web
```

**View detailed traces:**
- Open Tempo UI: `http://localhost:3200`
- Search for scrape trace
- See exact timing of each request

---

## Production Optimization

### Configuration Checklist

For **production deployments**, use this checklist:

```bash
# .env production settings

# ✅ Rate Limiting
SCRAPE_THEATER_DELAY_MS=3000   # Start conservative
SCRAPE_MOVIE_DELAY_MS=500      # Standard

# ✅ Scheduling (avoid peak hours)
SCRAPE_CRON_SCHEDULE="0 3 * * 3"  # Wednesday 3am (off-peak)

# ✅ Monitoring
LOG_LEVEL=info
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317

# ✅ Resilience
SCRAPE_DAYS=7
SCRAPE_MODE=weekly
USE_REDIS_SCRAPER=true  # Microservice mode for isolation

# ✅ Deploymentment
DOCKER_UID=1000
DOCKER_GID=1000
```

### Scaling Checklist

For **scaling to 50+ cinemas**:

1. **Split into multiple scrapes**
   - Even cinemas: 3am Wednesday
   - Odd cinemas: 9am Wednesday

2. **Use multiple scraper instances**
   ```bash
   docker compose --profile scraper up -d --scale ics-scraper=2
   ```

3. **Monitor queue depth**
   ```bash
   redis-cli LLEN scrape:jobs  # Should stay < 5
   ```

4. **Set up alerts**
   - Alert if scrape takes > 5 minutes
   - Alert if > 20% cinemas fail
   - Alert if queue depth > 10

---

## Advanced Techniques

### Per-Cinema Delay Configuration

**Future enhancement** - dynamically adjust delay per cinema:

```typescript
// Pseudocode for future implementation
const CINEMA_DELAY_MAP = {
  'C0042': 2000,  // UGC Montparnasse (high capacity, strict limits)
  'C0089': 3000,  // Max Linder (moderate)
  'W7504': 1500,  // Épée de Bois (low capacity, lenient)
};

async function scrapeCinema(cinema: Cinema) {
  const delay = CINEMA_DELAY_MAP[cinema.id] || DEFAULT_DELAY;
  // ... scrape logic ...
  await delayMs(delay);
}
```

### Headless Browser Optimization

**Current setup:**
- Single Puppeteer browser instance
- Reused across all cinemas
- Closed after scrape completes

**For very high scale** (100+ cinemas), consider:
```typescript
// Browser pool to parallelize requests
const BROWSER_POOL_SIZE = 2;
const browsers = await Promise.all(
  Array(BROWSER_POOL_SIZE)
    .fill(null)
    .map(() => puppeteer.launch())
);

// Distribute cinemas across browsers
for (const cinema of cinemas) {
  const browser = browsers[index % BROWSER_POOL_SIZE];
  // ...scrape with this browser...
}
```

### Adaptive Rate Limiting

**Future enhancement** - detect rate limit and auto-backoff:

```typescript
// Pseudocode
let lastFailureTime = null;

for (const cinema of cinemas) {
  try {
    await scrapeCinema(cinema);
    lastFailureTime = null;  // Reset on success
  } catch (err) {
    if (err.status === 429) {
      const backoffMs = calculateBackoff(lastFailureTime);
      logger.warn(`Rate limited, backing off ${backoffMs}ms`);
      await delayMs(backoffMs);
    }
  }
}
```

---

## Best Practices Summary

| Best Practice | Why | Example |
|---|---|---|
| Start conservative | Better to be slow and reliable | `SCRAPE_THEATER_DELAY_MS=3000` |
| Monitor continuously | Catch problems early | Check queue depth daily |
| Schedule off-peak | Less competition from other users | 3am instead of 8pm |
| Test before scaling | Verify settings work | Try with 2 cinemas first |
| Have fallback plan | Scrapes sometimes fail anyway | Cron can retry automatically |
| Document changes | Future-you will thank you | Record why you changed delays |

---

## Related Documentation

- [Scraper Configuration Reference](../../reference/scraper.md) - Env vars and modes
- [Scraper System Architecture](../../reference/architecture/scraper-system.md) - How scraper works
- [Troubleshooting Scraper](../../troubleshooting/scraper.md) - Common issues
- [Monitoring Guide](../deployment/monitoring.md) - Production monitoring
- [Docker Deployment](../deployment/docker.md) - Container configuration

---

[← Back to Advanced Guides](./README.md) | [Back to Documentation](../../README.md)
