# Scraper Reference

Current scraper behavior is Redis-backed and worker-based.

## Runtime model

- the server publishes scrape jobs to Redis
- the `scraper` workspace consumes jobs from Redis
- progress is published back through Redis and streamed to clients via SSE
- there is no `USE_REDIS_SCRAPER` toggle and no in-process scraping mode

## Worker modes

`RUN_MODE` supports:

- `oneshot`
- `consumer`
- `cron`
- `direct`

Production compose uses:

- `ics-scraper` with `RUN_MODE=consumer`
- `ics-scraper-cron` with `RUN_MODE=cron`

## Key environment variables

- `RUN_MODE`
- `SCRAPE_CRON_SCHEDULE`
- `SCRAPE_THEATER_DELAY_MS`
- `SCRAPE_MOVIE_DELAY_MS`
- `SCRAPER_CONCURRENCY`
- `REDIS_URL`
- `METRICS_PORT` default `9091`

Scrape planning settings are no longer env vars:

- `scrape_mode`
- `scrape_days`

Those are stored in `app_settings` and managed through the settings API/admin UI.

## Cinema seed source

`server/src/config/cinemas.json` is used only as a seed source when the `cinemas` table is empty.

Current server code does not maintain an automatic write-back sync from cinema CRUD operations to that file.

## Related

- [Scraper API](./api/scraper.md)
- [Scraper Architecture](./architecture/scraper-system.md)
