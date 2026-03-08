# Health Check API

## Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "name": "Allo-Scrapper"
}
```

**Response Fields:**
- `status` - Always `"ok"` when service is healthy
- `timestamp` - Current server time in ISO 8601 format
- `name` - Application name from `APP_NAME` environment variable

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

[← Back to API Reference](./README.md)
