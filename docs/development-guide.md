# Development Guide — allo-scrapper

> Generated: 2026-05-21

## Prerequisites

- **Node.js** >= 24
- **npm** >= 10
- **Docker** + Docker Compose (for PostgreSQL and Redis)
- **Git**

## Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd allo-scrapper

# 2. Install all workspace dependencies
npm install

# 3. Start infrastructure
docker compose up -d postgres redis

# 4. Set up environment
cp server/.env.example server/.env
cp scraper/.env.example scraper/.env
cp client/.env.example client/.env

# 5. Run database migrations
cd server
npm run db:migrate
cd ..

# 6. Start development servers
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Scraper
cd scraper && npm run dev

# Terminal 3: Client
cd client && npm run dev
```

## Development Workflow

### Branch Strategy
```
main         ← Production releases
  └─ develop ← Integration branch
       └─ feat/*  ← Feature branches
       └─ fix/*   ← Bug fix branches
       └─ docs/*  ← Documentation
```

### Commit Convention (Conventional Commits)
```
<type>(<scope>): <description>

feat(scraper): add new parser strategy
fix(api): correct auth middleware
docs: update AGENTS.md
```

### Pull Request Process
1. Create issue with appropriate label
2. Create branch: `<type>/<issue-number>-<description>`
3. Write failing tests first (RED)
4. Implement (GREEN)
5. Update documentation
6. Open PR referencing issue
7. Wait for CI + review
8. Merge to develop

## Running Tests

### Server Tests
```bash
cd server
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage
npx vitest run src/utils/url.test.ts  # Single file
```

### Scraper Tests
```bash
cd scraper
npm test
npm run test:run
```

### Client Tests
```bash
cd client
npm test
npm run test:run
```

### E2E Tests (Playwright)
```bash
npm run e2e
```

## Code Quality

```bash
# Lint
cd server && npm run lint
cd client && npm run lint

# Type check
cd server && npm run typecheck
cd client && npm run typecheck

# Format
npx prettier --check .
```

## Docker Development

```bash
# Build all services
docker compose build

# Run full stack
docker compose up

# Rebuild single service
docker compose build server
docker compose up -d server
```

## Database

```bash
# Generate migration
cd server && npm run db:generate

# Apply migrations
cd server && npm run db:migrate

# Open Drizzle Studio
cd server && npm run db:studio
```

## Environment Variables

### Server (`server/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret |
| `PORT` | No | Server port (default: 3001) |
| `CORS_ORIGIN` | No | CORS allowed origins |

### Scraper (`scraper/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis connection |
| `SCRAPE_INTERVAL` | No | Cron schedule |
| `PUPPETEER_HEADLESS` | No | Headless mode (default: true) |

### Client (`client/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Server API URL |
