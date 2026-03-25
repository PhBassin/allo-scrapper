# Configuration

Complete environment variable reference and configuration guide for Allo-Scrapper.

## Table of Contents

- [Environment File](#environment-file)
- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
  - [Database Configuration](#database-configuration)
  - [API Server Configuration](#api-server-configuration)
  - [Scraper Configuration](#scraper-configuration)
  - [Redis & Microservice Mode](#redis--microservice-mode)
  - [Monitoring & Observability](#monitoring--observability)
  - [Rate Limiting](#rate-limiting)
  - [Performance & Caching](#performance--caching)
  - [Application Branding](#application-branding)
- [Configuration Examples](#configuration-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting Configuration](#troubleshooting-configuration)

---

## Environment File

Allo-Scrapper uses a `.env` file in the project root for configuration.

### Creating the Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit with your preferred editor
nano .env
```

The `.env` file is automatically loaded by:
- Docker Compose (via `env_file` in docker-compose.yml)
- Node.js server (via `dotenv` package)
- Vite dev server (variables prefixed with `VITE_`)

---

## Required Variables

These variables are **required** for the application to function properly.

### `POSTGRES_HOST`
- **Description**: PostgreSQL server hostname
- **Default**: `localhost`
- **Example**: `ics-db` (Docker), `localhost` (manual), `db.example.com` (remote)
- **Notes**: Use `ics-db` when running in Docker Compose

### `POSTGRES_PORT`
- **Description**: PostgreSQL server port
- **Default**: `5432`
- **Example**: `5432`, `5433`

### `POSTGRES_DB`
- **Description**: Database name (ics = Independent Cinema Showtimes)
- **Default**: `ics`
- **Example**: `ics`, `cinema_db`

### `POSTGRES_USER`
- **Description**: Database username
- **Default**: `postgres`
- **Example**: `postgres`, `cinemauser`

### `POSTGRES_PASSWORD`
- **Description**: Database password
- **Default**: `postgres` (development only)
- **Example**: `SecureP@ssw0rd123`
- **⚠️ Important**: Use a strong password in production

### `JWT_SECRET`
- **Description**: Secret key for JWT token signing
- **Default**: None (⚠️ **REQUIRED in production**)
- **Example**: `Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=`
- **Generate**: `openssl rand -base64 32`
- **⚠️ Critical**: Never commit this to version control

### `ALLOWED_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: `http://localhost:3000,http://localhost:5173`
- **Example**: `http://localhost:3000,http://192.168.1.100:3000,https://cinema.example.com`
- **Notes**: Must include every origin the browser uses to access the app, including LAN IPs for local network access

---

## Optional Variables

### Database Configuration

#### `DATABASE_URL`
- **Description**: Full PostgreSQL connection string (overrides individual settings)
- **Default**: Constructed from `POSTGRES_*` variables
- **Example**: `postgresql://postgres:password@localhost:5432/ics`
- **Use case**: Cloud database providers (Heroku, Railway, etc.)

#### `AUTO_MIGRATE`
- **Description**: Automatically apply pending database migrations on server startup
- **Default**: `true`
- **Values**: `true`, `false`
- **Notes**:
  - `true` — Migrations run automatically each time the container starts (idempotent, safe)
  - `false` — Migrations must be applied manually via `docker compose exec ics-web npm run db:migrate`
  - Recommended to keep `true` for Docker deployments; useful to disable when running migrations separately in CI/CD

---

### API Server Configuration

#### `PORT`
- **Description**: API server port
- **Default**: `3000`
- **Example**: `8080`, `3001`

#### `NODE_ENV`
- **Description**: Node.js environment mode
- **Default**: `development`
- **Values**: `development`, `production`, `test`
- **Effects**: 
  - `production`: Optimized builds, less verbose logging
  - `development`: Hot reload, detailed error messages, verbose logging

#### `LOG_LEVEL`
- **Description**: Log verbosity level
- **Default**: `info`
- **Values**: `error`, `warn`, `info`, `debug`
- **Production**: Recommended `warn` or `error`

#### `APP_NAME`
- **Description**: Application name used in server logs, health check API, and service identifiers
- **Default**: `Allo-Scrapper`
- **Example**: `My Cinema Portal`
- **Notes**: Server-side only; does not affect frontend UI

#### `JWT_EXPIRES_IN`
- **Description**: JWT token expiration duration
- **Default**: `24h` (24 hours)
- **Format**: Any valid `jsonwebtoken` duration string
- **Examples**: 
  - `24h` - 24 hours (default)
  - `7d` - 7 days
  - `30m` - 30 minutes
  - `1h` - 1 hour
  - `168h` - 1 week (7 × 24 hours)
- **Notes**: 
  - Determines how long users stay logged in before needing to re-authenticate
  - Client automatically logs users out when token expires (proactive expiry handling)
  - Shorter durations = more secure but more frequent logins
  - Longer durations = better UX but tokens remain valid longer if compromised
  - No refresh tokens; users must re-enter credentials after expiry
- **Security**: Balance security (shorter) vs convenience (longer) based on your threat model
- **Production**: Consider `12h` or `24h` for internal tools, shorter for public-facing apps

---

### Scraper Configuration

#### `TZ`
- **Description**: Timezone for cron jobs (IANA format)
- **Default**: `Europe/Paris`
- **Example**: `America/New_York`, `Asia/Tokyo`, `UTC`
- **Find yours**: [List of IANA timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

#### `SCRAPE_CRON_SCHEDULE`
- **Description**: Cron expression for scheduled scraping
- **Default**: `0 8 * * 3` (Every Wednesday at 8:00 AM)
- **Examples**:
  - `0 3 * * *` - Every day at 3:00 AM
  - `0 */6 * * *` - Every 6 hours
  - `*/30 * * * *` - Every 30 minutes
  - `0 0 * * 0` - Every Sunday at midnight
- **Tools**: Use [crontab.guru](https://crontab.guru/) to build expressions
- **Notes**: 
  - Used by both the in-process cron (ics-web) and scraper microservice cron (ics-scraper-cron)
  - Internal variable `CRON_SCHEDULE` is automatically set from this value in docker-compose.yml

#### `SCRAPE_THEATER_DELAY_MS`
- **Description**: Delay between cinema scrapes (milliseconds)
- **Default**: `3000` (3 seconds)
- **Range**: `1000` - `10000`
- **Notes**: 
  - Lower values = faster scraping, higher values = more polite to source website
  - ⚠️ **Docker Compose**: `SCRAPE_DELAY_MS` in docker-compose.yml is obsolete and ignored (use `SCRAPE_THEATER_DELAY_MS` in `.env` instead)

#### `SCRAPE_MOVIE_DELAY_MS`
- **Description**: Delay between film detail fetches (milliseconds)
- **Default**: `500` (0.5 seconds)
- **Range**: `100` - `2000`

#### `SCRAPE_DAYS`
- **Description**: Number of days ahead to scrape
- **Default**: `7`
- **Range**: `1` - `14`
- **Examples**:
  - `7` - One week
  - `14` - Two weeks
  - `3` - Next 3 days only

#### `SCRAPE_MODE`
- **Description**: Start date for scraping window
- **Default**: `weekly`
- **Values**:
  - `weekly` - Start from next Wednesday
  - `from_today` - Start from today
  - `from_today_limited` - Start from today, limited days
- **Use case**: `weekly` for weekly schedules, `from_today` for daily updates

---

### Redis & Microservice Mode

#### `REDIS_URL`
- **Description**: Redis connection URL (required for scraper microservice)
- **Default**: `redis://localhost:6379`
- **Example**: `redis://ics-redis:6379` (Docker), `redis://:password@localhost:6379` (with auth)

#### `USE_REDIS_SCRAPER`
- **Description**: Delegate scraping to the Redis-backed microservice
- **Default**: `false`
- **Values**: `true`, `false`
- **Notes**: 
  - `false` - In-process scraping (legacy mode)
  - `true` - Microservice scraping (requires Redis and scraper container)
  - See [Scraper System Architecture](../reference/architecture/scraper-system.md)

#### `METRICS_PORT`
- **Description**: Port for Prometheus metrics endpoint (scraper microservice only)
- **Default**: `9091`
- **Example**: `9091`, `9092`
- **Notes**: 
  - Only used by the scraper microservice (`ics-scraper` container)
  - Exposes metrics at `http://localhost:9091/metrics`
  - See [Monitoring Guide](../guides/deployment/monitoring.md) for Prometheus configuration

---

### Monitoring & Observability

#### `OTEL_ENABLED`
- **Description**: Enable OpenTelemetry distributed tracing
- **Default**: `false`
- **Values**: `true`, `false`
- **Notes**: Requires Tempo instance (included in monitoring profile)

#### `OTEL_EXPORTER_OTLP_ENDPOINT`
- **Description**: OTLP gRPC endpoint for Tempo
- **Default**: `http://ics-tempo:4317`
- **Example**: `http://localhost:4317`, `http://tempo.example.com:4317`

#### `GRAFANA_ADMIN_USER`
- **Description**: Grafana admin username
- **Default**: `admin`
- **Example**: `admin`, `grafana-admin`

#### `GRAFANA_ADMIN_PASSWORD`
- **Description**: Grafana admin password
- **Default**: `admin`
- **Example**: `SecureGrafanaP@ss`
- **⚠️ Important**: Change default in production

See [Monitoring Guide](../guides/deployment/monitoring.md) for complete observability stack setup.

---

### Rate Limiting

All rate limits are configurable via environment variables. They can also be overridden at runtime via the admin UI (database values take priority over env vars).

See [Rate Limiting Reference](../reference/api/rate-limiting.md) for full documentation.

#### `RATE_LIMIT_WINDOW_MS`
- **Description**: Default sliding window duration for all limiters except registration (milliseconds)
- **Default**: `900000` (15 minutes)
- **Range**: 60000–3600000 (1 min – 1 hour)

#### `RATE_LIMIT_GENERAL_MAX`
- **Description**: Max requests per window for general `/api/*` routes
- **Default**: `100`

#### `RATE_LIMIT_AUTH_MAX`
- **Description**: Max **failed** login attempts per window
- **Default**: `5`
- **Notes**: Successful logins do not count toward this limit

#### `RATE_LIMIT_REGISTER_MAX`
- **Description**: Max user registrations per window
- **Default**: `3`

#### `RATE_LIMIT_REGISTER_WINDOW_MS`
- **Description**: Window duration for the registration limiter (milliseconds)
- **Default**: `3600000` (1 hour)

#### `RATE_LIMIT_PROTECTED_MAX`
- **Description**: Max requests per window for authenticated endpoints (e.g., reports)
- **Default**: `60`

#### `RATE_LIMIT_SCRAPER_MAX`
- **Description**: Max scrape triggers per window
- **Default**: `10`

#### `RATE_LIMIT_PUBLIC_MAX`
- **Description**: Max requests per window for public read endpoints (films, cinemas)
- **Default**: `100`

#### `RATE_LIMIT_HEALTH_MAX`
- **Description**: Max health-check requests per **minute** per IP address
- **Default**: `10`
- **Notes**: Localhost and Docker/Kubernetes internal IPs are automatically exempt

---

#### `JSON_PARSE_CACHE_SIZE`
- **Description**: Maximum number of cached JSON parse results
- **Default**: `10000`
- **Example**: `50000`, `100000`
- **Memory impact**: 
  - 10,000 entries ≈ 1-2 MB
  - 50,000 entries ≈ 5-10 MB
  - 100,000 entries ≈ 10-20 MB
- **Use case**: 
  - **Default (10,000)**: Suitable for most deployments (hundreds of films, dozens of cinemas)
  - **Large (50,000+)**: High-traffic deployments with thousands of films or very frequent API calls
  - **Small (5,000)**: Memory-constrained environments (e.g., Raspberry Pi, low-tier VPS)
- **Notes**: 
  - Caches parsed JSON values from database queries (genres, actors, experiences)
  - Uses LRU eviction strategy (no performance spikes from cache clearing)
  - Monitor cache effectiveness via `getJSONParseCacheStats()` in code
  - Typical hit rate: 95-99% for production workloads
- **When to increase**:
  - Low cache hit rate (<90%) in logs
  - High volume of unique films/cinemas
  - Frequent API calls with many concurrent users
- **When to decrease**:
  - Memory constraints
  - Small deployments (few cinemas, limited films)

---

### Application Branding

#### `VITE_APP_NAME`
- **Description**: Application name for React UI (browser title, header, footer)
- **Default**: `Allo-Scrapper`
- **Example**: `My Cinema Portal`, `Cinema Showtimes`
- **Notes**: 
  - Requires `VITE_` prefix for Vite to expose to frontend
  - Requires rebuild to take effect: `docker compose restart ics-client`

#### `VITE_API_BASE_URL`
- **Description**: API base URL for Vite dev server (local development only)
- **Default**: `/api`
- **Example**: `http://localhost:3000/api`
- **Notes**: 
  - Production Docker builds use relative URLs (`/api`) automatically
  - Only affects local development with Vite dev server

---

## Configuration Examples

### Development (Local)

```bash
# .env for local development
NODE_ENV=development
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
JWT_SECRET=dev-secret-do-not-use-in-production
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
TZ=Europe/Paris
SCRAPE_CRON_SCHEDULE=0 8 * * 3
SCRAPE_DAYS=7
APP_NAME=Allo-Scrapper
VITE_APP_NAME=Allo-Scrapper
VITE_API_BASE_URL=/api
```

### Development (Docker Compose)

```bash
# .env for Docker Compose development
NODE_ENV=development
POSTGRES_HOST=ics-db
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
JWT_SECRET=dev-secret-do-not-use-in-production
JWT_EXPIRES_IN=24h
LOG_LEVEL=info
TZ=Europe/Paris
SCRAPE_CRON_SCHEDULE=0 8 * * 3
APP_NAME=Allo-Scrapper
VITE_APP_NAME=Allo-Scrapper
```

### Production

```bash
# .env for production
NODE_ENV=production
POSTGRES_HOST=ics-db
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=cinema_user
POSTGRES_PASSWORD=<STRONG_PASSWORD_HERE>
PORT=3000
ALLOWED_ORIGINS=https://cinema.example.com,https://www.cinema.example.com
JWT_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>
JWT_EXPIRES_IN=24h
LOG_LEVEL=warn
TZ=Europe/Paris
SCRAPE_CRON_SCHEDULE=0 3 * * *
SCRAPE_THEATER_DELAY_MS=5000
SCRAPE_DAYS=14
APP_NAME=My Cinema Portal
VITE_APP_NAME=My Cinema Portal

# Optional: Monitoring
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<STRONG_GRAFANA_PASSWORD>

# Optional: Microservice scraper
USE_REDIS_SCRAPER=true
REDIS_URL=redis://ics-redis:6379
```

### LAN Access (Home Network)

```bash
# .env for LAN access
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://raspberrypi.local:3000
# Add all IP addresses and hostnames that browsers will use
```

---

## Security Best Practices

### 1. Generate Strong JWT Secret

```bash
# Generate secure secret
openssl rand -base64 32

# Add to .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### 2. Use Strong Database Password

```bash
# Generate random password
openssl rand -base64 24

# Update .env
POSTGRES_PASSWORD=<generated_password>
```

### 3. Protect .env File

```bash
# Set restrictive permissions
chmod 600 .env

# Ensure .env is in .gitignore
echo ".env" >> .gitignore
```

### 4. Limit CORS Origins

```bash
# Only allow specific origins
ALLOWED_ORIGINS=https://cinema.example.com,https://www.cinema.example.com

# Avoid wildcards in production
# BAD: ALLOWED_ORIGINS=*
```

### 5. Use HTTPS in Production

```bash
# Always use HTTPS URLs in production
ALLOWED_ORIGINS=https://cinema.example.com  # Good
# ALLOWED_ORIGINS=http://cinema.example.com  # Bad
```

See [Security Guide](../project/security.md) for complete security recommendations.

---

## Troubleshooting Configuration

### Database Connection Errors

**Error**: `ECONNREFUSED` or `connection refused`

**Solution**: Check `POSTGRES_HOST` matches your setup:
```bash
# Docker Compose
POSTGRES_HOST=ics-db

# Local PostgreSQL
POSTGRES_HOST=localhost
```

### CORS Errors in Browser

**Error**: `blocked by CORS policy`

**Solution**: Add your origin to `ALLOWED_ORIGINS`:
```bash
# Include all origins browsers use to access the app
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.100:3000
```

### JWT Authentication Failing

**Error**: `invalid signature` or `jwt malformed`

**Solution**: Ensure `JWT_SECRET` is set and consistent:
```bash
# Generate new secret
JWT_SECRET=$(openssl rand -base64 32)

# Restart services
docker compose restart
```

### Environment Variables Not Loading

**Vite variables not working:**
- Must be prefixed with `VITE_`
- Require rebuild: `docker compose restart ics-client`

**Docker variables not loading:**
- Check `.env` is in project root
- Verify `env_file: .env` in docker-compose.yml
- Restart services: `docker compose restart`

### Cron Schedule Not Working

**Scraping not happening:**
- Verify timezone matches your region: `TZ=Europe/Paris`
- Test expression at [crontab.guru](https://crontab.guru/)
- Check logs: `docker compose logs ics-web | grep cron`

---

## Related Documentation

- [Quick Start](./quick-start.md) - Get running quickly
- [Installation](./installation.md) - Installation methods
- [Production Deployment](../guides/deployment/production.md) - Production setup
- [Troubleshooting](../troubleshooting/) - Common issues
- [Security Guide](../project/security.md) - Security best practices

---

[← Back to Getting Started](./README.md) | [← Previous: Installation](./installation.md)
