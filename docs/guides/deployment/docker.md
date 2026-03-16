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
- [Docker Compose Profiles](#docker-compose-profiles)
- [Volume Management](#volume-management)
- [Container Management](#container-management)
- [Health Checks](#health-checks)
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

The `./server/src/config:/app/dist/config` bind mount allows cinema configuration changes made via the API (admin panel) to be immediately visible on the host filesystem. This enables version control of cinema configuration:

```bash
git add server/src/config/cinemas.json
git commit -m "chore: update cinema configuration"
git push
```

**Important:** This bind mount ensures that when cinemas are added/modified through the admin UI, the changes persist on the host and can be committed to version control.

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

> See [Monitoring](./monitoring.md) for full observability setup instructions.

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

See [Monitoring](./monitoring.md) for complete setup.

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
- `./server/src/config:/app/dist/config` - Bind mount for cinema configuration (enables git commits of API changes)

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

### Token Expiry Management

All three Docker Compose files (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.build.yml`) forward the `JWT_EXPIRES_IN` environment variable from your `.env` file to the application containers.

**Configuration in `.env`:**
```env
JWT_EXPIRES_IN=24h  # Default: 24 hours
```

**Docker Compose behavior:**
```yaml
# In all compose files
services:
  ics-web:
    environment:
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-24h}
```

The `:-24h` syntax provides a fallback default of 24 hours if `JWT_EXPIRES_IN` is not set in your `.env` file.

### Common Configurations

**Production (Recommended):**
```env
JWT_EXPIRES_IN=24h  # Re-authenticate once per day
```

**Long Sessions (Internal Tools):**
```env
JWT_EXPIRES_IN=7d   # Re-authenticate once per week
```

**High Security (Public Apps):**
```env
JWT_EXPIRES_IN=1h   # Re-authenticate every hour
```

**Development:**
```env
JWT_EXPIRES_IN=24h  # Avoid frequent re-logins during development
```

### Applying Changes

After modifying `JWT_EXPIRES_IN` in your `.env` file:

```bash
# Restart containers to pick up new environment variable
docker compose restart ics-web

# Or recreate containers (forces environment reload)
docker compose up -d --force-recreate ics-web
```

**Important:** 
- Existing JWT tokens remain valid until their original expiry time
- Only newly issued tokens (new logins) use the updated `JWT_EXPIRES_IN` value
- Users with active sessions must re-login to be affected by the new expiry duration

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
- `ics-web`: `GET /api/health` (HTTP 200)
- `ics-db`: `pg_isready -U postgres`
- `ics-redis`: `redis-cli ping`
- `ics-scraper`: Metrics endpoint (port 9091)

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
