# 🎯 Scraper Configuration

**Last updated:** March 18, 2026 | Status: Current ✅

Complete guide for configuring and managing the cinema scraper.

**Related Documentation:**
- [Scraper API](./api/scraper.md) - Scraper API endpoints
- [Database Reference](./database/) - Data storage structure
- [Docker Deployment](../guides/deployment/docker.md) - Scraper microservice mode

---

## Table of Contents

- [Overview](#overview)
- [Cinema Configuration](#cinema-configuration)
- [Configuration Synchronization](#configuration-synchronization)
- [Adding New Cinemas](#adding-new-cinemas)
- [Scraping Behavior](#scraping-behavior)
- [Git Workflow](#git-workflow)

---

## Overview

Cinema list is managed in the **database**, not a static file. On first startup, `server/src/config/cinemas.json` is automatically seeded into the database. After that, use the REST API to add, update, or remove cinemas.

**Currently tracking 3 cinemas in Paris (default seed):**
- **W7504**: Épée de Bois
- **C0072**: Le Grand Action  
- **C0089**: Max Linder Panorama

---

## Cinema Configuration

### Configuration Sources

The application uses **two synchronized sources** for cinema configuration:

1. **PostgreSQL Database** (primary source at runtime)
   - Used by the API and scraper
   - Modified via REST API (`POST /api/cinemas`, `PUT /api/cinemas/:id`, `DELETE /api/cinemas/:id`)
   - Persisted in Docker volume (`postgres-data`)

2. **cinemas.json File** (seed and git reference)
   - Located in `server/src/config/cinemas.json`
   - Used for initial database seeding on first startup
   - Automatically kept in sync with database via volume mount
   - Committed to git for version control

### Data Model

```json
{
  "cinemas": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=W7504.html"
    }
  ]
}
```

**Fields:**
- `id` (required): Cinema ID from the source website (e.g., `C0089`, `W7504`)
- `name` (required): Cinema display name
- `url` (required): Source website page URL for scraping

---

## Configuration Synchronization

### Automatic Sync

**When cinemas are added, updated, or deleted via the API, both the PostgreSQL database AND the `server/src/config/cinemas.json` file are automatically synchronized.**

**Volume Mount for Git Persistence:**

The `server/src/config/` directory is mounted as a Docker volume (`./server/src/config:/app/server/src/config`), which means:
- Changes to `cinemas.json` inside the container are **immediately visible** on your host filesystem
- You can commit and push these changes to git using the standard workflow
- The file persists across container restarts and rebuilds
- Works on both macOS and Linux hosts

**How it works:**
- All CRUD operations (`POST /api/cinemas`, `PUT /api/cinemas/:id`, `DELETE /api/cinemas/:id`) update both the database and JSON file atomically using transactions
- If the JSON write fails, the database changes are automatically rolled back to maintain consistency
- File locking prevents concurrent write corruption
- The volume mount ensures changes are immediately visible to git on the host

### Manual Sync

If the JSON file becomes out of sync with the database (e.g., after manual database edits), you can manually trigger synchronization:

```bash
curl http://localhost:3000/api/cinemas/sync
```

This endpoint reads all cinemas from the database and overwrites `cinemas.json`.

**Note:** Both the PostgreSQL database (in a Docker volume) and `cinemas.json` (on host filesystem via volume mount) are kept in sync automatically. Either can be used as a reference.

---

## Adding New Cinemas

### Recommended Workflow: API-First

The `server/src/config/` directory is volume-mounted in Docker, so changes made via the API are immediately visible on the host filesystem and can be committed to git.

**Step 1 — Add via API** (smart URL-based add with auto-scrape):
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"}'
```
This extracts the cinema ID, scrapes metadata and showtimes, and updates both the database and `server/src/config/cinemas.json`.

**Step 2 — Verify the change is visible on host:**
```bash
cat server/src/config/cinemas.json
git status
# → modified: server/src/config/cinemas.json
git diff server/src/config/cinemas.json
```

**Step 3 — Commit and push** (Conventional Commits format):
```bash
git add server/src/config/cinemas.json
git commit -m "feat(cinema): add <cinema name> (CXXXX)"
git push
```

### Alternative: Manual Edit (Development/Testing)

1. Edit `server/src/config/cinemas.json` directly on the host
2. Restart: `docker compose restart ics-web`
3. Resync DB from JSON: `curl http://localhost:3000/api/cinemas/sync`
4. Commit: `git add server/src/config/cinemas.json && git commit -m "feat(cinema): add <cinema>"`

### Adding Cinemas with Parser Changes

**For parser changes** (write tests before adding the cinema):

1. Fetch HTML fixture for tests
2. Write parser tests with the fixture
3. Verify existing tests still pass
4. Then add cinema via API and follow the git workflow above
5. Test commit: `test(parser): add tests for <cinema> (CXXXX)`
6. Cinema commit: `feat(cinema): add <cinema> (CXXXX)`

---

## Scraping Behavior

### Automatic Scraping

- **Runs on schedule** defined by `SCRAPE_CRON_SCHEDULE` (default: Wednesdays at 8 AM Paris time)
- **Cron jobs always use `weekly` mode** for 7 days
- **Trigger type**: `cron`

### Manual Scraping

- **Trigger via API**: `POST /api/scraper/trigger`
- **Uses env var defaults**: `SCRAPE_MODE` and `SCRAPE_DAYS`
- **Trigger type**: `manual`

### Scraping Process

**Multi-day loop:**
- For each cinema, the scraper iterates over the configured number of days (`SCRAPE_DAYS`, default 7)
- Fetches one page per date

**Rate limiting:**
- 500ms delay after each film detail page fetch
- 1000ms delay between date requests per cinema

**Film detail fetching:**
- If a film's duration is not yet in the database, the scraper fetches its individual source website page to retrieve it
- Already-known films skip this extra request

**Error handling (date-level):**
- If scraping fails for a specific date, the error is logged and the scraper continues to the next date
- It does not abort the entire cinema

**Error handling (cinema-level):**
- A cinema is only counted as failed if *all* of its dates fail
- A cinema where at least one date succeeds is counted as successful

**Data upsert:**
- Showtimes are inserted or updated via upsert (`INSERT … ON CONFLICT DO UPDATE`)
- Existing records are overwritten, not deleted and re-inserted

**Final status:**
- `success` (0 failed cinemas)
- `partial_success` (some failed)
- `failed` (all failed / fatal error)

### Scraper Modes

Controlled by `SCRAPE_MODE` environment variable:

| Mode | Start Date | Days | Use Case |
|------|-----------|------|----------|
| `weekly` | Last Wednesday | 7 | Default (cron jobs, full week) |
| `from_today` | Today | Configurable | Testing, catch-up scrapes |
| `from_today_limited` | Today | 3 | Quick tests |

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SCRAPE_CRON_SCHEDULE` | Cron expression for scheduled scraping | `0 8 * * 3` | `0 3 * * *` |
| `SCRAPE_THEATER_DELAY_MS` | Delay between cinema scrapes (ms) | `3000` | `5000` |
| `SCRAPE_MOVIE_DELAY_MS` | Delay between film detail fetches (ms) | `500` | `1000` |
| `SCRAPER_CONCURRENCY` | Number of cinemas to process concurrently | `2` | `3` |
| `SCRAPE_DAYS` | Number of days to scrape (1-14) | `7` | `14` |
| `SCRAPE_MODE` | Start date mode | `weekly` | `from_today_limited` |

---

## Git Workflow

### Workflow for Cinema Changes

After adding, updating, or deleting cinemas via the API, commit the changes to the repository:

```bash
# 1. Check what changed
git status
# → modified: server/src/config/cinemas.json

git diff server/src/config/cinemas.json

# 2. Commit using Conventional Commits format
git add server/src/config/cinemas.json

# Adding a cinema:
git commit -m "feat(cinema): add Le Champo (C0042)"
# Removing a cinema:
git commit -m "chore(cinema): remove Épée de Bois (W7504)"
# Updating cinema details:
git commit -m "fix(cinema): update Grand Action URL"

# 3. Push to remote
git push
```

### Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(cinema): <description>

[optional body]

[optional footer: refs #123]
```

**Types:**
- `feat(cinema)` - Adding a new cinema
- `chore(cinema)` - Removing a cinema
- `fix(cinema)` - Updating cinema details (URL, name)

**Examples:**
```bash
feat(cinema): add Le Champo (C0042)
chore(cinema): remove closed cinema Épée de Bois (W7504)
fix(cinema): update Grand Action scraping URL
```

---

## API Endpoints

See [API.md](./api/README.md) for complete API reference:

- `GET /api/cinemas` - List all cinemas
- `GET /api/cinemas/:id` - Get cinema details with showtimes
- `POST /api/cinemas` - Add new cinema
- `PUT /api/cinemas/:id` - Update cinema
- `DELETE /api/cinemas/:id` - Delete cinema
- `GET /api/cinemas/sync` - Manual sync DB → JSON
- `POST /api/scraper/trigger` - Trigger manual scrape
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/progress` - Watch scrape progress (SSE)

---

## Scraper Architecture

### In-Process Mode (Default)

```
Express API (ics-web)
 └─> Scraper Service (in-process)
      └─> PostgreSQL (direct insert)
```

**Feature flag:** `USE_REDIS_SCRAPER=false` (default)

### Microservice Mode

```
Express API (ics-web)
 └─> Redis Publisher (scrape:jobs)
      └─> Redis Consumer (ics-scraper)
           └─> PostgreSQL (direct insert)
           └─> Redis Publisher (progress events)
                └─> Express API (SSE streaming)
```

**Feature flag:** `USE_REDIS_SCRAPER=true`

**Benefits:**
- Isolates scraping workload from API server
- Enables horizontal scaling (multiple scraper workers)
- Better observability (metrics, tracing)

See [DOCKER.md](../guides/deployment/docker.md) for scraper microservice deployment.

---

## Monitoring Scrapes

### Real-Time Progress (SSE)

```bash
# Watch scrape progress in real-time
curl -N http://localhost:3000/api/scraper/progress
```

Events include:
- `started` - Scrape begins
- `cinema_started` - Cinema processing begins
- `date_started` - Date processing begins
- `film_started` / `film_completed` / `film_failed` - Film detail fetch
- `date_completed` / `date_failed` - Date processing complete
- `cinema_completed` - Cinema processing complete
- `completed` - Scrape finished successfully
- `failed` - Fatal error

See [API.md - Watch Scrape Progress](./api/README.md#watch-scrape-progress-sse) for full event reference.

### Scrape Reports

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# View recent reports
curl "http://localhost:3000/api/reports?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"
```

Reports include:
- Start/end timestamps
- Status (running, success, partial_success, failed)
- Cinema counts (total, successful, failed)
- Film and showtime counts
- Error details

---

## Troubleshooting

See [Troubleshooting Guide](../troubleshooting/common-issues.md) for:
- Scraper not running
- Cinema-specific scraping errors
- Data synchronization issues
- Rate limiting problems

---

## Related Documentation

- [Scraper API](./api/scraper.md) - Scraper API endpoints
- [Database Reference](./database/) - Data storage structure
- [Docker Deployment](../guides/deployment/docker.md) - Scraper microservice mode
- [Troubleshooting](../troubleshooting/common-issues.md) - Scraper issues

---

[← Back to Reference Docs](./README.md) | [Back to Documentation](../README.md)
