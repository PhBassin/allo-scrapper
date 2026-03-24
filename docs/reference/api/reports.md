# Reports API

**Last updated:** March 18, 2026 | Status: Current ✅

**Authentication:** All endpoints require authentication (Bearer token)

## Reports

### Get Scrape Reports

```http
GET /api/reports
```

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `page` (optional, integer): Page number (default: `1`)
- `pageSize` (optional, integer): Reports per page (default: `20`)
- `status` (optional): `running`, `success`, `partial_success`, `failed`
- `triggerType` (optional): `manual` or `cron`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "started_at": "2024-02-15T10:00:00.000Z",
        "completed_at": "2024-02-15T10:15:23.000Z",
        "status": "success",
        "trigger_type": "cron",
        "total_cinemas": 2,
        "successful_cinemas": 2,
        "failed_cinemas": 0,
        "total_films_scraped": 45,
        "total_showtimes_scraped": 234,
        "errors": []
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get reports
curl "http://localhost:3000/api/reports?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get Scrape Report

```http
GET /api/reports/:id
```

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (integer): Report ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "status": "success",
    "trigger_type": "manual",
    "total_cinemas": 3
  }
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get specific report
curl "http://localhost:3000/api/reports/42" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get Scrape Report Details

```http
GET /api/reports/:id/details
```

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (integer): Report ID

**Description:** Get detailed breakdown of all scrape attempts for this report, including per-cinema, per-date status.

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": 123,
    "status": "rate_limited",
    "parentReportId": null,
    "summary": {
      "total": 21,
      "successful": 8,
      "failed": 0,
      "rate_limited": 1,
      "not_attempted": 12,
      "pending": 0
    },
    "attempts": [
      {
        "cinema_id": "C0042",
        "cinema_name": "UGC Montparnasse",
        "date": "2026-03-25",
        "status": "success",
        "created_at": "2026-03-24T10:00:00Z",
        "updated_at": "2026-03-24T10:00:15Z",
        "error_message": null
      },
      {
        "cinema_id": "C0042",
        "cinema_name": "UGC Montparnasse",
        "date": "2026-03-26",
        "status": "rate_limited",
        "created_at": "2026-03-24T10:00:15Z",
        "updated_at": "2026-03-24T10:00:17Z",
        "error_message": "HTTP 429 Too Many Requests"
      },
      {
        "cinema_id": "C0089",
        "cinema_name": "Max Linder",
        "date": "2026-03-25",
        "status": "not_attempted",
        "created_at": "2026-03-24T10:00:17Z",
        "updated_at": "2026-03-24T10:00:17Z",
        "error_message": null
      }
    ]
  }
}
```

**Response Fields:**
- `reportId` - Report ID
- `status` - Overall report status (`running`, `success`, `partial_success`, `failed`, `rate_limited`)
- `parentReportId` - If this is a resumed scrape, ID of the original report (null otherwise)
- `summary` - Aggregate counts of attempts by status
  - `total` - Total number of cinema/date combinations attempted
  - `successful` - Number of successful attempts
  - `failed` - Number of failed attempts (non-rate-limit errors)
  - `rate_limited` - Number of rate-limited attempts
  - `not_attempted` - Number of attempts that were never started (stopped before reaching them)
  - `pending` - Number of attempts currently in progress
- `attempts` - Array of all scrape attempts with detailed status
  - `cinema_id` - Cinema identifier (e.g., "C0042")
  - `cinema_name` - Human-readable cinema name
  - `date` - Scrape date in YYYY-MM-DD format
  - `status` - Attempt status (`pending`, `success`, `failed`, `rate_limited`, `not_attempted`)
  - `created_at` - When attempt was created
  - `updated_at` - When attempt status was last updated
  - `error_message` - Error details (null if successful)

**Response (404 — not found):**
```json
{
  "success": false,
  "error": "Report not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get detailed report breakdown
curl "http://localhost:3000/api/reports/123/details" \
  -H "Authorization: Bearer $TOKEN"
```

**Use Cases:**
- **Debug rate limits**: See exactly which cinema/date hit the rate limit
- **Resume planning**: Identify which attempts need to be retried
- **Performance analysis**: Understand failure patterns across cinemas/dates
- **Audit trail**: Track complete history of scrape attempts

---

[← Back to API Reference](./README.md)
