# 🔍 Common Issues

Solutions to frequently encountered problems in Allo-Scrapper.

**Related Documentation:**
- [Installation Guide](../getting-started/installation.md) - Initial setup
- [Docker Deployment](../guides/deployment/docker.md) - Docker issues
- [Networking Guide](../guides/deployment/networking.md) - Network and CORS issues
- [API Reference](../reference/api/README.md) - API endpoints

---

## Table of Contents

- [Database Issues](#database-issues)
- [Scraper Issues](#scraper-issues)
- [API Issues](#api-issues)
- [Docker Issues](#docker-issues)
- [Network and CORS Issues](#network-and-cors-issues)
- [Authentication Issues](#authentication-issues)
- [Build and Deployment Issues](#build-and-deployment-issues)
- [General Troubleshooting Steps](#general-troubleshooting-steps)
- [Getting Help](#getting-help)

---

## Database Issues

### Problem: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Cause:** PostgreSQL is not running or not accessible.

**Solution:**

```bash
# Check if PostgreSQL is running
docker compose ps

# Check environment variables
cat .env | grep POSTGRES

# Restart database
docker compose restart ics-db

# View database logs
docker compose logs ics-db

# Verify connection
docker compose exec ics-db psql -U postgres -d ics -c "SELECT 1;"
```

---

### Problem: `relation "films" does not exist`

**Cause:** Database migration not applied.

**Solution:**

```bash
# Run migration manually
docker compose exec ics-web npm run db:migrate

# Or connect to database and run schema manually
docker compose exec ics-db psql -U postgres -d ics

# In psql:
\i /path/to/schema.sql
```

---

### Problem: Users table not found

**Cause:** Database migration not applied (v2.0.0+ requires users table).

**Solution:**

```bash
# Apply migration manually
docker compose exec -T ics-db psql -U postgres -d ics < migrations/003_add_users_table.sql

# Verify table exists
docker compose exec ics-db psql -U postgres -d ics -c "\d users"

# Restart application
docker compose restart ics-web

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq
```

---

### Problem: Old data persisting after config changes

**Cause:** Changes to `cinemas.json` not reflected in database.

**Solution:**

```bash
# The config directory is volume-mounted, so API changes are visible on host immediately.

# If you manually edited cinemas.json on the host, restart the server to pick up changes:
docker compose restart ics-web

# Trigger a new scrape to fetch data for updated cinemas:
curl -X POST http://localhost:3000/api/scraper/trigger

# If the JSON file and database diverged (e.g. after manual DB edits), resync:
curl http://localhost:3000/api/cinemas/sync

# Full reset (clears all data):
docker compose down -v
docker compose up -d
```

---

## Scraper Issues

### Problem: Scraper not running

**Symptoms:** No showtimes appearing after scrape trigger.

**Solution:**

```bash
# Check scraper status
curl http://localhost:3000/api/scraper/status

# View server logs
docker compose logs ics-web

# Check scrape reports
curl http://localhost:3000/api/reports

# Manually trigger scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# Watch progress in real-time
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/scraper/progress
```

---

### Problem: Cinema-specific scraping fails

**Symptoms:** Specific cinema always fails during scrape.

**Solution:**

```bash
# Check if cinema exists in database
curl http://localhost:3000/api/cinemas | jq '.data[] | select(.id=="C0089")'

# Test scraping single cinema
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"cinemaId":"C0089"}'

# View error details in scrape report
curl http://localhost:3000/api/reports | jq '.data.items[0].errors'

# Common causes:
# - Cinema ID changed on source website
# - HTML structure changed (parser needs update)
# - Rate limiting from source website
```

---

### Problem: Rate limiting from source website

**Symptoms:** Frequent HTTP 429 or 503 errors during scraping.

**Solution:**

```bash
# Increase delays between requests
# Edit .env:
SCRAPE_THEATER_DELAY_MS=5000  # Increase from 3000
SCRAPE_MOVIE_DELAY_MS=1000    # Increase from 500

# Restart application
docker compose restart ics-web

# Reduce number of days scraped
SCRAPE_DAYS=3  # Reduce from 7

# Consider using scraper microservice mode for better rate limiting
USE_REDIS_SCRAPER=true
```

---

## API Issues

### Problem: `Cannot GET /api/films`

**Cause:** Server not running or API route not working.

**Solution:**

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Verify API base URL in client
cat client/.env | grep VITE_API_BASE_URL

# Check server logs for errors
docker compose logs ics-web -f

# Restart services
docker compose restart
```

---

### Problem: API returns empty data

**Cause:** Database is empty or scraper hasn't run.

**Solution:**

```bash
# Check if database has data
docker compose exec ics-db psql -U postgres -d ics -c "SELECT COUNT(*) FROM cinemas;"

# Trigger scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# Wait for scrape to complete (check status)
curl http://localhost:3000/api/scraper/status

# Verify data exists
curl http://localhost:3000/api/films | jq '.data.films | length'
```

---

## Docker Issues

### Problem: Port already in use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
echo "PORT=8080" >> .env
docker compose up -d
```

---

### Problem: Docker build fails

**Symptoms:** Build errors during `docker compose up --build`.

**Solution:**

```bash
# Clear Docker cache
docker builder prune -a

# Remove existing images
docker rmi allo-scrapper:latest

# Rebuild from scratch
docker compose build --no-cache

# Check Dockerfile syntax
docker build -t test .

# View detailed build logs
docker compose build --progress=plain
```

---

### Problem: Container keeps restarting

**Symptoms:** Container status shows "Restarting".

**Solution:**

```bash
# View container logs
docker compose logs ics-web --tail=100

# Check health status
docker inspect ics-web | jq '.[0].State.Health'

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Port conflict

# Disable restart policy temporarily
docker update --restart=no ics-web

# Fix the issue, then re-enable
docker update --restart=unless-stopped ics-web
```

---

### Problem: Volume permission errors

**Error:** `EACCES: permission denied`

**Solution:**

```bash
# Check volume permissions
docker compose exec ics-web ls -la /app

# Fix ownership (run as root)
docker compose exec -u root ics-web chown -R node:node /app

# Or recreate volumes
docker compose down -v
docker compose up -d
```

---

## Network and CORS Issues

### Problem: "Failed to fetch" or network errors in browser

**Symptoms:** Homepage loads but shows "Failed to load data".

**Solution:**

```bash
# 1. Verify CORS configuration includes your server IP
cat .env | grep ALLOWED_ORIGINS
# Should show: ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# 2. If missing, add your server IP
echo "ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000" >> .env

# 3. Restart container
docker compose restart ics-web

# 4. Clear browser cache and reload page
```

---

### Problem: CORS error in browser console

**Error:**
```
Access to fetch at 'http://192.168.1.100:3000/api/films' from origin 
'http://192.168.1.100:3000' has been blocked by CORS policy
```

**Solution:**

```bash
# Add the exact origin (including `http://`) to ALLOWED_ORIGINS in .env
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Restart
docker compose restart ics-web
```

See [Networking Guide](../guides/deployment/networking.md) for complete network troubleshooting.

---

### Problem: Cannot connect from another device

**Checklist:**

```bash
# 1. Verify server is accessible
ping 192.168.1.100

# 2. Check firewall
sudo ufw status  # Linux
sudo ufw allow 3000/tcp

# 3. Verify Docker container is running
docker compose ps

# 4. Test API directly
curl http://192.168.1.100:3000/api/health
```

---

## Authentication Issues

### Problem: "JWT secret not configured" error

**Symptoms:** 500 error on `/api/auth/login`, server logs show `JWT_SECRET must be configured`.

**Solution:**

```bash
# 1. Generate a secure secret
openssl rand -base64 32

# Example output: Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=

# 2. Add to .env file
echo "JWT_SECRET=Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=" >> .env

# 3. Restart services
docker compose restart ics-web

# 4. Verify authentication works
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq
```

---

### Problem: "Invalid token" or "Unauthorized" errors

**Possible Causes:**

**1. JWT_SECRET was changed (invalidates all tokens)**

```bash
# Check if JWT_SECRET changed recently
cat .env | grep JWT_SECRET

# If changed, all users must re-login
```

**2. Token malformed or missing**

```bash
# Check Authorization header format
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -v

# Header must be exactly: Authorization: Bearer <token>
# Common mistakes:
# ❌ Authorization: YOUR_TOKEN (missing "Bearer ")
# ❌ Authorization: Bearer: YOUR_TOKEN (extra colon)
# ❌ Missing Authorization header entirely
```

---

### Problem: Rate limited on login attempts

**Symptoms:** 429 Too Many Requests on `/api/auth/login`.

**Solution:**

```bash
# Option 1: Wait for rate limit window to reset
# Check Retry-After header for exact time:
curl -I http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'

# Retry-After: 896  (seconds until reset, ~15 minutes)

# Option 2: Restart server to clear rate limit (development only)
docker compose restart ics-web

# Option 3: Configure higher limit (in .env)
RATE_LIMIT_AUTH_MAX=10  # Allow 10 failed attempts instead of 5
docker compose restart ics-web
```

**Note:** Successful logins do NOT count toward rate limit - only failed attempts.

---

### Problem: Cannot change default admin password

**Symptoms:** `/api/auth/change-password` returns 401 "Current password is incorrect".

**Solution:**

```bash
# 1. Verify you can login with current password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq

# 2. Get token from response
TOKEN="<token_from_step_1>"

# 3. Change password with correct current password
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin","newPassword":"NewSecurePass123!"}'

# 4. Verify new password works
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewSecurePass123!"}' | jq
```

---

## Build and Deployment Issues

### Problem: npm ci fails in Docker build

**Error:** `npm ERR! code ELIFECYCLE` or dependency resolution errors.

**Solution:**

```bash
# Delete package-lock.json and regenerate
rm server/package-lock.json client/package-lock.json
cd server && npm install && cd ..
cd client && npm install && cd ..

# Commit new package-lock.json
git add server/package-lock.json client/package-lock.json
git commit -m "chore: regenerate package-lock.json"

# Rebuild Docker image
docker compose build --no-cache
```

---

### Problem: GitHub Actions build fails

**Common Causes:**

**1. Tests fail**

```bash
# Run tests locally first
cd server && npm run test:run

# Fix failing tests before pushing
```

**2. TypeScript errors**

```bash
# Check TypeScript compilation
cd server && npx tsc --noEmit

# Fix type errors before pushing
```

**3. Docker build fails**

```bash
# Test Docker build locally
docker build -t test .

# Check Dockerfile syntax
```

**4. Permissions error**

```bash
# Settings → Actions → General → Workflow permissions
# Must be "Read and write permissions"
```

---

### Problem: Pre-built image not found

**Error:** `Error response from daemon: manifest for ghcr.io/phbassin/allo-scrapper:latest not found`

**Solution:**

```bash
# Check available tags
docker search ghcr.io/phbassin/allo-scrapper

# Or use GitHub API
gh api \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/allo-scrapper/versions \
  | jq -r '.[].metadata.container.tags[]'

# Use correct tag
docker pull ghcr.io/phbassin/allo-scrapper:stable

# Or build locally
docker compose -f docker-compose.build.yml up --build -d
```

---

## General Troubleshooting Steps

### 1. Check Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f ics-web

# Last 100 lines
docker compose logs --tail=100 ics-web
```

### 2. Verify Environment Variables

```bash
# Check .env file
cat .env

# Verify required variables are set
grep -E "POSTGRES_|JWT_SECRET|ALLOWED_ORIGINS" .env
```

### 3. Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart ics-web

# Full restart (recreate containers)
docker compose down && docker compose up -d
```

### 4. Clean Slate

```bash
# Stop and remove all containers, volumes
docker compose down -v

# Remove all images
docker rmi $(docker images -q allo-scrapper*)

# Rebuild from scratch
docker compose up --build -d
```

### 5. Check Service Health

```bash
# View service status
docker compose ps

# Check health
curl http://localhost:3000/api/health

# Database connection
docker compose exec ics-db psql -U postgres -d ics -c "SELECT 1;"

# Redis connection
docker compose exec ics-redis redis-cli ping
```

---

## Getting Help

If you can't resolve the issue:

1. **Check existing issues**: https://github.com/PhBassin/allo-scrapper/issues
2. **Create new issue**: Include:
   - Error message (full text)
   - Steps to reproduce
   - Environment (OS, Docker version, Node version)
   - Relevant logs
3. **Ask in discussions**: https://github.com/PhBassin/allo-scrapper/discussions

---

## Related Documentation

- [Installation Guide](../getting-started/installation.md) - Initial setup and environment variables
- [Docker Deployment](../guides/deployment/docker.md) - Docker issues and deployment
- [Networking Guide](../guides/deployment/networking.md) - Network and CORS issues
- [API Reference](../reference/api/README.md) - API endpoints and usage
- [Testing Guide](../guides/development/testing.md) - Running tests
- [CI/CD Guide](../guides/development/cicd.md) - Build and deployment automation

---

[← Back to Troubleshooting](./README.md) | [Back to Documentation](../README.md)
