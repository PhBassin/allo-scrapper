# Database Schema Reference

**Last updated:** March 18, 2026 | Status: Current ✅

Complete PostgreSQL schema reference for the Allo-Scrapper database.

## Overview

The database uses **PostgreSQL 15** with the following tables:

- **theaters** - Theater/theater information
- **movies** - Movie metadata
- **showtimes** - Individual screening times
- **weekly_programs** - Weekly movie schedules per theater
- **scrape_reports** - Scraping job execution logs
- **users** - Authentication and user management
- **roles** - Role definitions for RBAC system
- **permissions** - Permission definitions for RBAC system
- **role_permissions** - Junction table linking roles to permissions
- **app_settings** - White-label branding configuration
- **schema_migrations** - Migration tracking system

## Table Definitions

### theaters

Stores theater/theater information scraped from external sources.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | Unique theater identifier (extracted from source URL) |
| `name` | `TEXT` | NOT NULL | Theater name |
| `address` | `TEXT` | | Street address |
| `postal_code` | `TEXT` | | Postal/ZIP code |
| `city` | `TEXT` | | City name |
| `screen_count` | `INTEGER` | | Number of screens |
| `image_url` | `TEXT` | | Theater image URL |
| `url` | `TEXT` | | Source URL for scraping |

**Indexes:**

None (primary key index on `id`)

**Notes:**

- `id` is typically extracted from the source URL (e.g., `C0053` from AlloCiné URL)
- Deleting a theater cascades to `showtimes` and `weekly_programs` tables
- `url` field stores the scraping source URL for updates

**Sample Query:**

```sql
-- Find all theaters in a specific city
SELECT * FROM theaters 
WHERE city = 'Paris' 
ORDER BY name;
```

---

### movies

Stores movie metadata including cast, ratings, and synopsis.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | PRIMARY KEY | Movie ID (from source) |
| `title` | `TEXT` | NOT NULL | Movie title (localized) |
| `original_title` | `TEXT` | | Original title (non-localized) |
| `poster_url` | `TEXT` | | Poster image URL |
| `duration_minutes` | `INTEGER` | | Runtime in minutes |
| `release_date` | `TEXT` | | Original release date (ISO 8601) |
| `rerelease_date` | `TEXT` | | Re-release date for reruns |
| `genres` | `TEXT` | | JSON array of genres |
| `nationality` | `TEXT` | | Country of origin |
| `director` | `TEXT` | | Director name |
| `actors` | `TEXT` | | JSON array of actor names |
| `synopsis` | `TEXT` | | Movie synopsis/description |
| `certificate` | `TEXT` | | Age rating/certificate (e.g., "PG-13", "12+") |
| `press_rating` | `REAL` | | Press/critic rating (0-5) |
| `audience_rating` | `REAL` | | Audience rating (0-5) |
| `source_url` | `TEXT` | NOT NULL | Source URL for metadata updates |
| `trailer_url` | `TEXT` | | Trailer URL from source website |

**Indexes:**

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `idx_movies_title_trgm` | GIN (trigram) | `title` | Fuzzy text search with `pg_trgm` extension |

**Notes:**

- `genres` and `actors` are stored as JSON text (e.g., `["Drama", "Thriller"]`)
- `source_url` replaced the legacy `allocine_url` column in migration 001
- The trigram index enables similarity search: `SELECT * FROM movies WHERE title % 'query'`
- Ratings are on a 0-5 scale (some sources may use different scales)

**Sample Queries:**

```sql
-- Fuzzy search by title (requires pg_trgm extension)
SELECT title, similarity(title, 'Godfather') AS sim
FROM movies
WHERE title % 'Godfather'
ORDER BY sim DESC
LIMIT 5;

-- Movies released in 2024
SELECT title, release_date, genres
FROM movies
WHERE release_date LIKE '2024-%'
ORDER BY release_date DESC;

-- Parse JSON genres field
SELECT title, json_array_elements_text(genres::json) AS genre
FROM movies
WHERE genres IS NOT NULL;
```

---

### showtimes

Individual screening times linking movies to theaters.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | Composite ID (theater-movie-datetime) |
| `movie_id` | `INTEGER` | NOT NULL, FK → `movies(id)` | Movie being shown |
| `theater_id` | `TEXT` | NOT NULL, FK → `theaters(id)` ON DELETE CASCADE | Theater location |
| `date` | `TEXT` | NOT NULL | Date of screening (ISO 8601: YYYY-MM-DD) |
| `time` | `TEXT` | NOT NULL | Time of screening (HH:MM) |
| `datetime_iso` | `TEXT` | NOT NULL | Full ISO 8601 datetime for sorting |
| `version` | `TEXT` | | Language version (e.g., "VO", "VF") |
| `format` | `TEXT` | | Projection format (e.g., "35mm", "Digital") |
| `experiences` | `TEXT` | | JSON array of special experiences |
| `week_start` | `TEXT` | NOT NULL | Monday of the week (ISO 8601: YYYY-MM-DD) |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_showtimes_theater_date` | `theater_id, date` | Find showtimes by theater and date |
| `idx_showtimes_movie_date` | `movie_id, date` | Find showtimes by movie and date |
| `idx_showtimes_week` | `week_start` | Weekly schedule queries |

**Foreign Keys:**

- `movie_id` → `movies(id)` (no cascade - orphaned showtimes preserved)
- `theater_id` → `theaters(id)` ON DELETE CASCADE (deleting theater removes showtimes)

**Notes:**

- `experiences` stores JSON like `["IMAX", "3D", "Dolby Atmos"]`
- `week_start` is always the Monday of the week containing the showtime
- `id` is typically generated as `${theater_id}-${movie_id}-${datetime_iso}`
- Deleting a theater cascades to showtimes; deleting a movie does NOT

**Sample Queries:**

```sql
-- All showtimes for a specific theater on a date
SELECT s.time, f.title, s.version, s.format
FROM showtimes s
JOIN movies f ON s.movie_id = f.id
WHERE s.theater_id = 'C0053' 
  AND s.date = '2026-03-10'
ORDER BY s.time;

-- Showtimes for a movie in the next 7 days
SELECT c.name AS theater, s.date, s.time, s.version
FROM showtimes s
JOIN theaters c ON s.theater_id = c.id
WHERE s.movie_id = 12345
  AND s.date >= CURRENT_DATE
  AND s.date < CURRENT_DATE + INTERVAL '7 days'
ORDER BY s.date, s.time;

-- Special format screenings (IMAX)
SELECT f.title, c.name, s.date, s.time
FROM showtimes s
JOIN movies f ON s.movie_id = f.id
JOIN theaters c ON s.theater_id = c.id
WHERE s.experiences::text LIKE '%IMAX%'
ORDER BY s.date;
```

---

### weekly_programs

Tracks which movies are playing at each theater each week, with "new this week" flag.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PRIMARY KEY | Auto-incrementing ID |
| `theater_id` | `TEXT` | NOT NULL, FK → `theaters(id)` ON DELETE CASCADE | Theater |
| `movie_id` | `INTEGER` | NOT NULL, FK → `movies(id)` | Movie |
| `week_start` | `TEXT` | NOT NULL | Monday of week (ISO 8601) |
| `is_new_this_week` | `INTEGER` | NOT NULL, DEFAULT 0 | 1 if movie is new, 0 otherwise |
| `scraped_at` | `TEXT` | NOT NULL | When this program was scraped |
| **UNIQUE** | | `(theater_id, movie_id, week_start)` | One row per theater-movie-week |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_weekly_programs_week` | `week_start` | Filter by week |

**Foreign Keys:**

- `theater_id` → `theaters(id)` ON DELETE CASCADE
- `movie_id` → `movies(id)` (no cascade)

**Notes:**

- Used for "What's new this week?" queries
- The UNIQUE constraint prevents duplicate entries for the same theater-movie-week
- `is_new_this_week` is an integer (not boolean) for SQLite compatibility

**Sample Queries:**

```sql
-- New movies at a specific theater this week
SELECT f.title, wp.week_start
FROM weekly_programs wp
JOIN movies f ON wp.movie_id = f.id
WHERE wp.theater_id = 'C0053'
  AND wp.week_start = '2026-03-10'
  AND wp.is_new_this_week = 1;

-- All theaters showing a specific movie this week
SELECT c.name, c.city
FROM weekly_programs wp
JOIN theaters c ON wp.theater_id = c.id
WHERE wp.movie_id = 12345
  AND wp.week_start = '2026-03-10';
```

---

### scrape_reports

Logs scraping job execution history and statistics.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PRIMARY KEY | Auto-incrementing report ID |
| `started_at` | `TIMESTAMPTZ` | NOT NULL | Job start time (UTC) |
| `completed_at` | `TIMESTAMPTZ` | | Job completion time (NULL if running) |
| `status` | `TEXT` | NOT NULL | Job status (see values below) |
| `trigger_type` | `TEXT` | NOT NULL | How job was triggered (see values below) |
| `total_theaters` | `INTEGER` | | Total theaters to scrape |
| `successful_theaters` | `INTEGER` | | Successfully scraped theaters |
| `failed_theaters` | `INTEGER` | | Failed theater scrapes |
| `total_movies_scraped` | `INTEGER` | | Total movies scraped |
| `total_showtimes_scraped` | `INTEGER` | | Total showtimes scraped |
| `errors` | `JSONB` | | Array of error objects |
| `progress_log` | `JSONB` | | Array of progress events |

**Status Values:**

- `running` - Job in progress
- `success` - All theaters scraped successfully
- `partial_success` - Some theaters failed
- `failed` - Job failed completely

**Trigger Types:**

- `manual` - User-initiated via API/admin panel
- `cron` - Scheduled automatic scrape

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_scrape_reports_started_at` | `started_at DESC` | Recent jobs first |
| `idx_scrape_reports_status` | `status` | Filter by status |

**Notes:**

- `errors` contains JSON like `[{"theater_id": "C0053", "error": "Timeout", "timestamp": "..."}]`
- `progress_log` tracks events: `[{"type": "theater_start", "theater_id": "C0053", "timestamp": "..."}]`
- NULL `completed_at` indicates a running or crashed job

**Sample Queries:**

```sql
-- Recent scrape jobs with success rate
SELECT 
  id,
  started_at,
  status,
  successful_theaters,
  total_theaters,
  ROUND(100.0 * successful_theaters / NULLIF(total_theaters, 0), 1) AS success_rate_pct
FROM scrape_reports
ORDER BY started_at DESC
LIMIT 10;

-- Failed jobs in the last 24 hours
SELECT id, started_at, errors
FROM scrape_reports
WHERE status = 'failed'
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;

-- Extract specific errors from JSONB
SELECT 
  id,
  started_at,
  jsonb_array_elements(errors) AS error_detail
FROM scrape_reports
WHERE errors IS NOT NULL
  AND jsonb_array_length(errors) > 0;
```

---

### users

User authentication and authorization with role-based access control.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PRIMARY KEY | Auto-incrementing user ID |
| `username` | `VARCHAR(255)` | UNIQUE, NOT NULL | Username for login |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt password hash |
| `role_id` | `INTEGER` | NOT NULL, FK → `roles(id)` | User's assigned role |
| `created_at` | `TIMESTAMPTZ` | DEFAULT CURRENT_TIMESTAMP | Account creation time |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_users_role_id` | `role_id` | Filter users by role |

**Constraints:**

- UNIQUE constraint on `username`
- Foreign key to `roles(id)`

**Notes:**

- Passwords are hashed with bcrypt (minimum 10 rounds)
- Default admin user created by migration 007 with random password (logged once)
- JWT authentication uses `id`, `role_name`, and `permissions` in token payload
- Foreign key from `app_settings.updated_by` references `users(id)`
- Role is now a foreign key reference instead of TEXT field (migrated in 008)

**Sample Queries:**

```sql
-- All admin users
SELECT id, username, created_at
FROM users
WHERE role = 'admin'
ORDER BY created_at;

-- User count by role
SELECT role, COUNT(*) AS count
FROM users
GROUP BY role;
```

---

### roles

Role definitions for the RBAC (Role-Based Access Control) system.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PRIMARY KEY | Auto-incrementing role ID |
| `name` | `TEXT` | NOT NULL, UNIQUE | Role name (e.g., 'admin', 'operator') |
| `description` | `TEXT` | | Human-readable description |
| `is_system` | `BOOLEAN` | NOT NULL, DEFAULT false | True for built-in system roles |
| `created_at` | `TIMESTAMPTZ` | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_roles_name` | `name` | Unique role name lookup |

**Notes:**

- System roles (`is_system = true`) cannot be modified or deleted
- Admin role has special bypass behavior in permission middleware
- Created in migration 008

---

### permissions

Permission definitions for the RBAC system.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PRIMARY KEY | Auto-incrementing permission ID |
| `name` | `TEXT` | NOT NULL, UNIQUE | Permission name (e.g., 'users:create') |
| `description` | `TEXT` | | Human-readable description |
| `category` | `TEXT` | NOT NULL | Permission category (e.g., 'users', 'scraper') |
| `created_at` | `TIMESTAMPTZ` | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_permissions_name` | `name` | Unique permission name lookup |
| `idx_permissions_category` | `category` | Group permissions by category |

**Notes:**

- 24 canonical permissions across 6 categories
- Permission names follow `category:action` format
- Created in migration 008

---

### role_permissions

Junction table linking roles to permissions.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `role_id` | `INTEGER` | NOT NULL, FK → `roles(id)` ON DELETE CASCADE | Role ID |
| `permission_id` | `INTEGER` | NOT NULL, FK → `permissions(id)` ON DELETE CASCADE | Permission ID |

**Constraints:**

- PRIMARY KEY `(role_id, permission_id)` - Composite primary key
- Foreign key cascades on role/permission deletion

**Notes:**

- Many-to-many relationship between roles and permissions
- Admin role permissions handled via bypass (no DB entries)
- Created in migration 008

---

### app_settings

White-label branding configuration (singleton table - always 1 row).

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | PRIMARY KEY, DEFAULT 1 | Always 1 (singleton) |
| `site_name` | `TEXT` | NOT NULL, DEFAULT 'Allo-Scrapper' | Site name shown in UI |
| `logo_base64` | `TEXT` | | Base64-encoded logo image |
| `favicon_base64` | `TEXT` | | Base64-encoded favicon |
| `color_primary` | `TEXT` | NOT NULL, DEFAULT '#FECC00' | Primary brand color (hex) |
| `color_secondary` | `TEXT` | NOT NULL, DEFAULT '#1F2937' | Secondary color (hex) |
| `color_accent` | `TEXT` | NOT NULL, DEFAULT '#F59E0B' | Accent color (hex) |
| `color_background` | `TEXT` | NOT NULL, DEFAULT '#FFFFFF' | Background color (hex) |
| `color_surface` | `TEXT` | NOT NULL, DEFAULT '#F3F4F6' | Surface color (hex) |
| `color_text_primary` | `TEXT` | NOT NULL, DEFAULT '#111827' | Primary text color (hex) |
| `color_text_secondary` | `TEXT` | NOT NULL, DEFAULT '#6B7280' | Secondary text color (hex) |
| `color_success` | `TEXT` | NOT NULL, DEFAULT '#10B981' | Success color (hex) |
| `color_error` | `TEXT` | NOT NULL, DEFAULT '#EF4444' | Error color (hex) |
| `font_primary` | `TEXT` | NOT NULL, DEFAULT 'Inter' | Primary font (Google Fonts) |
| `font_secondary` | `TEXT` | NOT NULL, DEFAULT 'Roboto' | Secondary font (Google Fonts) |
| `footer_text` | `TEXT` | DEFAULT '...' | Footer disclaimer text |
| `footer_links` | `JSONB` | DEFAULT '[]' | JSON array of footer links |
| `email_from_name` | `TEXT` | DEFAULT 'Allo-Scrapper' | Email sender name |
| `email_from_address` | `TEXT` | DEFAULT 'no-reply@...' | Email sender address |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `updated_by` | `INTEGER` | FK → `users(id)` | User who made last update |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_app_settings_updated_at` | `updated_at` | Track update history |

**Constraints:**

- `singleton_check` - CHECK constraint: `id = 1` (only 1 row allowed)
- Foreign key to `users(id)` for audit trail

**Notes:**

- Singleton pattern enforced by CHECK constraint
- `footer_links` example: `[{"label": "Privacy", "url": "/privacy"}, ...]`
- All hex colors must include `#` prefix (validated by frontend)
- Fonts must be valid Google Fonts names
- Images stored as base64 data URIs (validated max size: 2MB)

**Sample Queries:**

```sql
-- Get current branding settings
SELECT * FROM app_settings WHERE id = 1;

-- Update site name
UPDATE app_settings 
SET site_name = 'My Theater App', 
    updated_at = NOW(), 
    updated_by = 1
WHERE id = 1;

-- Parse footer links JSON
SELECT 
  site_name,
  jsonb_array_elements(footer_links) AS footer_link
FROM app_settings
WHERE id = 1;
```

---

### schema_migrations

Tracks applied database migrations (managed automatically).

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version` | `TEXT` | PRIMARY KEY | Migration filename (e.g., '001_neutralize_references.sql') |
| `checksum` | `TEXT` | NOT NULL | SHA-256 hash of migration file |
| `applied_at` | `TIMESTAMPTZ` | DEFAULT CURRENT_TIMESTAMP | When migration was applied |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_schema_migrations_applied_at` | `applied_at` | Migration history |

**Notes:**

- Created automatically by migration runner at server startup
- DO NOT manually modify this table
- Checksums verify migration file integrity after application
- Used to determine which migrations are pending

**Sample Queries:**

```sql
-- View migration history
SELECT * FROM schema_migrations 
ORDER BY applied_at;

-- Check if specific migration applied
SELECT EXISTS (
  SELECT 1 FROM schema_migrations 
  WHERE version = '005_add_user_roles.sql'
) AS is_applied;
```

---

## Relationships

### Entity-Relationship Diagram (Text)

```
theaters (1) ──< showtimes (N)
movies (1) ──< showtimes (N)

theaters (1) ──< weekly_programs (N)
movies (1) ──< weekly_programs (N)

roles (1) ──< users (N)
roles (1) ──< role_permissions (N) ──> permissions (N)

users (1) ──< app_settings.updated_by (1)
```

### Foreign Key Details

| Child Table | Child Column | Parent Table | Parent Column | On Delete |
|-------------|--------------|--------------|---------------|-----------|
| showtimes | `theater_id` | theaters | `id` | CASCADE |
| showtimes | `movie_id` | movies | `id` | (none) |
| weekly_programs | `theater_id` | theaters | `id` | CASCADE |
| weekly_programs | `movie_id` | movies | `id` | (none) |
| users | `role_id` | roles | `id` | (none) |
| role_permissions | `role_id` | roles | `id` | CASCADE |
| role_permissions | `permission_id` | permissions | `id` | CASCADE |
| app_settings | `updated_by` | users | `id` | (none) |

**Cascade Behavior:**

- Deleting a **theater** → deletes all showtimes and weekly programs for that theater
- Deleting a **movie** → does NOT cascade (orphaned showtimes/programs preserved)
- Deleting a **user** → does NOT cascade (app_settings.updated_by becomes NULL)

---

## Extensions

### pg_trgm (PostgreSQL Trigram)

**Purpose:** Enables fuzzy text search on movie titles.

**Installation:** Migration 002 (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)

**Usage:**

```sql
-- Find movies similar to "Godfather"
SELECT title, similarity(title, 'Godfather') AS sim
FROM movies
WHERE title % 'Godfather'  -- % operator = similarity match
ORDER BY sim DESC
LIMIT 10;
```

**Index:** GIN index on `movies.title` (`idx_movies_title_trgm`)

---

## Common Query Patterns

### Find Showtimes for a Movie at a Theater

```sql
SELECT s.date, s.time, s.version, s.format
FROM showtimes s
WHERE s.theater_id = 'C0053'
  AND s.movie_id = 12345
  AND s.date >= CURRENT_DATE
ORDER BY s.date, s.time;
```

### Weekly Schedule for a Theater

```sql
SELECT 
  f.title,
  f.poster_url,
  COUNT(DISTINCT s.date) AS days_showing,
  MIN(s.time) AS first_showtime,
  MAX(s.time) AS last_showtime
FROM showtimes s
JOIN movies f ON s.movie_id = f.id
WHERE s.theater_id = 'C0053'
  AND s.week_start = '2026-03-10'
GROUP BY f.id, f.title, f.poster_url
ORDER BY f.title;
```

### New Movies This Week

```sql
SELECT 
  f.title,
  f.poster_url,
  c.name AS theater,
  c.city
FROM weekly_programs wp
JOIN movies f ON wp.movie_id = f.id
JOIN theaters c ON wp.theater_id = c.id
WHERE wp.week_start = '2026-03-10'
  AND wp.is_new_this_week = 1
ORDER BY c.city, c.name, f.title;
```

### Theaters Showing a Specific Movie

```sql
SELECT DISTINCT
  c.id,
  c.name,
  c.city,
  c.postal_code,
  COUNT(s.id) AS showtime_count
FROM theaters c
JOIN showtimes s ON c.id = s.theater_id
WHERE s.movie_id = 12345
  AND s.date >= CURRENT_DATE
GROUP BY c.id, c.name, c.city, c.postal_code
ORDER BY c.city, c.name;
```

### Recent Scrape Job Statistics

```sql
SELECT 
  id,
  started_at,
  completed_at,
  status,
  total_theaters,
  successful_theaters,
  failed_theaters,
  total_movies_scraped,
  total_showtimes_scraped,
  ROUND(100.0 * successful_theaters / NULLIF(total_theaters, 0), 1) AS success_rate
FROM scrape_reports
WHERE completed_at IS NOT NULL
ORDER BY started_at DESC
LIMIT 20;
```

---

## Migration History

| Migration | Version | Date | Description |
|-----------|---------|------|-------------|
| 001 | 2.0.1 | 2026-02-15 | Rename `allocine_url` → `source_url` |
| 002 | 2.1.0 | 2026-02-21 | Add pg_trgm extension + GIN index |
| 003 | 2.2.0 | 2026-02-26 | Create users table |
| 004 | 3.0.0 | 2026-03-01 | Create app_settings table |
| 005 | 3.0.0 | 2026-03-01 | Add role column to users |
| 006 | 3.0.1 | 2026-03-01 | Fix app_settings schema alignment |
| 007 | 3.1.0 | 2026-03-01 | Seed default admin user |
| 008 | 4.0.0 | 2026-03-13 | Implement RBAC system (roles, permissions, role_permissions) |
| 009 | 4.0.1 | 2026-03-13 | Add roles:read permission |
| 010 | 4.0.2 | 2026-03-13 | Remove phantom permissions cleanup |

See [Database Migrations Guide](./migrations.md) for detailed migration documentation.

---

## Performance Considerations

### Index Usage

All indexes are created automatically by migrations or init.sql:

- **Primary keys** (`id` columns) - implicit B-tree indexes
- **Foreign keys** - no automatic indexes (consider adding if joins are slow)
- **GIN trigram index** on `movies.title` - enables fast fuzzy search
- **Composite indexes** on `showtimes` - optimized for date-range queries

### Query Optimization Tips

1. **Use indexes effectively:**
   - Filter by indexed columns first (`theater_id`, `movie_id`, `date`, `week_start`)
   - Use `EXPLAIN ANALYZE` to verify index usage

2. **Date filtering:**
   - Store dates in ISO 8601 format for consistent sorting
   - Use `>=` and `<` instead of `BETWEEN` for date ranges

3. **JSON fields:**
   - Use `jsonb_array_elements()` to expand JSON arrays
   - Add GIN indexes on JSONB columns if filtering frequently

4. **Avoid N+1 queries:**
   - Use JOINs instead of separate queries per row
   - Frontend should batch API requests when possible

---

## See Also

- [Database Migrations Guide](./migrations.md) - Migration system and workflow
- [Troubleshooting: Database](../../troubleshooting/database.md) - Common database issues
- [API Reference: Theaters](../api/theaters.md) - Theater endpoints
- [API Reference: Movies](../api/movies.md) - Movies endpoints
- [API Reference](../api/README.md) - API documentation
