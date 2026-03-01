# Database Migrations

This directory contains SQL migration scripts for the cinema showtimes database.

## Overview

Migrations are numbered sequentially and should be applied in order. Each migration is idempotent (safe to run multiple times).

## Available Migrations

### 001_neutralize_references.sql
**Version:** 2.0.1  
**Date:** 2026-02-15  
**Description:** Renames the old `allocine_url` column to `source_url` in the `films` table to use neutral terminology.

**Breaking Change:** Yes - affects database schema

### 002_add_pg_trgm_extension.sql
**Version:** 2.1.0  
**Date:** 2026-02-21  
**Description:** Enables PostgreSQL trigram extension (`pg_trgm`) for fuzzy text search and creates GIN index on `films.title` for improved similarity search performance.

**Breaking Change:** No - adds extension and index only

### 003_add_users_table.sql
**Version:** 2.2.0  
**Date:** 2026-02-26  
**Description:** Creates `users` table for JWT authentication and seeds default admin user (username: `admin`, password: `admin`). Required for authentication features.

**Breaking Change:** No - adds new table only

**Security Note:** Change the default admin password after first login in production.

### 004_add_app_settings.sql
**Version:** 3.0.0  
**Date:** 2026-03-01  
**Description:** Creates `app_settings` table with singleton constraint for white-label branding configuration. Stores site name, logo/favicon (base64), color palette (9 colors), typography (Google Fonts), footer customization, and email branding.

**Breaking Change:** No - adds new table only

**Features:**
- Singleton pattern (only 1 row allowed)
- Default branding values (#FECC00, #1F2937)
- JSONB for footer links array
- Foreign key to users(id) for tracking changes

### 005_add_user_roles.sql
**Version:** 3.0.0  
**Date:** 2026-03-01  
**Description:** Adds `role` column to `users` table with check constraint for 'admin' or 'user' values. Automatically promotes default admin user to admin role. Required for role-based access control in admin panel.

**Breaking Change:** No - extends existing table

**Safety Features:**
- Idempotent (checks if column already exists)
- Auto-promotes 'admin' user to admin role
- Verifies at least 1 admin exists after migration
- Index on role column for performance

## How to Apply Migrations

### Prerequisites
- Database backup created
- Docker containers running

### Method 1: Using Docker Compose

```bash
# 1. Backup database first
./scripts/backup-db.sh

# 2. Copy migration file to container
docker cp migrations/001_neutralize_references.sql $(docker compose ps -q db):/tmp/

# 3. Apply migration
docker compose exec db psql -U postgres -d cinema_showtimes -f /tmp/001_neutralize_references.sql
```

### Method 2: Direct psql

```bash
# 1. Backup database
docker compose exec -T db pg_dump -U postgres ics > backup_before_migration.sql

# 2. Apply migration
docker compose exec -T db psql -U postgres -d ics < migrations/001_neutralize_references.sql
```

### Method 3: From inside the container

```bash
# 1. Enter container
docker compose exec db sh

# 2. Inside container
psql -U postgres -d cinema_showtimes

# 3. In psql
\i /path/to/migration.sql
\q
```

## Rollback

### 001_neutralize_references.sql Rollback

```sql
-- Rollback: Rename source_url back to allocine_url
BEGIN;
ALTER TABLE films RENAME COLUMN source_url TO allocine_url;
COMMIT;
```

### 002_add_pg_trgm_extension.sql Rollback

```sql
-- Rollback: Remove index and extension
BEGIN;
DROP INDEX IF EXISTS idx_films_title_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
COMMIT;
```

### 003_add_users_table.sql Rollback

```sql
-- Rollback: Drop users table
-- WARNING: This will delete all user accounts
BEGIN;
DROP TABLE IF EXISTS users CASCADE;
COMMIT;
```

### 004_add_app_settings.sql Rollback

```sql
-- Rollback: Drop app_settings table
-- WARNING: This will delete all branding configuration
BEGIN;
DROP INDEX IF EXISTS idx_app_settings_updated_at;
DROP TABLE IF EXISTS app_settings CASCADE;
COMMIT;
```

### 005_add_user_roles.sql Rollback

```sql
-- Rollback: Remove role column and related objects
BEGIN;
DROP INDEX IF EXISTS idx_users_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP COLUMN IF EXISTS role;
COMMIT;
```

## Verification

After applying a migration, verify the changes:

```bash
# Check schema
docker compose exec db psql -U postgres -d cinema_showtimes -c "\d films"

# Verify data
docker compose exec db psql -U postgres -d cinema_showtimes -c "SELECT id, title, source_url FROM films LIMIT 5;"
```

## Migration Workflow

1. **Always backup first**
   ```bash
   ./scripts/backup-db.sh
   ```

2. **Test in development**
   ```bash
   # Apply to dev environment first
   docker compose -f docker-compose.dev.yml exec db psql ...
   ```

3. **Apply to production**
   ```bash
   # During maintenance window
   docker compose exec db psql ...
   ```

4. **Verify**
   ```bash
   # Check application still works
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/films | jq '.[0].source_url'
   ```

## Creating New Migrations

When creating a new migration:

1. **Use sequential numbering**: `00X_description.sql`
2. **Make it idempotent**: Check if changes already exist
3. **Include rollback**: Document how to undo changes
4. **Add to this README**: Document the migration
5. **Test thoroughly**: Test in dev before production

### Migration Template

```sql
-- Migration: <description>
-- Version: <version>
-- Date: <date>

BEGIN;

-- Check if change is needed
DO $$ 
BEGIN
    -- Your migration logic here
END $$;

COMMIT;
```

## Troubleshooting

### Migration fails with "column already exists"
The migration is idempotent and will skip if already applied. This is safe.

### Database connection refused
Ensure containers are running:
```bash
docker compose ps
docker compose up -d db
```

### Permission denied
Check PostgreSQL user permissions:
```bash
docker compose exec db psql -U postgres -c "\du"
```

## Notes

- Always backup before migrations
- Test migrations in development first
- Migrations are designed to be idempotent
- Keep backups for at least 7 days after migrations
- Document any manual steps required

## Production Deployment

For production deployment workflows including migration procedures, see **[DEPLOYMENT.md](../DEPLOYMENT.md)** in the root directory.

**Critical:** Always run migrations BEFORE deploying new code that depends on schema changes.
