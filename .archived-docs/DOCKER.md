# 🐳 Docker Deployment Guide

[← Back to README](./README.md)

Complete guide for Docker deployment and containerization.

**Related Documentation:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [Setup Guide](./SETUP.md) - Development environment
- [Monitoring](./MONITORING.md) - Observability stack

---

## Table of Contents

- [Docker Image Optimization](#docker-image-optimization)
- [Using Pre-built Images](#using-pre-built-images)
- [Development Mode](#development-mode)
- [Production Mode](#production-mode)
- [Building Images Locally](#building-images-locally)
- [Deployment Scripts](#deployment-scripts)
- [Docker Compose Profiles](#docker-compose-profiles)

---

## Docker Image Optimization

### Current Image Size

**1.19 GB** (optimized from 1.58 GB - **24.6% reduction, -390 MB**)

The Docker image has been aggressively optimized for production deployment:

| Technique | Savings | Description |
|-----------|---------|-------------|
| Playwright install as user | -271 MB | Install browsers as nodejs user to avoid chown duplicate layer |
| npm cache cleanup | -2-5 MB | Aggressive cache cleaning in all stages |
| Source maps disabled | -1-2 MB | No .map files in production build |
| Playwright cleanup | -5-10 MB | Clean /tmp and caches after browser install |
| Build artifacts removal | -1-2 MB | Remove .d.ts, .map, test files |

### Build Optimizations

**Frontend Builder:**
- npm cache cleaned
- Vite build without source maps
- node_modules cache removed

**Backend Builder:**
- npm cache cleaned
- Source maps removed in builder stage
- Reduced data transfer

**Production Stage:**
- Playwright system deps installed as root
- Then browsers installed as nodejs user (eliminates chown duplicate)
- --only-shell chromium for minimal browser footprint

**Key Innovation:** The largest optimization comes from installing Playwright browsers AS the nodejs user instead of as root and then using `chown -R`. The chown command would create a 271 MB duplicate layer containing copies of all the browser files.

### Image Analysis

```bash
# View layer sizes
docker history allo-scrapper-ics-web:latest --human | head -20

# Verify no source maps in production
docker run --rm allo-scrapper-ics-web find /app -name "*.map"
# (should return nothing)
```

---

## Using Pre-built Images

The application is automatically built and published to GitHub Container Registry on every release.

### Platform Support

Docker images are built for **linux/amd64** only. ARM64 (Apple Silicon, Raspberry Pi) is not supported via pre-built images due to QEMU emulation instability during `npm ci` on GitHub Actions runners. 

**If you need to run on ARM64**, build the image locally on your ARM64 machine:

```bash
docker build -t allo-scrapper .
```

### Available Images

> **v1.1.0+ tag strategy:**
> - **`:stable`** — production-ready builds from `main` branch and version tags. Use this in production.
> - **`:latest`** — continuous development builds from `develop`. May be unstable.
>
> If you used `:latest` for production in v1.0.0, switch to `:stable`. See [Migration Guide](#migration-guide-v100--v110).

- `ghcr.io/phbassin/allo-scrapper:stable` - Latest production-ready release (main branch) **[recommended for production]**
- `ghcr.io/phbassin/allo-scrapper:latest` - Latest development build (develop branch)
- `ghcr.io/phbassin/allo-scrapper:v1.1.0` - Specific version
- `ghcr.io/phbassin/allo-scrapper:main` - Latest commit on main branch
- `ghcr.io/phbassin/allo-scrapper:develop` - Latest commit on develop branch

### Migration Guide: v1.0.0 → v1.1.0

The Docker tag `:latest` now explicitly tracks the `develop` branch (continuous development). For production deployments, use `:stable` instead:

```yaml
# Before (v1.0.0) — production
image: ghcr.io/phbassin/allo-scrapper:latest

# After (v1.1.0+) — production
image: ghcr.io/phbassin/allo-scrapper:stable

# After (v1.1.0+) — bleeding edge / development
image: ghcr.io/phbassin/allo-scrapper:latest
```

No API, schema, or configuration changes are required. Only the Docker tag needs to be updated.

### Quick Deployment

```bash
# Pull and start services (uses docker-compose.yml)
docker compose pull
docker compose up -d

# View available image tags
docker images | grep allo-scrapper
```

### Using Specific Versions

Edit your `.env` file or `docker-compose.yml` to specify a version:

```yaml
services:
  ics-web:
    image: ghcr.io/phbassin/allo-scrapper:v1.0.0  # Pin to specific version
```

### Authentication for Private Repositories

If the repository is private, authenticate with GitHub Container Registry:

```bash
# Create a Personal Access Token (PAT) with read:packages scope
# Then login:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull the image
docker pull ghcr.io/phbassin/allo-scrapper:latest
```

---

## Development Mode

Uses `docker-compose.dev.yml` with hot-reload and separate frontend dev server:

```bash
npm run dev
```

**Services:**
- `db`: PostgreSQL 15
- `server`: Express API with nodemon (port 3000)
- `client`: Vite dev server (port 5173)

**Features:**
- Hot-reload for both server and client
- Separate Vite dev server with HMR
- Source maps enabled
- Volume mounts for code changes

**Stop services:**
```bash
npm run dev:down
```

---

## Production Mode

Uses `docker-compose.yml` with pre-built images from GitHub Container Registry:

```bash
# Base stack (app + DB + Redis)
docker compose up -d

# With scraper microservice
docker compose --profile scraper up -d

# With full observability stack (Prometheus, Grafana, Loki, Tempo)
docker compose --profile monitoring up -d

# Everything
docker compose --profile monitoring --profile scraper up -d
```

**Base services (`docker compose up -d`):**
- `ics-db`: PostgreSQL 15 with volume persistence
- `ics-redis`: Redis 7 (message queue + pub/sub)
- `ics-web`: Combined API + static frontend (port 3000)

**`--profile scraper` adds:**
- `ics-scraper`: Scraper microservice (job consumer)
- `ics-scraper-cron`: Cron-triggered scraper

**`--profile monitoring` adds:**
- `ics-prometheus`: Metrics (port 9090)
- `ics-grafana`: Dashboards (port 3001, default admin/admin)
- `ics-loki` + `ics-promtail`: Log aggregation
- `ics-tempo`: Distributed tracing (OTLP port 4317)
- `ics-postgres-exporter`, `ics-redis-exporter`: DB/Redis metrics

> See [MONITORING.md](./MONITORING.md) for full observability setup instructions.

---

## Docker Compose Profiles

### Base Stack (No Profiles)

```bash
docker compose up -d
```

**Services:**
- `ics-db` - PostgreSQL database
- `ics-redis` - Redis (job queue + pub/sub)
- `ics-web` - API + frontend (in-process scraper mode)

**Ports:**
- 3000 - Web application
- 5432 - PostgreSQL (localhost only)
- 6379 - Redis (localhost only)

---

### Scraper Profile

```bash
docker compose --profile scraper up -d
```

**Adds:**
- `ics-scraper` - Scraper microservice (job consumer)
- `ics-scraper-cron` - Cron-triggered scraper

**Requirements:**
- `USE_REDIS_SCRAPER=true` in `.env`

**Ports:**
- 9091 - Scraper metrics (Prometheus)

**Use Case:**
- Isolate scraping workload from API server
- Enable horizontal scaling (multiple scraper workers)
- Better observability (metrics, tracing)

---

### Monitoring Profile

```bash
docker compose --profile monitoring up -d
```

**Adds:**
- `ics-prometheus` - Metrics collection (port 9090)
- `ics-grafana` - Dashboards (port 3001)
- `ics-loki` - Log aggregation
- `ics-promtail` - Log shipping
- `ics-tempo` - Distributed tracing (OTLP port 4317)
- `ics-postgres-exporter` - PostgreSQL metrics
- `ics-redis-exporter` - Redis metrics

**Ports:**
- 9090 - Prometheus UI
- 3001 - Grafana UI (admin/admin)
- 3200 - Tempo UI
- 3100 - Loki API

**Use Case:**
- Production monitoring and observability
- Performance analysis
- Debugging distributed traces

See [MONITORING.md](./MONITORING.md) for complete setup.

---

## Building Images Locally

If you prefer to build from source instead of using pre-built images:

```bash
# Build locally using docker-compose.build.yml
docker compose -f docker-compose.build.yml up --build -d

# Or build manually
npm run docker:build

# Build with custom tag
docker build -t allo-scrapper:v1.0.0 .

# Multi-platform build (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t allo-scrapper:latest .
```

### Build Arguments

```bash
# Build with specific Node version
docker build --build-arg NODE_VERSION=20.11 -t allo-scrapper .

# Build without Playwright (smaller image, no E2E tests)
docker build --build-arg INSTALL_PLAYWRIGHT=false -t allo-scrapper .
```

---

## Deployment Scripts

### Pull and Deploy

```bash
./scripts/pull-and-deploy.sh
```

**What it does:**
1. Pulls latest image from GitHub Container Registry
2. Stops running containers
3. Starts containers with new image
4. Shows logs

---

### Backup Database

```bash
./scripts/backup-db.sh
```

**What it does:**
1. Creates timestamped SQL dump in `backups/` directory
2. Retains last 7 days of backups
3. Compresses backups with gzip

**Backup location:**
```
backups/
├── backup-2024-02-15-103045.sql.gz
├── backup-2024-02-16-083012.sql.gz
└── ...
```

---

### Restore Database

```bash
./scripts/restore-db.sh backups/backup-2024-02-15-103045.sql.gz
```

**What it does:**
1. Asks for confirmation (destructive operation)
2. Stops application
3. Drops and recreates database
4. Restores from backup
5. Restarts application

**⚠️ Warning:** This is a destructive operation. All current data will be lost.

---

## Docker Compose Files

### docker-compose.yml (Production)

- Uses pre-built images from GHCR
- Includes base services (db, redis, web)
- Supports `--profile scraper` and `--profile monitoring`
- Optimized for production

### docker-compose.dev.yml (Development)

- Local builds with hot-reload
- Separate Vite dev server
- Source maps enabled
- Volume mounts for live code updates

### docker-compose.build.yml (Local Build)

- Builds images from source
- Uses multi-stage builds
- No pre-built images required
- Good for testing Dockerfile changes

---

## Volume Management

### Persistent Volumes

```bash
# List volumes
docker volume ls | grep allo-scrapper

# Inspect volume
docker volume inspect allo-scrapper_postgres-data

# Remove volumes (⚠️ destroys data)
docker compose down -v
```

**Volumes:**
- `postgres-data` - PostgreSQL database (persistent)
- `redis-data` - Redis data (persistent)
- `./server/src/config` - Cinema configuration (bind mount)

### Backup Volumes

```bash
# Backup PostgreSQL volume
docker run --rm \
  -v allo-scrapper_postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-volume-$(date +%Y%m%d).tar.gz -C /data .
```

---

## Container Management

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f ics-web

# Last 100 lines
docker compose logs --tail=100 ics-web

# Since timestamp
docker compose logs --since 2024-02-15T10:00:00 ics-web
```

### Execute Commands

```bash
# Shell in container
docker compose exec ics-web sh

# Run database migration
docker compose exec ics-web npm run db:migrate

# Connect to PostgreSQL
docker compose exec ics-db psql -U postgres -d ics

# Run scraper manually
docker compose exec ics-web node -e "require('./dist/services/scraper').scrapeAllTheaters()"
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart ics-web

# Recreate containers (applies config changes)
docker compose up -d --force-recreate
```

---

## Health Checks

All services include health checks for monitoring:

```bash
# Check service health
docker compose ps

# Inspect health status
docker inspect ics-web | jq '.[0].State.Health'
```

**Health Check Endpoints:**
- `ics-web`: `GET /api/health` (HTTP 200)
- `ics-db`: `pg_isready -U postgres`
- `ics-redis`: `redis-cli ping`
- `ics-scraper`: Metrics endpoint (port 9091)

---

## Troubleshooting Docker

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for:
- Port conflicts
- Database connection issues
- Container startup failures
- Volume permission problems

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [MONITORING.md](./MONITORING.md) - Observability stack
- [Setup Guide](./SETUP.md) - Development setup
- [CI/CD Guide](./CICD.md) - Automated builds
- [Troubleshooting](./TROUBLESHOOTING.md) - Docker issues

---

[← Back to README](./README.md)
