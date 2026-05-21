# Development Guide — allo-scrapper

## Prerequisites
- **Node.js**: >= 24.0.0 (see `.nvmrc`: `24`)
- **npm**: >= 10.0.0
- **Docker**: For PostgreSQL 15, Redis 7, and monitoring stack
- **Playwright**: For E2E tests (installed via npm)

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Start development environment (Docker required)
npm run dev

# Or start individual services
npm run server:dev    # Express API on port 3000
npm run client:dev    # Vite dev server on port 5173
npm run scraper:dev   # Scraper microservice
```

## Environment Setup
Copy `.env.example` → `.env` and configure:
- `JWT_SECRET` — Required (generate: `openssl rand -base64 64`)
- `DATABASE_URL` or `POSTGRES_*` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `ALLOWED_ORIGINS` — CORS origins
- `SCRAPE_MODE`, `SCRAPE_DAYS` — Scraper configuration

## Development Commands

### All Workspaces
| Command | Description |
|---------|-------------|
| `npm run dev` | Start full Docker dev stack (DB + Redis + server + client) |
| `npm run build` | Build server + client |
| `npm test` | Run tests in all workspaces |
| `npm run e2e` | Playwright E2E tests |
| `npm run e2e:headed` | E2E with visible browser |
| `npm run clean` | Remove all build artifacts |

### Server (`cd server`)
| Command | Description |
|---------|-------------|
| `npm run dev` | tsx watch (hot reload) |
| `npm run build` | TypeScript compilation |
| `npm start` | Production start |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Single test run |
| `npm run test:coverage` | With coverage report |
| `npm run db:migrate` | Run database migrations |

### Client (`cd client`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | tsc + vite build |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Single test run |

### Scraper (`cd scraper`)
| Command | Description |
|---------|-------------|
| `npm run dev` | tsx watch (hot reload) |
| `npm run build` | TypeScript compilation |
| `npm start` | Production start |
| `npm run test:run` | Single test run |

## Testing
- **Unit/Integration**: Vitest (all workspaces)
- **E2E**: Playwright (13 spec files in `e2e/`)
- **Coverage targets**: Lines >= 80%, Functions >= 80%, Statements >= 80%, Branches >= 65%
- **Scraper tests**: Real HTML fixtures in `scraper/tests/fixtures/`

## Docker Compose Profiles
```bash
# Production stack
docker compose up -d

# With monitoring (Prometheus, Grafana, Loki, Tempo)
docker compose --profile monitoring up -d

# Development stack
docker compose -f docker-compose.dev.yml up --build
```

## Key Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment (dev/production) |
| `PORT` | 3000 | Server listen port |
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_PORT` | 5432 | PostgreSQL port |
| `POSTGRES_DB` | ics | Database name |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `JWT_SECRET` | (required) | JWT signing key (>=32 chars) |
| `JWT_EXPIRES_IN` | 24h | Token expiry |
| `AUTO_MIGRATE` | true | Auto-run migrations on startup |
| `LOG_LEVEL` | info | Winston log level |
| `SCRAPE_MODE` | weekly | Scrape scope |
| `SCRAPE_DAYS` | 7 | Days to scrape |
| `TZ` | Europe/Paris | Timezone |
