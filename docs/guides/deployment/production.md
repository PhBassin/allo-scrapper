# Production Deployment

Complete guide for deploying Allo-Scrapper to production using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Deployment](#deployment)
- [Environment Configuration](#environment-configuration)
- [JWT Secret Configuration](#jwt-secret-configuration)
- [Database Management](#database-management)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Updating the Application](#updating-the-application)
- [Security Recommendations](#security-recommendations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum:**
- **OS**: Linux (Ubuntu 20.04+) or macOS
- **Docker**: 24.0+ with Docker Compose plugin
- **RAM**: 2GB
- **Disk Space**: 2GB for Docker images + database storage
- **Network**: Internet access for pulling images and scraping

**Recommended:**
- **OS**: Ubuntu 22.04 LTS or Debian 12
- **RAM**: 4GB
- **Disk Space**: 20GB (for database growth and backups)
- **CPU**: 4 cores

### Install Docker

**Ubuntu/Debian:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (optional, avoids sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin (if not included)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

**Other platforms:** See [Installation Guide](../../getting-started/installation.md)

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

**Option A: Clone the repository** (recommended):
```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
```

**Option B: Download files manually**:
```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/docker-compose.yml

# Download .env.example
curl -O https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/.env.example

# Download database initialization script
mkdir -p docker
curl -o docker/init.sql https://raw.githubusercontent.com/PhBassin/allo-scrapper/main/docker/init.sql
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Critical production settings:**

```bash
# Database Configuration
POSTGRES_HOST=ics-db
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<STRONG_PASSWORD_HERE>  # ⚠️ CHANGE THIS!

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn

# JWT Secret (REQUIRED for production)
JWT_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>

# CORS Configuration
# Must include the origin the browser uses to reach the app
ALLOWED_ORIGINS=https://cinema.example.com

# Scraper Configuration
SCRAPE_CRON_SCHEDULE=0 3 * * *    # Daily at 3 AM
TZ=Europe/Paris                   # Your timezone
SCRAPE_DAYS=14                    # Scrape 2 weeks ahead
```

See [Configuration Guide](../../getting-started/configuration.md) for all environment variables.

---

## Deployment

### Pull Pre-built Images

Images are automatically built and pushed to GitHub Container Registry on every release.

**Tag strategy:**
- **`:stable`** - Production-ready builds from `main` branch (**use this**)
- **`:latest`** - Development builds from `develop` (may be unstable)

```bash
# Pull stable (production-ready) image
docker pull ghcr.io/phbassin/allo-scrapper:stable

# Start services
docker compose up -d
```

### Verify Deployment

```bash
# Check container status
docker compose ps

# Expected output:
# NAME         STATUS          PORTS
# ics-db       Up (healthy)    0.0.0.0:5432->5432/tcp
# ics-web      Up (healthy)    0.0.0.0:3000->3000/tcp

# Check logs
docker compose logs -f ics-web

# Test API health endpoint
curl http://localhost:3000/api/health

# Expected: {"success":true,"data":{"status":"healthy",...}}
```

### Database Initialization

The database schema is **automatically initialized** on first startup.

Verify tables were created:
```bash
docker compose exec ics-db psql -U postgres -d ics -c "\dt"
```

Expected output:
```
              List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | cinemas         | table | postgres
 public | films           | table | postgres
 public | scrape_sessions | table | postgres
 public | showtimes       | table | postgres
 public | users           | table | postgres
 public | app_settings    | table | postgres
```

**Note:** If you changed `POSTGRES_PASSWORD` after initial setup, delete the volume first:
```bash
docker compose down -v
docker compose up -d
```

---

## Environment Configuration

### Port Configuration

Default ports:
- **API & Frontend**: 3000
- **PostgreSQL**: 5432

To change ports, edit `.env`:
```bash
PORT=8080              # API server
POSTGRES_PORT=5433     # PostgreSQL
```

Then restart:
```bash
docker compose down
docker compose up -d
```

### CORS Configuration

CORS must include **every origin** the browser uses to access the app.

**Local access only:**
```bash
ALLOWED_ORIGINS=http://localhost:3000
```

**LAN access (home network):**
```bash
# Find server IP: hostname -I or ip addr show
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

**Production with domain:**
```bash
ALLOWED_ORIGINS=https://cinema.example.com,https://www.cinema.example.com
```

**After changing, restart:**
```bash
docker compose restart ics-web
```

See [Networking Guide](./networking.md) for detailed LAN setup.

### Cron Scheduling

Configure automated scraping with cron expressions:

```bash
# Daily at 3 AM
SCRAPE_CRON_SCHEDULE=0 3 * * *

# Every Wednesday at 8 AM (default)
SCRAPE_CRON_SCHEDULE=0 8 * * 3

# Every 6 hours
SCRAPE_CRON_SCHEDULE=0 */6 * * *
```

Use [crontab.guru](https://crontab.guru/) to build expressions.

**Timezone:**
```bash
TZ=Europe/Paris        # Match your local timezone
TZ=America/New_York
TZ=Asia/Tokyo
```

---

## JWT Secret Configuration

⚠️ **CRITICAL**: JWT secret is **required** for production authentication.

### Generate Secure Secret

```bash
# Generate 32-byte random secret
openssl rand -base64 32

# Example output:
# Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=
```

### Add to Environment

```bash
# Edit .env
nano .env

# Add JWT secret
JWT_SECRET=Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=
```

### Restart Services

```bash
docker compose restart ics-web
```

### Verify Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Expected: JWT token in response
# {"success":true,"data":{"token":"eyJhbG..."}}
```

### Security Best Practices

1. **Never commit JWT secret to version control**
   ```bash
   # Ensure .env is in .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use different secrets for each environment**
   - Development: One secret
   - Staging: Different secret
   - Production: Different secret

3. **Rotate secrets periodically**
   - Generate new secret
   - Update `.env`
   - Restart services
   - All users must re-login

4. **Protect .env file**
   ```bash
   chmod 600 .env
   ```

### JWT Secret Rotation

To rotate JWT secrets without downtime:

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update .env
nano .env  # Replace JWT_SECRET value

# 3. Restart web service
docker compose restart ics-web

# 4. All users will need to re-login
```

### Troubleshooting JWT

**Issue**: "jwt malformed" or "invalid signature" errors

**Solution**:
1. Verify `JWT_SECRET` is set in `.env`
2. Ensure no extra spaces/quotes around the secret
3. Restart services: `docker compose restart ics-web`
4. Re-login to get new token

**Issue**: Token expires too quickly

**Solution**: Tokens expire after 24 hours (default). This is configurable in code but not via environment variables. For longer sessions, consider implementing refresh tokens.

---

## Database Management

### Run Migrations

Migrations run automatically on startup. To manually run:

```bash
docker compose exec ics-web npm run db:migrate
```

### Access Database Shell

```bash
# PostgreSQL shell
docker compose exec ics-db psql -U postgres -d ics

# Inside psql:
\dt          # List tables
\d cinemas   # Describe cinemas table
SELECT * FROM cinemas;
\q           # Quit
```

### Inspect Data

```bash
# Count records
docker compose exec ics-db psql -U postgres -d ics \
  -c "SELECT 
        (SELECT COUNT(*) FROM cinemas) as cinemas,
        (SELECT COUNT(*) FROM films) as films,
        (SELECT COUNT(*) FROM showtimes) as showtimes;"

# Recent scrapes
docker compose exec ics-db psql -U postgres -d ics \
  -c "SELECT * FROM scrape_sessions ORDER BY started_at DESC LIMIT 5;"
```

### Reset Database

⚠️ **Warning**: This deletes all data!

```bash
# Stop services
docker compose down

# Remove database volume
docker volume rm allo-scrapper_postgres_data

# Restart (will re-initialize)
docker compose up -d
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# API health
curl http://localhost:3000/api/health

# Container health
docker compose ps

# Database health
docker compose exec ics-db pg_isready -U postgres
```

### View Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs ics-web
docker compose logs ics-db

# Follow logs (live)
docker compose logs -f ics-web

# Last 100 lines
docker compose logs --tail=100 ics-web

# Filter by time
docker compose logs --since=1h ics-web
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### Manual Scraping

```bash
# Trigger scrape via API
curl -X POST http://localhost:3000/api/scraper/start

# Or via Docker exec
docker compose exec ics-web npm run scrape
```

### Enable Full Monitoring Stack

For production monitoring with Prometheus, Grafana, Loki, and Tempo:

```bash
# Start with monitoring profile
docker compose --profile monitoring up -d
```

See [Monitoring Guide](./monitoring.md) for complete setup.

---

## Updating the Application

### Pre-Update Checklist

1. ✅ **Create database backup**
   ```bash
   ./scripts/backup-production.sh --host localhost --user postgres
   ```

2. ✅ **Check release notes**
   - Review [CHANGELOG.md](../../project/changelog.md)
   - Note any breaking changes or migration requirements

3. ✅ **Verify current version**
   ```bash
   curl http://localhost:3000/api/version
   ```

### Update Procedure

```bash
# 1. Pull latest image
docker pull ghcr.io/phbassin/allo-scrapper:stable

# 2. Stop services
docker compose down

# 3. Restart with new image
docker compose up -d

# 4. Check logs for errors
docker compose logs -f ics-web

# 5. Verify health
curl http://localhost:3000/api/health
```

### Database Migrations

Migrations run automatically on startup. Monitor logs:

```bash
docker compose logs ics-web | grep migration
```

### Rollback if Needed

```bash
# 1. Stop services
docker compose down

# 2. Restore database from backup
./scripts/restore-production.sh --file backups/ics_backup_YYYYMMDD_HHMMSS.sql

# 3. Use previous image version
docker pull ghcr.io/phbassin/allo-scrapper:<previous-tag>

# 4. Update docker-compose.yml to pin version
# image: ghcr.io/phbassin/allo-scrapper:<previous-tag>

# 5. Restart
docker compose up -d
```

### Zero-Downtime Updates

For critical production environments:

1. Set up a staging environment
2. Test updates there first
3. Use blue-green deployment or Docker Swarm
4. Consider using a load balancer

---

## Security Recommendations

### Production Security Checklist

**Environment Security:**
- [ ] Strong `POSTGRES_PASSWORD` set
- [ ] `JWT_SECRET` generated with `openssl rand -base64 32`
- [ ] `NODE_ENV=production`
- [ ] `.env` file has restrictive permissions (`chmod 600`)
- [ ] `.env` in `.gitignore`

**Network Security:**
- [ ] HTTPS enabled (see below)
- [ ] `ALLOWED_ORIGINS` limited to your domains (no wildcards)
- [ ] Firewall configured (see below)
- [ ] Database port (5432) not exposed externally

**Application Security:**
- [ ] Default admin password changed
- [ ] Automated backups configured
- [ ] Log level set to `warn` or `error`
- [ ] Security updates applied regularly

### HTTPS/SSL Setup

**Option 1: Nginx Reverse Proxy with Let's Encrypt**

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d cinema.example.com

# Nginx will auto-configure SSL
```

See [Networking Guide](./networking.md) for detailed Nginx configuration.

**Option 2: Cloudflare** (easiest)

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL/TLS mode
3. Point DNS to your server IP
4. Cloudflare handles HTTPS automatically

### Firewall Configuration

**UFW (Ubuntu):**
```bash
# Enable firewall
sudo ufw enable

# Allow SSH (IMPORTANT: do this first!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if directly exposing)
sudo ufw allow 3000/tcp

# DO NOT expose PostgreSQL port externally
# sudo ufw deny 5432/tcp  # Not needed, denied by default

# Check status
sudo ufw status
```

### Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker pull ghcr.io/phbassin/allo-scrapper:stable
docker compose down && docker compose up -d

# Enable automatic security updates (Ubuntu)
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose logs ics-web
```

**Common issues:**
- Missing environment variables
- Port already in use
- Database connection failure

**Solution:**
```bash
# Verify .env exists
cat .env

# Check port availability
sudo lsof -i :3000
sudo lsof -i :5432

# Restart everything
docker compose down
docker compose up -d
```

### Database Connection Errors

**Error**: `ECONNREFUSED` or `connection refused`

**Check:**
```bash
# Is database running?
docker compose ps ics-db

# Database logs
docker compose logs ics-db

# Test connection
docker compose exec ics-db pg_isready -U postgres
```

**Solution:**
```bash
# Restart database
docker compose restart ics-db

# If persists, check POSTGRES_HOST in .env
# Should be "ics-db" not "localhost"
```

### Authentication Not Working

**Error**: "jwt malformed" or "jwt must be provided"

**Solution:**
1. Verify `JWT_SECRET` is set in `.env`
2. Restart web service: `docker compose restart ics-web`
3. Clear browser cookies/local storage
4. Re-login to get new token

### Scraper Not Running

**Check cron schedule:**
```bash
docker compose logs ics-web | grep cron
docker compose logs ics-web | grep scrape
```

**Manual trigger:**
```bash
curl -X POST http://localhost:3000/api/scraper/start
```

**Verify cron configuration:**
```bash
# Check .env
grep SCRAPE_CRON_SCHEDULE .env

# Verify timezone
grep TZ .env

# Test at crontab.guru
```

### Out of Disk Space

**Check usage:**
```bash
df -h
docker system df
```

**Clean up:**
```bash
# Remove old images
docker image prune -a

# Remove unused volumes (careful!)
docker volume prune

# Remove stopped containers
docker container prune

# Full cleanup
docker system prune -a --volumes
```

### Performance Issues

**Slow response times:**
1. Check container resources: `docker stats`
2. Increase memory limit in `docker-compose.yml`
3. Add database indexes (see [Database Schema](../../reference/database/schema.md))

**High CPU usage:**
1. Reduce scraper concurrency (`SCRAPE_THEATER_DELAY_MS`)
2. Optimize scrape schedule (less frequent)
3. Add more resources to server

### For More Help

- **Docker Issues**: [Docker Troubleshooting](../../../TROUBLESHOOTING.md#docker-issues)
- **Database Issues**: [Database Troubleshooting](../../troubleshooting/database.md)
- **Networking Issues**: [Networking Guide](./networking.md)
- **GitHub Issues**: [Report a bug](https://github.com/PhBassin/allo-scrapper/issues)

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart service
docker compose restart ics-web

# View logs
docker compose logs -f ics-web

# Database shell
docker compose exec ics-db psql -U postgres -d ics

# Backup database
./scripts/backup-production.sh --host localhost --user postgres

# Update application
docker pull ghcr.io/phbassin/allo-scrapper:stable && docker compose down && docker compose up -d
```

### Important Files

- **`.env`** - Environment configuration
- **`docker-compose.yml`** - Service orchestration
- **`server/src/config/cinemas.json`** - Cinema configuration
- **`backups/`** - Database backups

---

## Related Documentation

- **[Docker Setup Guide](./docker.md)** - Docker configuration and optimization
- **[Backup & Restore](./backup-restore.md)** - Database backup workflows
- **[Networking Guide](./networking.md)** - LAN access and CORS setup
- **[Monitoring Guide](./monitoring.md)** - Observability stack setup
- **[Configuration Reference](../../getting-started/configuration.md)** - All environment variables
- **[Troubleshooting](../../troubleshooting/)** - Common issues and solutions

---

[← Back to Deployment Guides](./README.md)
