# Health API

## `GET /api/health`

Public endpoint.

Current behavior:

- checks DB connectivity when the DB handle is available
- caches the result for 5 seconds
- returns `200` when healthy and `503` when unhealthy
- uses a dedicated health limiter

Example healthy response:

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-04-26T20:00:00.000Z",
  "cached": false
}
```

Fallback response shape when DB is unavailable in app context:

```json
{
  "status": "ok",
  "timestamp": "2026-04-26T20:00:00.000Z",
  "name": "Allo-Scrapper"
}
```
