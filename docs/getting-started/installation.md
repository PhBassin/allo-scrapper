# Installation

Current installation paths for the repo.

## Option 1: Docker dev workflow

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

cp .env.example .env
openssl rand -base64 64
# set JWT_SECRET in .env

npm run dev
```

What starts:

- `db`
- `redis`
- `server`
- `client`

What does not start:

- the scraper worker

Start that separately when needed:

```bash
cd scraper
RUN_MODE=consumer npm run dev
```

## Option 2: Manual local setup

Requirements:

- Node.js `>=24`
- npm `>=10`
- PostgreSQL 15+
- Redis 7+

Install dependencies from the repo root:

```bash
npm ci --legacy-peer-deps
```

If `sharp` fails from the repo root, reinstall from `server/`:

```bash
cd server
rm -rf node_modules
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

Minimum values to review:

- `JWT_SECRET`
- `POSTGRES_*`
- `REDIS_URL`
- `ALLOWED_ORIGINS`

Run migrations manually if desired:

```bash
cd server
npm run db:migrate
```

Start services in separate terminals:

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev

# terminal 3
cd scraper
RUN_MODE=consumer npm run dev
```

## Option 3: Production compose

```bash
cp .env.example .env
openssl rand -base64 64
# set JWT_SECRET in .env

docker compose pull
docker compose up -d
```

Unlike dev compose, `docker-compose.yml` starts the full stack by default:

- `ics-db`
- `ics-redis`
- `ics-web`
- `ics-scraper`
- `ics-scraper-cron`

Monitoring services are optional and enabled with `--profile monitoring`.

## Verification

```bash
curl http://localhost:3000/api/health
cd server && npm run test:run
cd server && npm run test:integration
cd client && npm run lint && npm run test:run && npm run build
cd scraper && npm run test:run
cd packages/saas && npm run test:run
npm run build --workspaces --if-present
```

Playwright is separate and requires the app to already be running:

```bash
npm run e2e
```

## First admin account

Fresh installs create username `admin`.

- On a fresh DB, the password is usually randomly generated and logged once by the migration runner.
- On an existing DB upgraded from older versions, a previous password may still be in place.

## Related

- [Quick Start](./quick-start.md)
- [Configuration](./configuration.md)
- [Development Setup](../guides/development/setup.md)
- [Docker Guide](../guides/deployment/docker.md)
