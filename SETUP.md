# 💻 Development Setup Guide

[← Back to README](./README.md)

Complete guide for setting up your development environment.

**Related Documentation:**
- [Environment Variables](#environment-variables) - Configuration reference
- [Docker Deployment](./DOCKER.md) - Docker setup and deployment
- [Testing Guide](./TESTING.md) - Running tests
- [Troubleshooting](./TROUBLESHOOTING.md) - Common setup issues

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
  - [Option B: Manual Setup](#option-b-manual-setup-local-postgresql)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)

---

## Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **PostgreSQL**: 15.x or higher (or use Docker)
- **Git**: For version control
- **Docker** (optional): For containerized development

---

## Development Setup

### Option A: Docker Compose (Recommended)

This method runs all services (PostgreSQL, API, Client) in containers:

```bash
# Clone the repository
git clone https://github.com/yourusername/allo-scrapper.git
cd allo-scrapper

# Copy environment configuration
cp .env.example .env

# Start all services with hot-reload
npm run dev

# In another terminal, initialize the database (if not already migrated)
docker compose -f docker-compose.dev.yml exec server npm run db:migrate

# View logs
npm run dev:logs
```

**Services will be available at:**
- API: http://localhost:3000
- Client (dev server): http://localhost:5173
- PostgreSQL: localhost:5432

**Stop all services:**
```bash
npm run dev:down
```

---

### Option B: Manual Setup (Local PostgreSQL)

If you prefer running services outside Docker:

#### 1. Setup PostgreSQL

```bash
# Install PostgreSQL 15+ (macOS example)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb ics
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env to match your local PostgreSQL settings
```

#### 3. Install Dependencies

```bash
# Install root dependencies (optional, for convenience scripts)
npm ci

# Install server dependencies
cd server
npm ci
cd ..

# Install client dependencies
cd client
npm ci
cd ..
```

#### 4. Initialize Database

```bash
cd server
npm run db:migrate
cd ..
```

#### 5. Start Services

**Terminal 1 - API Server:**
```bash
cd server
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 2 - React Client:**
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

#### 6. Trigger Initial Scrape

```bash
# In another terminal
curl -X POST http://localhost:3000/api/scraper/trigger
```

---

## Environment Variables

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `POSTGRES_HOST` | PostgreSQL server hostname | `localhost` | `db` |
| `POSTGRES_PORT` | PostgreSQL server port | `5432` | `5432` |
| `POSTGRES_DB` | Database name (`ics` = Independent Cinema Showtimes) | `ics` | `ics` |
| `POSTGRES_USER` | Database username | `postgres` | `myuser` |
| `POSTGRES_PASSWORD` | Database password | `password` | `securepass123` |
| `PORT` | API server port | `3000` | `8080` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins. Must include every origin the browser uses to reach the app — including LAN IPs (e.g. `http://192.168.1.100:3000`) for local network installs. | `http://localhost:3000,http://localhost:5173` | `http://localhost:3000,http://192.168.1.100:3000` |
| `JWT_SECRET` | Secret key for JWT token signing (⚠️ **REQUIRED in production**, no default fallback for security) | — | `openssl rand -base64 32` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string (overrides individual settings above) | — | `postgresql://postgres:password@localhost:5432/ics` |
| `TZ` | Timezone for cron jobs (IANA format) | `Europe/Paris` | `America/New_York` |
| `SCRAPE_CRON_SCHEDULE` | Cron expression for scheduled scraping | `0 8 * * 3` | `0 3 * * *` |
| `SCRAPE_THEATER_DELAY_MS` | Delay between cinema scrapes (ms) | `3000` | `5000` |
| `SCRAPE_MOVIE_DELAY_MS` | Delay between film detail fetches (ms) | `500` | `1000` |
| `SCRAPE_DAYS` | Number of days to scrape (1-14) | `7` | `14` |
| `SCRAPE_MODE` | Start date: `weekly` (Wed), `from_today`, or `from_today_limited` | `weekly` | `from_today_limited` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `REDIS_URL` | Redis connection URL (required for scraper microservice) | `redis://localhost:6379` | `redis://ics-redis:6379` |
| `USE_REDIS_SCRAPER` | Delegate scraping to the Redis microservice | `false` | `true` |
| `LOG_LEVEL` | Log verbosity (`error`, `warn`, `info`, `debug`) | `info` | `debug` |
| `OTEL_ENABLED` | Enable OpenTelemetry distributed tracing | `false` | `true` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP gRPC endpoint for Tempo | `http://ics-tempo:4317` | `http://ics-tempo:4317` |
| `GRAFANA_ADMIN_USER` | Grafana admin username | `admin` | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | `admin` | `securepass` |
| `APP_NAME` | Application name used in server logs, health check API, and service identifiers | `Allo-Scrapper` | `My Cinema App` |
| `VITE_APP_NAME` | Application name for React UI (browser title, header, footer). Requires `VITE_` prefix for Vite. | `Allo-Scrapper` | `My Cinema App` |
| `VITE_API_BASE_URL` | API base URL for Vite dev server (local development only). Production Docker builds use relative URLs (`/api`) automatically and ignore this variable. | `/api` | `http://localhost:3000/api` |

### Cron Schedule Examples

- `0 8 * * 3` - Every Wednesday at 8:00 AM (default)
- `0 3 * * *` - Every day at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

### Generating JWT Secret

For production deployments, generate a secure JWT secret:

```bash
# Generate a 32-byte random string (base64 encoded)
openssl rand -base64 32

# Example output: Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=

# Add to .env
echo "JWT_SECRET=Kx7JhF9mP3nQ8wE2vY5zL1dR6sT4cW0oA9bN8xM7uI=" >> .env
```

---

## Available Scripts

### Root Scripts (Convenience)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development stack (Docker Compose) |
| `npm run dev:down` | Stop development stack |
| `npm run dev:logs` | View development logs |
| `npm run build` | Build server and client |
| `npm run docker:build` | Build and start using docker-compose.build.yml |
| `npm run docker:build:local` | Build Docker image locally with tag |
| `npm run docker:pull` | Pull latest images from GitHub Container Registry |
| `npm run docker:up` | Start production stack (uses pre-built images) |
| `npm run docker:down` | Stop production stack |
| `npm run docker:logs` | View production logs |
| `npm run docker:restart` | Restart web service |
| `npm run docker:clean` | Remove containers and volumes |
| `npm run deploy` | Pull latest image and redeploy |
| `npm run backup` | Backup database |
| `npm run server:dev` | Start API server in dev mode |
| `npm run server:build` | Build API server |
| `npm run server:start` | Start built API server |
| `npm run server:db:migrate` | Initialize/update database schema |
| `npm run server:scrape` | Trigger one-time scrape |
| `npm run client:dev` | Start client dev server |
| `npm run client:build` | Build client for production |
| `npm run client:preview` | Preview production client build |
| `npm run install:all` | Install dependencies for all packages |
| `npm run clean` | Remove all build artifacts and node_modules |
| `npm test` | Run server tests |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run e2e:headed` | Run E2E tests in headed (visible) browser |
| `npm run e2e:ui` | Open Playwright interactive UI |
| `npm run integration-test` | Run full-stack integration test (Docker + E2E) |

### Server Scripts

```bash
cd server
npm run dev           # Start with tsx watch (hot-reload)
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled server
npm run db:migrate    # Initialize database schema
npm run scrape        # Run scraper once
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage
```

### Client Scripts

```bash
cd client
npm run dev           # Start Vite dev server (port 5173)
npm run build         # Build for production (outputs to dist/)
npm run lint          # Run ESLint
npm run preview       # Preview production build
```

---

## Git Hooks

The project includes a pre-push hook to ensure code quality:

```bash
# Install git hooks (run once after cloning)
./scripts/install-hooks.sh
```

The pre-push hook automatically runs:
1. TypeScript type checking (`tsc --noEmit`)
2. Unit tests (`npm run test:run`)

If either fails, the push is blocked until issues are resolved.

---

## Development Workflow

### Typical Development Session

```bash
# 1. Start development services
npm run dev

# 2. In another terminal, verify services are running
curl http://localhost:3000/api/health

# 3. Access the client
open http://localhost:5173

# 4. Make code changes (hot-reload enabled)
# - Server: Automatically restarts on changes
# - Client: Vite HMR updates instantly

# 5. Run tests
cd server && npm test

# 6. View logs
npm run dev:logs

# 7. Stop services when done
npm run dev:down
```

### Database Workflow

```bash
# View database schema
docker compose -f docker-compose.dev.yml exec server npm run db:migrate

# Connect to PostgreSQL CLI
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ics

# Inside psql:
\dt          # List tables
\d cinemas   # Describe cinemas table
SELECT * FROM cinemas;
```

### Troubleshooting Development Setup

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues:
- Database connection errors
- Port conflicts
- CORS issues
- Environment variable problems

---

## Related Documentation

- [API Reference](./API.md) - Complete API documentation
- [Docker Deployment](./DOCKER.md) - Production deployment
- [Testing Guide](./TESTING.md) - Running tests
- [Database Schema](./DATABASE.md) - Database structure
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

---

[← Back to README](./README.md)
