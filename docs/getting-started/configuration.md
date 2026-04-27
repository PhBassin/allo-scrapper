# Configuration

Complete environment variable reference and configuration guide for Allo-Scrapper.

The canonical, always-current reference is [`.env.example`](../../.env.example) at the repo root. This page mirrors and explains it.

## Table of Contents

- [Environment File](#environment-file)
- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
  - [Database & Migrations](#database--migrations)
  - [API Server](#api-server)
  - [Scraper Service](#scraper-service)
  - [Redis](#redis)
  - [SaaS Mode](#saas-mode)
  - [Monitoring & Observability](#monitoring--observability)
  - [Rate Limiting](#rate-limiting)
  - [Performance & Caching](#performance--caching)
  - [Application Branding](#application-branding)
  - [Docker Permissions](#docker-permissions)
- [Settings Managed in the Admin UI](#settings-managed-in-the-admin-ui)
- [Configuration Examples](#configuration-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting Configuration](#troubleshooting-configuration)

---

## Environment File

Allo-Scrapper uses a `.env` file in the project root for configuration.

```bash
cp .env.example .env
nano .env
```

The `.env` file is consumed by:
- **Docker Compose** — via `env_file: .env` in `docker-compose.yml` and `docker-compose.dev.yml`.
- **Node.js services** (`server`, `scraper`) — via the `dotenv` package.
- **Vite dev server** — variables prefixed with `VITE_` only.

---

## Required Variables

The server **refuses to start** if `JWT_SECRET` is missing, shorter than 32 characters, or matches a known insecure default.

### `JWT_SECRET`

- **Description:** Secret key for signing JWT tokens (HS256).
- **Required:** Yes (no default)
- **Minimum length:** 32 characters
- **Generate:** `openssl rand -base64 64`
- **Notes:** Rotating this invalidates every existing session. Use different values per environment. Never commit.

### Database connection

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | `db` for `docker-compose.dev.yml`, `ics-db` for production `docker-compose.yml`. |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` | `ics` | |
| `POSTGRES_USER` | `postgres` | |
| `POSTGRES_PASSWORD` | `password` | **Replace in production.** |
| `DATABASE_URL` | _(constructed)_ | If set, overrides the individual `POSTGRES_*` variables. |

### `ALLOWED_ORIGINS`

- **Description:** Comma-separated list of allowed CORS origins.
- **Default:** `http://localhost:3000,http://localhost:5173`
- **Notes:** Must include every origin the browser uses, including LAN IPs (e.g. `http://192.168.1.100:3000`).

---

## Optional Variables

### Database & Migrations

#### `AUTO_MIGRATE`

- **Default:** `true`
- **Effect:** Runs pending migrations on server startup, then seeds `server/src/config/cinemas.json` into the `cinemas` table when it is empty.
- **Disable with caution:** Schema changes will not be applied automatically — you must run migrations manually before the server boots.

### API Server

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Express listen port. |
| `NODE_ENV` | `development` | `development`, `production`, or `test`. Test mode also unlocks SaaS test fixtures. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug`. |
| `APP_NAME` | `Allo-Scrapper` | Server-side identifier in logs and `/api/health`. |
| `JWT_EXPIRES_IN` | `24h` | Any `jsonwebtoken` duration string (`24h`, `7d`, `30m`, `86400`). No refresh tokens; users must re-login after expiry. |
| `TZ` | `Europe/Paris` | IANA timezone, used for cron schedules. |

### Scraper Service

The scraper is a separate workspace (`scraper/`). Production Compose runs two scraper containers (`ics-scraper` and `ics-scraper-cron`) that share the same image but use different `RUN_MODE` values.

| Variable | Default | Notes |
|---|---|---|
| `RUN_MODE` | `consumer` (in compose) | `consumer` (poll Redis queue), `cron` (scheduled), `oneshot` (pop one job and exit), `direct` (run once immediately and exit). |
| `SCRAPE_CRON_SCHEDULE` | `0 8 * * 3` | Cron expression for the `cron` scraper. The compose file maps this to the internal `CRON_SCHEDULE`. |
| `SCRAPE_THEATER_DELAY_MS` | `3000` | Delay between cinema scrapes. Lower = faster, higher = friendlier to source. |
| `SCRAPE_MOVIE_DELAY_MS` | `500` | Delay between film-detail fetches. |
| `SCRAPER_CONCURRENCY` | `2` | Cinemas processed in parallel. `1`–`5`; higher values risk HTTP 429. |
| `METRICS_PORT` | `9091` | Prometheus metrics endpoint of the scraper at `/metrics`. |

> **Removed:** `SCRAPE_DAYS` and `SCRAPE_MODE` are no longer environment variables. They are managed in the **Admin → Settings** panel and stored in the database. See [Settings Managed in the Admin UI](#settings-managed-in-the-admin-ui).

### Redis

Redis is a **mandatory** dependency. The server subscribes to the Redis `scrape:progress` channel during startup and the scraper consumes/produces jobs through Redis queues.

| Variable | Default | Notes |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Use `redis://redis:6379` in dev compose, `redis://ics-redis:6379` in production compose, or `redis://:password@host:6379` for authenticated instances. |

### SaaS Mode

Multi-tenant mode is opt-in. When disabled (default), `/superadmin` routes are not mounted and the SaaS plugin is not loaded.

| Variable | Default | Notes |
|---|---|---|
| `SAAS_ENABLED` | `false` | Backend toggle. Loads `@allo-scrapper/saas` dynamically at startup. **Requires container restart to change.** |
| `E2E_ENABLE_ORG_FIXTURE` | _(unset)_ | When the backend runs in `development`, set to `true` to expose the SaaS test-fixture endpoints (`POST /test/seed-org`, `DELETE /test/cleanup-org/:id`). They are also exposed automatically when `NODE_ENV=test`. |

### Monitoring & Observability

| Variable | Default | Notes |
|---|---|---|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing export. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://ics-tempo:4317` | Tempo OTLP gRPC endpoint. |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin login (monitoring profile only). |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | **Change in production.** |

See the [Monitoring Guide](../guides/deployment/monitoring.md) for the full observability stack.

### Rate Limiting

All limits are configurable via env vars **and** the admin UI (`/admin?tab=ratelimits`). Database values take priority over env vars; env vars serve as fallback.

| Variable | Default | Applies to |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Default sliding window for everything except registration. |
| `RATE_LIMIT_GENERAL_MAX` | `100` | All `/api/*` routes. |
| `RATE_LIMIT_AUTH_MAX` | `5` | **Failed** logins per window (successful logins are skipped). |
| `RATE_LIMIT_REGISTER_MAX` | `3` | `/api/auth/register`. |
| `RATE_LIMIT_REGISTER_WINDOW_MS` | `3600000` (1 h) | Window for the register limiter only. |
| `RATE_LIMIT_PROTECTED_MAX` | `60` | Authenticated routes (`/api/reports/*`, etc.). |
| `RATE_LIMIT_SCRAPER_MAX` | `10` | `/api/scraper/trigger`. |
| `RATE_LIMIT_PUBLIC_MAX` | `100` | Public read endpoints (films, cinemas). |
| `RATE_LIMIT_HEALTH_MAX` | `10` | `/api/health` per **minute**. Localhost and Docker/K8s internal IPs are auto-exempt; responses are cached for 5 s. |
| `RATE_LIMIT_SAAS_SLUG_MAX` | `50` | Org-slug availability checks per 15-minute window per IP (SaaS only). |

Full details: [Rate Limiting Reference](../reference/api/rate-limiting.md).

### Performance & Caching

#### `JSON_PARSE_CACHE_SIZE`

- **Default:** `10000` (≈ 1–2 MB)
- **Effect:** LRU cache for `JSON.parse` results on repeated DB fields (genres, actors, experiences). Set to `0` to disable (not recommended). Increase for high-traffic deployments with many unique films.

### Application Branding

| Variable | Default | Notes |
|---|---|---|
| `VITE_APP_NAME` | `Allo-Scrapper` | Browser title/header/footer. Read by Vite at runtime in dev; baked in at build time in Docker production builds (via `Dockerfile` build arg). |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | **Local dev only.** Production Docker builds use relative `/api` URLs and ignore this. |

### Docker Permissions

| Variable | Default | Notes |
|---|---|---|
| `IMAGE_TAG` | `latest` | Tag pulled for pre-built images (`latest`, `develop`, `v1.0.0`, …). |
| `DOCKER_UID` | `1000` | Container UID. Match your host user (`id -u`) so volume-mounted files (e.g. `cinemas.json`) are writable. macOS users typically need `501`. |
| `DOCKER_GID` | `1000` | Container GID (`id -g`). macOS typically `20`. |

---

## Settings Managed in the Admin UI

These previously env-driven values are now stored in the database and edited from the admin panel:

- **Scrape window** — `scrape_days` (1–14) and `scrape_mode` (`weekly`, `from_today`, `from_today_limited`).
- **Rate limits** — overrides for every limiter listed above.
- **Other operational settings** — see [`server/src/routes/settings.ts`](../../server/src/routes/settings.ts).

Changes through the admin UI take effect within ~30 seconds without a container restart.

---

## Configuration Examples

### Local development (no Docker)

```bash
NODE_ENV=development
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
JWT_SECRET=$(openssl rand -base64 64)   # paste the actual value
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
TZ=Europe/Paris
REDIS_URL=redis://localhost:6379
VITE_APP_NAME=Allo-Scrapper
VITE_API_BASE_URL=http://localhost:3000/api
```

### Development via Docker Compose (`npm run dev`)

```bash
NODE_ENV=development
POSTGRES_HOST=db                # docker-compose.dev.yml service name
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
JWT_SECRET=<generate-a-32+char-secret>
LOG_LEVEL=info
TZ=Europe/Paris
REDIS_URL=redis://redis:6379    # docker-compose.dev.yml service name
APP_NAME=Allo-Scrapper
VITE_APP_NAME=Allo-Scrapper
```

> The dev compose stack does **not** start the scraper container. Run `cd scraper && npm run dev` separately for end-to-end scraping in dev.

### Production (`docker-compose.yml`)

```bash
NODE_ENV=production
POSTGRES_HOST=ics-db            # production service name
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=cinema_user
POSTGRES_PASSWORD=<strong-password>
PORT=3000
ALLOWED_ORIGINS=https://cinema.example.com
JWT_SECRET=<openssl rand -base64 64>
JWT_EXPIRES_IN=24h
LOG_LEVEL=warn
TZ=Europe/Paris
SCRAPE_CRON_SCHEDULE=0 3 * * *
SCRAPE_THEATER_DELAY_MS=5000
SCRAPER_CONCURRENCY=2
REDIS_URL=redis://ics-redis:6379
RUN_MODE=consumer               # for ics-scraper; ics-scraper-cron overrides to "cron"
APP_NAME=My Cinema Portal
VITE_APP_NAME=My Cinema Portal
IMAGE_TAG=latest

# Optional: monitoring profile
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong-grafana-password>

# Optional: SaaS mode
SAAS_ENABLED=false
```

### LAN access (home network)

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://raspberrypi.local:3000
```

---

## Security Best Practices

### 1. Generate a strong `JWT_SECRET`

```bash
openssl rand -base64 64
# or
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

The server validates length and rejects known weak defaults.

### 2. Use a strong database password

```bash
openssl rand -base64 24
```

### 3. Protect `.env`

```bash
chmod 600 .env
grep -q '^.env$' .gitignore || echo '.env' >> .gitignore
```

### 4. Restrict CORS origins

Never use wildcards in production. List only the exact origins the browser will use.

### 5. Use HTTPS in production

Configure TLS termination at your reverse proxy (Caddy, Nginx, Traefik). See [Production Deployment](../guides/deployment/production.md) and [Networking](../guides/deployment/networking.md).

Full security recommendations: [Security Guide](../project/security.md).

---

## Troubleshooting Configuration

### Server refuses to start: `JWT_SECRET is required` / `JWT_SECRET too short`

Generate a 32+ character secret and set it in `.env`:

```bash
JWT_SECRET=$(openssl rand -base64 64)
```

### Database connection errors (`ECONNREFUSED`)

`POSTGRES_HOST` must match the network the server runs on:

| Where you run the server | `POSTGRES_HOST` |
|---|---|
| Production Docker Compose | `ics-db` |
| Dev Docker Compose | `db` |
| Manually on host | `localhost` |

### CORS errors in browser

Add the exact origin shown in the browser to `ALLOWED_ORIGINS` (scheme + host + port). LAN IPs and dev-server origins (`http://localhost:5173`) need to be listed explicitly.

### JWT errors (`invalid signature`, `jwt malformed`)

Token was signed with a different `JWT_SECRET` than the one currently set. Restart all services after changing the secret:

```bash
docker compose restart
```

All previously issued tokens are invalidated.

### Vite variables not appearing in the browser

- They must be prefixed with `VITE_`.
- Local dev: restart the Vite dev server.
- Docker production: variables are baked at **build time** via Docker build args. Rebuild the image, don't just restart the container.

### Cron scrapes not firing

- Verify `TZ` matches your region.
- Verify `SCRAPE_CRON_SCHEDULE` at [crontab.guru](https://crontab.guru/).
- Production logs: `docker compose logs ics-scraper-cron`.

---

## Related Documentation

- [Quick Start](./quick-start.md)
- [Installation](./installation.md)
- [Production Deployment](../guides/deployment/production.md)
- [Scraper System Architecture](../reference/architecture/scraper-system.md)
- [Troubleshooting](../troubleshooting/)
- [Security Guide](../project/security.md)

---

[← Back to Getting Started](./README.md) | [← Previous: Installation](./installation.md)
