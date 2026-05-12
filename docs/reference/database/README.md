# 🗄 Database Schema

Complete database schema documentation for the Allo-Scrapper PostgreSQL database.

**Related Documentation:**
- [API Reference](../api/README.md) - API endpoints that query this data
- [Installation Guide](../../getting-started/installation.md) - Database initialization

---

## Table of Contents

- [Overview](#overview)
- [Tables](#tables)
  - [theaters](#theaters)
  - [movies](#movies)
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
- **Composite primary keys** for showtimes (theater + movie + date + time)
- **Indexes** for optimized query performance
- **JSONB** for scrape report metadata

---

## Tables

### theaters

Stores theater venue information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Theater ID from the source website (e.g., `C0089`, `W7504`) |
| `name` | TEXT | NOT NULL | Theater name |
| `address` | TEXT | | Street address |
| `postal_code` | TEXT | | Postal code |
| `city` | TEXT | | City name |
| `screen_count` | INTEGER | | Number of screens |
| `image_url` | TEXT | | Theater image URL |
| `url` | TEXT | | Source website page URL for scraping (null = not scraped) |

**Indexes:**
- Primary key on `id`

**Example:**
```sql
SELECT * FROM theaters WHERE id = 'W7504';
```

---

### movies

Stores movie metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Movie ID from the source website |
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
| `synopsis` | TEXT | | Movie synopsis |
| `certificate` | TEXT | | Age rating (TP, -12, -16, etc.) |
| `press_rating` | REAL | | Press rating (0-5) |
| `audience_rating` | REAL | | Audience rating (0-5) |
| `source_url` | TEXT | | Source website movie page URL |
| `trailer_url` | TEXT | | Trailer URL (when available) |

**Indexes:**
- Primary key on `id`
- GIN index on `title` and `original_title` for trigram search (fuzzy matching)

**Example:**
```sql
SELECT * FROM movies WHERE id = 123456;

-- Search with trigram similarity
SELECT * FROM movies 
WHERE similarity(title, 'Matrix') > 0.3 
ORDER BY similarity(title, 'Matrix') DESC;
```

---

### showtimes

Stores individual screening times.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Composite unique ID (`{theater_id}-{movie_id}-{date}-{time}`) |
| `movie_id` | INTEGER | FOREIGN KEY → `movies.id` | Movie being screened |
| `theater_id` | TEXT | FOREIGN KEY → `theaters.id` | Theater screening the movie |
| `date` | TEXT | NOT NULL | Date in `YYYY-MM-DD` format |
| `time` | TEXT | NOT NULL | Time in `HH:MM` format (24-hour) |
| `datetime_iso` | TEXT | | Full ISO 8601 datetime with timezone |
| `version` | TEXT | | Language version (VF, VO, VOSTFR) |
| `format` | TEXT | | Projection format (2D, 3D) |
| `experiences` | TEXT | | JSON array of experiences (e.g., `["Dolby Atmos","IMAX"]`) |
| `week_start` | TEXT | | Week start date (`YYYY-MM-DD`) for grouping |

**Indexes:**
- Primary key on `id`
- `idx_showtimes_theater_date` on `(theater_id, date)` - Theater schedule queries
- `idx_showtimes_movie_date` on `(movie_id, date)` - Movie showtime queries
- `idx_showtimes_week` on `(week_start)` - Weekly program queries

**Foreign Keys:**
- `movie_id` references `movies(id)` ON DELETE CASCADE
- `theater_id` references `theaters(id)` ON DELETE CASCADE

**Example:**
```sql
-- Get all showtimes for a theater on a specific date
SELECT * FROM showtimes 
WHERE theater_id = 'W7504' AND date = '2024-02-15'
ORDER BY time;

-- Get all showtimes for a movie
SELECT s.*, t.name AS theater_name 
FROM showtimes s
JOIN theaters t ON s.theater_id = t.id
WHERE s.movie_id = 123456
ORDER BY s.date, s.time;
```

---

### weekly_programs

Tracks which movies are playing at which theaters per week.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `theater_id` | TEXT | FOREIGN KEY → `theaters.id` | Theater showing the movie |
| `movie_id` | INTEGER | FOREIGN KEY → `movies.id` | Movie being shown |
| `week_start` | TEXT | NOT NULL | Week start date (`YYYY-MM-DD`) |
| `is_new_this_week` | INTEGER | DEFAULT 0 | Boolean flag (0/1) - Is this a new release? |
| `scraped_at` | TEXT | | Scrape timestamp (ISO 8601) |

**Indexes:**
- Primary key on `id`
- `idx_weekly_programs_week` on `(week_start)` - Weekly queries
- UNIQUE constraint on `(theater_id, movie_id, week_start)` - Prevent duplicates

**Foreign Keys:**
- `theater_id` references `theaters(id)` ON DELETE CASCADE
- `movie_id` references `movies(id)` ON DELETE CASCADE

**Example:**
```sql
-- Get all movies playing this week at a theater
SELECT m.*, wp.is_new_this_week
FROM weekly_programs wp
JOIN movies m ON wp.movie_id = m.id
WHERE wp.theater_id = 'W7504' AND wp.week_start = '2024-02-12'
ORDER BY wp.is_new_this_week DESC, m.title;
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
| `total_theaters` | INTEGER | DEFAULT 0 | Number of theaters attempted |
| `successful_theaters` | INTEGER | DEFAULT 0 | Successfully scraped theaters |
| `failed_theaters` | INTEGER | DEFAULT 0 | Failed theater scrapes |
| `total_movies_scraped` | INTEGER | DEFAULT 0 | Total movies found |
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
| `role_id` | INTEGER | NOT NULL, FK → `roles(id)` | User's assigned role |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Account creation timestamp |

**Indexes:**
- Primary key on `id`
- UNIQUE constraint on `username`
- `idx_users_role_id` on `role_id`

**Default User:**
- Username: `admin`
- Password: `admin` (bcrypt hashed)
- Role: References admin role in `roles` table
- Created automatically on first database initialization

**RBAC Integration:**
- Role is now a foreign key reference to `roles` table (migrated from TEXT in migration 008)
- See [Roles & Permissions Reference](../roles-and-permissions.md) for complete RBAC table structures

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
theaters (1) ──────┬─── (N) showtimes
                   │
                   └─── (N) weekly_programs
                            │
movies (1) ────────┴────────┘
       │
       └─── (N) showtimes
```

**Cascade Behavior:**
- Deleting a theater → Deletes all its showtimes and weekly_programs
- Deleting a movie → Deletes all its showtimes and weekly_programs
- Deleting a scrape_report → No cascades (reports are independent)
- Deleting a user → No cascades (no user-owned data currently)

---

## Indexes

### Performance Indexes

| Table | Index Name | Columns | Purpose |
|-------|-----------|---------|---------|
| `showtimes` | `idx_showtimes_theater_date` | `(theater_id, date)` | Theater schedule queries |
| `showtimes` | `idx_showtimes_movie_date` | `(movie_id, date)` | Movie showtime queries |
| `showtimes` | `idx_showtimes_week` | `(week_start)` | Weekly program queries |
| `weekly_programs` | `idx_weekly_programs_week` | `(week_start)` | Weekly queries |
| `scrape_reports` | `idx_scrape_reports_started_at` | `(started_at DESC)` | Recent reports |
| `scrape_reports` | `idx_scrape_reports_status` | `(status)` | Status filtering |

### Search Indexes

| Table | Index Type | Columns | Purpose |
|-------|-----------|---------|---------|
| `movies` | GIN (trigram) | `title` | Fuzzy search by title |
| `movies` | GIN (trigram) | `original_title` | Fuzzy search by original title |

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
FROM movies
WHERE similarity(title, 'Matirx') > 0.3
ORDER BY score DESC;
```

---

## Migrations

### Migration Files

Located in `server/src/db/schema.ts` (single-file schema for now).

**Migration History:**
1. **Initial schema** - Core tables (`theaters`, `movies`, `showtimes`, `weekly_programs`, `scrape_reports`)
2. **Users table** (v2.0.0) - Authentication support
3. **Trigram indexes** - Fuzzy movie search

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
\d theaters             # Describe theaters table
\di                    # List indexes
\df                    # List functions
SELECT version();      # PostgreSQL version
```

---

## Query Examples

### Theater Queries

```sql
-- Get theater with all showtimes for today
SELECT t.*, 
       json_agg(s.*) AS showtimes
FROM theaters t
LEFT JOIN showtimes s ON t.id = s.theater_id
WHERE s.date = CURRENT_DATE
GROUP BY t.id;

-- Count showtimes per theater
SELECT t.name, COUNT(s.id) AS showtime_count
FROM theaters t
LEFT JOIN showtimes s ON t.id = s.theater_id
GROUP BY t.id, t.name
ORDER BY showtime_count DESC;
```

### Movie Queries

```sql
-- Get movie with all showtimes
SELECT m.*, 
       json_agg(
         json_build_object(
           'theater_id', t.id,
           'theater_name', t.name,
           'date', s.date,
           'time', s.time
         )
       ) AS showtimes
FROM movies m
LEFT JOIN showtimes s ON m.id = s.movie_id
LEFT JOIN theaters t ON s.theater_id = t.id
WHERE m.id = 123456
GROUP BY m.id;

-- Find new releases this week
SELECT m.*, wp.week_start
FROM weekly_programs wp
JOIN movies m ON wp.movie_id = m.id
WHERE wp.is_new_this_week = 1
  AND wp.week_start = '2024-02-12'
ORDER BY m.title;
```

### Showtime Queries

```sql
-- Get showtimes for a specific date range
SELECT s.*, m.title, t.name AS theater_name
FROM showtimes s
JOIN movies m ON s.movie_id = m.id
JOIN theaters t ON s.theater_id = t.id
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

- [API Reference](../api/README.md) - API endpoints that query this data
- [Installation Guide](../../getting-started/installation.md) - Database initialization
- [Troubleshooting](../../troubleshooting/common-issues.md) - Database issues

---

[← Back to Reference Docs](../README.md) | [Back to Documentation](../../README.md)
