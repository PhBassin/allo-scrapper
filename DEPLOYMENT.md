# Deployment Guide

Complete guide for deploying Allo-Scrapper to a local server using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Deployment from Registry](#deployment-from-registry)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Updating the Application](#updating-the-application)
- [Backup & Restore](#backup--restore)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **OS:** Linux (Ubuntu 20.04+ recommended) or macOS
- **Docker:** 24.0+ with Docker Compose plugin
- **RAM:** Minimum 2GB, recommended 4GB
- **Disk Space:** 2GB for Docker images + database storage
- **Network:** Internet access for pulling images and scraping

### Installation

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (if not included)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Initial Setup

### 1. Create Project Directory

```bash
# Create deployment directory
mkdir -p ~/allo-scrapper
cd ~/allo-scrapper

# Create required subdirectories
mkdir -p data/postgres backups logs
```

### 2. Download Configuration Files

Download the required files from the repository:

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/docker-compose.yml

# Download .env.example
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/.env.example

# Download database initialization script
mkdir -p docker
curl -o docker/init.sql https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/docker/init.sql
```

Or clone the repository (recommended):

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
```

### 3. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Required settings:**

```bash
# Database Configuration
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=its
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here  # ⚠️ CHANGE THIS!

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS – must include the origin the browser uses to reach the app.
# When served via Docker on port 3000, the frontend and API share the same origin.
# Add http://localhost:5173 if also running the Vite dev server.
# IMPORTANT: if accessed from another machine on your LAN (e.g. http://192.168.1.100:3000),
# you MUST add that address here, or browsers will get a CORS error.
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Scraper Configuration
SCRAPE_CRON_SCHEDULE=0 8 * * 3    # Wednesday at 8:00 AM
SCRAPE_DELAY_MS=1000              # 1 second between requests
TZ=Europe/Paris                   # Your timezone
```

---

## Deployment from Registry

### Pull and Run

The application is automatically built and pushed to GitHub Container Registry on every release.
An automated GitHub Actions cleanup job also runs on every push to `main` (and version tags) to delete untagged images.

> **Tag strategy (v1.1.0+):**
> - **`:stable`** — production-ready; built from `main` branch and version tags. **Use this in production.**
> - **`:latest`** — development builds from `develop`; may be unstable.
>
> If you were using `:latest` for production in v1.0.0, switch to `:stable`.

```bash
# Pull the stable (production-ready) image
docker pull ghcr.io/phbassin/allo-scrapper:stable

# Start the services
docker compose up -d
```

### Verify Deployment

```bash
# Check container status
docker compose ps

# Expected output:
# NAME                STATUS              PORTS
# allo-scrapper-db    Up (healthy)        0.0.0.0:5432->5432/tcp
# allo-scrapper-web   Up (healthy)        0.0.0.0:3000->3000/tcp

# Check logs
docker compose logs -f web

# Test API health endpoint
curl http://localhost:3000/api/health

# Expected: {"status":"ok","timestamp":"2026-02-15T..."}
```

### Database Initialization

The database schema is **automatically initialized** on first startup via the `docker/init.sql` script mounted in PostgreSQL's `docker-entrypoint-initdb.d` directory.

No manual action is required. You can verify the tables were created:

```bash
docker compose exec db psql -U postgres -d cinema_showtimes -c "\dt"
```

Expected output:
```
              List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | cinemas         | table | postgres
 public | films           | table | postgres
 public | scrape_reports  | table | postgres
 public | showtimes       | table | postgres
 public | weekly_programs | table | postgres
```

> **Note:** If you previously had a database volume and changed `POSTGRES_PASSWORD`, you must delete the volume first: `docker compose down -v` then `docker compose up -d`.

---

## Environment Configuration

### Port Configuration

By default, the application runs on port 3000. To change:

```bash
# In .env file
PORT=8080

# Restart containers
docker compose restart web
```

### Database Configuration

**Persistent Storage:**

Database data is stored in a Docker volume. To use a custom directory:

```yaml
# In docker-compose.yml
volumes:
  - ./data/postgres:/var/lib/postgresql/data
```

**Connection from Host:**

The database is exposed on port 5432 for external tools:

```bash
# Connect with psql
psql -h localhost -U postgres -d cinema_showtimes

# Connect with GUI tools
Host: localhost
Port: 5432
Database: cinema_showtimes
User: postgres
Password: [from .env]
```

### Cron Schedule

The scraper runs automatically based on the cron schedule:

```bash
# .env file
SCRAPE_CRON_SCHEDULE=0 8 * * 3  # Every Wednesday at 8:00 AM

# Common patterns:
# Daily at 8 AM:    0 8 * * *
# Every 6 hours:    0 */6 * * *
# Twice daily:      0 8,20 * * *
# Disable cron:     # (comment out the line)
```

---

## Database Management

### Manual Migration

Run migrations manually:

```bash
docker compose exec web node dist/db/schema.js
```

### Database Shell Access

```bash
# Access PostgreSQL shell
docker compose exec db psql -U postgres -d cinema_showtimes

# List tables
\dt

# View table structure
\d films
\d showtimes
\d cinemas
\d scrape_reports

# Exit
\q
```

### Data Inspection

```bash
# Count records
docker compose exec db psql -U postgres -d cinema_showtimes -c "SELECT COUNT(*) FROM films;"
docker compose exec db psql -U postgres -d cinema_showtimes -c "SELECT COUNT(*) FROM showtimes;"

# View recent scrape reports
docker compose exec db psql -U postgres -d cinema_showtimes -c "
  SELECT id, status, started_at, completed_at, total_films_scraped 
  FROM scrape_reports 
  ORDER BY started_at DESC 
  LIMIT 5;
"
```

---

## Monitoring & Maintenance

### Observability Stack (Optional)

A full observability stack (Prometheus, Grafana, Loki, Tempo) is available via the `monitoring` Docker Compose profile. See [MONITORING.md](./MONITORING.md) for full documentation.

```bash
# Start monitoring services (Grafana on :3001, Prometheus on :9090)
docker compose --profile monitoring up -d

# Start monitoring + scraper microservice together
docker compose --profile monitoring --profile scraper up -d
```

### Scraper Microservice (Optional)

By default the scraper runs in-process inside `ics-web`. To use the standalone scraper microservice (communicates via Redis):

```bash
# 1. Enable the feature flag in .env
USE_REDIS_SCRAPER=true

# 2. Start the scraper service
docker compose --profile scraper up -d

# 3. Restart the web service to pick up the flag
docker compose restart ics-web
```

The `ics-scraper-cron` service handles scheduled automatic scraping; `ics-scraper` processes on-demand jobs from the Redis queue.

### Health Checks

```bash
# Check service health
curl http://localhost:3000/api/health

# Check scraper status
curl http://localhost:3000/api/scraper/status | jq

# View recent reports
curl http://localhost:3000/api/reports | jq
```

### Log Monitoring

```bash
# Follow all logs
docker compose logs -f

# Follow only web service logs
docker compose logs -f web

# View last 100 lines
docker compose logs --tail=100 web

# Save logs to file
docker compose logs web > logs/app-$(date +%Y%m%d).log
```

### Resource Usage

```bash
# Check container stats
docker stats allo-scrapper-web allo-scrapper-db

# Check disk usage
docker system df

# Check volume size
docker volume inspect allo-scrapper_postgres_data
```

### Manual Scraping

Trigger a manual scrape via API:

```bash
# Trigger scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# Monitor progress (Server-Sent Events)
curl -N http://localhost:3000/api/scraper/progress
```

Or from inside the container:

```bash
docker compose exec web npm run scrape
```

---

## Updating the Application

### Standard Update Process

```bash
# 1. Pull stable image (production-ready)
docker compose pull

# 2. Stop and remove old containers
docker compose down

# 3. Start with new image
docker compose up -d

# 4. Verify deployment
docker compose ps
curl http://localhost:3000/api/health
```

### Zero-Downtime Update (Advanced)

```bash
# 1. Pull new image
docker compose pull

# 2. Start new container alongside old one
docker compose up -d --no-deps --scale web=2 --no-recreate

# 3. Wait for health check
sleep 30

# 4. Stop old container
docker compose up -d --no-deps --scale web=1

# 5. Remove old container
docker compose down --remove-orphans
```

### Rollback to Previous Version

```bash
# Pull specific version
docker pull ghcr.io/phbassin/allo-scrapper:v1.0.0

# Or use the stable tag (always points to latest production release)
docker pull ghcr.io/phbassin/allo-scrapper:stable

# Update docker-compose.yml to use specific tag
# image: ghcr.io/phbassin/allo-scrapper:v1.0.0

# Restart
docker compose up -d
```

---

## Backup & Restore

### Automated Backup Script

Create `~/allo-scrapper/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="$HOME/allo-scrapper/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cinema_showtimes_${TIMESTAMP}.sql"

echo "🔄 Creating database backup..."
mkdir -p "$BACKUP_DIR"

# Backup database
docker compose exec -T db pg_dump -U postgres cinema_showtimes > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "✅ Backup created: ${BACKUP_FILE}.gz"

# Keep only last 7 backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "🧹 Old backups cleaned (kept last 7 days)"
```

Make it executable:

```bash
chmod +x ~/allo-scrapper/scripts/backup-db.sh
```

### Scheduled Backups

Add to crontab:

```bash
crontab -e

# Add line (daily backup at 2 AM):
0 2 * * * cd ~/allo-scrapper && ./scripts/backup-db.sh >> logs/backup.log 2>&1
```

### Manual Backup

```bash
# Backup database
docker compose exec -T db pg_dump -U postgres cinema_showtimes > backup_$(date +%Y%m%d).sql

# Backup with compression
docker compose exec -T db pg_dump -U postgres cinema_showtimes | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
# Stop application
docker compose stop web

# Restore database
gunzip -c backup_20260215.sql.gz | docker compose exec -T db psql -U postgres cinema_showtimes

# Restart application
docker compose start web
```

### Complete System Backup

```bash
# Backup configuration and database
tar -czf allo-scrapper-backup-$(date +%Y%m%d).tar.gz \
  .env \
  docker-compose.yml \
  backups/

# Restore
tar -xzf allo-scrapper-backup-20260215.tar.gz
```

---

## Troubleshooting

### Service Won't Start

**Problem:** Container exits immediately

```bash
# Check logs for errors
docker compose logs web

# Common issues:
# 1. Database not ready
docker compose up -d db
sleep 10
docker compose up -d web

# 2. Port already in use
sudo lsof -i :3000
# Kill process or change PORT in .env

# 3. Permission issues
sudo chown -R $USER:$USER data/
```

### Database Connection Failed

**Problem:** `ECONNREFUSED` or connection timeout

```bash
# Verify database is running
docker compose ps db

# Check database logs
docker compose logs db

# Restart database
docker compose restart db

# Wait for health check
docker compose ps

# Verify network
docker network ls
docker network inspect allo-scrapper_allo-network
```

### Password Authentication Failed

**Problem:** `password authentication failed for user "postgres"`

This happens when you change `POSTGRES_PASSWORD` but the database volume already exists with the old password. PostgreSQL ignores environment variables when data already exists.

```bash
# Option 1: Delete volume and reinitialize (data loss)
docker compose down -v
docker compose up -d

# Option 2: Use the original password
# Set POSTGRES_PASSWORD to the value used when the volume was first created
```

### Out of Memory

**Problem:** Container killed by OOM

```bash
# Check memory usage
docker stats

# Add memory limits to docker-compose.yml
services:
  web:
    mem_limit: 1g
    mem_reservation: 512m

# Restart with limits
docker compose up -d
```

### Scraper Failing

**Problem:** Scrape reports show errors

```bash
# Check scrape status
curl http://localhost:3000/api/scraper/status | jq

# View recent reports
curl http://localhost:3000/api/reports | jq

# Check for network issues
docker compose exec web ping -c 3 www.cinema_showtimes.fr

# Increase scrape delay (in .env)
SCRAPE_DELAY_MS=2000

# Restart
docker compose restart web
```

### Disk Space Issues

**Problem:** No space left on device

```bash
# Check disk usage
df -h
docker system df

# Clean up Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Limit database size (manual cleanup)
docker compose exec db psql -U postgres cinema_showtimes -c "
  DELETE FROM showtimes WHERE date < NOW() - INTERVAL '30 days';
"
```

### Web UI Not Loading

**Problem:** Blank page or 404 errors

```bash
# Verify static files are served
curl -I http://localhost:3000/

# Should return 200 OK with text/html

# Check for routing issues
curl http://localhost:3000/index.html

# Rebuild image if needed
docker compose build --no-cache web
docker compose up -d
```

### SSL/HTTPS Setup (Reverse Proxy)

For production deployment with HTTPS, use a reverse proxy:

**Example with Nginx:**

```nginx
server {
    listen 80;
    server_name cinema.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cinema.example.com;

    ssl_certificate /etc/ssl/certs/cinema.example.com.crt;
    ssl_certificate_key /etc/ssl/private/cinema.example.com.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE endpoint configuration
    location /api/scraper/progress {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

---

## Security Recommendations

### Production Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong, unique passwords
- [ ] Don't expose PostgreSQL port publicly (remove from docker-compose.yml)
- [ ] Keep Docker and system packages updated
- [ ] Enable firewall (ufw/iptables)
- [ ] Use HTTPS with reverse proxy
- [ ] Regular backups (automated)
- [ ] Monitor logs for suspicious activity
- [ ] Limit container resources (memory, CPU)
- [ ] Use non-root user in containers (already configured)

### Firewall Configuration

```bash
# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (or keep internal with reverse proxy)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

---

## Support & Resources

### Useful Commands Quick Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart a service
docker compose restart web

# View logs
docker compose logs -f web

# Execute command in container
docker compose exec web [command]

# Database backup
docker compose exec -T db pg_dump -U postgres cinema_showtimes > backup.sql

# Trigger manual scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# Check health
curl http://localhost:3000/api/health
```

### Getting Help

- **Documentation:** See [README.md](README.md) for development setup
- **Issues:** Report bugs on [GitHub Issues](https://github.com/PhBassin/allo-scrapper/issues)
- **Logs:** Always include logs when reporting issues

---

## License

MIT License - See LICENSE file for details
