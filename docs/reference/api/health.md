# Health Check API

Public endpoint for load balancers, Docker health checks and uptime monitors. It has its own rate limiter (`healthCheckLimiter`, see [Rate Limiting](./rate-limiting.md)).

Source: `server/src/app.ts`.

## Endpoints

### Health Check

```http
GET /api/health
```

The server checks the database with `SELECT 1` and caches the result for 5 seconds, so frequent probes don't load the database.

**Healthy (200 OK):**

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-11-02T10:30:00.000Z",
  "cached": false
}
```

**Unhealthy (503 Service Unavailable):**

```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "timestamp": "2026-11-02T10:30:00.000Z",
  "cached": false
}
```

**Response fields:**

- `status`: `"healthy"` or `"unhealthy"`
- `database`: `"connected"` or `"disconnected"`
- `timestamp`: current server time, ISO 8601
- `cached`: `true` when the result comes from the 5-second cache

If the server starts without a database connection in its app context, it falls back to `{ "status": "ok", "timestamp": "…", "name": "<APP_NAME>" }`.

**Example:**

```bash
curl -i http://localhost:3000/api/health
```

---

[← Back to API Reference](./README.md)
