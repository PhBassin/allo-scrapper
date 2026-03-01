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
```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "message": "Scrape started successfully"
  }
}
```

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

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
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

[← Back to API Reference](./README.md)
