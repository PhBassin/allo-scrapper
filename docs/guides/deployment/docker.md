# Docker Guide

Current compose files and what they actually do.

## `docker-compose.yml`

Production-style runtime.

Starts by default:

- `ics-db`
- `ics-redis`
- `ics-web`
- `ics-scraper`
- `ics-scraper-cron`

Optional profile:

- `--profile monitoring`

Monitoring adds:

- `ics-prometheus`
- `ics-grafana`
- `ics-loki`
- `ics-promtail`
- `ics-tempo`
- `ics-postgres-exporter`
- `ics-redis-exporter`

Start it:

```bash
docker compose up -d
docker compose --profile monitoring up -d
```

## `docker-compose.dev.yml`

Local development stack.

Starts:

- `db`
- `redis`
- `server`
- `client`

Does not start:

- scraper worker

Use:

```bash
npm run dev
```

Run the worker separately when needed:

```bash
cd scraper
RUN_MODE=consumer npm run dev
```

## `docker-compose.build.yml`

Local image build helper.

Starts only:

- `db`
- `web`

Important limitation:

- the server requires Redis at startup
- this file does not provide Redis
- it is useful for image-build smoke testing, but not as a complete runnable queue-based stack unless you add Redis separately

## Current runtime details

- `ics-web` serves both the API and the built frontend in production
- `ics-web` mounts only `server/src/config/cinemas.json` into the built container
- the scraper image exposes metrics internally on port `9091` at `/metrics`
- the backend exposes metrics at `/metrics`

## Useful commands

```bash
# production-style stack
docker compose up -d
docker compose logs -f ics-web
docker compose restart ics-web
docker compose down

# dev stack
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml logs -f
docker compose -f docker-compose.dev.yml down

# local image build helper
docker compose -f docker-compose.build.yml up --build -d
```

## Related

- [Production Deployment](./production.md)
- [Monitoring](./monitoring.md)
- [Configuration](../../getting-started/configuration.md)
