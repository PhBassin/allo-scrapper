# 🗄 Database Schema

Complete database schema documentation for the Allo-Scrapper PostgreSQL database.

**Related Documentation:**
- [API Reference](./api/README.md) - API endpoints that query this data
- [Installation Guide](../getting-started/installation.md) - Database initialization

---

## Table of Contents

- [Overview](#overview)
- [Tables](#tables)
  - [cinemas](#cinemas)
  - [films](#films)
  - [showtimes](#showtimes)
  - [weekly_programs](#weekly_programs)
  - [scrape_reports](#scrape_reports)
  - [users](#users)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [Migrations](#migrations)

---

## Overview

The database uses PostgreSQL 15+ with the following design principles:
- **Relational data** with foreign key constraints
- **JSON columns** for flexible array storage (genres, actors, experiences)
- **Composite primary keys** for showtimes (cinema + film + date + time)
- **Indexes** for optimized query performance
- **JSONB** for scrape report metadata

---

## Tables

### cinemas

Stores cinema venue information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Cinema ID from the source website (e.g., `C0089`, `W7504`) |
| `name` | TEXT | NOT NULL | Cinema name |
| `address` | TEXT | | Street address |
| `postal_code` | TEXT | | Postal code |
| `city` | TEXT | | City name |
| `screen_count` | INTEGER | | Number of screens |
| `image_url` | TEXT | | Cinema image URL |
| `url` | TEXT | | Source website page URL for scraping (null = not scraped) |

**Indexes:**
- Primary key on `id`

**Example:**
```sql
SELECT * FROM cinemas WHERE id = 'W7504';
```

---

### films

Stores film metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Film ID from the source website |
| `title` | TEXT | NOT NULL | French title |
| `original_title` | TEXT | | Original title |
| `poster_url` | TEXT | | Poster image URL |
| `duration_minutes` | INTEGER | | Runtime in minutes |
| `release_date` | TEXT | | Initial release date (ISO 8601) |
| `rerelease_date` | TEXT | | Re-release date (ISO 8601, nullable) |
| `genres` | TEXT | | JSON array of genres (e.g., `["Drama","Thriller"]`) |
| `nationality` | TEXT | | Country of origin |
| `director` | TEXT | | Director name |
| `actors` | TEXT | | JSON array of actor names |
| `synopsis` | TEXT | | Film synopsis |
| `certificate` | TEXT | | Age rating (TP, -12, -16, etc.) |
| `press_rating` | REAL | | Press rating (0-5) |
| `audience_rating` | REAL | | Audience rating (0-5) |
| `source_url` | TEXT | | Source website film page URL |

**Indexes:**
- Primary key on `id`
- GIN index on `title` and `original_title` for trigram search (fuzzy matching)

**Example:**
```sql
SELECT * FROM films WHERE id = 123456;

-- Search with trigram similarity
SELECT * FROM films 
WHERE similarity(title, 'Matrix') > 0.3 
ORDER BY similarity(title, 'Matrix') DESC;
```

---

### showtimes

Stores individual screening times.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Composite unique ID (`{cinema_id}-{film_id}-{date}-{time}`) |
| `film_id` | INTEGER | FOREIGN KEY → `films.id` | Film being screened |
| `cinema_id` | TEXT | FOREIGN KEY → `cinemas.id` | Cinema screening the film |
| `date` | TEXT | NOT NULL | Date in `YYYY-MM-DD` format |
| `time` | TEXT | NOT NULL | Time in `HH:MM` format (24-hour) |
| `datetime_iso` | TEXT | | Full ISO 8601 datetime with timezone |
| `version` | TEXT | | Language version (VF, VO, VOSTFR) |
| `format` | TEXT | | Projection format (2D, 3D) |
| `experiences` | TEXT | | JSON array of experiences (e.g., `["Dolby Atmos","IMAX"]`) |
| `week_start` | TEXT | | Week start date (`YYYY-MM-DD`) for grouping |

**Indexes:**
- Primary key on `id`
- `idx_showtimes_cinema_date` on `(cinema_id, date)` - Cinema schedule queries
- `idx_showtimes_film_date` on `(film_id, date)` - Film showtime queries
- `idx_showtimes_week` on `(week_start)` - Weekly program queries

**Foreign Keys:**
- `film_id` references `films(id)` ON DELETE CASCADE
- `cinema_id` references `cinemas(id)` ON DELETE CASCADE

**Example:**
```sql
-- Get all showtimes for a cinema on a specific date
SELECT * FROM showtimes 
WHERE cinema_id = 'W7504' AND date = '2024-02-15'
ORDER BY time;

-- Get all showtimes for a film
SELECT s.*, c.name AS cinema_name 
FROM showtimes s
JOIN cinemas c ON s.cinema_id = c.id
WHERE s.film_id = 123456
ORDER BY s.date, s.time;
```

---

### weekly_programs

Tracks which films are playing at which cinemas per week.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `cinema_id` | TEXT | FOREIGN KEY → `cinemas.id` | Cinema showing the film |
| `film_id` | INTEGER | FOREIGN KEY → `films.id` | Film being shown |
| `week_start` | TEXT | NOT NULL | Week start date (`YYYY-MM-DD`) |
| `is_new_this_week` | INTEGER | DEFAULT 0 | Boolean flag (0/1) - Is this a new release? |
| `scraped_at` | TEXT | | Scrape timestamp (ISO 8601) |

**Indexes:**
- Primary key on `id`
- `idx_weekly_programs_week` on `(week_start)` - Weekly queries
- UNIQUE constraint on `(cinema_id, film_id, week_start)` - Prevent duplicates

**Foreign Keys:**
- `cinema_id` references `cinemas(id)` ON DELETE CASCADE
- `film_id` references `films(id)` ON DELETE CASCADE

**Example:**
```sql
-- Get all films playing this week at a cinema
SELECT f.*, wp.is_new_this_week
FROM weekly_programs wp
JOIN films f ON wp.film_id = f.id
WHERE wp.cinema_id = 'W7504' AND wp.week_start = '2024-02-12'
ORDER BY wp.is_new_this_week DESC, f.title;
```

---

### scrape_reports

Logs scraping job execution details.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing report ID |
| `started_at` | TIMESTAMPTZ | NOT NULL | Job start time (with timezone) |
| `completed_at` | TIMESTAMPTZ | | Job completion time (nullable if still running) |
| `status` | TEXT | NOT NULL | Status: `running`, `success`, `partial_success`, `failed` |
| `trigger_type` | TEXT | NOT NULL | Trigger: `manual`, `cron` |
| `total_cinemas` | INTEGER | DEFAULT 0 | Number of cinemas attempted |
| `successful_cinemas` | INTEGER | DEFAULT 0 | Successfully scraped cinemas |
| `failed_cinemas` | INTEGER | DEFAULT 0 | Failed cinema scrapes |
| `total_films_scraped` | INTEGER | DEFAULT 0 | Total films found |
| `total_showtimes_scraped` | INTEGER | DEFAULT 0 | Total showtimes found |
| `errors` | JSONB | DEFAULT '[]' | Array of error objects |
| `progress_log` | JSONB | DEFAULT '[]' | Array of progress events (SSE events) |

**Indexes:**
- Primary key on `id`
- `idx_scrape_reports_started_at` on `(started_at DESC)` - Recent reports first
- `idx_scrape_reports_status` on `(status)` - Filter by status

**Example:**
```sql
-- Get recent scrape reports
SELECT * FROM scrape_reports 
ORDER BY started_at DESC 
LIMIT 10;

-- Get failed scrapes
SELECT * FROM scrape_reports 
WHERE status = 'failed'
ORDER BY started_at DESC;

-- Get error details
SELECT id, started_at, errors 
FROM scrape_reports 
WHERE jsonb_array_length(errors) > 0;
```

---

### users

Stores user authentication credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| `username` | VARCHAR(255) | UNIQUE, NOT NULL | Unique username |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hashed password |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Account creation timestamp |

**Indexes:**
- Primary key on `id`
- UNIQUE constraint on `username`

**Default User:**
- Username: `admin`
- Password: `admin` (bcrypt hashed)
- Created automatically on first database initialization

**Example:**
```sql
-- Verify user exists
SELECT id, username, created_at FROM users WHERE username = 'admin';

-- Count users
SELECT COUNT(*) FROM users;
```

**Security Notes:**
- Passwords are **never stored in plaintext**
- Uses bcrypt hashing with salt (via `bcrypt.hash()` in Node.js)
- Default admin password should be changed in production

---

## Relationships

```
cinemas (1) ──────┬─── (N) showtimes
                  │
                  └─── (N) weekly_programs
                           │
films (1) ────────┴────────┘
      │
      └─── (N) showtimes
```

**Cascade Behavior:**
- Deleting a cinema → Deletes all its showtimes and weekly_programs
- Deleting a film → Deletes all its showtimes and weekly_programs
- Deleting a scrape_report → No cascades (reports are independent)
- Deleting a user → No cascades (no user-owned data currently)

---

## Indexes

### Performance Indexes

| Table | Index Name | Columns | Purpose |
|-------|-----------|---------|---------|
| `showtimes` | `idx_showtimes_cinema_date` | `(cinema_id, date)` | Cinema schedule queries |
| `showtimes` | `idx_showtimes_film_date` | `(film_id, date)` | Film showtime queries |
| `showtimes` | `idx_showtimes_week` | `(week_start)` | Weekly program queries |
| `weekly_programs` | `idx_weekly_programs_week` | `(week_start)` | Weekly queries |
| `scrape_reports` | `idx_scrape_reports_started_at` | `(started_at DESC)` | Recent reports |
| `scrape_reports` | `idx_scrape_reports_status` | `(status)` | Status filtering |

### Search Indexes

| Table | Index Type | Columns | Purpose |
|-------|-----------|---------|---------|
| `films` | GIN (trigram) | `title` | Fuzzy search by title |
| `films` | GIN (trigram) | `original_title` | Fuzzy search by original title |

**Trigram Search Extension:**
The database uses the PostgreSQL `pg_trgm` extension for fuzzy text search. This enables:
- Typo tolerance (e.g., "Matirx" finds "Matrix")
- Partial matching (e.g., "Matr" finds "Matrix")
- Similarity scoring (0.0 to 1.0)

```sql
-- Enable extension (already in schema.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Example fuzzy search
SELECT title, similarity(title, 'Matirx') AS score
FROM films
WHERE similarity(title, 'Matirx') > 0.3
ORDER BY score DESC;
```

---

## Migrations

### Migration Files

Located in `server/src/db/schema.ts` (single-file schema for now).

**Migration History:**
1. **Initial schema** - Core tables (`cinemas`, `films`, `showtimes`, `weekly_programs`, `scrape_reports`)
2. **Users table** (v2.0.0) - Authentication support
3. **Trigram indexes** - Fuzzy film search

### Running Migrations

```bash
# Development (manual setup)
cd server
npm run db:migrate

# Docker Compose (automatic on startup)
docker compose exec ics-web npm run db:migrate

# Production
docker compose exec ics-web npm run db:migrate
```

### Checking Schema

```bash
# Connect to PostgreSQL
docker compose exec ics-db psql -U postgres -d ics

# Inside psql:
\dt                    # List tables
\d cinemas             # Describe cinemas table
\di                    # List indexes
\df                    # List functions
SELECT version();      # PostgreSQL version
```

---

## Query Examples

### Cinema Queries

```sql
-- Get cinema with all showtimes for today
SELECT c.*, 
       json_agg(s.*) AS showtimes
FROM cinemas c
LEFT JOIN showtimes s ON c.id = s.cinema_id
WHERE s.date = CURRENT_DATE
GROUP BY c.id;

-- Count showtimes per cinema
SELECT c.name, COUNT(s.id) AS showtime_count
FROM cinemas c
LEFT JOIN showtimes s ON c.id = s.cinema_id
GROUP BY c.id, c.name
ORDER BY showtime_count DESC;
```

### Film Queries

```sql
-- Get film with all showtimes
SELECT f.*, 
       json_agg(
         json_build_object(
           'cinema_id', c.id,
           'cinema_name', c.name,
           'date', s.date,
           'time', s.time
         )
       ) AS showtimes
FROM films f
LEFT JOIN showtimes s ON f.id = s.film_id
LEFT JOIN cinemas c ON s.cinema_id = c.id
WHERE f.id = 123456
GROUP BY f.id;

-- Find new releases this week
SELECT f.*, wp.week_start
FROM weekly_programs wp
JOIN films f ON wp.film_id = f.id
WHERE wp.is_new_this_week = 1
  AND wp.week_start = '2024-02-12'
ORDER BY f.title;
```

### Showtime Queries

```sql
-- Get showtimes for a specific date range
SELECT s.*, f.title, c.name AS cinema_name
FROM showtimes s
JOIN films f ON s.film_id = f.id
JOIN cinemas c ON s.cinema_id = c.id
WHERE s.date BETWEEN '2024-02-15' AND '2024-02-21'
ORDER BY s.date, s.time;

-- Count showtimes by version
SELECT version, COUNT(*) AS count
FROM showtimes
WHERE date >= CURRENT_DATE
GROUP BY version
ORDER BY count DESC;
```

### Report Queries

```sql
-- Average scrape duration
SELECT AVG(
  EXTRACT(EPOCH FROM (completed_at - started_at))
) AS avg_duration_seconds
FROM scrape_reports
WHERE status = 'success';

-- Error rate by trigger type
SELECT trigger_type,
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       ROUND(
         100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*),
         2
       ) AS error_rate_pct
FROM scrape_reports
GROUP BY trigger_type;
```

---

## Related Documentation

- [API Reference](./api/README.md) - API endpoints that query this data
- [Installation Guide](../getting-started/installation.md) - Database initialization
- [Troubleshooting](../troubleshooting/common-issues.md) - Database issues

---

[← Back to Reference Docs](./README.md) | [Back to Documentation](../README.md)
