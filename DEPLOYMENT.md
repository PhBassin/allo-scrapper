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

Download `docker-compose.yml` and `.env.example` from the repository:

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/docker-compose.yml

# Download .env.example
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/.env.example
```

Or clone the repository:

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
POSTGRES_DB=allocine
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here  # ⚠️ CHANGE THIS!

# Server Configuration
PORT=3000
NODE_ENV=production

# Scraper Configuration
SCRAPE_CRON_SCHEDULE=0 8 * * 3    # Wednesday at 8:00 AM
SCRAPE_DELAY_MS=1000              # 1 second between requests
TZ=Europe/Paris                   # Your timezone
```

---

## Deployment from Registry

### Pull and Run

The application is automatically built and pushed to GitHub Container Registry on every release.

```bash
# Pull the latest image
docker pull ghcr.io/phbassin/allo-scrapper:latest

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

### Initialize Database

On first deployment, initialize the database schema:

```bash
docker compose exec web node dist/db/schema.js
```

Expected output:
```
🔄 Initialisation de la base de données PostgreSQL...
✅ Base de données initialisée avec succès
```

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
psql -h localhost -U postgres -d allocine

# Connect with GUI tools
Host: localhost
Port: 5432
Database: allocine
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
docker compose exec db psql -U postgres -d allocine

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
docker compose exec db psql -U postgres -d allocine -c "SELECT COUNT(*) FROM films;"
docker compose exec db psql -U postgres -d allocine -c "SELECT COUNT(*) FROM showtimes;"

# View recent scrape reports
docker compose exec db psql -U postgres -d allocine -c "
  SELECT id, status, started_at, completed_at, total_films_scraped 
  FROM scrape_reports 
  ORDER BY started_at DESC 
  LIMIT 5;
"
```

---

## Monitoring & Maintenance

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
# 1. Pull latest image
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
BACKUP_FILE="${BACKUP_DIR}/allocine_${TIMESTAMP}.sql"

echo "🔄 Creating database backup..."
mkdir -p "$BACKUP_DIR"

# Backup database
docker compose exec -T db pg_dump -U postgres allocine > "$BACKUP_FILE"

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
docker compose exec -T db pg_dump -U postgres allocine > backup_$(date +%Y%m%d).sql

# Backup with compression
docker compose exec -T db pg_dump -U postgres allocine | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
# Stop application
docker compose stop web

# Restore database
gunzip -c backup_20260215.sql.gz | docker compose exec -T db psql -U postgres allocine

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
docker compose exec web ping -c 3 www.allocine.fr

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
docker compose exec db psql -U postgres allocine -c "
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
docker compose exec -T db pg_dump -U postgres allocine > backup.sql

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
