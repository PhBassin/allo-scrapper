# Database Migrations

This directory contains SQL migration scripts for the cinema showtimes database.

## 🚀 Automatic Migrations (Recommended)

**Since version 3.1.0**, the application automatically applies pending database migrations at server startup.

### How It Works

1. **Server starts** → Migration runner checks for pending migrations
2. **Compares files** in `migrations/` directory with `schema_migrations` table
3. **Applies pending migrations** in sequential order (001, 002, 003, ...)
4. **Tracks applied migrations** with SHA-256 checksums for integrity verification
5. **Seeds admin user** if none exists (migration 007)

### Configuration

Set the `AUTO_MIGRATE` environment variable in `.env`:

```bash
# Enable automatic migrations (default)
AUTO_MIGRATE=true

# Disable automatic migrations (manual mode)
AUTO_MIGRATE=false
```

### Fresh Install Behavior

On a **fresh database** (no tables), the migration runner will:

1. Create `schema_migrations` tracking table
2. Apply all 7 migrations in order:
   - 001: Neutralize references (source_url)
   - 002: Add pg_trgm extension for fuzzy search
   - 003: Create users table
   - 004: Create app_settings table (white-label branding)
   - 005: Add role column to users
   - 006: Fix app_settings schema (no-op on fresh install)
   - 007: Seed default admin user
3. **Generate random admin password** and log it prominently:

```
═══════════════════════════════════════════════════════════
🔐 DEFAULT ADMIN USER CREATED
═══════════════════════════════════════════════════════════
Username: admin
Password: Xk8#mP2qLz7!nV5w
═══════════════════════════════════════════════════════════
⚠️  SECURITY WARNING:
1. Save this password immediately
2. Change it after first login
3. This password will NOT be shown again
═══════════════════════════════════════════════════════════
```

**IMPORTANT:** Save this password! It's randomly generated and will NOT be shown again.

### Upgrade Behavior

On an **existing database**, the migration runner will:

1. Check `schema_migrations` table for already-applied migrations
2. **Skip applied migrations** (no re-execution)
3. **Apply only new migrations** (e.g., if you have 001-005, only 006-007 run)
4. **Verify checksums** of already-applied migrations (warns if file modified)

### Checksum Verification

Each migration is tracked with a **SHA-256 checksum** to detect file modifications after application.

If a migration file changes after being applied, you'll see a warning:

```
⚠️  Migration 006_fix_app_settings_schema.sql checksum mismatch (file modified after application)
    Applied checksum: abc123...
    Current checksum: def456...
```

**This is non-fatal** - the server continues to start, but you should investigate why the file changed.

### schema_migrations Table

The migration system tracks state in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,           -- e.g., '001_neutralize_references.sql'
  checksum TEXT NOT NULL,             -- SHA-256 hash of migration file
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

View migration history:

```bash
docker compose exec ics-db psql -U postgres -d ics -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
```

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

### 006_fix_app_settings_schema.sql
**Version:** 3.0.1  
**Date:** 2026-03-01  
**Description:** Migrates app_settings schema from old column names to final schema matching TypeScript types. Renames `color_text` → `color_text_primary`, adds `color_text_secondary`, `color_surface`, renames font columns, adds `email_from_address`. **Only needed for databases created before v3.0.1** (fresh installs skip this via IF EXISTS guards).

**Breaking Change:** No - migrates data safely

**Note:** On fresh installs (migration 004 already has final schema), this migration's UPDATE statements are skipped via IF EXISTS checks.

### 007_seed_default_admin.sql
**Version:** 3.1.0  
**Date:** 2026-03-01  
**Description:** Marker migration that triggers admin user seeding logic in the migration runner. Creates default admin user with **randomly generated 16-character password** if no admin exists. Password is logged prominently at startup.

**Breaking Change:** No

**Admin Seeding Logic (Option C-Enhanced):**
- **If zero admins exist:**
  - **And 'admin' username doesn't exist:** Create new admin, log random password
  - **And 'admin' username exists with wrong role:** Fix role to 'admin', warn about unchanged password
- **If any admin exists:** Skip (no changes)

**Security:**
- Password: 16 chars (uppercase, lowercase, digits, special chars)
- Logged once via `logger.warn()` with prominent banner
- Must be changed after first login

## 🛠️ Manual Migrations (Legacy Method)

**Note:** With `AUTO_MIGRATE=true` (default), manual migrations are NOT needed. This section is for troubleshooting or when `AUTO_MIGRATE=false`.

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

### No admin password logged on fresh install
**Cause:** Migration 007 detected an existing admin user.  
**Solution:** Check `docker compose exec ics-db psql -U postgres -d ics -c "SELECT username, role FROM users;"`

If admin exists with wrong role, the migration runner will fix it automatically.

### Migration checksum mismatch warning
**Cause:** Migration file was modified after being applied to the database.  
**Impact:** Non-fatal (server continues), but indicates potential issue.  
**Solution:** 
1. Check git history: `git log -p migrations/XXX_*.sql`
2. If intentional change, understand it won't re-run (already applied)
3. If unintentional, revert file to original checksum

### AUTO_MIGRATE=false but tables don't exist
**Cause:** You disabled automatic migrations but never ran manual migrations.  
**Solution:** Either:
- **Option A (Recommended):** Remove `AUTO_MIGRATE=false` and restart server
- **Option B (Manual):** Apply migrations manually (see Legacy Method section)

### Server fails to start after migration
**Cause:** Migration error or database connection issue.  
**Solution:**
1. Check server logs: `docker compose logs ics-web | grep -i migration`
2. Check database logs: `docker compose logs ics-db | tail -50`
3. Verify database is running: `docker compose ps ics-db`
4. Test database connection: `docker compose exec ics-db psql -U postgres -d ics -c "SELECT 1;"`

### Migration stuck or taking too long
**Cause:** Large dataset migration or database lock.  
**Solution:**
1. Check active queries: `docker compose exec ics-db psql -U postgres -d ics -c "SELECT * FROM pg_stat_activity;"`
2. Check for table locks: `docker compose exec ics-db psql -U postgres -d ics -c "SELECT * FROM pg_locks;"`
3. If safe, restart: `docker compose restart ics-db`

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

- **Automatic migrations enabled by default** (`AUTO_MIGRATE=true`)
- Fresh installs: All 7 migrations applied automatically
- Upgrades: Only new migrations applied automatically
- Migrations are tracked in `schema_migrations` table
- Checksums verify migration file integrity
- Admin password generated once on first run (save it!)
- Always backup before manual migrations (automatic migrations are safe)
- Test migrations in development first
- Migrations are designed to be idempotent
- Keep backups for at least 7 days after migrations
- Document any manual steps required

## Production Deployment

For production deployment workflows including migration procedures, see **[Production Deployment](../docs/guides/deployment/production.md)**.

**Critical Notes:**
- **Automatic migrations run at startup** - No manual intervention needed
- If deploying via Docker Compose: Migrations run when `ics-web` container starts
- If deploying via GitHub Actions: Migrations run during image startup
- Admin password logged on first deployment only (save it from logs)
- Set `AUTO_MIGRATE=false` only if you need manual migration control
