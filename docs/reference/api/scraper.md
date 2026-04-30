# Scraper API

The scraping pipeline is queue-based. The server enqueues jobs onto Redis (`scrape:jobs`), the `scraper` workspace consumes them, and progress is broadcast over a Server-Sent Events stream replayed from Redis. There is no in-process scraping mode.

> **Removed:** Earlier docs referenced an in-process mode toggled by `USE_REDIS_SCRAPER`. That env var no longer exists in the codebase. The server always queues to Redis and the scraper container(s) always consume from Redis.

All endpoints below live under `/api/scraper`. SaaS deployments scope queries by `org_id` automatically; system admins see all orgs.

## Trigger Endpoints

### Trigger Manual Scrape

```http
POST /api/scraper/trigger
```

**Authentication:** Required (Bearer token).
**Permissions:**
- No `cinemaId` (full scrape) → `scraper:trigger`.
- With `cinemaId` (single-cinema scrape) → `scraper:trigger_single` **or** `scraper:trigger`.
- System admins bypass permission checks.

**Request Body (optional):**
```json
{
  "cinemaId": "C0153",
  "filmId": 12345
}
```

| Combination | Behavior |
|---|---|
| _empty body_ | Full scrape (all cinemas, all dates). |
| `cinemaId` only | All films/dates for that cinema. |
| `filmId` only | That film at every cinema showing it. |
| both | That film at that cinema only. |

**Response (200):**
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

| Field | Meaning |
|---|---|
| `reportId` | New row in `scrape_reports`. Use it to poll status, follow progress, or retry. |
| `queueDepth` | Length of `scrape:jobs` after enqueue. |

**Errors:**
- `403` — `Permission denied` if the caller lacks `scraper:trigger`/`scraper:trigger_single`.
- `404` — `Cinema not found: <id>` raised when `cinemaId` doesn't resolve to a real cinema.

**Examples:**
```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}' | jq -r '.data.token')

# Full scrape
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN"

# Single cinema
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId": "C0153"}'

# Single film
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filmId": 12345}'

# Specific film at specific cinema
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cinemaId": "C0153", "filmId": 12345}'
```

---

### Resume a Failed or Rate-Limited Scrape

```http
POST /api/scraper/resume/:reportId
```

**Authentication:** Required.
**Permission:** `scraper:trigger` (admin bypass applies).

Creates a new scrape report whose work-set is restricted to the cinema/date combinations that ended with status `failed`, `rate_limited`, or `not_attempted` in the parent report. The new report links back via `parent_report_id`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reportId": 124,
    "parentReportId": 123,
    "pendingAttempts": 5,
    "message": "Resume job queued for microservice",
    "queueDepth": 1
  }
}
```

**Errors:**
- `400` — `Invalid report ID` or `No pending attempts to resume`.
- `404` — `Report not found`.

```bash
curl -X POST http://localhost:3000/api/scraper/resume/123 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Status & Progress

### Get Current Status

```http
GET /api/scraper/status
```

**Authentication:** Required.

Returns whether a scrape is currently active and a snapshot of the latest completed report.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "currentSession": null,
    "latestReport": {
      "id": 42,
      "completed_at": "2026-04-15T10:15:23.000Z",
      "status": "success"
    }
  }
}
```

When a scrape is in flight, `currentSession` is populated with `reportId`, `triggerType`, `startedAt`, and `status`.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/scraper/status
```

---

### Watch Scrape Progress (SSE)

```http
GET /api/scraper/progress
```

**Authentication:** Required.

Persistent Server-Sent Events stream. Previously buffered events for the active scrape are replayed to new subscribers, then live events are streamed. Replayable business events include standard SSE `id:` fields so clients can resume with `Last-Event-ID` after reconnecting. A JSON `ping` event is sent every 30 s to keep the connection alive. Heartbeat frames are transport-only: they do not include `id:` fields and are not replayed as scrape history to new subscribers.

**Request Headers:**
- `Authorization: Bearer <token>`
- `Accept: text/event-stream`
- `Last-Event-ID: <event-id>` optional; replays matching tenant progress events after this ID

**Response Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

**Event Format**

Events are unnamed SSE messages. Business progress messages use `id:` plus one or more `data:` lines. Each payload is JSON with a `type` discriminator:

```
data: {"type":"ping","timestamp":"2026-04-28T15:18:00.000Z"}
```

```
id: 1
data: {"type":"started","total_cinemas":3,"total_dates":7}

id: 2
data: {"type":"cinema_started","cinema_name":"Épée de Bois","cinema_id":"W7504","index":1}

id: 3
data: {"type":"date_started","date":"2026-02-19","cinema_name":"Épée de Bois"}

id: 4
data: {"type":"film_started","film_title":"Mon Film","film_id":123456}

id: 5
data: {"type":"film_completed","film_title":"Mon Film","showtimes_count":5}

id: 6
data: {"type":"film_failed","film_title":"Mon Film","error":"HTTP 404"}

id: 7
data: {"type":"date_completed","date":"2026-02-19","films_count":12}

id: 8
data: {"type":"date_failed","date":"2026-02-19","cinema_name":"Épée de Bois","error":"HTTP 503"}

id: 9
data: {"type":"cinema_completed","cinema_name":"Épée de Bois","total_films":42}

id: 10
data: {"type":"completed","summary":{"total_cinemas":3,"successful_cinemas":3,"failed_cinemas":0,"total_films":87,"total_showtimes":412,"total_dates":7,"duration_ms":34210,"errors":[]}}

id: 11
data: {"type":"failed","error":"Fatal error message"}
```

| Type | Emitted | Payload fields |
|---|---|---|
| `started` | Once at start | `total_cinemas`, `total_dates` |
| `ping` | Every 30 s while stream remains open | `timestamp` |
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

**Rate-limit handling**

When the scraper detects HTTP 429 from the source:

1. The current scrape stops to avoid further pressure.
2. The report status becomes `rate_limited` (not `failed`).
3. A `cinema_failed` event with `error_type: "http_429"` is emitted.
4. The final `completed` event includes `"status": "rate_limited"` in `summary`.

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

```bash
curl -N -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/scraper/progress
```

Resume after the last processed business event:

```bash
curl -N \
  -H "Authorization: Bearer $TOKEN" \
  -H "Last-Event-ID: 42" \
  http://localhost:3000/api/scraper/progress
```

```javascript
let lastEventId;

async function connectProgressStream(token) {
  const response = await fetch('/api/scraper/progress', {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
    },
  });

  for await (const chunk of response.body) {
    // Parse SSE blocks, store each business event `id:`, and reconnect with it.
  }
}
```

---

## Dead-Letter Queue

Jobs that exhaust their retry budget are moved to a Redis-backed DLQ. Operators can inspect the failed payloads and requeue them.

**Permissions:** caller must hold `scraper:trigger` **or** be a system admin.
**Tenant scoping:** non-system users only see DLQ entries that match their `org_id`.

### List DLQ Jobs

```http
GET /api/scraper/dlq?page=1&pageSize=50
```

| Query | Default | Notes |
|---|---|---|
| `page` | `1` | 1-based. Clamped to ≥ 1. |
| `pageSize` | `50` | Capped at `50`. |

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "job_id": "report-123",
        "failure_reason": "HTTP 503",
        "retry_count": 3,
        "timestamp": "2026-04-21T19:00:00.000Z",
        "cinema_id": "C0042",
        "org_id": "7",
        "org_slug": "acme",
        "user_id": "12",
        "endpoint": "/api/scraper/trigger",
        "job": {
          "type": "scrape",
          "triggerType": "manual",
          "reportId": 123,
          "retryCount": 3,
          "options": { "cinemaId": "C0042" },
          "traceContext": {
            "org_id": "7",
            "org_slug": "acme",
            "user_id": "12",
            "endpoint": "/api/scraper/trigger"
          }
        }
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 50
  }
}
```

Newest jobs are returned first. Errors: `403` `Permission denied`.

### Get a Single DLQ Job

```http
GET /api/scraper/dlq/:jobId
```

Returns the same shape as a single entry from the list endpoint. `404` if the job ID doesn't exist (or doesn't belong to the caller's org).

### Retry a DLQ Job

```http
POST /api/scraper/dlq/:jobId/retry
```

Requeues the job onto `scrape:jobs` with `retry_count` reset to `0`. Response shape is the requeued job entry. `404` if not found.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scraper/dlq/report-123/retry
```

---

## Scrape Schedules

Cron-style recurring scrape definitions stored in the database. Schedule changes are published to Redis (`schedule_changes`) so the `scraper` cron container reloads them without a restart.

| Permission | Endpoints |
|---|---|
| `scraper:schedules:list` | `GET /schedules`, `GET /schedules/:id` |
| `scraper:schedules:create` | `POST /schedules` |
| `scraper:schedules:update` | `PUT /schedules/:id`, `POST /schedules/:id/trigger` |
| `scraper:schedules:delete` | `DELETE /schedules/:id` |

### List Schedules

```http
GET /api/scraper/schedules
```

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

### Get Schedule by ID

```http
GET /api/scraper/schedules/:id
```

`404` `Schedule not found` when the ID doesn't exist.

### Create Schedule

```http
POST /api/scraper/schedules
```

```json
{
  "name": "Daily Morning Scrape",
  "description": "Scrape all cinemas every morning at 6 AM",
  "cron_expression": "0 6 * * *",
  "enabled": true,
  "target_cinemas": ["W7504", "C0072"]
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Must be unique. `400` if blank, `400` `Schedule name already exists` on conflict. |
| `cron_expression` | yes | Standard 5-field cron. |
| `description` | no | Free text. |
| `enabled` | no | Defaults to `true`. |
| `target_cinemas` | no | Empty/omitted → all cinemas. |

Returns `201` with the created record.

### Update Schedule

```http
PUT /api/scraper/schedules/:id
```

All fields optional; the request body is merged with the existing record. `400 Schedule name already exists` on a unique-name conflict, `404 Schedule not found` if the ID doesn't exist.

### Delete Schedule

```http
DELETE /api/scraper/schedules/:id
```

`204 No Content` on success, `404 Schedule not found` otherwise.

### Trigger Schedule Immediately

```http
POST /api/scraper/schedules/:id/trigger
```

Bypasses the cron timing and enqueues the schedule's first target cinema (or full scrape, if no targets are configured) right now.

```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "scheduleId": 1,
    "scheduleName": "Daily Morning Scrape",
    "message": "Schedule job queued for immediate execution",
    "queueDepth": 2
  }
}
```

---

## Related

- [Scraper System Architecture](../architecture/scraper-system.md)
- [Reports API](./reports.md) — query the `reportId` returned by trigger/resume.
- [Rate Limiting Reference](./rate-limiting.md)

[← Back to API Reference](./README.md)
