# Docker Setup & Management

Complete guide for Docker deployment, containerization, and optimization.

**Last updated:** March 15, 2026

**Related Guides:**
- [Production Deployment](./production.md) - Full production setup
- [Backup & Restore](./backup-restore.md) - Database backup workflows
- [Monitoring](./monitoring.md) - Observability stack
- [Networking](./networking.md) - LAN access and CORS

---

## Table of Contents

- [Docker Image Optimization](#docker-image-optimization)
- [Using Pre-built Images](#using-pre-built-images)
- [Development Mode](#development-mode)
- [Production Mode](#production-mode)
- [Building Images Locally](#building-images-locally)
- [Volume Management](#volume-management)
- [Container Management](#container-management)
- [Health Checks](#health-checks)
- [JWT Configuration](#jwt-configuration)
- [Docker Compose Files](#docker-compose-files)
- [Troubleshooting](#troubleshooting)

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

### Configuration Volume Mount

The `./server/src/config:/app/dist/config` bind mount allows theater configuration changes made via the API (admin panel) to be immediately visible on the host filesystem. This enables version control of theater configuration:

```bash
git add server/src/config/theaters.json
git commit -m "chore: update theater configuration"
git push
```

**Important:** This bind mount ensures that when theaters are added/modified through the admin UI, the changes persist on the host and can be committed to version control.

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

Docker images are built for **linux/amd64 and linux/arm64** using GitHub's native ARM64 runners (no QEMU emulation). Both the web image and the scraper image support both architectures.

Docker automatically selects the correct variant for your machine when you `docker pull`.

### Available Images

**Web application:**

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

**Scraper microservice:**

- `ghcr.io/phbassin/allo-scrapper-scraper:stable` - Latest production-ready release **[recommended for production]**
- `ghcr.io/phbassin/allo-scrapper-scraper:latest` - Latest development build
- `ghcr.io/phbassin/allo-scrapper-scraper:v1.x.x` - Specific version

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
# Pull and start services (uses docker-compose.yaml)
docker compose pull
docker compose up -d

# View available image tags
docker images | grep allo-scrapper
```

### Using Specific Versions

Edit your `.env` file or `docker-compose.yaml` to specify a version:

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

Uses `docker-compose.yaml` with pre-built images from GitHub Container Registry:

```bash
# Base stack (DB + Redis + Web + Scraper consumer + Cron)
docker compose up -d

# With full observability stack (Prometheus, Grafana, Loki, Tempo)
cp .env.monitoring.example .env.monitoring
docker compose --env-file .env --env-file .env.monitoring \
  -f docker-compose.yaml -f docker-compose.monitoring.yml up -d
```

**Base services (`docker compose up -d`):**
- `ics-db`: PostgreSQL 15 with volume persistence
- `ics-redis`: Redis 7 (message queue + pub/sub)
- `ics-web`: Combined API + static frontend (port 3000)
- `ics-scraper`: Scraper microservice (job consumer)
- `ics-scraper-cron`: Cron-triggered scraper

**`docker-compose.monitoring.yml` adds:**
- `ics-prometheus`: Metrics (port 9090)
- `ics-grafana`: Dashboards (port 3001, default admin/admin)
- `ics-loki` + `ics-promtail`: Log aggregation
- `ics-tempo`: Distributed tracing (OTLP port 4317)
- `ics-postgres-exporter`, `ics-redis-exporter`: data-store metrics

Configure monitoring via `.env.monitoring` (copy from `.env.monitoring.example`).

> See [Monitoring](./monitoring.md) for full observability setup instructions.

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
- `postgres-data` - PostgreSQL database persistence
- `loki-data`, `prometheus-data`, `tempo-data`, `grafana-data` - Monitoring stack data
- `./server/src/config:/app/dist/config` - Bind mount for theater configuration (enables git commits of API changes)

### Backup Volumes

```bash
# List all project volumes
docker volume ls | grep allo-scrapper

# Backup PostgreSQL volume
docker run --rm \
  -v allo-scrapper_postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-volume-$(date +%Y%m%d).tar.gz -C /data .

# Backup monitoring data (optional)
docker run --rm \
  -v allo-scrapper_prometheus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/prometheus-volume-$(date +%Y%m%d).tar.gz -C /data .

# Restore PostgreSQL volume
docker run --rm \
  -v allo-scrapper_postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres-volume-YYYYMMDD.tar.gz -C /data
```

> **Note:** Redis data is not persisted by design. Redis serves as a message queue and pub/sub system, not as persistent storage.

See [Backup & Restore](./backup-restore.md) for complete backup workflows.

---

## JWT Configuration

### Token Expiry

`JWT_EXPIRES_IN` is hardcoded to `1h` in `docker-compose.yaml`. To change it, edit the compose file:

```yaml
services:
  ics-web:
    environment:
      JWT_EXPIRES_IN: 1h   # Change this value
```

### Client Behavior

The React client implements **proactive token expiry handling**:
- When a user logs in, the client decodes the JWT to extract the expiry timestamp
- A `setTimeout` timer is scheduled to fire exactly when the token expires
- When the timer fires, the user is automatically logged out with a "session expired" message
- No failed API requests occur due to expired tokens

This means users see a friendly "Votre session a expiré. Veuillez vous reconnecter." message instead of encountering 401 errors.

### Verification

Check the current JWT expiry configuration:

```bash
# View environment variables in running container
docker compose exec ics-web printenv | grep JWT

# Example output:
# JWT_SECRET=your-secret-here
# JWT_EXPIRES_IN=24h
```

See [Configuration Reference](../../getting-started/configuration.md#jwt_expires_in) for complete JWT configuration options.

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
- `ics-web`: `GET /api/health` (HTTP 200) - API and frontend availability
- `ics-db`: `pg_isready -U postgres` - Database readiness
- `ics-redis`: `redis-cli ping` - Redis availability
- `ics-scraper` & `ics-scraper-cron`: No explicit health check; metrics available at `http://localhost:9091/metrics`

**Note:** The scraper microservices (`ics-scraper` and `ics-scraper-cron`) expose metrics on port 9091 for Prometheus monitoring. The Docker Compose configuration allows them to start as dependencies are met; they will auto-restart if they crash.

---

## Docker Compose Files

### docker-compose.yaml (Production)

- Uses pre-built images from GHCR
- Includes all base services (db, redis, web, scraper consumer, scraper cron)
- Supports the optional monitoring stack via `docker-compose.monitoring.yml`
- Only 5 env vars needed: IMAGE_TAG, POSTGRES_PASSWORD, JWT_SECRET, ALLOWED_ORIGINS, SCRAPE_CRON_SCHEDULE
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

## Troubleshooting

### Port Conflicts

**Problem:** Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

**Problem:** Cannot connect to database

```bash
# Check if database is running
docker compose ps ics-db

# Check database logs
docker compose logs ics-db

# Restart database
docker compose restart ics-db
```

### Container Startup Failures

**Problem:** Container exits immediately

```bash
# Check container logs
docker compose logs ics-web

# Inspect container
docker inspect ics-web

# Check environment variables
docker compose config
```

### Volume Permission Problems

**Problem:** Permission denied errors

```bash
# Fix PostgreSQL data permissions
docker compose down
sudo chown -R 999:999 postgres-data/
docker compose up -d
```

---

## Related Documentation

- [Production Deployment](./production.md) - Complete production setup
- [Backup & Restore](./backup-restore.md) - Database backup workflows
- [Monitoring](./monitoring.md) - Observability stack
- [Networking](./networking.md) - LAN access and CORS
- [../../getting-started/installation.md](../../getting-started/installation.md) - Initial setup

---

[← Back to Deployment Guides](./README.md)
