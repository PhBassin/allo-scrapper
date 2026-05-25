# Deployment Guide — allo-scrapper

> Generated: 2026-05-21

## Docker Deployment (Recommended)

### Prerequisites
- Docker Engine 24+
- Docker Compose v2
- PostgreSQL 15+ (external or containerized)
- Redis 7+ (external or containerized)

### Production docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: allo_scrapper
      POSTGRES_USER: allo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped

  server:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://allo:${DB_PASSWORD}@postgres:5432/allo_scrapper
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  scraper:
    build: ./scraper
    environment:
      DATABASE_URL: postgresql://allo:${DB_PASSWORD}@postgres:5432/allo_scrapper
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  client:
    build: ./client
    ports:
      - "80:5173"
    environment:
      VITE_API_URL: http://server:3001
    depends_on:
      - server
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

### Deployment Steps

```bash
# 1. Clone and configure
git clone <repo-url>
cd allo-scrapper
cp .env.example .env
# Edit .env with production values

# 2. Build images
docker compose build

# 3. Start services
docker compose up -d

# 4. Run migrations
docker compose exec server npm run db:migrate

# 5. Verify health
curl http://localhost:3001/api/system/health
curl http://localhost
```

## Environment Variables for Production

| Variable | Purpose |
|----------|---------|
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing secret (use strong random) |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `NODE_ENV` | Set to `production` |

## CI/CD Pipeline

GitHub Actions workflows:
- **Docker Build** — Builds and pushes images on merge to main
- **Version Tag** — Auto-versioning based on PR labels
- **Tests** — Vitest + Playwright on every PR

## Health Checks

| Service | Endpoint |
|---------|----------|
| Server | `GET /api/system/health` |
| Server Ready | `GET /api/system/ready` |
| Client | `GET /` |

## Backup & Restore

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U allo allo_scrapper > backup.sql

# Restore
docker compose exec -T postgres psql -U allo allo_scrapper < backup.sql
```

## Monitoring

- **Logs:** Winston JSON logs → stdout → Docker logs
- **Metrics:** OpenTelemetry → Prometheus endpoint
- **Health:** Docker health checks on all services

## Scaling

- **Server:** Horizontal scaling via load balancer (stateless)
- **Scraper:** Single instance (rate-limited, stateful browser)
- **Client:** CDN for static assets
- **Redis:** Single instance (sufficient for job queue)
- **PostgreSQL:** Connection pooling via PgBouncer for high load
