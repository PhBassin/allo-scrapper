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
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here  # ⚠️ CHANGE THIS!

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS – must include the origin the browser uses to reach the app.
# The frontend and API are served by the same Express server on port 3000.
#
# For local access only:
ALLOWED_ORIGINS=http://localhost:3000
#
# For LAN access (access from other devices on your network):
# Add your server's LAN IP address (find with: hostname -I)
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
#
# For production with domain:
ALLOWED_ORIGINS=https://cinema.example.com
#
# Multiple origins (localhost + LAN + domain):
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,https://cinema.example.com
#
# IMPORTANT: After changing ALLOWED_ORIGINS, restart the container:
# docker compose restart ics-web

# Scraper Configuration
SCRAPE_CRON_SCHEDULE=0 8 * * 3    # Wednesday at 8:00 AM
SCRAPE_DELAY_MS=1000              # 1 second between requests
TZ=Europe/Paris                   # Your timezone

# Docker User Permissions (for volume write permissions)
# Set to your host user UID/GID (run `id` to find yours)
# Defaults to 1000:1000 (standard Linux user)
DOCKER_UID=1000                   # Your user ID
DOCKER_GID=1000                   # Your group ID
```

### 4. Configure Docker User Permissions

The application runs as a non-root user for security. When using volume mounts for cinema config persistence, you must configure the container user to match your host user.

**Find your UID/GID:**

```bash
# Linux/macOS
id

# Output example:
# uid=1000(youruser) gid=1000(yourgroup) groups=...
```

**Set in `.env` file:**

```bash
# Add these lines to your .env file
DOCKER_UID=1000  # Replace with your UID from above
DOCKER_GID=1000  # Replace with your GID from above
```

**Why this matters:**
- The cinema config file (`cinemas.json`) is mounted from host to container
- API updates write to this file inside the container
- Container user must have write permission to host-mounted files
- Running as your host UID ensures seamless read/write access

**Default values:**
- `DOCKER_UID=1000` (standard Linux first user)
- `DOCKER_GID=1000` (standard Linux first group)

**macOS users:** Your UID is typically 501, GID is 20:
```bash
DOCKER_UID=501
DOCKER_GID=20
```

**Security note:** Never use `user: root` in production. Always run containers as non-root users.

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

### Network Access & CORS

**Accessing from LAN:**

When deploying on a local network server (e.g., home/office network), you must update CORS to allow browser connections from your server's IP address.

#### Step-by-Step Setup

1. **Find your server's IP address:**
   ```bash
   # Linux
   hostname -I
   # Example output: 192.168.1.100 10.0.2.15
   
   # macOS
   ipconfig getifaddr en0  # Wi-Fi
   ipconfig getifaddr en1  # Ethernet
   ```

2. **Update CORS configuration in `.env`:**
   ```bash
   # Edit .env file
   nano .env
   
   # Add your server's LAN IP to ALLOWED_ORIGINS
   ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
   ```

3. **Restart the web service:**
   ```bash
   docker compose restart ics-web
   ```

4. **Access from another device on the same network:**
   ```
   Browser → http://192.168.1.100:3000
   ```

#### Multiple Access Points

For servers accessible via multiple addresses:

```bash
# .env example for multiple origins
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,https://cinema.example.com
```

**Security Note:** Only add origins you trust. Each origin grants full API access to browsers visiting from that address.

#### Testing External Access

**Test API connectivity:**
```bash
# From another machine on the network
curl http://192.168.1.100:3000/api/health

# Expected: {"status":"ok","timestamp":"..."}
```

**Verify CORS headers:**
```bash
curl -I http://192.168.1.100:3000/api/films \
  -H "Origin: http://192.168.1.100:3000"

# Should include this header:
# Access-Control-Allow-Origin: http://192.168.1.100:3000
```

**Test from browser:**
1. Open `http://192.168.1.100:3000` on another device
2. Open DevTools (F12) → Network tab
3. Reload the page
4. Verify API requests use the server IP (not localhost):
   - ✅ Correct: `http://192.168.1.100:3000/api/films`
   - ❌ Wrong: `http://localhost:3000/api/films`

#### Troubleshooting Network Access

**Problem: "Failed to fetch" or "Network Error"**

1. Verify CORS configuration:
   ```bash
   docker compose exec ics-web printenv ALLOWED_ORIGINS
   ```

2. Check if your IP is included - if not, update `.env` and restart

3. Verify container is accessible:
   ```bash
   # From external device
   ping 192.168.1.100
   curl http://192.168.1.100:3000/api/health
   ```

**Problem: CORS error in browser console**

```
Access to fetch at 'http://192.168.1.100:3000/api/films' 
has been blocked by CORS policy
```

**Solution:** Add the exact origin to `ALLOWED_ORIGINS` in `.env`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
docker compose restart ics-web
```

**Problem: Cannot reach server from external device**

1. **Check firewall:** Ensure port 3000 is open
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 3000/tcp
   sudo ufw status
   ```

2. **Verify Docker port binding:**
   ```bash
   docker compose ps
   # Should show: 0.0.0.0:3000->3000/tcp
   ```

3. **Test connectivity:**
   ```bash
   # From external device
   telnet 192.168.1.100 3000
   # Should connect (if telnet installed)
   ```

#### Production Deployment with Domain

For production with a domain name:

1. **Update `.env` with your domain:**
   ```bash
   ALLOWED_ORIGINS=https://cinema.example.com
   ```

2. **Use HTTPS with reverse proxy** (see "SSL/HTTPS Setup" section below)

3. **Restart services:**
   ```bash
   docker compose restart ics-web
   ```

---

## JWT Secret Configuration (CRITICAL)

### Overview

**⚠️ SECURITY REQUIREMENT:** The application **requires** `JWT_SECRET` to be configured in production environments. There is **no default fallback** for security reasons.

**What it does:**
- Signs JWT tokens used for authentication
- Validates tokens on protected endpoints
- Invalidates all sessions when changed

**Security implications:**
- Anyone with the secret can forge valid authentication tokens
- Leaked secret = complete authentication bypass
- Must be unique per environment (dev/staging/production)

---

### Generating a Secure Secret

**Requirements:**
- Minimum 32 characters (256 bits recommended)
- Cryptographically random (not a password or phrase)
- Unique to this installation

**Method 1: OpenSSL (Recommended)**
```bash
openssl rand -base64 32
# Output: Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=
```

**Method 2: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Output: P8vQ3wR7xY2zA1bN5cM4dF6gH9jK0lT3uW8eI7oA5s=
```

**Method 3: Python**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: 8G5kD2qL9xW3mN7jR4cY1vB6zH0pF5uT8eI3oA7s
```

**⚠️ DO NOT use these examples!** Generate your own unique secret.

---

### Configuring the Secret

#### Production Deployment

**Step 1: Generate secret**
```bash
# Generate and save to file
openssl rand -base64 32 > jwt_secret.txt

# Or save directly to environment
export JWT_SECRET=$(openssl rand -base64 32)
```

**Step 2: Add to .env file**
```bash
# Edit .env
nano .env

# Add line (paste your generated secret):
JWT_SECRET=<your_generated_secret_here>

# Example (DO NOT use this exact value):
JWT_SECRET=Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=
```

**Step 3: Restart services**
```bash
docker compose restart ics-web
```

**Step 4: Verify configuration**
```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq

# Expected: {"success":true,"data":{"token":"eyJ..."}}

# If error: "JWT secret not configured" → JWT_SECRET not loaded
# Check: docker compose exec ics-web printenv JWT_SECRET
```

---

### Secret Rotation (Advanced)

Rotating `JWT_SECRET` invalidates all existing user sessions. Users must re-login after rotation.

**When to rotate:**
- Security breach (secret compromised)
- Employee with secret access leaves
- Periodic rotation policy (e.g., every 90 days)
- Moving between environments (dev → staging → production)

**Rotation procedure (zero-downtime):**

```bash
# 1. Backup current secret
echo "Old secret: $(grep JWT_SECRET .env)" > jwt_rotation_$(date +%Y%m%d).log

# 2. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)
echo "New secret: $NEW_SECRET" >> jwt_rotation_$(date +%Y%m%d).log

# 3. Update .env file
sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env

# 4. Rolling restart (zero downtime - requires multiple instances)
# For single instance (brief downtime):
docker compose restart ics-web

# 5. Notify users to re-login
echo "Secret rotated at $(date)" >> jwt_rotation_$(date +%Y%m%d).log

# 6. Monitor for authentication errors
docker compose logs -f ics-web | grep "Unauthorized"
```

**Note:** All users will be logged out immediately when the secret changes. Plan rotation during maintenance windows or off-peak hours.

---

### Security Best Practices

#### ✅ DO

- **Generate cryptographically random secrets** (use OpenSSL/crypto libraries)
- **Use different secrets per environment** (dev/staging/production)
- **Store in environment variables** (.env file, not code)
- **Minimum 32 characters** (256 bits recommended)
- **Rotate periodically** (every 90 days or after incidents)
- **Use secret management systems** in production (AWS Secrets Manager, HashiCorp Vault, etc.)
- **Backup old secrets** during rotation (for debugging)
- **Document rotation dates** (maintain audit log)

#### ❌ DON'T

- **Never commit to version control** (.gitignore .env files)
- **Never use weak secrets** (passwords, dictionary words, patterns)
- **Never share between environments** (same secret for dev and prod)
- **Never log the secret** (in application logs or error messages)
- **Never transmit over insecure channels** (email, chat, HTTP)
- **Never hardcode in application** (always use environment variables)
- **Never reuse** across multiple applications

---

### Troubleshooting JWT Issues

#### Error: "JWT secret not configured"

**Symptom:** 500 error on login, logs show "JWT_SECRET must be configured"

**Cause:** Environment variable not set

**Fix:**
```bash
# Check if set
docker compose exec ics-web printenv JWT_SECRET

# If empty, add to .env and restart
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
docker compose restart ics-web
```

---

#### Error: "Unauthorized" after secret rotation

**Symptom:** Valid users get 401 errors, worked before rotation

**Cause:** Old tokens invalidated by new secret

**Fix:** Users must log in again to get new tokens:
```bash
# Re-login to get new token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq
```

---

#### Error: "Invalid token"

**Symptom:** Protected endpoints return 401, token format looks valid

**Possible causes:**
1. **JWT_SECRET changed** → Users must re-login
2. **Token from different environment** → Dev token won't work in prod if secrets differ
3. **Token malformed** → Check Authorization header: `Bearer <token>`

**Debug:**
```bash
# Decode token payload (without verifying signature)
# Install: npm install -g jwt-cli
jwt decode <your_token>

# Check if token was signed with current secret
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>" \
  -v

# If 401: Token invalid/expired or signed with wrong secret
```

---

### Using Secret Management Systems (Production)

For enterprise deployments, use dedicated secret management instead of .env files:

#### AWS Secrets Manager

```bash
# Store secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name allo-scrapper/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

# Retrieve in application startup script
export JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id allo-scrapper/jwt-secret \
  --query SecretString \
  --output text)

# Start application with secret
docker compose up -d
```

#### HashiCorp Vault

```bash
# Store secret in Vault
vault kv put secret/allo-scrapper jwt_secret="$(openssl rand -base64 32)"

# Retrieve in application startup
export JWT_SECRET=$(vault kv get -field=jwt_secret secret/allo-scrapper)

# Start application
docker compose up -d
```

#### Docker Secrets (Docker Swarm)

```bash
# Create Docker secret
echo "$(openssl rand -base64 32)" | docker secret create jwt_secret -

# Reference in docker-compose.yml (swarm mode)
services:
  ics-web:
    secrets:
      - jwt_secret
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  jwt_secret:
    external: true
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

### Pre-Update Checklist

**CRITICAL:** Always check for database migrations before updating!

```bash
# 1. Review release notes for breaking changes
# Check GitHub releases: https://github.com/PhBassin/allo-scrapper/releases

# 2. Check for new migrations
ls migrations/*.sql | sort

# 3. Backup database BEFORE update
./scripts/backup-db.sh
# or manually:
docker compose exec -T db pg_dump -U postgres ics > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Standard Update Process (Without Migrations)

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

### Update Process with Database Migrations

**IMPORTANT:** When a release includes database migrations, you MUST apply them BEFORE deploying the new code.

```bash
# 1. Backup database (MANDATORY)
docker compose exec -T db pg_dump -U postgres ics > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migrations in order (while old code is still running)
# Check migrations/README.md for the list of migrations

# Apply each new migration sequentially:
docker compose exec -T db psql -U postgres -d ics < migrations/003_add_users_table.sql

# 3. Verify migration success
docker compose exec db psql -U postgres -d ics -c "\d users"

# 4. NOW update the application code
docker compose pull
docker compose down
docker compose up -d

# 5. Verify deployment
docker compose ps
curl http://localhost:3000/api/health

# 6. Test new features (example: authentication)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq
```

**Migration Order:**
1. **Backup** → 2. **Apply Migrations** → 3. **Verify Migrations** → 4. **Deploy Code** → 5. **Verify**

See **[migrations/README.md](migrations/README.md)** for detailed migration documentation and rollback procedures.

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

### Production Security Checklist

#### Authentication & Secrets
- [ ] **Set JWT_SECRET environment variable** (CRITICAL - no default)
- [ ] **Generate cryptographically random JWT_SECRET** (min 32 chars): `openssl rand -base64 32`
- [ ] **Never commit JWT_SECRET to git** (.env should be in .gitignore)
- [ ] **Use different JWT_SECRET per environment** (dev/staging/production)
- [ ] **Change default admin password** (username: admin, password: admin)
- [ ] **Rotate JWT_SECRET periodically** (every 90 days recommended)

#### Database Security
- [ ] Change default PostgreSQL password
- [ ] Use strong, unique passwords (min 16 chars, mixed case + numbers + symbols)
- [ ] Don't expose PostgreSQL port publicly (remove `ports:` from docker-compose.yml)
- [ ] Enable PostgreSQL SSL/TLS connections
- [ ] Restrict database user permissions (principle of least privilege)

#### Application Security
- [ ] Configure ALLOWED_ORIGINS restrictively (only trusted domains)
- [ ] Enable HTTPS with reverse proxy (see SSL/HTTPS Setup section)
- [ ] Review rate limiting configuration (adjust for your traffic patterns)
- [ ] Disable registration endpoint if not needed (comment out route)
- [ ] Monitor failed login attempts (check scrape_reports logs)

#### Infrastructure Security
- [ ] Keep Docker and system packages updated
- [ ] Enable firewall (ufw/iptables) - allow only necessary ports
- [ ] Regular automated backups (database + .env configuration)
- [ ] Monitor logs for suspicious activity (failed logins, rate limit hits)
- [ ] Limit container resources (memory, CPU) to prevent DoS
- [ ] Use non-root user in containers (already configured)
- [ ] Implement log rotation (prevent disk filling)
- [ ] Set up monitoring/alerting (see MONITORING.md)

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
