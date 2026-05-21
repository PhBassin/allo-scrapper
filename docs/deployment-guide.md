# Deployment Guide — allo-scrapper

## Infrastructure Requirements
- **Docker** + Docker Compose
- **PostgreSQL 15** (or managed: RDS, Cloud SQL)
- **Redis 7** (or managed: ElastiCache, Memorystore)
- **Node.js >=24** (for local dev only)

## Production Deployment (Docker Compose)

```bash
# Pull images or build
docker compose pull
# OR
docker compose build

# Start stack
docker compose up -d

# With monitoring
docker compose --profile monitoring up -d
```

### Services Started
| Service | Port | Description |
|---------|------|-------------|
| ics-db | 5432 (internal) | PostgreSQL 15 |
| ics-redis | 6379 (internal) | Redis 7 |
| ics-web | 3000 | API server + static frontend |
| ics-scraper | — | Scraper consumer (Redis BLPOP) |
| ics-scraper-cron | — | Scraper cron scheduler |

### Monitoring Profile (optional)
| Service | Port | Description |
|---------|------|-------------|
| ics-prometheus | 9090 | Metrics collection |
| ics-loki | 3100 | Log aggregation |
| ics-tempo | 3200 | Distributed tracing |
| ics-grafana | 3001 | Dashboards |

## Environment Configuration
All configuration via `.env` file (see `.env.example`):

### Required
- `JWT_SECRET` — Generate: `openssl rand -base64 64`
- `POSTGRES_PASSWORD` — Database password
- `REDIS_URL` — Default: `redis://ics-redis:6379`

### Optional
- `IMAGE_TAG` — Docker image tag (default: `stable`)
- `TZ` — Timezone (default: `Europe/Paris`)
- `SCRAPE_MODE` — `weekly`, `from_today_limited` (default: `weekly`)
- `SCRAPE_DAYS` — Days to scrape (default: `7`)
- `LOG_LEVEL` — `error`, `warn`, `info`, `debug`

## Health Checks
```bash
# Server health
curl http://localhost:3000/api/health

# Scraper metrics
curl http://localhost:9091/metrics

# Docker health
docker compose ps
```

## CI/CD Pipeline (GitHub Actions)
1. **CI** (`ci.yml`) — Lint, test, build on PR
2. **Docker Build & Push** (`docker-build-push.yml`) — Build on merge to main
3. **Version Tag** (`version-tag.yml`) — Auto version bump + GitHub Release
4. **Sync Main → Develop** (`sync-main-to-develop.yml`) — Merge-back
5. **GHCR Cleanup** (`ghcr-cleanup.yml`) — Remove old images

## Backup & Restore
```bash
# Backup database
./scripts/backup-db.sh

# Export settings
curl -X POST http://localhost:3000/api/settings/export   -H "Authorization: Bearer <admin-token>"

# Restore from settings export
curl -X POST http://localhost:3000/api/settings/import   -H "Content-Type: application/json"   -H "Authorization: Bearer <admin-token>"   -d @settings-export.json
```
