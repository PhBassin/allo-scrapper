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

## Rate Limiting

All `/api/*` routes are protected by `express-rate-limit`. Limits are enforced per **tenant-scoped JWT key** for authenticated endpoints and per **IP** for public/auth endpoints. All limits are skipped when `NODE_ENV=test`.

### Limiter Reference

| Endpoint pattern | Limiter | Default limit | Window | Key | Exemptions |
|---|---|---|---|---|---|
| All `/api/*` routes + SPA fallback | `generalLimiter` | 100 req | 15 min | JWT compound key or IP | none |
| `POST /api/auth/login` ¹, `POST /api/auth/change-password` | `authLimiter` | 5 req | 15 min | IP | none |
| `POST /api/auth/register` | `registerLimiter` | 3 req | **1 hour** | IP | none |
| Reports, cinemas writes, scraper status/DLQ, users, settings, system | `protectedLimiter` | 60 req | 15 min | JWT compound key | none |
| `POST /api/scraper/trigger`, `POST /api/scraper/resume/:id`, DLQ read/retry | `scraperLimiter` | 10 req | 15 min | JWT compound key | none |
| `GET /api/cinemas`, `GET /api/cinemas/:id` (unauthenticated) | `publicLimiter` | 100 req | 15 min | IP | none |
| `GET /api/health` | `healthCheckLimiter` | 10 req | **1 min** | IP | localhost + private IPs ² |

¹ `authLimiter` sets `skipSuccessfulRequests: true` for `POST /api/auth/login` — successful logins do not count toward the limit.

² `healthCheckLimiter` calls `isTrustedLocalHealthProbe(req)` which exempts a request when **all three** conditions hold:
- `req.ip` is `127.0.0.1` or `::1`
- The socket's `remoteAddress` is loopback or a private range (`10.x`, `192.168.x`, `172.16–31.x`, link-local, ULA IPv6)
- Every IP in the `X-Forwarded-For` chain is also loopback

Docker internal health probes satisfy all three conditions; requests routed through a public IP do not.

**JWT compound key** (`authenticatedKeyGenerator`): decodes the JWT without verification and builds the key `scope:<s>|org:<slug>|username:<u>|id:<id>`. Falls back to `req.ip` when no JWT is present or decode fails. This prevents cross-tenant limiter collisions when tenant users share small integer `id` values.

### Retry-After Behaviour

When a rate limit is exceeded the server responds with **HTTP 429**. `protectedLimiter` adds two fields to help clients back off:

- **`Retry-After` header** — seconds until the window resets.
- **`retryAfterSeconds` JSON field** — same value in the response body.

`generalLimiter` and `protectedLimiter` also emit standard `RateLimit-*` headers (`standardHeaders: true, legacyHeaders: false`).

#### Exponential Backoff Example

```typescript
async function fetchWithBackoff(url: string, options?: RequestInit, maxRetries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429) return res;

    const retryAfter = res.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt);
    const jitter = Math.random() * 1000;

    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000 + jitter));
  }

  throw new Error(`Request failed after ${maxRetries} retries due to rate limiting`);
}
```

### Testing Rate Limits Locally

Rate limiters are **fully disabled** when `NODE_ENV=test`. To test limiter behaviour manually, run the server in `development` mode with tightened env vars:

```bash
# Reduce windows and limits for faster local verification
RATE_LIMIT_WINDOW_MS=60000       # 1-minute window instead of 15 min
RATE_LIMIT_GENERAL_MAX=20
RATE_LIMIT_AUTH_MAX=3
RATE_LIMIT_PROTECTED_MAX=10
```

> **Admin API**: `server/src/routes/admin/rate-limits.ts` exposes CRUD endpoints for `rate_limit_configs` (migration `017_add_rate_limit_configs.sql`). Changes to the database take effect on the **next server restart** because limiters are initialised at module load time.

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
