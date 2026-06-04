# Configuration

Environment variable reference for Allo-Scrapper.

## Table of Contents

- [How Configuration Works](#how-configuration-works)
- [Production Variables (.env.example)](#production-variables-envexample)
- [Development Overrides (.env.dev.example)](#development-overrides-envdevexample)
- [Monitoring Variables (.env.monitoring.example)](#monitoring-variables-envmonitoringexample)
- [Coolify Deployment (.env.coolify)](#coolify-deployment-envcoolify)
- [Internal Variables (Hardcoded in Compose)](#internal-variables-hardcoded-in-compose)
- [Configuration Examples](#configuration-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting Configuration](#troubleshooting-configuration)

---

## How Configuration Works

The project uses **4 environment files** for different purposes:

| File | Purpose | When to Use |
|------|---------|-------------|
| `.env.example` | Production template (5 variables) | Always copy to `.env` first |
| `.env.dev.example` | Development overrides | Append to `.env` for local dev |
| `.env.monitoring.example` | Observability stack vars | Only when running monitoring |
| `.env.coolify` | Coolify deployment template | Only for Coolify deployments |

**Key design principle:** Only secrets and deployment-specific values go in `.env`. Everything else is hardcoded in `docker-compose.yaml` so users don't need to configure it.

---

## Production Variables (.env.example)

Copy to `.env` and fill in:

```bash
cp .env.example .env
```

These are the **only 5 variables** you need for production:

### `IMAGE_TAG`
- **Default**: `stable`
- **Values**: `stable`, `latest`, or a specific version like `v4.2.0`
- **Notes**: Determines which Docker image tag is pulled from GHCR. Use `stable` for production.

### `POSTGRES_PASSWORD`
- **Required**: Yes
- **Example**: `SecureP@ssw0rd123`
- **Notes**: Password for the PostgreSQL container. Use a strong password.

### `JWT_SECRET`
- **Required**: Yes (server refuses to start without it)
- **Minimum**: 32 characters
- **Generate**: `openssl rand -base64 64`
- **Notes**: Never commit this to version control. Must be unique per deployment.

### `ALLOWED_ORIGINS`
- **Default**: `http://localhost:3000`
- **Example**: `https://my-app.xyz,https://www.my-app.xyz`
- **Notes**: Comma-separated CORS origins. Add every domain/browser origin that accesses the app.

### `SCRAPE_CRON_SCHEDULE`
- **Default**: `0 8 * * 3` (every Wednesday at 08:00)
- **Example**: `0 3 * * *` (every day at 3 AM)
- **Format**: Standard cron expression (minute hour dayOfMonth month dayOfWeek)
- **Tool**: Use [crontab.guru](https://crontab.guru/) to build expressions

---

## Development Overrides (.env.dev.example)

For local development, append dev overrides to your `.env`:

```bash
cat .env.example .env.dev.example > .env
```

This adds variables needed for development mode (`docker-compose.dev.yml`):

### Database (local PostgreSQL)
| Variable | Default |
|----------|---------|
| `POSTGRES_HOST` | `localhost` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | `ics` |
| `POSTGRES_USER` | `postgres` |

### Dev Server
| Variable | Default |
|----------|---------|
| `SERVER_PORT` | `3000` |
| `CLIENT_PORT` | `5173` |
| `NODE_ENV` | `development` |

### App Defaults
| Variable | Default |
|----------|---------|
| `TZ` | `Europe/Paris` |
| `LOG_LEVEL` | `info` |
| `JWT_EXPIRES_IN` | `24h` |
| `PORT` | `3000` |

### Scraper
| Variable | Default |
|----------|---------|
| `SCRAPE_MODE` | `weekly` |
| `SCRAPE_DAYS` | `7` |
| `SCRAPE_THEATER_DELAY_MS` | `3000` |
| `SCRAPE_MOVIE_DELAY_MS` | `500` |
| `SCRAPER_CONCURRENCY` | `2` |
| `SCRAPE_DELAY_MS` | `1000` |

### Advanced (commented out by default)
- `AUTO_MIGRATE`, `COOKIE_SECURE`, `REFRESH_TOKEN_EXPIRY`, `REDIS_URL`, `APP_NAME`

---

## Monitoring Variables (.env.monitoring.example)

Only needed when running the observability stack with `docker-compose.monitoring.yml`:

```bash
cp .env.monitoring.example .env.monitoring
docker compose --env-file .env --env-file .env.monitoring \
  -f docker-compose.yaml -f docker-compose.monitoring.yml up -d
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing (set to `true` only when Tempo is running) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://ics-tempo:4317` | OTLP gRPC endpoint for Tempo |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password (change in production) |

Alternatively, append these variables directly to your main `.env` file.

---

## Coolify Deployment (.env.coolify)

Template for Coolify deployments with the 5 essential variables:

```
IMAGE_TAG=stable
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=https://your-domain.coolify.io
SCRAPE_CRON_SCHEDULE=0 8 * * 3
```

---

## Internal Variables (Hardcoded in Compose)

The following variables are **hardcoded** inside `docker-compose.yaml` and do **not** need to be set in `.env`. They are listed here for reference:

| Variable | Value | Service |
|----------|-------|---------|
| `NODE_ENV` | `production` | All |
| `POSTGRES_HOST` | `ics-db` | ics-web, ics-scraper, ics-scraper-cron |
| `POSTGRES_PORT` | `5432` | ics-web, ics-scraper, ics-scraper-cron |
| `POSTGRES_DB` | `ics` | ics-web, ics-scraper, ics-scraper-cron |
| `POSTGRES_USER` | `postgres` | ics-web, ics-scraper, ics-scraper-cron |
| `PORT` | `3000` | ics-web |
| `REDIS_URL` | `redis://ics-redis:6379` | ics-web, ics-scraper, ics-scraper-cron |
| `AUTO_MIGRATE` | `true` | ics-web |
| `LOG_LEVEL` | `info` | All |
| `TZ` | `Europe/Paris` | All |
| `JWT_EXPIRES_IN` | `1h` | ics-web |
| `RUN_MODE` | `consumer` / `cron` | ics-scraper / ics-scraper-cron |
| `SCRAPE_MODE` | `from_today_limited` / `weekly` | ics-scraper / ics-scraper-cron |
| `SCRAPE_DAYS` | `7` | ics-scraper, ics-scraper-cron |

To override any of these, edit `docker-compose.yaml` directly.

---

## Configuration Examples

### Production (Docker)

```bash
# .env — only 5 variables needed
IMAGE_TAG=stable
POSTGRES_PASSWORD=my-strong-password
JWT_SECRET=$(openssl rand -base64 64)
ALLOWED_ORIGINS=https://theater.example.com
SCRAPE_CRON_SCHEDULE=0 8 * * 3
```

```bash
docker compose up -d
```

### Production + Monitoring (Docker)

```bash
# .env (same as above)
IMAGE_TAG=stable
POSTGRES_PASSWORD=my-strong-password
JWT_SECRET=$(openssl rand -base64 64)
ALLOWED_ORIGINS=https://theater.example.com
SCRAPE_CRON_SCHEDULE=0 8 * * 3

# .env.monitoring
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=my-grafana-password
```

```bash
docker compose --env-file .env --env-file .env.monitoring \
  -f docker-compose.yaml -f docker-compose.monitoring.yml up -d
```

### Development (Local)

```bash
# Append dev overrides to production template
cat .env.example .env.dev.example > .env

# Edit secrets in .env
# POSTGRES_PASSWORD=yourpassword
# JWT_SECRET=$(openssl rand -base64 64)
```

```bash
npm run dev
```

### LAN Access

```bash
# .env — add LAN IPs to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

---

## Security Best Practices

### 1. Generate Strong JWT Secret

```bash
openssl rand -base64 64
```

### 2. Use Strong Database Password

```bash
openssl rand -base64 24
```

### 3. Protect .env File

```bash
chmod 600 .env
```

### 4. Limit CORS Origins

```bash
# Only allow specific origins
ALLOWED_ORIGINS=https://theater.example.com,https://www.theater.example.com

# Never use wildcards in production
# BAD: ALLOWED_ORIGINS=*
```

### 5. Use HTTPS in Production

```bash
ALLOWED_ORIGINS=https://theater.example.com  # Good
# ALLOWED_ORIGINS=http://theater.example.com  # Bad
```

---

## Troubleshooting Configuration

### Database Connection Errors

**Error**: `ECONNREFUSED` or `connection refused`

**Solution**: In Docker, `POSTGRES_HOST` is hardcoded to `ics-db` — no configuration needed. For local dev, ensure `.env.dev.example` overrides are applied.

### CORS Errors in Browser

**Error**: `blocked by CORS policy`

**Solution**: Add your origin to `ALLOWED_ORIGINS` in `.env`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.100:3000
```

### JWT Authentication Failing

**Error**: `invalid signature` or `jwt malformed`

**Solution**: Ensure `JWT_SECRET` is set and at least 32 characters:
```bash
JWT_SECRET=$(openssl rand -base64 64)
docker compose restart
```

### Environment Variables Not Loading

**Docker variables not loading:**
- Check `.env` is in project root
- Run `docker compose config` to see resolved variables
- Restart services: `docker compose restart`

### Cron Schedule Not Working

**Scraping not happening:**
- Verify cron expression at [crontab.guru](https://crontab.guru/)
- Check logs: `docker compose logs ics-scraper-cron`

---

## Related Documentation

- [Quick Start](./quick-start.md) - Get running quickly
- [Installation](./installation.md) - Installation methods
- [Production Deployment](../guides/deployment/production.md) - Production setup
- [Monitoring](../guides/deployment/monitoring.md) - Observability stack
- [Docker Setup](../guides/deployment/docker.md) - Docker management

---

[← Back to Getting Started](./README.md) | [← Previous: Installation](./installation.md)
