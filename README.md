# Allo-Scrapper

Cinema showtimes aggregator built as an npm workspaces monorepo:

- `server`: Express 5 API and production frontend host
- `client`: React 19 + Vite SPA
- `scraper`: separate Redis-backed scraper worker
- `packages/saas`: optional multi-tenant overlay loaded when `SAAS_ENABLED=true`
- `packages/logger`: shared Winston logger

## Current Architecture

- The server always initializes PostgreSQL and subscribes to Redis scrape progress.
- Scraping is always queue-based. The API enqueues jobs in Redis, and the `scraper` workspace consumes them.
- In production, `docker-compose.yml` starts:
  - `ics-db`
  - `ics-redis`
  - `ics-web`
  - `ics-scraper`
  - `ics-scraper-cron`
- In local dev, `npm run dev` uses `docker-compose.dev.yml` and starts only:
  - `db`
  - `redis`
  - `server`
  - `client`

For end-to-end scraping in local dev, run the worker separately:

```bash
cd scraper
RUN_MODE=consumer npm run dev
```

## Requirements

- Node.js `>=24`
- npm `>=10`
- Docker / Docker Compose for the containerized flows
- PostgreSQL 15+
- Redis 7+

## Quick Start

### Docker dev

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

cp .env.example .env
openssl rand -base64 64
# paste the value into JWT_SECRET in .env

npm run dev
```

Access:

- UI: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`

Start the scraper worker in a second terminal if you want scraping to work locally:

```bash
cd scraper
RUN_MODE=consumer npm run dev
```

### Production compose

```bash
cp .env.example .env
openssl rand -base64 64
# set JWT_SECRET in .env

docker compose pull
docker compose up -d
```

This starts the full queue-based runtime, including both scraper containers.

## First Login

Fresh installs do not reliably mean `admin/admin`.

- The migration runner creates username `admin`.
- On a fresh database, the password is randomly generated and logged once at startup.
- On an older existing database, you may still have an earlier password already in place.

Check the server logs after the first boot if you need the generated password.

## Commands That Matter

```bash
# dev stack
npm run dev
npm run dev:down

# focused builds
npm run build
npm run build --workspaces --if-present

# server
cd server && npm run test:run
cd server && npm run test:integration
cd server && npm run test:coverage

# client
cd client && npm run lint && npm run test:run && npm run build

# scraper
cd scraper && npm run test:run

# saas package
cd packages/saas && npm run test:run
```

## Runtime Notes

- `AUTO_MIGRATE` defaults to `true`.
- After migrations, the server seeds `server/src/config/cinemas.json` into the `cinemas` table if the table is empty.
- `playwright.config.ts` does not start the app for you.
- Playwright defaults to `http://localhost:5173` unless `PLAYWRIGHT_BASE_URL` is set.
- Vite proxies both `/api` and `/test` to the backend in local dev.
- Superadmins authenticate through `POST /api/auth/login`; there is no `/api/superadmin/login` route.

## Documentation

- Docs index: [`docs/README.md`](./docs/README.md)
- Getting started: [`docs/getting-started/`](./docs/getting-started/)
- Development: [`docs/guides/development/`](./docs/guides/development/)
- Deployment: [`docs/guides/deployment/`](./docs/guides/deployment/)
- API reference: [`docs/reference/api/`](./docs/reference/api/)
- Architecture: [`docs/reference/architecture/`](./docs/reference/architecture/)
- Migrations: [`migrations/README.md`](./migrations/README.md)
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)

## Contributing

Repository workflow currently expects:

1. Create an issue first.
2. Branch from `develop`.
3. Use Conventional Commits.
4. Open a PR with `Closes #<issue>`.
5. Add exactly one version label for PRs targeting `main`: `major`, `minor`, or `patch`.

See:

- [`docs/guides/development/contributing.md`](./docs/guides/development/contributing.md)
- [`AGENTS.md`](./AGENTS.md)

## License

MIT. See [`LICENSE`](./LICENSE).
