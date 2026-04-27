# Development Setup

This page reflects the current repo workflow.

## Requirements

- Node.js `>=24`
- npm `>=10`
- Docker

## Recommended workflow

Use the repo-level dev stack:

```bash
cp .env.example .env
openssl rand -base64 64
# set JWT_SECRET in .env

npm run dev
```

This uses `docker-compose.dev.yml` and starts:

- `db`
- `redis`
- `server`
- `client`

Open `http://localhost:5173`.

## Scraper in local dev

The dev compose file does not run the scraper worker.

To make scraping work locally:

```bash
cd scraper
RUN_MODE=consumer npm run dev
```

If you run `npm run dev` in `scraper` without `RUN_MODE=consumer`, it defaults to `oneshot` and exits after one queue pop.

## Manual workspace install

If you are not using the Docker dev stack:

```bash
npm ci --legacy-peer-deps
```

If `sharp` fails:

```bash
cd server
rm -rf node_modules
npm install
```

## Git hooks

Install once:

```bash
./scripts/install-hooks.sh
```

Current pre-push hook runs only:

```bash
cd server
npx tsc --noEmit
npm run test:run
```

## Common commands

```bash
# server
cd server && npm run dev
cd server && npm run test:run
cd server && npm run test:integration
cd server && npm run test:coverage

# client
cd client && npm run dev
cd client && npm run lint
cd client && npm run test:run
cd client && npm run build

# scraper
cd scraper && RUN_MODE=consumer npm run dev
cd scraper && npm run test:run

# full workspace build used by CI
npm run build --workspaces --if-present
```

## Notes

- `AUTO_MIGRATE` defaults to `true`.
- Vite proxies `/api` and `/test` to the backend.
- Fresh databases create username `admin`, but the password may be randomly generated and logged once.
- Playwright does not start the app for you.

## Related

- [Testing](./testing.md)
- [Contributing](./contributing.md)
- [Installation](../../getting-started/installation.md)
