# 🎯 Scraper Configuration

**Last updated:** March 18, 2026 | Status: Current ✅

Complete guide for configuring and managing the theater scraper.

**Related Documentation:**
- [Scraper API](./api/scraper.md) - Scraper API endpoints
- [Database Reference](./database/) - Data storage structure
- [Docker Deployment](../guides/deployment/docker.md) - Scraper microservice mode

---

## Table of Contents

- [Overview](#overview)
- [Theater Configuration](#theater-configuration)
- [Configuration Synchronization](#configuration-synchronization)
- [Adding New Theaters](#adding-new-theaters)
- [Scraping Behavior](#scraping-behavior)
- [Git Workflow](#git-workflow)

---

## Overview

Theater list is managed in the **database**, not a static file. On first startup, `server/src/config/theaters.json` is automatically seeded into the database. After that, use the REST API to add, update, or remove theaters.

**Currently tracking 3 theaters in Paris (default seed):**
- **W7504**: Épée de Bois
- **C0072**: Le Grand Action  
- **C0089**: Max Linder Panorama

---

## Theater Configuration

### Configuration Sources

The application uses **two synchronized sources** for theater configuration:

1. **PostgreSQL Database** (primary source at runtime)
   - Used by the API and scraper
   - Modified via REST API (`POST /api/theaters`, `PUT /api/theaters/:id`, `DELETE /api/theaters/:id`)
   - Persisted in Docker volume (`postgres-data`)

2. **theaters.json File** (seed and git reference)
   - Located in `server/src/config/theaters.json`
   - Used for initial database seeding on first startup
   - Automatically kept in sync with database via volume mount
   - Committed to git for version control

### Data Model

```json
{
  "theaters": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "url": "https://www.example-theater-site.com/seance/salle_gen_csalle=W7504.html"
    }
  ]
}
```

**Fields:**
- `id` (required): Theater ID from the source website (e.g., `C0089`, `W7504`)
- `name` (required): Theater display name
- `url` (required): Source website page URL for scraping

---

## Configuration Synchronization

### Automatic Sync

**When theaters are added, updated, or deleted via the API, both the PostgreSQL database AND the `server/src/config/theaters.json` file are automatically synchronized.**

**Volume Mount for Git Persistence:**

The `server/src/config/` directory is mounted as a Docker volume (`./server/src/config:/app/server/src/config`), which means:
- Changes to `theaters.json` inside the container are **immediately visible** on your host filesystem
- You can commit and push these changes to git using the standard workflow
- The file persists across container restarts and rebuilds
- Works on both macOS and Linux hosts

**How it works:**
- All CRUD operations (`POST /api/theaters`, `PUT /api/theaters/:id`, `DELETE /api/theaters/:id`) update both the database and JSON file atomically using transactions
- If the JSON write fails, the database changes are automatically rolled back to maintain consistency
- File locking prevents concurrent write corruption
- The volume mount ensures changes are immediately visible to git on the host

### Manual Sync

If the JSON file becomes out of sync with the database (e.g., after manual database edits), you can manually trigger synchronization:

```bash
curl http://localhost:3000/api/theaters/sync
```

This endpoint reads all theaters from the database and overwrites `theaters.json`.

**Note:** Both the PostgreSQL database (in a Docker volume) and `theaters.json` (on host filesystem via volume mount) are kept in sync automatically. Either can be used as a reference.

---

## Adding New Theaters

### Recommended Workflow: API-First

The `server/src/config/` directory is volume-mounted in Docker, so changes made via the API are immediately visible on the host filesystem and can be committed to git.

**Step 1 — Add via API** (smart URL-based add with auto-scrape):
```bash
curl -X POST http://localhost:3000/api/theaters \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"}'
```
This extracts the theater ID, scrapes metadata and showtimes, and updates both the database and `server/src/config/theaters.json`.

**Step 2 — Verify the change is visible on host:**
```bash
cat server/src/config/theaters.json
git status
# → modified: server/src/config/theaters.json
git diff server/src/config/theaters.json
```

**Step 3 — Commit and push** (Conventional Commits format):
```bash
git add server/src/config/theaters.json
git commit -m "feat(theater): add <theater name> (CXXXX)"
git push
```

### Alternative: Manual Edit (Development/Testing)

1. Edit `server/src/config/theaters.json` directly on the host
2. Restart: `docker compose restart ics-web`
3. Resync DB from JSON: `curl http://localhost:3000/api/theaters/sync`
4. Commit: `git add server/src/config/theaters.json && git commit -m "feat(theater): add <theater>"`

### Adding Theaters with Parser Changes

**For parser changes** (write tests before adding the theater):

1. Fetch HTML fixture for tests
2. Write parser tests with the fixture
3. Verify existing tests still pass
4. Then add theater via API and follow the git workflow above
5. Test commit: `test(parser): add tests for <theater> (CXXXX)`
6. Theater commit: `feat(theater): add <theater> (CXXXX)`

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
- For each theater, the scraper iterates over the configured number of days (`SCRAPE_DAYS`, default 7)
- Fetches one page per date

**Rate limiting:**
- 500ms delay after each movie detail page fetch
- 1000ms delay between date requests per theater

**Movie detail fetching:**
- If a movie's duration is not yet in the database, the scraper fetches its individual source website page to retrieve it
- Already-known movies skip this extra request

**Error handling (date-level):**
- If scraping fails for a specific date, the error is logged and the scraper continues to the next date
- It does not abort the entire theater

**Error handling (theater-level):**
- A theater is only counted as failed if *all* of its dates fail
- A theater where at least one date succeeds is counted as successful

**Data upsert:**
- Showtimes are inserted or updated via upsert (`INSERT … ON CONFLICT DO UPDATE`)
- Existing records are overwritten, not deleted and re-inserted

**Final status:**
- `success` (0 failed theaters)
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
| `SCRAPE_THEATER_DELAY_MS` | Delay between theater scrapes (ms) | `3000` | `5000` |
| `SCRAPE_MOVIE_DELAY_MS` | Delay between movie detail fetches (ms) | `500` | `1000` |
| `SCRAPE_DAYS` | Number of days to scrape (1-14) | `7` | `14` |
| `SCRAPE_MODE` | Start date mode | `weekly` | `from_today_limited` |

---

## Git Workflow

### Workflow for Theater Changes

After adding, updating, or deleting theaters via the API, commit the changes to the repository:

```bash
# 1. Check what changed
git status
# → modified: server/src/config/theaters.json

git diff server/src/config/theaters.json

# 2. Commit using Conventional Commits format
git add server/src/config/theaters.json

# Adding a theater:
git commit -m "feat(theater): add Le Champo (C0042)"
# Removing a theater:
git commit -m "chore(theater): remove Épée de Bois (W7504)"
# Updating theater details:
git commit -m "fix(theater): update Grand Action URL"

# 3. Push to remote
git push
```

### Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(theater): <description>

[optional body]

[optional footer: refs #123]
```

**Types:**
- `feat(theater)` - Adding a new theater
- `chore(theater)` - Removing a theater
- `fix(theater)` - Updating theater details (URL, name)

**Examples:**
```bash
feat(theater): add Le Champo (C0042)
chore(theater): remove closed theater Épée de Bois (W7504)
fix(theater): update Grand Action scraping URL
```

---

## API Endpoints

See [API.md](./api/README.md) for complete API reference:

- `GET /api/theaters` - List all theaters
- `GET /api/theaters/:id` - Get theater details with showtimes
- `POST /api/theaters` - Add new theater
- `PUT /api/theaters/:id` - Update theater
- `DELETE /api/theaters/:id` - Delete theater
- `GET /api/theaters/sync` - Manual sync DB → JSON
- `POST /api/scraper/trigger` - Trigger manual scrape
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/progress` - Watch scrape progress (SSE)

---

## Scraper Architecture

The scraper runs as a microservice, decoupled from the API server via Redis.

```
Express API (ics-web)
 └─> Redis Publisher (scrape:jobs)
      └─> Redis Consumer (ics-scraper)
           └─> PostgreSQL (direct insert)
           └─> Redis Publisher (progress events)
                └─> Express API (SSE streaming)
```

The scraper microservice (`ics-scraper` and `ics-scraper-cron`) is always included in `docker-compose.yaml` — no feature flag needed.

**Benefits:**
- Isolates scraping workload from API server
- Enables horizontal scaling (multiple scraper workers)
- Better observability (metrics, tracing)

See [Docker Setup](../guides/deployment/docker.md) for scraper microservice deployment.

---

## Monitoring Scrapes

### Real-Time Progress (SSE)

```bash
# Watch scrape progress in real-time
curl -N http://localhost:3000/api/scraper/progress
```

Events include:
- `started` - Scrape begins
- `theater_started` - Theater processing begins
- `date_started` - Date processing begins
- `movie_started` / `movie_completed` / `movie_failed` - Movie detail fetch
- `date_completed` / `date_failed` - Date processing complete
- `theater_completed` - Theater processing complete
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
- Theater counts (total, successful, failed)
- Movie and showtime counts
- Error details

---

## Troubleshooting

See [Troubleshooting Guide](../troubleshooting/common-issues.md) for:
- Scraper not running
- Theater-specific scraping errors
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
