# Scraper API

**Note:** This API uses Server-Sent Events (SSE) for real-time progress monitoring.

## Scraper

### Trigger Manual Scrape

```http
POST /api/scraper/trigger
```

**Authentication:** Required (Bearer token)

**Request Body (optional):**
```json
{
  "cinemaId": "C0153",  // Optional: scrape only this cinema (must exist in database)
  "filmId": 12345       // Optional: scrape only this film
}
```

**Behavior:**
- No parameters → Full scrape (all cinemas, all films, all dates)
- `cinemaId` only → Scrape this cinema (all films, all dates for this cinema)
- `filmId` only → Scrape this film (all cinemas showing this film)
- Both `cinemaId` and `filmId` → Scrape this film at this specific cinema only

**Response (200 — started):**

**In-Process Mode** (default: `USE_REDIS_SCRAPER=false`):
```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "message": "Scrape started successfully"
  }
}
```

**Redis Microservice Mode** (`USE_REDIS_SCRAPER=true`):
```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "message": "Scrape job queued for microservice",
    "queueDepth": 2
  }
}
```

**Response Fields:**
- `reportId` - Unique scrape report ID (can be used to track progress in database)
- `message` - Human-readable status message
- `queueDepth` - (Redis mode only) Number of jobs in the Redis queue after this job was added

**Response (404 — cinema not found):**
```json
{
  "success": false,
  "error": "Cinema not found: CXXXX"
}
```

**Response (409 — already running):**
```json
{
  "success": false,
  "error": "A scrape is already in progress",
  "data": {
    "current_scrape": {
      "started_at": "2024-02-15T10:00:00.000Z",
      "trigger_type": "manual"
    }
  }
}
```

**Examples:**
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Full scrape (all cinemas, all films)
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN"

# Cinema-specific scrape (C-prefix)
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId": "C0153"}'

# Cinema-specific scrape (W-prefix)
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId": "W7515"}'

# Film-specific scrape
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filmId": 12345}'

# Combined: scrape specific film at specific cinema
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId": "C0153", "filmId": 12345}'
```

---

### Get Scraper Status

```http
GET /api/scraper/status
```

**Authentication:** Not required (public endpoint)

**Response (In-Process Mode):**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "useRedisScraper": false,
    "currentSession": {
      "reportId": 43,
      "triggerType": "manual",
      "startedAt": "2024-02-15T10:00:00.000Z",
      "status": "running"
    },
    "latestReport": {
      "id": 42,
      "completed_at": "2024-02-15T10:15:23.000Z",
      "status": "success"
    }
  }
}
```

**Response (Redis Microservice Mode):**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "useRedisScraper": true,
    "currentSession": null,
    "latestReport": {
      "id": 42,
      "completed_at": "2024-02-15T10:15:23.000Z",
      "status": "success"
    }
  }
}
```

**Response Fields:**
- `isRunning` - Whether a scrape is currently running in-process (always `false` in Redis mode)
- `useRedisScraper` - Whether the Redis microservice scraper is enabled (`USE_REDIS_SCRAPER` env var)
- `currentSession` - Current scrape session details (null in Redis mode or when no scrape is running)
- `latestReport` - Most recent completed scrape report from database

**Example:**
```bash
curl http://localhost:3000/api/scraper/status
```

---

### Watch Scrape Progress (SSE)

```http
GET /api/scraper/progress
```

Opens a persistent Server-Sent Events connection. All previously accumulated events are replayed to new clients, then new events are streamed in real time. A heartbeat (`: heartbeat`) is sent every 15 seconds to keep the connection alive.

**Response Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

**Event Format:**

All events are sent as plain `data:` lines (no named `event:` field). Each line is a JSON object with a `type` discriminator:

```
data: {"type":"started","total_cinemas":3,"total_dates":7}

data: {"type":"cinema_started","cinema_name":"Épée de Bois","cinema_id":"W7504","index":1}

data: {"type":"date_started","date":"2026-02-19","cinema_name":"Épée de Bois"}

data: {"type":"film_started","film_title":"Mon Film","film_id":123456}

data: {"type":"film_completed","film_title":"Mon Film","showtimes_count":5}

data: {"type":"film_failed","film_title":"Mon Film","error":"HTTP 404"}

data: {"type":"date_completed","date":"2026-02-19","films_count":12}

data: {"type":"date_failed","date":"2026-02-19","cinema_name":"Épée de Bois","error":"HTTP 503"}

data: {"type":"cinema_completed","cinema_name":"Épée de Bois","total_films":42}

data: {"type":"completed","summary":{"total_cinemas":3,"successful_cinemas":3,"failed_cinemas":0,"total_films":87,"total_showtimes":412,"total_dates":7,"duration_ms":34210,"errors":[]}}

data: {"type":"failed","error":"Fatal error message"}
```

**Event Types:**

| Type | Emitted | Payload fields |
|------|---------|----------------|
| `started` | Once at start | `total_cinemas`, `total_dates` |
| `cinema_started` | Per cinema | `cinema_name`, `cinema_id`, `index` |
| `date_started` | Per cinema × date | `date`, `cinema_name` |
| `film_started` | Per film | `film_title`, `film_id` |
| `film_completed` | Per film (success) | `film_title`, `showtimes_count` |
| `film_failed` | Per film (error) | `film_title`, `error` |
| `date_completed` | Per date (success) | `date`, `films_count` |
| `date_failed` | Per date (error) | `date`, `cinema_name`, `error` |
| `cinema_completed` | Per cinema (≥1 date ok) | `cinema_name`, `total_films` |
| `completed` | Once on success | `summary` (ScrapeSummary object) |
| `failed` | Once on fatal error | `error` |

**Rate Limit Handling:**

When the scraper detects an HTTP 429 (Too Many Requests) response from the source server:
1. The scrape stops immediately to avoid further rate limiting
2. Status is set to `rate_limited` instead of `failed`
3. A `cinema_failed` event is emitted with error_type `http_429`
4. The final `completed` event includes `"status": "rate_limited"` in the summary

**Example Rate Limited Summary:**
```json
{
  "type": "completed",
  "summary": {
    "total_cinemas": 10,
    "successful_cinemas": 3,
    "failed_cinemas": 7,
    "total_films": 45,
    "total_showtimes": 212,
    "total_dates": 7,
    "duration_ms": 12340,
    "status": "rate_limited",
    "errors": [{
      "cinema_name": "Example Cinema",
      "cinema_id": "C0123",
      "date": "2026-03-24",
      "error": "HTTP 429 Too Many Requests",
      "error_type": "http_429",
      "http_status_code": 429
    }]
  }
}
```

**Example:**
```bash
curl -N http://localhost:3000/api/scraper/progress
```

**JavaScript Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/scraper/progress');

// All events arrive via onmessage (no named event: field)
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log('Event:', data.type, data);

  if (data.type === 'completed') {
    console.log('Scraping complete:', data.summary);
    eventSource.close();
  }
  if (data.type === 'failed') {
    console.error('Scraping failed:', data.error);
    eventSource.close();
  }
};

eventSource.onerror = (err) => {
  console.error('SSE connection error:', err);
  eventSource.close();
};
```

---

## Scrape Schedules

Schedule recurring scrapes using cron expressions.

### List All Schedules

```http
GET /api/scraper/schedules
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:list`

**Response (200 — success):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Daily Morning Scrape",
      "description": "Scrape all cinemas every morning at 6 AM",
      "cron_expression": "0 6 * * *",
      "enabled": true,
      "target_cinemas": ["W7504", "C0072"],
      "created_by": 1,
      "created_at": "2026-03-15T10:30:00Z",
      "updated_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

---

### Get Schedule by ID

```http
GET /api/scraper/schedules/:id
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:list`

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Daily Morning Scrape",
    "description": "Scrape all cinemas every morning at 6 AM",
    "cron_expression": "0 6 * * *",
    "enabled": true,
    "target_cinemas": ["W7504", "C0072"],
    "created_by": 1,
    "created_at": "2026-03-15T10:30:00Z",
    "updated_at": "2026-03-15T10:30:00Z"
  }
}
```

**Response (404 — not found):**
```json
{
  "success": false,
  "error": "Schedule not found"
}
```

---

### Create Schedule

```http
POST /api/scraper/schedules
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:create`

**Request Body:**
```json
{
  "name": "Daily Morning Scrape",
  "description": "Scrape all cinemas every morning at 6 AM",
  "cron_expression": "0 6 * * *",
  "enabled": true,
  "target_cinemas": ["W7504", "C0072"]
}
```

**Request Fields:**
- `name` (string, required) - Schedule name (must be unique)
- `description` (string, optional) - Human-readable description
- `cron_expression` (string, required) - Cron expression (e.g., `0 6 * * *` for 6 AM daily)
- `enabled` (boolean, optional, default: true) - Whether schedule is active
- `target_cinemas` (array, optional) - List of cinema IDs to scrape (empty = all cinemas)

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Daily Morning Scrape",
    "description": "Scrape all cinemas every morning at 6 AM",
    "cron_expression": "0 6 * * *",
    "enabled": true,
    "target_cinemas": ["W7504", "C0072"],
    "created_by": 1,
    "created_at": "2026-03-15T10:30:00Z",
    "updated_at": "2026-03-15T10:30:00Z"
  }
}
```

**Response (400 — validation error):**
```json
{
  "success": false,
  "error": "Schedule name is required"
}
```

---

### Update Schedule

```http
PUT /api/scraper/schedules/:id
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:update`

**Request Body (all fields optional):**
```json
{
  "name": "Updated Schedule Name",
  "description": "Updated description",
  "cron_expression": "0 12 * * *",
  "enabled": false,
  "target_cinemas": ["W7504"]
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Schedule Name",
    "description": "Updated description",
    "cron_expression": "0 12 * * *",
    "enabled": false,
    "target_cinemas": ["W7504"],
    "created_by": 1,
    "created_at": "2026-03-15T10:30:00Z",
    "updated_at": "2026-03-18T15:45:00Z"
  }
}
```

---

### Delete Schedule

```http
DELETE /api/scraper/schedules/:id
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:delete`

**Response (204 — deleted):**
```
(no body)
```

**Response (404 — not found):**
```json
{
  "success": false,
  "error": "Schedule not found"
}
```

---

### Trigger Schedule Immediately

```http
POST /api/scraper/schedules/:id/trigger
```

**Authentication:** Required (Bearer token)  
**Permission:** `scraper:schedules:update`

**Description:** Immediately trigger a schedule, bypassing the cron timing.

**Response (200 — started):**
```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "message": "Scrape job queued for microservice",
    "queueDepth": 2
  }
}
```

---

[← Back to API Reference](./README.md)
