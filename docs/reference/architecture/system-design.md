# System Design

High-level architecture based on the current codebase.

## Workspaces

- `client`: React SPA
- `server`: API plus production frontend host
- `scraper`: standalone worker service
- `packages/saas`: optional server plugin
- `packages/logger`: shared logger

## Core flow

1. Browser talks to the API.
2. The API reads and writes PostgreSQL.
3. Manual or scheduled scrape requests are enqueued in Redis.
4. The scraper worker consumes jobs from Redis and writes results to PostgreSQL.
5. Progress is published back through Redis and forwarded by the API over SSE.

## Current services

### Production compose

- `ics-db`
- `ics-redis`
- `ics-web`
- `ics-scraper`
- `ics-scraper-cron`

Optional monitoring profile adds Prometheus, Grafana, Loki, Tempo, and exporters.

### Dev compose

- `db`
- `redis`
- `server`
- `client`

The scraper worker is not part of the dev compose file.

## Technology snapshot

- Node.js 24
- Express 5
- React 19
- Vite 8
- PostgreSQL 15
- Redis 7
- TypeScript 6

## SaaS mode

When `SAAS_ENABLED=true`, the server dynamically loads `@allo-scrapper/saas` and mounts:

- `/api/superadmin/*`
- `/api/org/:slug/*`
- `/api/saas/metrics`
- `/test/*` fixture routes in test-enabled runtimes only

## Notes

- `AUTO_MIGRATE` defaults to `true`
- the server seeds cinemas from `server/src/config/cinemas.json` when the table is empty
- the backend exposes `/metrics`
- the scraper exposes `/metrics` on port `9091`
