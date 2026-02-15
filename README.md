# Allo-Scrapper

Cinema showtimes aggregator based on Allociné data.

> **Important (current state):** this repository now contains both a **new full-stack app** (`server` + `client`) and the **legacy Astro scraper/static site** at repository root (`src`, root `package.json`).

## Project structure (for developers and AI agents)

```text
allo-scrapper/
├── server/                    # Express + TypeScript API + scraper + cron
│   ├── src/routes             # /api/films, /api/cinemas, /api/reports, /api/scraper
│   ├── src/services/scraper   # Allociné scraping logic
│   ├── src/db                 # PostgreSQL schema and queries
│   └── src/config/cinemas.json
├── client/                    # React + Vite frontend
│   └── src/
├── src/                       # Legacy Astro scraper/static site code (root package)
├── config/cinemas.json        # Legacy cinema config (root flow)
├── docker-compose.dev.yml     # Dev stack: postgres + server + client
├── docker-compose.yml         # Production-like stack
└── .github/workflows/scrape.yml
```

## Which app should I run?

- **Main full-stack app (recommended for development):** `server/` + `client/`
- **Legacy flow (kept in root):** Astro + scraper from root package

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL 15+ (or Docker Compose)

## Environment variables

Copy and adjust:

```bash
cp .env.example .env
```

Main variables:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `PORT` (API server port, default `3000`)
- `VITE_API_BASE_URL` (client API URL, default `http://localhost:3000/api`)
- `SCRAPE_CRON_SCHEDULE`, `SCRAPE_DELAY_MS`

## Local development

### Option A: Docker Compose (recommended)

```bash
cd allo-scrapper
docker compose -f docker-compose.dev.yml up --build
```

- API: `http://localhost:3000/api`
- Client: `http://localhost:5173`

### Option B: Run services manually

```bash
# terminal 1
cd allo-scrapper/server
npm ci
npm run dev

# terminal 2
cd allo-scrapper/client
npm ci
npm run dev
```

## Commands by package

### `server/`

```bash
cd allo-scrapper/server
npm ci
npm run dev         # start API in watch mode
npm run build       # compile TypeScript
npm run start       # run compiled server
npm run db:migrate  # initialize/update DB schema
npm run scrape      # run scraper once
```

### `client/`

```bash
cd allo-scrapper/client
npm ci
npm run dev
npm run build
npm run lint
npm run preview
```

### Root (legacy Astro flow)

```bash
cd allo-scrapper
npm ci
npm run test
npm run scrape
npm run build       # runs scrape first, so requires DB access
npm run dev
```

## API quick reference

- `GET /api/health`
- `GET /api/films`
- `GET /api/films/:id`
- `GET /api/cinemas`
- `GET /api/cinemas/:id`
- `GET /api/reports`
- `POST /api/scraper/trigger`
- `GET /api/scraper/status`
- `GET /api/scraper/progress` (SSE)

## CI / automation

- Workflow: `.github/workflows/scrape.yml`
- Runs scheduled/manual scraping + build/deploy flow for the root pipeline.

## Notes for AI coding agents

- Treat this repository as a **multi-project repo** (`server`, `client`, and root legacy app).
- Run commands from the correct directory.
- For backend/frontend changes, validate only the relevant package commands.
- Root `npm run build` (current implementation) also requires a reachable PostgreSQL instance because it runs scraping first.
