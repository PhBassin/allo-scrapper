# 📡 API Documentation

[← Back to README](./README.md)

Complete API reference for the Allo-Scrapper REST API.

**Related Documentation:**
- [Database Schema](./DATABASE.md) - Data models and relationships
- [Troubleshooting](./TROUBLESHOOTING.md#authentication-troubleshooting) - Auth issues
- [Setup Guide](./SETUP.md) - Environment variables

---

## Table of Contents

- [Base URL](#base-url)
- [Response Format](#response-format)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Cinemas](#cinemas)
  - [Films](#films)
  - [Authentication](#authentication-endpoints)
  - [Scraper](#scraper)
  - [Reports](#reports)
  - [Settings Management](#settings-management)
  - [User Management](#user-management)
  - [System Information](#system-information)

---

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

---

## Response Format

All endpoints except `GET /api/health` return:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Authentication

Protected endpoints require JWT authentication:
- **Login**: `POST /api/auth/login` to obtain a token
- **Authorization Header**: `Authorization: Bearer <token>`

**Default credentials:**
- Username: `admin`
- Password: `admin`

**⚠️ Important:** Change the default admin password in production environments.

**Protected Endpoints:**
- `POST /api/scraper/trigger` - Trigger manual scraping
- `GET /api/reports` - View scrape reports
- `GET /api/reports/:id` - View report details

**Example:**
```bash
# Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Use token for protected endpoints
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limiting

All API endpoints are protected with rate limiting to prevent abuse and ensure service availability.

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window | Description |
|--------------|-------|--------|-------------|
| **General API** | 100 requests | 15 minutes | Applies to all `/api/*` routes |
| **Login** | 5 failed attempts | 15 minutes | Failed logins only (successful logins don't count) |
| **Registration** | 3 registrations | 1 hour | New user registrations |
| **Protected Endpoints** | 60 requests | 15 minutes | `/api/reports/*` endpoints |
| **Scraper Trigger** | 10 requests | 15 minutes | `/api/scraper/trigger` endpoint |
| **Public Endpoints** | 100 requests | 15 minutes | `/api/films/*`, `/api/cinemas/*` |

### Rate Limit Headers

All API responses include rate limit headers:
- `RateLimit-Limit` - Maximum requests allowed in the window
- `RateLimit-Remaining` - Requests remaining in current window
- `RateLimit-Reset` - Unix timestamp when the window resets

### 429 Response Format

When the rate limit is exceeded, the API returns a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Too many requests, please try again later."
}
```

The response includes a `Retry-After` header indicating when to retry (in seconds).

### Configuration

Rate limits can be configured via environment variables in `.env`:

```bash
# Rate limit window (default: 15 minutes)
RATE_LIMIT_WINDOW_MS=900000

# General API limit (default: 100)
RATE_LIMIT_GENERAL_MAX=100

# Auth login limit (default: 5)
RATE_LIMIT_AUTH_MAX=5

# Registration limit (default: 3)
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_REGISTER_WINDOW_MS=3600000

# Protected endpoints limit (default: 60)
RATE_LIMIT_PROTECTED_MAX=60

# Scraper trigger limit (default: 10)
RATE_LIMIT_SCRAPER_MAX=10

# Public endpoints limit (default: 100)
RATE_LIMIT_PUBLIC_MAX=100
```

### Practical Examples

**Testing rate limits:**
```bash
# Trigger rate limit on login (5 failed attempts per 15 min)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# 6th request returns 429 Too Many Requests
```

**Checking rate limit headers:**
```bash
# Make request and view headers
curl -I http://localhost:3000/api/films

# Response includes:
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# RateLimit-Reset: 1709647200  (Unix timestamp)
```

**Handling 429 responses:**
```bash
# When rate limited, check Retry-After header
curl -i http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'

# If 429, response includes:
# Retry-After: 896  (seconds until reset)
```

**Rate limit bypass for successful logins:**
```bash
# Failed logins count toward limit
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
# → Increments counter

# Successful logins do NOT count
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
# → Does NOT increment counter (returns token)
```

---

## Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

## Cinemas

### List All Cinemas

```http
GET /api/cinemas
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "address": "100 Rue Mouffetard",
      "postal_code": "75005",
      "city": "Paris",
      "screen_count": 1,
      "image_url": "https://..."
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/cinemas
```

---

### Get Cinema Details

```http
GET /api/cinemas/:id
```

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response:**
```json
{
  "success": true,
  "data": {
    "showtimes": [
      {
        "id": "W7504-123456-2024-02-15-14:00",
        "date": "2024-02-15",
        "time": "14:00",
        "datetime_iso": "2024-02-15T14:00:00+01:00",
        "version": "VF",
        "format": "2D",
        "experiences": ["Dolby Atmos"],
        "film": {
          "id": 123456,
          "title": "Film Title",
          "original_title": "Original Title"
        }
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/cinemas/W7504"
```

---

### Add Cinema

```http
POST /api/cinemas
```

**Body (JSON):**
```json
{
  "id": "C0099",
  "name": "New Cinema",
  "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "id": "C0099",
    "name": "New Cinema",
    "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"
  }
}
```

**Error Responses:**
- `400` — Missing required fields (`id`, `name`, `url`)
- `409` — Cinema with this ID already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -d '{"id":"C0099","name":"New Cinema","url":"https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"}'
```

---

### Update Cinema

```http
PUT /api/cinemas/:id
```

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Body (JSON):** At least one field required.
```json
{
  "name": "Updated Name",
  "url": "https://new-url.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "W7504",
    "name": "Updated Name",
    "url": "https://new-url.com"
  }
}
```

**Error Responses:**
- `400` — No fields provided
- `404` — Cinema not found

**Example:**
```bash
curl -X PUT http://localhost:3000/api/cinemas/W7504 \
  -H "Content-Type: application/json" \
  -d '{"name":"Épée de Bois (updated)"}'
```

---

### Delete Cinema

```http
DELETE /api/cinemas/:id
```

Deletes the cinema and cascades to all its showtimes and weekly programs.

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response (204):**
```json
{ "success": true }
```

**Error Responses:**
- `404` — Cinema not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/cinemas/C0099
```

---

### Sync Cinemas to JSON

```http
GET /api/cinemas/sync
```

Manually synchronizes the database cinema configurations to the `cinemas.json` file. This endpoint reads all cinemas from the database and overwrites the JSON file.

**Note:** Automatic synchronization occurs after all cinema CRUD operations (`POST`, `PUT`, `DELETE`), so manual sync is rarely needed unless the JSON file was modified externally or becomes out of sync.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "message": "Synced 3 cinema(s) to JSON file"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/cinemas/sync
```

---

## Films

### List All Films

```http
GET /api/films
```

**Response:**
```json
{
  "success": true,
  "data": {
    "films": [
      {
        "id": 123456,
        "title": "Film Title",
        "original_title": "Original Title",
        "poster_url": "https://...",
        "duration_minutes": 120,
        "release_date": "2024-01-15",
        "genres": ["Drama"],
        "nationality": "France",
        "director": "Director Name"
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films
```

---

### Get Film Details

```http
GET /api/films/:id
```

**Parameters:**
- `id` (integer): Film ID from the source website

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123456,
    "title": "Film Title",
    "original_title": "Original Title",
    "poster_url": "https://...",
    "duration_minutes": 120,
    "release_date": "2024-01-15",
    "rerelease_date": null,
    "genres": ["Drama", "Thriller"],
    "nationality": "France",
    "director": "Director Name",
    "actors": ["Actor 1", "Actor 2"],
    "synopsis": "Full synopsis text...",
    "certificate": "TP",
    "press_rating": 4.2,
    "audience_rating": 3.8,
    "source_url": "https://www.example-cinema-site.com/film/fichefilm_gen_cfilm=123456.html",
    "cinemas": [
      {
        "id": "W7504",
        "name": "Épée de Bois",
        "address": "100 Rue Mouffetard",
        "postal_code": "75005",
        "city": "Paris",
        "screen_count": 1,
        "image_url": "https://...",
        "showtimes": [
          {
            "id": "W7504-123456-2024-02-15-14:00",
            "date": "2024-02-15",
            "time": "14:00",
            "datetime_iso": "2024-02-15T14:00:00+01:00",
            "version": "VF",
            "format": "2D",
            "experiences": []
          }
        ]
      }
    ]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films/123456
```

---

### Search Films

```http
GET /api/films/search?q={query}
```

Search for films using fuzzy matching with PostgreSQL trigram similarity. Returns up to 10 results matching the query string.

**Query Parameters:**
- `q` (string, required): Search query (minimum 2 characters)

**Search Behavior:**
- Uses multi-strategy hybrid search combining:
  1. **Exact match** (highest priority): `title = query` or `original_title = query`
  2. **Prefix match**: Title starts with query (e.g., "Mar" → "Marty")
  3. **Trigram similarity** (very permissive, similarity > 0.1): Handles typos and variations
  4. **Partial match** (case-insensitive ILIKE `%query%`): Contains query anywhere
  5. **Original title search**: All strategies applied to `original_title` as well
- Results ordered by relevance using weighted scoring:
  - Exact match: 1.0 (highest)
  - Starts with query: 0.9
  - High trigram similarity (>0.3): 0.6-0.8
  - Low trigram similarity (>0.1): 0.5-0.6 (very permissive!)
  - Contains anywhere: 0.35-0.4
- **Very permissive**: Accepts false positives for maximum coverage (e.g., "mer" finds "Marty", "La Mer", "Merlin")
- Returns up to 10 results

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 123456,
      "title": "The Matrix",
      "original_title": "The Matrix",
      "poster_url": "https://...",
      "duration_minutes": 136,
      "release_date": "1999-06-23",
      "genres": ["Sci-Fi", "Action"],
      "nationality": "USA",
      "director": "Wachowski Brothers"
    }
  ]
}
```

**Error Responses:**
- `400` — Missing or invalid query parameter (e.g., query too short)

**Examples:**
```bash
# Exact match
curl "http://localhost:3000/api/films/search?q=Matrix"

# Fuzzy match (typo)
curl "http://localhost:3000/api/films/search?q=Matirx"

# Partial match
curl "http://localhost:3000/api/films/search?q=Matr"

# Very permissive search (accepts variations)
curl "http://localhost:3000/api/films/search?q=mer"
# → Finds "Marty", "La Mer", "Merlin", etc.

# Original title search
curl "http://localhost:3000/api/films/search?q=The%20Matrix"
# → Finds films with original_title="The Matrix"

# URL-encoded query (with spaces)
curl "http://localhost:3000/api/films/search?q=The%20Dark%20Knight"
```

---

## Authentication Endpoints

### User Login

```http
POST /api/auth/login
```

**Description:** Authenticate a user and receive a JWT token for accessing protected endpoints.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

**Response (401 — invalid credentials):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Response (400 — missing fields):**
```json
{
  "success": false,
  "error": "Username and password are required"
}
```

**Example:**
```bash
# Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Use token for protected endpoints
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN"
```

**Note:** The default admin account is created automatically on first database initialization with username `admin` and password `admin`. **Change this password in production.**

---

### Register New User

```http
POST /api/auth/register
```

**Description:** Create a new user account. This endpoint can be disabled or protected in production environments.

**Request Body:**
```json
{
  "username": "newuser",
  "password": "securepassword"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": 2,
      "username": "newuser"
    }
  }
}
```

**Response (409 — username exists):**
```json
{
  "success": false,
  "error": "Username already exists"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"securepass123"}'
```

---

### Change Password

```http
POST /api/auth/change-password
```

**Authentication:** Required (Bearer token)

**Description:** Change the password for the currently authenticated user. Requires the current password for verification.

**Request Body:**
```json
{
  "currentPassword": "current_password",
  "newPassword": "new_secure_password"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  }
}
```

**Response (401 — invalid current password):**
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

**Response (400 — missing fields):**
```json
{
  "success": false,
  "error": "Current password and new password are required"
}
```

**Response (401 — unauthorized, no token):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Example:**
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Change password
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin","newPassword":"NewSecurePass123!"}'

# Verify new password works (should succeed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewSecurePass123!"}'
```

**Security Notes:**
- Requires valid JWT token (must be logged in)
- Current password must be provided (prevents unauthorized password changes if session is hijacked)
- Failed password change attempts count toward rate limiting
- Password is hashed with bcrypt before storage (never stored in plaintext)

---

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

## Settings Management

The Settings API provides complete white-label branding customization for the application. Configure site name, logo, colors, fonts, footer, and email branding through a comprehensive admin interface.

### Get Public Settings

```http
GET /api/settings
```

**Authentication:** None (public endpoint)

**Description:** Returns public settings used for theme application in the frontend. Does not include admin-only fields like `updated_by`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,iVBORw0KG...",
    "favicon_base64": "data:image/x-icon;base64,AAABA...",
    "color_primary": "#FECC00",
    "color_secondary": "#1F2937",
    "color_accent": "#3B82F6",
    "color_background": "#F9FAFB",
    "color_surface": "#FFFFFF",
    "color_text_primary": "#111827",
    "color_text_secondary": "#6B7280",
    "color_success": "#10B981",
    "color_error": "#EF4444",
    "font_primary": "Inter",
    "font_secondary": "Roboto",
    "footer_text": "Cinema schedules updated weekly",
    "footer_copyright": "{site_name} © {year}",
    "footer_links": [
      {"label": "Privacy Policy", "url": "https://example.com/privacy"},
      {"label": "Contact", "url": "https://example.com/contact"}
    ],
    "email_from_name": "My Cinema Portal",
    "email_from_address": "noreply@example.com",
    "email_header_color": "#FECC00",
    "email_footer_text": "You received this email from My Cinema Portal"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/settings
```

---

### Get Admin Settings

```http
GET /api/settings/admin
```

**Authentication:** Required (Admin role only)

**Description:** Returns full settings including admin-only fields like `updated_by` and `updated_at`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,iVBORw0KG...",
    "favicon_base64": "data:image/x-icon;base64,AAABA...",
    "color_primary": "#FECC00",
    "color_secondary": "#1F2937",
    "color_accent": "#3B82F6",
    "color_background": "#F9FAFB",
    "color_surface": "#FFFFFF",
    "color_text_primary": "#111827",
    "color_text_secondary": "#6B7280",
    "color_success": "#10B981",
    "color_error": "#EF4444",
    "font_primary": "Inter",
    "font_secondary": "Roboto",
    "footer_text": "Cinema schedules updated weekly",
    "footer_copyright": "{site_name} © {year}",
    "footer_links": [
      {"label": "Privacy Policy", "url": "https://example.com/privacy"}
    ],
    "email_from_name": "My Cinema Portal",
    "email_from_address": "noreply@example.com",
    "email_header_color": "#FECC00",
    "email_footer_text": "You received this email from My Cinema Portal",
    "updated_at": "2026-03-01T14:30:00.000Z",
    "updated_by": 1
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get admin settings
curl http://localhost:3000/api/settings/admin \
  -H "Authorization: Bearer $TOKEN"
```

---

### Update Settings

```http
PUT /api/settings
```

**Authentication:** Required (Admin role only)

**Description:** Update application settings. All fields are optional; only provided fields will be updated.

**Request Body:**
```json
{
  "site_name": "My Cinema Portal",
  "color_primary": "#FF5733",
  "font_primary": "Montserrat",
  "footer_text": "Updated footer text with {site_name} and {year} placeholders",
  "footer_links": [
    {"label": "Privacy", "url": "https://example.com/privacy"},
    {"label": "Terms", "url": "https://example.com/terms"}
  ]
}
```

**Validation Rules:**
- **Colors**: Must be valid hex codes (e.g., `#FECC00` or `#FFF`)
- **Images**: Must be valid base64 data URLs
  - Logo: Max 200KB, formats: PNG/JPG/SVG, min 100x100px
  - Favicon: Max 50KB, formats: ICO/PNG, 32x32 or 64x64px
- **Footer links**: Array of `{label: string, url: string}` objects
- **Fonts**: String values (Google Fonts or system fonts)

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "site_name": "My Cinema Portal",
    "color_primary": "#FF5733",
    "updated_at": "2026-03-01T15:00:00.000Z"
  }
}
```

**Response (400 — validation error):**
```json
{
  "success": false,
  "error": "Invalid color format for color_primary: must be hex code"
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Update settings
curl -X PUT http://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "My Cinema Portal",
    "color_primary": "#FF5733",
    "font_primary": "Montserrat"
  }'
```

---

### Reset Settings to Defaults

```http
POST /api/settings/reset
```

**Authentication:** Required (Admin role only)

**Description:** Reset all settings to default values (original Allo-Scrapper branding).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Settings reset to defaults",
    "settings": {
      "site_name": "Allo-Scrapper",
      "color_primary": "#FECC00",
      "color_secondary": "#1F2937"
    }
  }
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Reset settings
curl -X POST http://localhost:3000/api/settings/reset \
  -H "Authorization: Bearer $TOKEN"
```

---

### Export Settings

```http
GET /api/settings/export
```

**Authentication:** Required (Admin role only)

**Description:** Export all settings as a JSON file for backup or migration purposes.

**Response (200):**
```json
{
  "version": "1.0",
  "exported_at": "2026-03-01T15:30:00.000Z",
  "settings": {
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,...",
    "color_primary": "#FECC00",
    "footer_links": [...]
  }
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Export settings to file
curl http://localhost:3000/api/settings/export \
  -H "Authorization: Bearer $TOKEN" \
  -o settings-backup.json
```

---

### Import Settings

```http
POST /api/settings/import
```

**Authentication:** Required (Admin role only)

**Description:** Import settings from a previously exported JSON file. Validates the structure before applying.

**Request Body:**
```json
{
  "version": "1.0",
  "exported_at": "2026-03-01T15:30:00.000Z",
  "settings": {
    "site_name": "My Cinema Portal",
    "color_primary": "#FECC00"
  }
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Settings imported successfully",
    "applied_fields": ["site_name", "color_primary", "font_primary"]
  }
}
```

**Response (400 — invalid format):**
```json
{
  "success": false,
  "error": "Invalid import format: missing version field"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Import settings from file
curl -X POST http://localhost:3000/api/settings/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @settings-backup.json
```

---

### Get Dynamic Theme CSS

```http
GET /api/theme.css
```

**Authentication:** None (public endpoint)

**Description:** Returns dynamically generated CSS based on current settings. Includes CSS custom properties, Google Fonts imports, and theme variables. Response is cached with ETag for performance.

**Response (200):**
```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&display=swap');

/* CSS Custom Properties */
:root {
  --color-primary: #FECC00;
  --color-secondary: #1F2937;
  --color-accent: #3B82F6;
  --color-background: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-success: #10B981;
  --color-error: #EF4444;
  --font-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --font-secondary: 'Roboto', system-ui, -apple-system, sans-serif;
}

body {
  font-family: var(--font-primary);
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-secondary);
}
```

**Response Headers:**
- `Content-Type: text/css`
- `Cache-Control: public, max-age=3600` (1 hour cache)
- `ETag: "w/hash-of-settings"` (conditional caching)

**Example:**
```bash
# Fetch theme CSS
curl http://localhost:3000/api/theme.css

# Include in HTML
<link rel="stylesheet" href="http://localhost:3000/api/theme.css">
```

**Usage in Frontend:**
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Load dynamic theme -->
  <link rel="stylesheet" href="/api/theme.css">
  
  <!-- Your app styles -->
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <!-- Theme variables are available via var(--color-primary), etc. -->
</body>
</html>
```

---

## User Management

The User Management API enables administrators to manage user accounts and roles. All endpoints require admin authentication.

### List All Users

```http
GET /api/users
```

**Authentication:** Required (Admin role only)

**Query Parameters:**
- `page` (optional, integer): Page number (default: `1`)
- `pageSize` (optional, integer): Users per page (default: `20`, max: `100`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "created_at": "2026-01-15T10:00:00.000Z"
      },
      {
        "id": 2,
        "username": "viewer",
        "role": "user",
        "created_at": "2026-02-01T14:30:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# List users
curl "http://localhost:3000/api/users?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get User by ID

```http
GET /api/users/:id
```

**Authentication:** Required (Admin role only)

**Parameters:**
- `id` (integer): User ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "viewer",
    "role": "user",
    "created_at": "2026-02-01T14:30:00.000Z"
  }
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get user by ID
curl http://localhost:3000/api/users/2 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Create New User

```http
POST /api/users
```

**Authentication:** Required (Admin role only)

**Description:** Create a new user account with specified role.

**Request Body:**
```json
{
  "username": "newuser",
  "password": "SecurePass123!",
  "role": "user"
}
```

**Validation Rules:**
- **Username**: 3-50 characters, alphanumeric + underscore/hyphen, unique
- **Password**: Minimum 8 characters (hashed with bcrypt)
- **Role**: Must be either `"admin"` or `"user"`

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "username": "newuser",
      "role": "user",
      "created_at": "2026-03-01T16:00:00.000Z"
    },
    "message": "User created successfully"
  }
}
```

**Response (409 — username exists):**
```json
{
  "success": false,
  "error": "Username already exists"
}
```

**Response (400 — validation error):**
```json
{
  "success": false,
  "error": "Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "SecurePass123!",
    "role": "user"
  }'
```

---

### Update User Role

```http
PUT /api/users/:id/role
```

**Authentication:** Required (Admin role only)

**Description:** Change a user's role between `admin` and `user`. Safety guards prevent demoting the last admin.

**Parameters:**
- `id` (integer): User ID

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "viewer",
      "role": "admin"
    },
    "message": "User role updated successfully"
  }
}
```

**Response (400 — cannot demote last admin):**
```json
{
  "success": false,
  "error": "Cannot change role: at least one admin user must remain"
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Promote user to admin
curl -X PUT http://localhost:3000/api/users/2/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

### Reset User Password

```http
POST /api/users/:id/reset-password
```

**Authentication:** Required (Admin role only)

**Description:** Generate a new secure random password for a user. Returns the plaintext password (only shown once).

**Parameters:**
- `id` (integer): User ID

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully",
    "new_password": "Xy9mK2pQr4sT"
  }
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Security Note:** The new password is only returned in this response and is not stored in plaintext. Communicate it securely to the user.

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Reset password
curl -X POST http://localhost:3000/api/users/2/reset-password \
  -H "Authorization: Bearer $TOKEN"

# Response includes new password:
# {"success":true,"data":{"message":"Password reset successfully","new_password":"Xy9mK2pQr4sT"}}
```

---

### Delete User

```http
DELETE /api/users/:id
```

**Authentication:** Required (Admin role only)

**Description:** Delete a user account. Safety guards prevent:
- Deleting the last admin user
- Deleting your own account (self-deletion)

**Parameters:**
- `id` (integer): User ID

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  }
}
```

**Response (400 — cannot delete last admin):**
```json
{
  "success": false,
  "error": "Cannot delete the last admin user"
}
```

**Response (400 — cannot self-delete):**
```json
{
  "success": false,
  "error": "Cannot delete your own account"
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Delete user
curl -X DELETE http://localhost:3000/api/users/3 \
  -H "Authorization: Bearer $TOKEN"
```

---

## System Information

Monitor application health, server metrics, database statistics, and migration status.

**Base Route**: `/api/system/*`  
**Authentication**: Required (admin role only)  
**Rate Limit**: 100 requests per 15 minutes

All system endpoints require admin authentication via JWT token.

---

### GET /api/system/info

Get comprehensive system information including app version, server health, and database statistics.

**Authentication**: Required (admin only)

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "app": {
      "version": "1.0.0",
      "buildDate": "2026-03-01T16:20:05.310Z",
      "environment": "production",
      "nodeVersion": "v20.20.0"
    },
    "server": {
      "uptime": 16.906572842,
      "memoryUsage": {
        "heapUsed": "41.86 MB",
        "heapTotal": "47.00 MB",
        "rss": "115.09 MB"
      },
      "platform": "linux",
      "arch": "arm64"
    },
    "database": {
      "size": "8063 kB",
      "tables": 8,
      "cinemas": 24,
      "films": 0,
      "showtimes": 0
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `app.version` | string | Semantic version from package.json |
| `app.buildDate` | string | ISO timestamp when app was built |
| `app.environment` | string | `production`, `development`, or `staging` |
| `app.nodeVersion` | string | Node.js runtime version |
| `server.uptime` | number | Seconds since server started |
| `server.memoryUsage.heapUsed` | string | JavaScript heap memory in use (MB) |
| `server.memoryUsage.heapTotal` | string | Total heap allocated (MB) |
| `server.memoryUsage.rss` | string | Resident Set Size - total memory (MB) |
| `server.platform` | string | Operating system (`linux`, `darwin`, `win32`) |
| `server.arch` | string | CPU architecture (`arm64`, `x64`) |
| `database.size` | string | Total database size |
| `database.tables` | number | Number of database tables |
| `database.cinemas` | number | Count of cinema records |
| `database.films` | number | Count of film records |
| `database.showtimes` | number | Count of showtime records |

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get system info
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/system/info | jq .
```

---

### GET /api/system/migrations

Get database migration status including applied and pending migrations.

**Authentication**: Required (admin only)

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "applied": [
      {
        "version": "001_neutralize_references.sql",
        "appliedAt": "2026-03-01T14:44:35.770Z",
        "status": "applied"
      },
      {
        "version": "002_add_pg_trgm_extension.sql",
        "appliedAt": "2026-03-01T14:44:35.772Z",
        "status": "applied"
      }
    ],
    "pending": [],
    "total": 7
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `applied` | array | List of applied migrations |
| `applied[].version` | string | Migration filename |
| `applied[].appliedAt` | string | ISO timestamp when migration was applied |
| `applied[].status` | string | Always `"applied"` for applied migrations |
| `pending` | array | List of pending migrations (filenames) |
| `total` | number | Total count of migrations (applied + pending) |

**Migration Naming Convention:**
- Format: `NNN_description.sql`
- Example: `003_add_users_table.sql`

**Use Cases:**
- Verify all migrations applied after deployment
- Detect pending migrations before backup
- Audit migration history

**Example:**
```bash
# Get migration status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/system/migrations | jq .

# Check for pending migrations
PENDING=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/system/migrations | jq '.data.pending | length')
if [ "$PENDING" -gt 0 ]; then
  echo "Warning: $PENDING pending migrations"
fi
```

---

### GET /api/system/health

Get health check status with component-level checks.

**Authentication**: Required (admin only)

**Response (200 — healthy):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "database": true,
      "migrations": true
    },
    "scrapers": {
      "activeJobs": 0,
      "lastScrapeTime": null,
      "totalCinemas": 24
    },
    "uptime": 11.916256922
  }
}
```

**Response (200 — degraded):**
```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "checks": {
      "database": true,
      "migrations": false
    },
    "scrapers": {
      "activeJobs": 0,
      "lastScrapeTime": null,
      "totalCinemas": 24
    },
    "uptime": 45.123456789
  }
}
```

**Response (500 — error):**
```json
{
  "success": false,
  "error": "Failed to check system health"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall health: `healthy`, `degraded`, or `error` |
| `checks.database` | boolean | Database connection and query test |
| `checks.migrations` | boolean | All migrations applied (no pending) |
| `scrapers.activeJobs` | number | Count of active scraping jobs |
| `scrapers.lastScrapeTime` | string \| null | ISO timestamp of last completed scrape |
| `scrapers.totalCinemas` | number | Total configured cinemas |
| `uptime` | number | Server uptime in seconds |

**Health Status Logic:**
- **healthy**: All checks pass (`database: true`, `migrations: true`)
- **degraded**: Some checks fail (e.g., pending migrations exist)
- **error**: Critical failure (returned as 500 status code)

**Use Cases:**
- Load balancer health checks
- Monitoring/alerting systems
- Pre-deployment verification

**Example:**
```bash
# Simple health check
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/system/health | jq '.data.status'

# Full health monitoring
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/system/health | jq '{
    status: .data.status,
    database: .data.checks.database,
    migrations: .data.checks.migrations,
    activeJobs: .data.scrapers.activeJobs
  }'
```

---

## Related Documentation


- [Setup Guide](./SETUP.md) - Environment variables and configuration
- [Database Schema](./DATABASE.md) - Data models and relationships
- [Troubleshooting](./TROUBLESHOOTING.md) - Common API issues and solutions
- [Scraper Configuration](./SCRAPER.md) - Cinema management and scraping behavior

---

[← Back to README](./README.md)
