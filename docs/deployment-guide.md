# Deployment Guide — allo-scrapper

> Last updated: 2026-05-31

## Docker Deployment (Recommended)

### Prerequisites
- Docker Engine 24+
- Docker Compose v2
- Git

### Production docker-compose.yaml

The main compose file (`docker-compose.yaml`) includes all services (DB, Redis, web, scraper consumer, scraper cron). Only 5 environment variables are needed — everything else is hardcoded.

```yaml
# Key services in docker-compose.yaml:
# - ics-db (PostgreSQL 15)
# - ics-redis (Redis 7)
# - ics-web (API + frontend, port 3000)
# - ics-scraper (job consumer)
# - ics-scraper-cron (scheduled scraper)
```

### Deployment Steps

```bash
# 1. Clone and configure
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
cp .env.example .env
# Set POSTGRES_PASSWORD and JWT_SECRET in .env

# 2. Start services (DB auto-migrates on first startup)
docker compose up -d

# 3. Verify health
curl http://localhost:3000/api/health
```

### With Monitoring

```bash
cp .env.monitoring.example .env.monitoring
docker compose --env-file .env --env-file .env.monitoring \
  -f docker-compose.yaml -f docker-compose.monitoring.yml up -d
```

## Environment Variables for Production

Only 5 variables in `.env`:

| Variable | Purpose |
|----------|---------|
| `IMAGE_TAG` | Docker image tag (`stable`, `latest`, or version) |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `SCRAPE_CRON_SCHEDULE` | Cron expression for auto-scraping |

All other config (NODE_ENV, PORT, POSTGRES_HOST, TZ, etc.) is hardcoded in `docker-compose.yaml`.

## CI/CD Pipeline

GitHub Actions workflows:
- **Docker Build** — Builds and pushes images on merge to main
- **Version Tag** — Auto-versioning based on PR labels
- **Tests** — Vitest + Playwright on every PR

## Health Checks

| Service | Endpoint |
|---------|----------|
| Web | `GET /api/health` |
| PostgreSQL | `pg_isready` (internal) |
| Redis | `redis-cli ping` (internal) |

## Backup & Restore

```bash
# Backup PostgreSQL
docker compose exec ics-db pg_dump -U postgres ics > backup.sql

# Restore
docker compose exec -T ics-db psql -U postgres ics < backup.sql
```

## Monitoring

- **Metrics:** Prometheus → Grafana (port 3001)
- **Logs:** Promtail → Loki → Grafana
- **Traces:** OpenTelemetry → Tempo → Grafana
- **Health:** Docker health checks on all services

See [Monitoring Guide](guides/deployment/monitoring.md) for setup.

## Scaling

- **Web:** Horizontal scaling via load balancer (stateless)
- **Scraper:** Single instance (rate-limited, stateful browser)
- **Redis:** Single instance (sufficient for job queue)
- **PostgreSQL:** Connection pooling via PgBouncer for high load
