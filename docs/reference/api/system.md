# System Information API

**Last updated:** March 18, 2026 | Status: Current ✅

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

[← Back to API Reference](./README.md)
