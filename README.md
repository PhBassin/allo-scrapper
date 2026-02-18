# 🎬 Allo-Scrapper

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Cinema showtimes aggregator** that scrapes and centralizes movie screening schedules from the source website cinema pages. Built with Express.js, React, and PostgreSQL, fully containerized with Docker.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Quick Start](#-quick-start)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [Scraper Configuration](#-scraper-configuration)
- [Docker Deployment](#-docker-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Available Scripts](#-available-scripts)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **Automated Scraping**: Scheduled scraping of cinema showtimes from the source website
- **RESTful API**: Complete Express.js backend with TypeScript
- **Modern UI**: React SPA with Vite for fast development
- **Real-time Progress**: Server-Sent Events (SSE) for live scraping updates
- **Weekly Reports**: Track cinema programs and identify new releases
- **Docker Ready**: Full containerization with multi-stage builds
- **CI/CD**: GitHub Actions workflow for automated Docker image builds
- **Production Ready**: Health checks, error handling, and database migrations

---

## 🏗 Architecture

```
┌─────────────────┐
│   React SPA     │  Port 80 (production) / 5173 (dev)
│   (Vite + TS)   │
└────────┬────────┘
         │ HTTP API
         ▼
┌─────────────────┐
│  Express.js API │  Port 3000
│  (TypeScript)   │
│  ┌───────────┐  │
│  │  Scraper  │  │  Cron-based scraping
│  │  Service  │◄─┼─ (configurable schedule)
│  └─────┬─────┘  │
└────────┼────────┘
         │ SQL
         ▼
┌─────────────────┐
│   PostgreSQL    │  Port 5432
│   Database      │
│  ┌───────────┐  │
│  │  cinemas  │  │
│  │  films    │  │
│  │ showtimes │  │
│  │scrape_    │  │
│  │ reports   │  │
│  └───────────┘  │
└─────────────────┘
```

**Data Flow:**
1. Client makes HTTP requests to Express API (`/api/*`)
2. API routes handle business logic and validate requests
3. Scraper service periodically fetches data from the source website
4. PostgreSQL stores structured cinema, film, and showtime data
5. Client receives JSON responses and renders UI

---

## 📸 Screenshots

### Homepage - Cinema List
```
[Screenshot placeholder: Grid view of cinemas with poster images]
```

### Cinema Detail Page
```
[Screenshot placeholder: Weekly program with film cards and showtimes]
```

### Film Detail Page
```
[Screenshot placeholder: Film information, synopsis, ratings, and all showtimes across cinemas]
```

### Scraping Reports Dashboard
```
[Screenshot placeholder: Table of scrape reports with status, duration, and statistics]
```

---

## 🚀 Quick Start

### Option A: Using Pre-built Images (Recommended)

The easiest way to deploy is using pre-built Docker images from GitHub Container Registry.

**Prerequisites:**
- Docker and Docker Compose installed
- Port 3000 and 5432 available

**Deployment steps:**

```bash
# Clone the repository (for configuration files)
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Pull the latest image and start services
docker compose up -d

# Initialize database
docker compose exec web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

**Access the application:**
- Web UI: http://localhost:3000
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

**Update to latest version:**
```bash
docker compose pull web
docker compose up -d
```

**Stop the application:**
```bash
docker compose down
```

### Option B: Building Locally

If you want to build the Docker image from source:

```bash
# Clone the repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Build and start services
docker compose -f docker-compose.build.yml up --build -d

# Initialize database
docker compose exec web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

For production deployment and advanced configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 💻 Development Setup

### Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **PostgreSQL**: 15.x or higher (or use Docker)
- **Git**: For version control

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

# In another terminal, initialize the database
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

### Option B: Manual Setup (Local PostgreSQL)

If you prefer running services outside Docker:

#### 1. Setup PostgreSQL

```bash
# Install PostgreSQL 15+ (macOS example)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb its
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

## 🧪 Testing

The scraper includes a comprehensive unit test suite with code coverage tracking.

### Running Tests

```bash
cd server

# Watch mode (recommended for development)
npm test

# Single run
npm run test:run

# With coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Test Coverage

- **Lines**: 94.3% (target: 80%)
- **Functions**: 100% (target: 80%)
- **Statements**: 93.7% (target: 80%)
- **Branches**: 68.8% (target: 65%)

### Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `theater-parser.test.ts` | 30 | HTML parsing for all cinemas |
| `date.test.ts` | 22 | Date utility functions |
| `showtimes.test.ts` | 2 | Showtime utility functions |
| `queries.test.ts` | 4 | Database query functions |
| `films.test.ts` | 5 | Films API route handler |

> **Note:** Coverage numbers above reflect `theater-parser.ts` only (the configured coverage scope).

- **Fixtures**: Full HTML pages from Allociné (~1.6MB) for realistic testing
- **Regression tests**: Ensures existing cinemas (C0089, W7504, C0072) continue working
- **Total**: 107 tests across 8 test files (4 source `.ts` + 4 compiled `.js` dist files)

See `server/tests/README.md` for detailed testing documentation.

---

## 📁 Project Structure

```
allo-scrapper/
├── .github/
│   └── workflows/
│       ├── docker-build-push.yml    # CI/CD: Docker image build & push
│       ├── cleanup-docker-images.yml# Docker image cleanup
│       ├── ghcr-cleanup.yml         # Daily GHCR image cleanup
│       └── sync-main-to-develop.yml # Auto-sync main → develop
├── client/                          # React frontend (Vite + TypeScript)
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── api/                     # API client functions
│   │   ├── components/              # Reusable UI components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── pages/                   # Route components
│   │   ├── types/                   # TypeScript interfaces
│   │   ├── utils/                   # Client utility functions
│   │   ├── App.tsx                  # Root component with routing
│   │   └── main.tsx                 # Application entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                          # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── config/
│   │   │   └── cinemas.json         # Cinema list configuration
│   │   ├── db/
│   │   │   ├── client.ts            # PostgreSQL connection pool
│   │   │   ├── queries.ts           # Database query functions
│   │   │   └── schema.ts            # Database schema & migration
│   │   ├── routes/
│   │   │   ├── cinemas.ts           # GET /api/cinemas, /api/cinemas/:id
│   │   │   ├── films.ts             # GET /api/films, /api/films/:id
│   │   │   ├── reports.ts           # GET /api/reports, /api/reports/:id
│   │   │   └── scraper.ts           # POST /api/scraper/trigger, GET /api/scraper/status|progress
│   │   ├── services/
│   │   │   ├── scraper/
│   │   │   │   ├── http-client.ts   # HTTP client for the source website
│   │   │   │   ├── index.ts         # Main scraper orchestrator
│   │   │   │   ├── theater-parser.ts# Cinema page HTML parsing
│   │   │   │   └── film-parser.ts   # Film detail page HTML parsing
│   │   │   ├── cron.ts              # Cron job manager
│   │   │   ├── progress-tracker.ts  # SSE progress event system
│   │   │   └── scrape-manager.ts    # Scrape session management
│   │   ├── types/
│   │   │   ├── scraper.ts           # Domain type definitions
│   │   │   └── api.ts               # API response type definitions
│   │   ├── utils/
│   │   │   ├── date.ts              # Date calculation utilities
│   │   │   └── showtimes.ts         # Showtime grouping utilities
│   │   ├── app.ts                   # Express app configuration (incl. GET /api/health)
│   │   └── index.ts                 # Server entry point
│   ├── tests/
│   │   └── fixtures/                # HTML fixtures for parser tests
│   ├── package.json
│   └── tsconfig.json
├── e2e/                             # Playwright end-to-end tests
├── scripts/
│   ├── backup-db.sh                 # Database backup script
│   ├── integration-test.sh          # Full-stack integration test runner
│   ├── pull-and-deploy.sh           # Pull latest Docker image & restart
│   └── restore-db.sh                # Database restore script
├── .dockerignore
├── .env.example                     # Environment variables template
├── .gitignore
├── DEPLOYMENT.md                    # Comprehensive deployment guide
├── docker-compose.build.yml         # Local build stack
├── docker-compose.dev.yml           # Development stack
├── docker-compose.yml               # Production stack
├── Dockerfile                       # Multi-stage production build
├── playwright.config.ts             # Playwright E2E configuration
├── package.json                     # Root convenience scripts
└── README.md                        # This file
```

---

## 📡 API Documentation

### Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

### Response Format

All endpoints except `GET /api/health` return:

```json
{
  "success": true,
  "data": {}
}
```

### Endpoints

#### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z"
}
```

---

#### List All Cinemas

```http
GET /api/cinemas
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "address": "100 Rue Mouffetard",
      "postal_code": "75005",
      "city": "Paris",
      "screen_count": 1,
      "image_url": "https://..."
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/cinemas
```

---

#### Get Cinema Details

```http
GET /api/cinemas/:id
```

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response:**
```json
{
  "success": true,
  "data": {
    "showtimes": [
      {
        "id": "W7504-123456-2024-02-15-14:00",
        "date": "2024-02-15",
        "time": "14:00",
        "datetime_iso": "2024-02-15T14:00:00+01:00",
        "version": "VF",
        "format": "2D",
        "experiences": ["Dolby Atmos"],
        "film": {
          "id": 123456,
          "title": "Film Title",
          "original_title": "Original Title"
        }
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/cinemas/W7504"
```

---

#### List All Films

```http
GET /api/films
```

**Response:**
```json
{
  "success": true,
  "data": {
    "films": [
      {
        "id": 123456,
        "title": "Film Title",
        "original_title": "Original Title",
        "poster_url": "https://...",
        "duration_minutes": 120,
        "release_date": "2024-01-15",
        "genres": ["Drama"],
        "nationality": "France",
        "director": "Director Name"
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films
```

---

#### Get Film Details

```http
GET /api/films/:id
```

**Parameters:**
- `id` (integer): Film ID from the source website

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123456,
    "title": "Film Title",
    "original_title": "Original Title",
    "poster_url": "https://...",
    "duration_minutes": 120,
    "release_date": "2024-01-15",
    "rerelease_date": null,
    "genres": ["Drama", "Thriller"],
    "nationality": "France",
    "director": "Director Name",
    "actors": ["Actor 1", "Actor 2"],
    "synopsis": "Full synopsis text...",
    "certificate": "TP",
    "press_rating": 4.2,
    "audience_rating": 3.8,
    "source_url": "https://www.example-cinema-site.com/film/fichefilm_gen_cfilm=123456.html",
    "cinemas": [
      {
        "id": "W7504",
        "name": "Épée de Bois",
        "address": "100 Rue Mouffetard",
        "postal_code": "75005",
        "city": "Paris",
        "screen_count": 1,
        "image_url": "https://...",
        "showtimes": [
          {
            "id": "W7504-123456-2024-02-15-14:00",
            "date": "2024-02-15",
            "time": "14:00",
            "datetime_iso": "2024-02-15T14:00:00+01:00",
            "version": "VF",
            "format": "2D",
            "experiences": []
          }
        ]
      }
    ]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films/123456
```

---

#### List Scrape Reports

```http
GET /api/reports
```

**Query Parameters:**
- `page` (optional, integer): Page number (default: `1`)
- `pageSize` (optional, integer): Reports per page (default: `20`)
- `status` (optional): `running`, `success`, `partial_success`, `failed`
- `triggerType` (optional): `manual` or `cron`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "started_at": "2024-02-15T10:00:00.000Z",
        "completed_at": "2024-02-15T10:15:23.000Z",
        "status": "success",
        "trigger_type": "cron",
        "total_cinemas": 2,
        "successful_cinemas": 2,
        "failed_cinemas": 0,
        "total_films_scraped": 45,
        "total_showtimes_scraped": 234,
        "errors": []
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/reports?page=1&pageSize=10"
```

---

#### Get Scrape Report

```http
GET /api/reports/:id
```

**Parameters:**
- `id` (integer): Report ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "status": "success",
    "trigger_type": "manual",
    "total_cinemas": 3
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/reports/42"
```

---

#### Trigger Manual Scrape

```http
POST /api/scraper/trigger
```

**Response (200 — started):**
```json
{
  "success": true,
  "data": {
    "reportId": 43,
    "message": "Scrape started successfully"
  }
}
```

**Response (409 — already running):**
```json
{
  "success": false,
  "error": "A scrape is already in progress",
  "data": {
    "current_scrape": {
      "started_at": "2024-02-15T10:00:00.000Z",
      "trigger_type": "manual"
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/scraper/trigger
```

---

#### Get Scraper Status

```http
GET /api/scraper/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "currentSession": {
      "reportId": 43,
      "triggerType": "manual",
      "startedAt": "2024-02-15T10:00:00.000Z",
      "status": "running"
    },
    "latestReport": {
      "id": 42,
      "completed_at": "2024-02-15T10:15:23.000Z",
      "status": "success"
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/scraper/status
```

---

#### Watch Scrape Progress (SSE)

```http
GET /api/scraper/progress
```

Opens a persistent Server-Sent Events connection. All previously accumulated events are replayed to new clients, then new events are streamed in real time. A heartbeat (`: heartbeat`) is sent every 15 seconds to keep the connection alive.

**Response Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

**Event Format:**

All events are sent as plain `data:` lines (no named `event:` field). Each line is a JSON object with a `type` discriminator:

```
data: {"type":"started","total_cinemas":3,"total_dates":7}

data: {"type":"cinema_started","cinema_name":"Épée de Bois","cinema_id":"W7504","index":1}

data: {"type":"date_started","date":"2026-02-19","cinema_name":"Épée de Bois"}

data: {"type":"film_started","film_title":"Mon Film","film_id":123456}

data: {"type":"film_completed","film_title":"Mon Film","showtimes_count":5}

data: {"type":"film_failed","film_title":"Mon Film","error":"HTTP 404"}

data: {"type":"date_completed","date":"2026-02-19","films_count":12}

data: {"type":"date_failed","date":"2026-02-19","cinema_name":"Épée de Bois","error":"HTTP 503"}

data: {"type":"cinema_completed","cinema_name":"Épée de Bois","total_films":42}

data: {"type":"completed","summary":{"total_cinemas":3,"successful_cinemas":3,"failed_cinemas":0,"total_films":87,"total_showtimes":412,"total_dates":7,"duration_ms":34210,"errors":[]}}

data: {"type":"failed","error":"Fatal error message"}
```

**Event Types:**

| Type | Emitted | Payload fields |
|------|---------|----------------|
| `started` | Once at start | `total_cinemas`, `total_dates` |
| `cinema_started` | Per cinema | `cinema_name`, `cinema_id`, `index` |
| `date_started` | Per cinema × date | `date`, `cinema_name` |
| `film_started` | Per film | `film_title`, `film_id` |
| `film_completed` | Per film (success) | `film_title`, `showtimes_count` |
| `film_failed` | Per film (error) | `film_title`, `error` |
| `date_completed` | Per date (success) | `date`, `films_count` |
| `date_failed` | Per date (error) | `date`, `cinema_name`, `error` |
| `cinema_completed` | Per cinema (≥1 date ok) | `cinema_name`, `total_films` |
| `completed` | Once on success | `summary` (ScrapeSummary object) |
| `failed` | Once on fatal error | `error` |

**Example:**
```bash
curl -N http://localhost:3000/api/scraper/progress
```

**JavaScript Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/scraper/progress');

// All events arrive via onmessage (no named event: field)
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log('Event:', data.type, data);

  if (data.type === 'completed') {
    console.log('Scraping complete:', data.summary);
    eventSource.close();
  }
  if (data.type === 'failed') {
    console.error('Scraping failed:', data.error);
    eventSource.close();
  }
};

eventSource.onerror = (err) => {
  console.error('SSE connection error:', err);
  eventSource.close();
};
```

---

## 🔧 Environment Variables

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `POSTGRES_HOST` | PostgreSQL server hostname | `localhost` | `db` |
| `POSTGRES_PORT` | PostgreSQL server port | `5432` | `5432` |
| `POSTGRES_DB` | Database name (`its` = Independent Theater Showtime) | `its` | `its` |
| `POSTGRES_USER` | Database username | `postgres` | `myuser` |
| `POSTGRES_PASSWORD` | Database password | `password` | `securepass123` |
| `PORT` | API server port | `3000` | `8080` |
| `VITE_API_BASE_URL` | Client API base URL | `http://localhost:3000/api` | `https://api.example.com/api` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string (overrides individual settings above) | — | `postgresql://postgres:password@localhost:5432/its` |
| `TZ` | Timezone for cron jobs (IANA format) | `Europe/Paris` | `America/New_York` |
| `SCRAPE_CRON_SCHEDULE` | Cron expression for scheduled scraping | `0 8 * * 3` | `0 3 * * *` |
| `SCRAPE_DELAY_MS` | Delay between HTTP requests to avoid rate limiting (ms) | `1000` | `2000` |
| `SCRAPE_DAYS` | Number of days to scrape (1-14) | `7` | `14` |
| `SCRAPE_MODE` | Start date: `weekly` (Wed), `from_today`, or `from_today_limited` | `weekly` | `from_today_limited` |
| `NODE_ENV` | Environment mode | `development` | `production` |

### Cron Schedule Examples

- `0 8 * * 3` - Every Wednesday at 8:00 AM (default)
- `0 3 * * *` - Every day at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

---

## 🗄 Database Schema

### Tables

#### `cinemas`
Stores cinema venue information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (the source website cinema ID) |
| `name` | TEXT | Cinema name |
| `address` | TEXT | Street address |
| `postal_code` | TEXT | Postal code |
| `city` | TEXT | City name |
| `screen_count` | INTEGER | Number of screens |
| `image_url` | TEXT | Cinema image URL |

#### `films`
Stores film metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (the source website film ID) |
| `title` | TEXT | French title |
| `original_title` | TEXT | Original title |
| `poster_url` | TEXT | Poster image URL |
| `duration_minutes` | INTEGER | Runtime in minutes |
| `release_date` | TEXT | Initial release date (ISO) |
| `rerelease_date` | TEXT | Re-release date (ISO, nullable) |
| `genres` | TEXT | JSON array of genres |
| `nationality` | TEXT | Country of origin |
| `director` | TEXT | Director name |
| `actors` | TEXT | JSON array of actor names |
| `synopsis` | TEXT | Film synopsis |
| `certificate` | TEXT | Age rating (TP, -12, -16, etc.) |
| `press_rating` | REAL | Press rating (0-5) |
| `audience_rating` | REAL | Audience rating (0-5) |
| `source_url` | TEXT | the source website film page URL |

#### `showtimes`
Stores individual screening times.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (composite unique ID) |
| `film_id` | INTEGER | Foreign key → `films.id` |
| `cinema_id` | TEXT | Foreign key → `cinemas.id` |
| `date` | TEXT | Date in `YYYY-MM-DD` format |
| `time` | TEXT | Time in `HH:MM` format |
| `datetime_iso` | TEXT | Full ISO 8601 datetime |
| `version` | TEXT | Language version (VF, VO, VOSTFR) |
| `format` | TEXT | Projection format (2D, 3D) |
| `experiences` | TEXT | JSON array of experiences |
| `week_start` | TEXT | Week start date (`YYYY-MM-DD`) |

**Indexes:**
- `idx_showtimes_cinema_date` on `(cinema_id, date)`
- `idx_showtimes_film_date` on `(film_id, date)`
- `idx_showtimes_week` on `(week_start)`

#### `weekly_programs`
Tracks which films are playing at which cinemas per week.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `cinema_id` | TEXT | Foreign key → `cinemas.id` |
| `film_id` | INTEGER | Foreign key → `films.id` |
| `week_start` | TEXT | Week start date (`YYYY-MM-DD`) |
| `is_new_this_week` | INTEGER | Boolean flag (0/1) |
| `scraped_at` | TEXT | Scrape timestamp (ISO) |

**Indexes:**
- `idx_weekly_programs_week` on `(week_start)`
- Unique constraint on `(cinema_id, film_id, week_start)`

#### `scrape_reports`
Logs scraping job execution details.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `started_at` | TIMESTAMPTZ | Job start time |
| `completed_at` | TIMESTAMPTZ | Job completion time (nullable) |
| `status` | TEXT | Status: `running`, `success`, `partial_success`, `failed` |
| `trigger_type` | TEXT | Trigger: `manual`, `cron` |
| `total_cinemas` | INTEGER | Number of cinemas attempted |
| `successful_cinemas` | INTEGER | Successfully scraped cinemas |
| `failed_cinemas` | INTEGER | Failed cinema scrapes |
| `total_films_scraped` | INTEGER | Total films found |
| `total_showtimes_scraped` | INTEGER | Total showtimes found |
| `errors` | JSONB | Array of error objects |
| `progress_log` | JSONB | Array of progress events |

**Indexes:**
- `idx_scrape_reports_started_at` on `(started_at DESC)`
- `idx_scrape_reports_status` on `(status)`

### Relationships

```
cinemas (1) ──────┬─── (N) showtimes
                  │
                  └─── (N) weekly_programs
                           │
films (1) ────────┴────────┘
      │
      └─── (N) showtimes
```

---

## 🎯 Scraper Configuration

Cinema list is configured in `server/src/config/cinemas.json`.

**Currently tracking 3 cinemas in Paris:**
- **W7504**: Épée de Bois
- **C0072**: Le Grand Action  
- **C0089**: Max Linder Panorama

```json
[
  {
    "id": "W7504",
    "name": "Épée de Bois",
    "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=W7504.html"
  },
  {
    "id": "C0072",
    "name": "Le Grand Action",
    "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0072.html"
  },
  {
    "id": "C0089",
    "name": "Max Linder Panorama",
    "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0089.html"
  }
]
```

### Adding New Cinemas

1. Find the cinema on the source website (e.g., https://www.example-cinema-site.com/seance/salle_gen_csalle=C0089.html)
2. Extract the cinema ID from the URL (e.g., `C0089`)
3. Add entry to `cinemas.json`:
   ```json
   {
     "id": "C0089",
     "name": "Cinema Name",
     "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0089.html"
   }
   ```
4. *(Optional)* Add test fixtures and unit tests (see `server/tests/README.md`)
5. Restart the server
6. Trigger a scrape: `curl -X POST http://localhost:3000/api/scraper/trigger`

### Scraping Behavior

- **Automatic**: Runs on schedule defined by `SCRAPE_CRON_SCHEDULE` (default: Wednesdays at 8 AM Paris time). Cron jobs always use `weekly` mode for 7 days.
- **Manual**: Trigger via `POST /api/scraper/trigger`. Uses `SCRAPE_MODE` and `SCRAPE_DAYS` env var defaults.
- **Multi-day loop**: For each cinema, the scraper iterates over the configured number of days (`SCRAPE_DAYS`, default 7), fetching one page per date.
- **Rate limiting**: 500ms delay after each film detail page fetch; 1000ms delay between date requests per cinema.
- **Film detail fetching**: If a film's duration is not yet in the database, the scraper fetches its individual Allocine page to retrieve it. Already-known films skip this extra request.
- **Error handling (date-level)**: If scraping fails for a specific date, the error is logged and the scraper continues to the next date — it does not abort the entire cinema.
- **Error handling (cinema-level)**: A cinema is only counted as failed if *all* of its dates fail. A cinema where at least one date succeeds is counted as successful.
- **Data upsert**: Showtimes are inserted or updated via upsert (`INSERT … ON CONFLICT DO UPDATE`). Existing records are overwritten, not deleted and re-inserted.
- **Final status**: `success` (0 failed cinemas), `partial_success` (some failed), or `failed` (all failed / fatal error).

---

## 🐳 Docker Deployment

### Using Pre-built Images from GitHub Container Registry

The application is automatically built and published to GitHub Container Registry on every release.

**Available images:**
- `ghcr.io/phbassin/allo-scrapper:latest` - Latest stable release
- `ghcr.io/phbassin/allo-scrapper:v1.0.0` - Specific version
- `ghcr.io/phbassin/allo-scrapper:main` - Latest from main branch
- `ghcr.io/phbassin/allo-scrapper:develop` - Latest from develop branch

#### Quick Deployment

```bash
# Pull and start services (uses docker-compose.yml)
docker compose pull
docker compose up -d

# View available image tags
docker images | grep allo-scrapper
```

#### Using Specific Versions

Edit your `.env` file or `docker-compose.yml` to specify a version:

```yaml
services:
  web:
    image: ghcr.io/phbassin/allo-scrapper:v1.0.0  # Pin to specific version
```

#### Authentication for Private Repositories

If the repository is private, authenticate with GitHub Container Registry:

```bash
# Create a Personal Access Token (PAT) with read:packages scope
# Then login:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull the image
docker pull ghcr.io/phbassin/allo-scrapper:latest
```

### Development Mode

Uses `docker-compose.dev.yml` with hot-reload and separate frontend dev server:

```bash
npm run dev
```

**Services:**
- `db`: PostgreSQL 15
- `server`: Express API with nodemon (port 3000)
- `client`: Vite dev server (port 5173)

### Production Mode

Uses `docker-compose.yml` with pre-built images from GitHub Container Registry:

```bash
docker compose up -d
```

**Services:**
- `db`: PostgreSQL 15 with volume persistence
- `web`: Combined API + static frontend (port 3000)

### Building Docker Images Locally

If you prefer to build from source instead of using pre-built images:

```bash
# Build locally using docker-compose.build.yml
docker compose -f docker-compose.build.yml up --build -d

# Or build manually
npm run docker:build

# Build with custom tag
docker build -t allo-scrapper:v1.0.0 .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t allo-scrapper:latest .
```

### Deployment Scripts

#### Pull and Deploy
```bash
./scripts/pull-and-deploy.sh
```
Pulls the latest image from GitHub Container Registry and restarts containers.

#### Backup Database
```bash
./scripts/backup-db.sh
```
Creates a timestamped SQL dump in `backups/` directory. Retains last 7 days.

#### Restore Database
```bash
./scripts/restore-db.sh backups/backup-2024-02-15-103045.sql
```
Restores database from a backup file with safety confirmation.

For comprehensive deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow (`.github/workflows/docker-build-push.yml`) that:

1. **Triggers on:**
   - Push to `main` or `develop` branches
   - Version tags (`v*`)
   - Manual workflow dispatch

2. **Builds:**
   - Multi-platform Docker images (linux/amd64, linux/arm64)
   - Uses layer caching for faster builds
   - Runs automated tests (if configured)

3. **Publishes to:**
   - GitHub Container Registry (ghcr.io)
   - Tags: `latest`, `main`, `develop`, version tags

4. **Outputs:**
   - Build attestation
   - Image digest
   - Build summary in Actions UI

### Using Pre-built Images

Pre-built Docker images are automatically published to GitHub Container Registry on every release.

**Pull and use images:**

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/phbassin/allo-scrapper:latest

# Or pull a specific version
docker pull ghcr.io/phbassin/allo-scrapper:v1.0.0

# Run with docker compose (automatically pulls if not present)
docker compose up -d

# List available local images
docker images | grep allo-scrapper
```

**Available tags:**
- `latest` - Latest stable release (main branch)
- `v1.0.0`, `v1.0`, etc. - Specific version tags
- `main` - Latest commit on main branch
- `develop` - Latest commit on develop branch
- `main-abc1234` - Specific commit SHA

**Registry cleanup policy:** untagged images and images older than 15 days are automatically deleted daily by the `GHCR Cleanup` workflow.

**Browse all available images:**
https://github.com/PhBassin/allo-scrapper/pkgs/container/allo-scrapper

### Setting Up CI/CD

1. Enable GitHub Container Registry in repository settings
2. Grant workflow permissions: Settings → Actions → General → Read and write permissions
3. Push to `main` or `develop` to trigger build
4. Images will be available at `ghcr.io/yourusername/allo-scrapper`

---

## 📜 Available Scripts

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

## 🧪 Testing

### Unit Tests

The server includes comprehensive unit tests using Vitest.

```bash
# Run unit tests in watch mode
cd server && npm test

# Run tests once
npm run test:run

# Generate coverage report
npm run test:coverage
```

**Coverage targets:**
- Lines: ≥ 80%
- Functions: ≥ 80%
- Statements: ≥ 80%
- Branches: ≥ 65%

### Integration Tests (E2E)

End-to-end tests verify full-stack functionality using Playwright.

```bash
# Run full integration test (recommended)
./scripts/integration-test.sh

# Or run manually:
docker compose up --build -d
sleep 10
npx playwright test

# View test report
npx playwright show-report

# Run specific test
npx playwright test --grep "test name"

# Debug mode
npx playwright test --headed --debug
```

**What E2E tests cover:**
- User interactions (button clicks, form submissions)
- API integration between frontend and backend
- Real-time features (Server-Sent Events for scrape progress)
- Critical user workflows (scraping, viewing showtimes)

**Test locations:**
- `e2e/` - Playwright E2E test specs
- `playwright.config.ts` - Playwright configuration
- `scripts/integration-test.sh` - Automated full-stack test script

**Known limitations:**
- Tests run sequentially (`workers: 1`) to avoid scrape conflicts
- Scrapes complete quickly in Docker; timing-sensitive tests may need adjustments
- For best results, restart Docker between test sessions if issues occur

---

## 🔍 Troubleshooting

### Database Connection Issues

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Check if PostgreSQL is running
docker compose ps

# Check environment variables
cat .env | grep POSTGRES

# Restart database
docker compose restart db

# View database logs
docker compose logs db
```

---

### Scraper Not Running

**Problem:** No showtimes appearing after scrape trigger

**Solution:**
```bash
# Check scraper status
curl http://localhost:3000/api/scraper/status

# View server logs
docker compose logs web

# Check scrape reports
curl http://localhost:3000/api/reports

# Manually trigger scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# Watch progress in real-time
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/scraper/progress
```

---

### API Returns 404

**Problem:** `Cannot GET /api/films`

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Verify API base URL in client
cat client/.env | grep VITE_API_BASE_URL

# Check server logs for errors
docker compose logs web -f

# Restart services
docker compose restart
```

---

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

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

### Database Migration Fails

**Problem:** `Error: relation "films" does not exist`

**Solution:**
```bash
# Run migration manually
docker compose exec web npm run db:migrate

# Or connect to database and run schema manually
docker compose exec db psql -U postgres -d its

# In psql:
\i /path/to/schema.sql
```

---

### Client Cannot Reach API

**Problem:** Network errors in browser console

**Solution:**
1. Check `VITE_API_BASE_URL` in `.env`
2. Verify API is accessible: `curl http://localhost:3000/api/health`
3. Check CORS settings in `server/src/app.ts`
4. Rebuild client: `cd client && npm run build`

---

### Docker Build Fails

**Problem:** Build errors during `docker compose up --build`

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
```

---

### Old Data Persisting

**Problem:** Changes to `cinemas.json` not reflected

**Solution:**
```bash
# Restart server to reload config
docker compose restart web

# Trigger new scrape
curl -X POST http://localhost:3000/api/scraper/trigger

# If needed, clear database
docker compose down -v
docker compose up -d
docker compose exec web npm run db:migrate
```

---

## 🤝 Contributing

Contributions are welcome! Please read our **[Contributing Guide](./CONTRIBUTING.md)** for detailed instructions.

### Quick Start

1. **Create an issue** before starting work
2. **Write tests first** (TDD is mandatory)
3. **Use atomic commits** with [Conventional Commits](https://www.conventionalcommits.org/) format
4. **Update documentation** if changing APIs
5. **Open a Pull Request** referencing the issue

### Commit Format

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `perf`, `ci`, `build`

**Examples:**
```bash
feat(scraper): add support for new cinema chain
fix(api): handle missing film data gracefully
test(parser): add edge cases for empty HTML
```

### Resources

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Full contributor guidelines
- **[AGENTS.md](./AGENTS.md)** - Instructions for AI coding agents
- **[server/tests/README.md](./server/tests/README.md)** - Testing documentation

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **the source website** for cinema and film data
- **Express.js** community for excellent backend framework
- **React** and **Vite** teams for modern frontend tooling
- All contributors and users of this project

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/allo-scrapper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/allo-scrapper/discussions)
- **Documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Built with ❤️ for cinema lovers**
