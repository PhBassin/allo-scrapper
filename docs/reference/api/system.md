# System API

All routes are protected.

## `GET /api/system/info`

Requires `system:info`.

Returns:

- app version from `package.json`
- build date generated at request time by the current implementation
- environment
- Node version
- server uptime and memory usage
- database size and row counts

## `GET /api/system/migrations`

Requires `system:migrations`.

Returns:

- applied migrations from `schema_migrations`
- pending migration files from the `migrations/` directory
- combined total

## `GET /api/system/health`

Requires `system:health`.

Returns:

- overall status: `healthy` or `degraded`
- check flags for database and migrations
- scraper summary: `activeJobs`, `lastScrapeTime`, `totalCinemas`
- uptime
