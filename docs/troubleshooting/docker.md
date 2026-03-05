# 🐳 Docker Troubleshooting

Container and Docker Compose troubleshooting for Allo-Scrapper.

**Related Documentation:**
- [Docker Deployment](../guides/deployment/docker.md) - Docker setup guide
- [Production Deployment](../guides/deployment/production.md) - Production configuration
- [Common Issues](./common-issues.md) - General troubleshooting

---

## Table of Contents

- [Container Startup Failures](#container-startup-failures)
- [Port Conflicts](#port-conflicts)
- [Volume Issues](#volume-issues)
- [Health Check Failures](#health-check-failures)
- [Resource Constraints](#resource-constraints)
- [Network Issues](#network-issues)
- [Build Failures](#build-failures)
- [Common Commands](#common-commands)

---

## Container Startup Failures

### Missing `JWT_SECRET` (v2.0.0+)

**Error in logs:**

```
Error: JWT_SECRET environment variable is required
```

**Cause:** Required environment variable missing (breaking change in v2.0.0+).

**Solution:**

```bash
# Add to .env file
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Restart containers
docker compose restart ics-web
```

---

### Container Keeps Restarting

**Symptoms:**
- Container status shows "Restarting"
- Continuous restart loop

**Diagnosis:**

```bash
# Check container status
docker compose ps

# View recent logs
docker compose logs --tail=50 ics-web

# Check exit code
docker inspect ics-web --format='{{.State.ExitCode}}'
```

**Common causes:**
1. **Health check failures** - `/api/health` endpoint not responding
2. **Missing environment variables** - `JWT_SECRET`, `POSTGRES_PASSWORD`
3. **Database not ready** - waiting for `ics-db` to be healthy
4. **Port already in use** - another process using port 3000
5. **Application crash** - check logs for errors

**Solution:**

```bash
# Remove restart policy temporarily to see error
docker compose up ics-web

# Check health check endpoint manually
docker compose exec ics-web wget -qO- http://localhost:3000/api/health
```

---

### Service Dependencies Not Starting

**Cause:** `depends_on: healthy` waiting for database/Redis health checks.

**Expected behavior:**
- `ics-web` waits for `ics-db` and `ics-redis` to be **healthy**
- `ics-scraper` waits for `ics-db` and `ics-redis` to be **healthy**

**Check dependency status:**

```bash
# View all services with health status
docker compose ps

# Expected output:
# ics-db      healthy
# ics-redis   healthy
# ics-web     running (after deps healthy)
```

**If dependencies stuck:**

```bash
# Check database health
docker compose exec ics-db pg_isready -U postgres

# Check Redis health
docker compose exec ics-redis redis-cli ping

# Restart dependencies
docker compose restart ics-db ics-redis
```

---

## Port Conflicts

### `Error: bind: address already in use`

**Default ports used:**
- `3000` - Web server (ics-web)
- `5432` - PostgreSQL (ics-db)
- `6379` - Redis (ics-redis)
- `3001` - Grafana (monitoring profile)
- `9090` - Prometheus (monitoring profile)
- `3100` - Loki (monitoring profile)
- `3200` - Tempo (monitoring profile)
- `4317/4318` - OTLP (monitoring profile)

**Find conflicting process:**

```bash
# Check which process uses port 3000
lsof -i :3000

# Or on Linux
netstat -tulpn | grep :3000
```

**Solution 1: Stop conflicting process**

```bash
# Kill process by PID
kill <PID>
```

**Solution 2: Override port in `.env`**

```bash
# Change web server port
echo "PORT=3001" >> .env

# Restart containers
docker compose up -d
```

**Update docker-compose.yml ports mapping:**

```yaml
services:
  ics-web:
    ports:
      - "${PORT:-3000}:3000"  # Maps host ${PORT} to container 3000
```

---

## Volume Issues

### PostgreSQL Volume Permission Errors

**Error:**

```
initdb: could not change permissions of directory "/var/lib/postgresql/data": Operation not permitted
```

**Cause:** Volume `postgres-data` has wrong ownership (requires UID 999 for postgres user).

**Solution:**

```bash
# Fix volume permissions
sudo chown -R 999:999 ./postgres-data/

# Or recreate volume
docker compose down -v
docker compose up -d
```

---

### Config Volume Not Syncing

**Issue:** Changes to `server/src/config/cinemas.json` not reflected in running container.

**Cause:** Volume mount caches old files or container needs restart.

**Solution:**

```bash
# Restart to pick up config changes
docker compose restart ics-web

# Verify mount
docker compose exec ics-web ls -la /app/dist/config/

# Force recreate container
docker compose up -d --force-recreate ics-web
```

**Note:** Config volume mount: `./server/src/config:/app/dist/config`

---

### Disk Space Exhaustion

**Symptoms:**
- Containers fail to start
- "No space left on device" errors

**Check disk usage:**

```bash
# Check Docker disk usage
docker system df

# Check volume sizes
docker volume ls
docker volume inspect postgres-data
```

**Cleanup:**

```bash
# Remove unused containers, images, networks
docker system prune -a

# Remove unused volumes (WARNING: destroys data)
docker volume prune

# Remove specific old images
docker images | grep allo-scrapper | awk '{print $3}' | xargs docker rmi
```

---

## Health Check Failures

### Web Server Health Check

**Configuration:**

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**What it does:**
- Checks `/api/health` endpoint every **30 seconds**
- Waits **40 seconds** before first check (start period)
- Allows **3 failed attempts** before marking unhealthy

**Manual test:**

```bash
# From host
curl http://localhost:3000/api/health

# Inside container
docker compose exec ics-web wget -qO- http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-03-05T..."}
```

**If failing:**

```bash
# Check if server is listening
docker compose exec ics-web netstat -tulpn | grep :3000

# Check application logs
docker compose logs ics-web | tail -50

# Test without health check
docker compose up ics-web --no-deps
```

---

### Database Health Check

**Configuration:**

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Manual test:**

```bash
docker compose exec ics-db pg_isready -U postgres

# Expected output:
# /var/run/postgresql:5432 - accepting connections
```

---

### Redis Health Check

**Configuration:**

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Manual test:**

```bash
docker compose exec ics-redis redis-cli ping

# Expected output:
# PONG
```

---

## Resource Constraints

### Redis Memory Limit

**Configuration:**

```yaml
ics-redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
```

**Settings:**
- **Memory limit:** 256 MB
- **Eviction policy:** `allkeys-lru` (least recently used)
- **Persistence:** AOF enabled

**Impact when limit hit:**
- Old keys evicted automatically
- **Scraper queue jobs may be lost** if Redis evicts active jobs
- No error thrown, silent data loss

**Monitor Redis memory:**

```bash
# Check memory usage
docker compose exec ics-redis redis-cli INFO memory | grep used_memory_human

# Check evicted keys count
docker compose exec ics-redis redis-cli INFO stats | grep evicted_keys
```

**Increase limit (if needed):**

Edit `docker-compose.yml`:

```yaml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru --appendonly yes
```

---

### No Memory Limits on Other Services

**⚠️ Warning:** No explicit memory/CPU limits on:
- `ics-web`
- `ics-scraper`
- `ics-db`

**Risk:** Services can exhaust host resources.

**Add limits (production):**

```yaml
services:
  ics-web:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

---

### Out of Memory Errors

**Symptoms:**
- Container killed unexpectedly
- `OOMKilled` in `docker inspect`

**Check if OOM killed:**

```bash
docker inspect ics-web --format='{{.State.OOMKilled}}'
```

**Solution:**

```bash
# Increase Docker Desktop memory limit
# Settings > Resources > Memory > 4GB+

# Or add container memory limits (see above)
```

---

## Network Issues

### Container-to-Container Communication

**Use service names, not `localhost`:**

```bash
# ✅ CORRECT in Docker
POSTGRES_HOST=ics-db
REDIS_URL=redis://ics-redis:6379

# ❌ WRONG in Docker
POSTGRES_HOST=localhost
REDIS_URL=redis://localhost:6379
```

**Test connectivity:**

```bash
# From ics-web, ping database
docker compose exec ics-web ping ics-db

# Check DNS resolution
docker compose exec ics-web nslookup ics-db

# Test PostgreSQL connection
docker compose exec ics-web psql -h ics-db -U postgres -d ics -c "SELECT 1;"
```

---

### Network Isolation Between Profiles

**Default network:** All services on same `default` network.

**Check network:**

```bash
docker network ls
docker network inspect allo-scrapper_default
```

---

## Build Failures

### Playwright Browser Download Failure

**Error during build:**

```
ERROR: Failed to download Chromium
```

**Cause:** Network timeout or proxy issues during `npx playwright install chromium`.

**Solution:**

```bash
# Build with increased timeout
DOCKER_BUILDKIT=1 docker compose build --build-arg BUILDKIT_INLINE_CACHE=1

# Or download Playwright browsers manually first
docker compose build --no-cache ics-web
```

**Dockerfile optimization:**
- Multi-stage build to reduce layer size
- Playwright system deps installed as root
- Browser binaries installed as `nodejs` user (avoids 271MB chown layer)

---

### Image Build Fails on ARM (Apple Silicon)

**Issue:** Building on M1/M2/M3 Mac.

**Solution:**

```bash
# Build for linux/amd64 platform
docker compose build --platform linux/amd64

# Or use multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t allo-scrapper .
```

---

### Cache Issues

**Symptoms:**
- Old code running despite changes
- Build not picking up new dependencies

**Solution:**

```bash
# Rebuild without cache
docker compose build --no-cache

# Force recreate containers
docker compose up -d --force-recreate

# Remove all build cache
docker builder prune -a
```

---

## Common Commands

### Service Management

```bash
# Start all services
docker compose up -d

# Start with profiles
docker compose --profile scraper --profile monitoring up -d

# Stop all services
docker compose down

# Stop and remove volumes (destroys data)
docker compose down -v

# Restart specific service
docker compose restart ics-web

# View service status
docker compose ps
```

### Logs

```bash
# View logs for all services
docker compose logs

# Follow logs in real-time
docker compose logs -f ics-web

# Last 50 lines
docker compose logs --tail=50 ics-web

# Filter for errors
docker compose logs ics-web | grep ERROR
```

### Debugging

```bash
# Inspect container
docker inspect ics-web

# View container processes
docker compose top ics-web

# Execute command in container
docker compose exec ics-web sh

# View resource usage
docker stats ics-web

# Validate docker-compose.yml
docker compose config
```

### Cleanup

```bash
# Remove stopped containers
docker compose rm

# Remove unused images
docker image prune

# Remove unused volumes (WARNING: destroys data)
docker volume prune

# Full cleanup (everything)
docker system prune -a --volumes
```

---

## Configuration

### Graceful Shutdown

**Timeout:** 10 seconds before forced exit.

**Signal handling:** Uses `dumb-init` as PID 1 for proper SIGTERM/SIGINT forwarding.

**Stop gracefully:**

```bash
docker compose stop  # Sends SIGTERM, waits for graceful shutdown
```

---

### Restart Policies

**Default:** `restart: unless-stopped`

**Behavior:**
- Restart on failure
- Don't restart if manually stopped
- Restart on Docker daemon restart

**Override:**

```yaml
services:
  ics-web:
    restart: "no"  # Never restart
    # or
    restart: always  # Always restart
    # or
    restart: on-failure  # Only on non-zero exit
```

---

## Related Documentation

- [Docker Deployment Guide](../guides/deployment/docker.md) - Full Docker setup
- [Production Deployment](../guides/deployment/production.md) - Production configuration
- [Monitoring Guide](../guides/deployment/monitoring.md) - Observability stack
- [Networking Guide](../guides/deployment/networking.md) - Network configuration
- [Common Issues](./common-issues.md) - General troubleshooting

---

[← Back to Troubleshooting](./README.md)
