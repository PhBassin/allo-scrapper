# Database Migrations Guide

Complete guide to database migration system, workflows, and best practices.

## Overview

The Allo-Scrapper project uses an **automatic migration system** that runs at server startup. Migrations are SQL files that evolve the database schema safely and reproducibly.

**Key Features:**

- ✅ Automatic migration at startup (since v3.1.0)
- ✅ SHA-256 checksum verification
- ✅ Sequential execution with rollback on failure
- ✅ Idempotent migrations (safe to re-run)
- ✅ Audit trail in `schema_migrations` table

---

## How It Works

### Automatic Migration Flow

```
1. Server starts
2. Migration runner connects to database
3. Creates schema_migrations table (if needed)
4. Scans migrations/ directory for .sql files
5. Compares with schema_migrations table
6. Applies pending migrations in order (001, 002, 003, ...)
7. Records each migration with SHA-256 checksum
8. Server continues startup
```

**Configuration:**

The `AUTO_MIGRATE` environment variable controls automatic migrations:

```bash
# .env file
AUTO_MIGRATE=true   # Default: migrations run automatically at startup
AUTO_MIGRATE=false  # Disable automatic migrations (manual mode)
```

### Migration Tracking

Each applied migration is recorded in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,           -- e.g., '001_neutralize_references.sql'
  checksum TEXT NOT NULL,             -- SHA-256 hash of file contents
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Checksum Verification:**

- Migration files are hashed with SHA-256 before and after application
- If a file is modified after being applied, a **warning** is logged (non-fatal)
- Prevents accidental modifications to already-applied migrations

---

## Migration Files

### Location

All migration files live in the **root `migrations/` directory**:

```
allo-scrapper/
├── migrations/
│   ├── 001_neutralize_references.sql
│   ├── 002_add_pg_trgm_extension.sql
│   ├── 003_add_users_table.sql
│   ├── 004_add_app_settings.sql
│   ├── 005_add_user_roles.sql
│   ├── 006_fix_app_settings_schema.sql
│   ├── 007_seed_default_admin.sql
│   └── README.md
```

### Naming Convention

**Format:** `XXX_description.sql`

- `XXX` = 3-digit sequential number (001, 002, 003, ...)
- `description` = lowercase with underscores (e.g., `add_users_table`)
- Extension must be `.sql`

**Examples:**

- ✅ `001_neutralize_references.sql`
- ✅ `008_add_cinema_geolocation.sql`
- ❌ `1_fix.sql` (wrong number format)
- ❌ `010-add-feature.sql` (wrong separator)

### Migration Template

Use this template for new migrations:

```sql
-- Migration: <Short description>
-- Version: <semantic version>
-- Date: <YYYY-MM-DD>
-- Description: <Detailed description>
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_XXX.sql
--
-- Apply this migration:
--   (Automatic if AUTO_MIGRATE=true, or manual via psql)

BEGIN;

-- Make migration idempotent with IF EXISTS / IF NOT EXISTS checks
DO $$ 
BEGIN
    -- Check if change is needed
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='your_table' AND column_name='your_column'
    ) THEN
        -- Apply change
        ALTER TABLE your_table ADD COLUMN your_column TEXT;
        RAISE NOTICE 'Migration applied: your_column added';
    ELSE
        RAISE NOTICE 'Migration skipped: your_column already exists';
    END IF;
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='your_table' AND column_name='your_column'
    ) THEN
        RAISE NOTICE 'Migration successful: verification passed';
    ELSE
        RAISE EXCEPTION 'Migration failed: verification failed';
    END IF;
END $$;

COMMIT;

-- Rollback instructions (document for manual rollback if needed):
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE your_table DROP COLUMN IF EXISTS your_column;
-- COMMIT;
```

---

## Migration Lifecycle

### Fresh Install (No Existing Database)

When the server starts with a **fresh database**:

1. **Creates `schema_migrations` table**
2. **Applies all migrations in order** (001 → 007)
3. **Seeds default admin user** (migration 007):
   - Generates random 16-character password
   - Logs password prominently (save it immediately!)
   - Password shown **only once** during this startup

**Output Example:**

```
[info] Starting database migration process...
[info] Schema migrations table verified
[info] Found 7 migration files
[info] Applying migration: 001_neutralize_references.sql
[info] Migration applied successfully: 001_neutralize_references.sql
[info] Applying migration: 002_add_pg_trgm_extension.sql
[info] Migration applied successfully: 002_add_pg_trgm_extension.sql
...
[info] Applying migration: 007_seed_default_admin.sql
[warn] ═══════════════════════════════════════════════════════════
[warn] 🔐 DEFAULT ADMIN USER CREATED
[warn] ═══════════════════════════════════════════════════════════
[warn] Username: admin
[warn] Password: Xk8#mP2qLz7!nV5w
[warn] ═══════════════════════════════════════════════════════════
[warn] ⚠️  SECURITY WARNING:
[warn] 1. Save this password immediately
[warn] 2. Change it after first login
[warn] 3. This password will NOT be shown again
[warn] ═══════════════════════════════════════════════════════════
[info] All 7 migrations applied successfully
```

### Upgrade (Existing Database)

When the server starts with an **existing database**:

1. **Checks `schema_migrations` table** for applied migrations
2. **Compares checksums** of applied migrations (warns if file modified)
3. **Applies only new migrations** (e.g., if DB has 001-005, applies 006-007)
4. **Skips admin seeding** if any admin user already exists

**Output Example (Upgrading from v2.2.0 to v3.1.0):**

```
[info] Starting database migration process...
[info] Schema migrations table verified
[info] Found 7 migration files
[info] Migration already applied: 001_neutralize_references.sql
[info] Migration already applied: 002_add_pg_trgm_extension.sql
[info] Migration already applied: 003_add_users_table.sql
[info] Applying migration: 004_add_app_settings.sql
[info] Migration applied successfully: 004_add_app_settings.sql
[info] Applying migration: 005_add_user_roles.sql
[info] Migration applied successfully: 005_add_user_roles.sql
[info] Applying migration: 006_fix_app_settings_schema.sql
[info] Migration applied successfully: 006_fix_app_settings_schema.sql
[info] Applying migration: 007_seed_default_admin.sql
[info] Admin user already exists, skipping admin seed
[info] 3 new migrations applied successfully
```

### Checksum Mismatch (Modified Migration File)

If a migration file is **modified after being applied**, you'll see:

```
[warn] ⚠️  Migration 006_fix_app_settings_schema.sql checksum mismatch (file modified after application)
[warn]     Applied checksum: abc123def456...
[warn]     Current checksum: 789ghi012jkl...
```

**What This Means:**

- The migration file on disk differs from when it was originally applied
- **Non-fatal** - server continues to start
- **Action Required:** Investigate why the file changed:
  - Check git history: `git log -p migrations/006_fix_app_settings_schema.sql`
  - If intentional: Understand that the change **won't be applied** (migration already ran)
  - If unintentional: Revert file to original version

---

## Applied Migrations Reference

### 001_neutralize_references.sql

**Version:** 2.0.1  
**Date:** 2026-02-15  
**Breaking Change:** Yes (column rename)

**Description:**

Renames `films.allocine_url` → `films.source_url` to use brand-neutral terminology.

**Changes:**

- `ALTER TABLE films RENAME COLUMN allocine_url TO source_url`

**Rollback:**

```sql
BEGIN;
ALTER TABLE films RENAME COLUMN source_url TO allocine_url;
COMMIT;
```

---

### 002_add_pg_trgm_extension.sql

**Version:** 2.1.0  
**Date:** 2026-02-21  
**Breaking Change:** No

**Description:**

Enables PostgreSQL trigram extension for fuzzy text search on film titles.

**Changes:**

- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- `CREATE INDEX idx_films_title_trgm ON films USING gin(title gin_trgm_ops);`

**Usage:**

```sql
-- Fuzzy search
SELECT title, similarity(title, 'Godfather') AS sim
FROM films
WHERE title % 'Godfather'
ORDER BY sim DESC;
```

**Rollback:**

```sql
BEGIN;
DROP INDEX IF EXISTS idx_films_title_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
COMMIT;
```

---

### 003_add_users_table.sql

**Version:** 2.2.0  
**Date:** 2026-02-26  
**Breaking Change:** No

**Description:**

Creates `users` table for JWT authentication.

**Changes:**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Note:** Admin user seeding moved to migration 007 in v3.1.0.

**Rollback:**

```sql
BEGIN;
DROP TABLE IF EXISTS users CASCADE;
COMMIT;
```

**⚠️ Warning:** Rollback deletes all user accounts.

---

### 004_add_app_settings.sql

**Version:** 3.0.0  
**Date:** 2026-03-01  
**Breaking Change:** No

**Description:**

Creates `app_settings` table for white-label branding configuration.

**Changes:**

- Creates table with 21 columns (identity, colors, typography, footer, email)
- Enforces **singleton pattern** (only 1 row allowed via CHECK constraint)
- Inserts default branding values
- Creates index on `updated_at`

**Key Columns:**

- `site_name` (default: 'Allo-Scrapper')
- 9 color fields (hex values)
- 2 font fields (Google Fonts names)
- `footer_links` (JSONB array)
- `updated_by` (FK → `users(id)`)

**Rollback:**

```sql
BEGIN;
DROP INDEX IF EXISTS idx_app_settings_updated_at;
DROP TABLE IF EXISTS app_settings CASCADE;
COMMIT;
```

---

### 005_add_user_roles.sql

**Version:** 3.0.0  
**Date:** 2026-03-01  
**Breaking Change:** No

**Description:**

Adds role-based access control to users table.

**Changes:**

- `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`
- `ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));`
- `CREATE INDEX idx_users_role ON users(role);`
- Promotes default 'admin' user to admin role

**Role Values:**

- `admin` - Full access (scraper, settings, user management)
- `user` - Read-only access

**Rollback:**

```sql
BEGIN;
DROP INDEX IF EXISTS idx_users_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP COLUMN IF EXISTS role;
COMMIT;
```

---

### 006_fix_app_settings_schema.sql

**Version:** 3.0.1  
**Date:** 2026-03-01  
**Breaking Change:** No

**Description:**

Aligns `app_settings` table schema with TypeScript types (`server/src/types/settings.ts`).

**Changes:**

- **Adds columns:** `color_text_primary`, `color_text_secondary`, `color_surface`, `font_primary`, `font_secondary`, `email_from_address`
- **Removes columns:** `color_text`, `color_link`, `color_warning`, `font_family_heading`, `font_family_body`, `footer_copyright`, `email_header_color`, `email_footer_text`
- Copies values from old → new columns (if upgrading)
- Validates `footer_links` is valid JSONB

**Note:** On **fresh installs** (migration 004 already has final schema), this migration's UPDATE statements are skipped via `IF EXISTS` guards.

**Rollback:**

```sql
BEGIN;
-- Restore old columns
ALTER TABLE app_settings ADD COLUMN color_text TEXT;
ALTER TABLE app_settings ADD COLUMN font_family_heading TEXT;
ALTER TABLE app_settings ADD COLUMN font_family_body TEXT;
UPDATE app_settings SET 
  color_text = color_text_primary, 
  font_family_heading = font_primary, 
  font_family_body = font_secondary;
-- Drop new columns
ALTER TABLE app_settings DROP COLUMN color_text_primary;
ALTER TABLE app_settings DROP COLUMN color_text_secondary;
ALTER TABLE app_settings DROP COLUMN color_surface;
ALTER TABLE app_settings DROP COLUMN font_primary;
ALTER TABLE app_settings DROP COLUMN font_secondary;
ALTER TABLE app_settings DROP COLUMN email_from_address;
COMMIT;
```

---

### 007_seed_default_admin.sql

**Version:** 3.1.0  
**Date:** 2026-03-01  
**Breaking Change:** No

**Description:**

Marker migration that triggers admin user seeding logic in the migration runner (`server/src/db/migrations.ts`).

**Seeding Logic:**

1. **If no admin users exist:**
   - **AND** username 'admin' doesn't exist:
     - Create `admin` user with **randomly generated 16-character password**
     - Log password prominently (shown **only once**)
   - **AND** username 'admin' exists but with wrong role:
     - Fix role to `'admin'`
     - Warn that password is unchanged
2. **If any admin user exists:** Skip (no changes)

**Password Requirements:**

- Length: 16 characters
- Includes: uppercase, lowercase, digits, special characters
- Generated with Node.js `crypto.randomBytes()`

**Security Notes:**

- Password logged via `logger.warn()` with prominent banner
- Password **never shown again** after initial startup
- Must be changed after first login
- Stored as bcrypt hash (10+ rounds)

**Rollback:**

```sql
-- Delete default admin user (if created by this migration)
BEGIN;
DELETE FROM users WHERE username = 'admin';
COMMIT;
```

**⚠️ Warning:** Only delete if you're certain the user was created by this migration.

---

### 008_permission_based_roles.sql

**Version:** 4.0.0  
**Date:** 2026-03-13  
**Breaking Change:** Yes (major RBAC implementation)

**Description:**

Implements comprehensive Role-Based Access Control (RBAC) system, replacing the binary admin/user role system with granular permissions.

**Changes:**

**New Tables:**
```sql
-- Roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table  
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Junction table
CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

**User Table Migration:**
- Adds `role_id INTEGER REFERENCES roles(id) NOT NULL`
- Migrates existing `role` TEXT values to role references
- Drops old `role` column and constraints
- Creates `idx_users_role_id` index

**Seed Data:**
- **24 permissions** across 6 categories (users, scraper, cinemas, settings, reports, system)
  - Note: This count was increased to 26 in migration 012 (added users:read, cinemas:read)
- **Admin role**: System role with bypass privileges
- **Operator role**: System role with 7 specific permissions
  - Note: Increased to 9 permissions in migration 012 (added cinemas:read, users:read)

**Permission Categories:**
- `users` (4): list, create, update, delete
  - Note: Increased to 5 in migration 012 (added users:read)
- `scraper` (2): trigger, trigger_single  
- `cinemas` (3): create, update, delete
  - Note: Increased to 4 in migration 012 (added cinemas:read)
- `settings` (5): read, update, reset, export, import
- `reports` (2): list, view
- `system` (3): info, health, migrations

**Rollback:**

```sql
BEGIN;
-- Add back old role column
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Migrate role_id back to role names
UPDATE users SET role = (
  SELECT name FROM roles WHERE roles.id = users.role_id
);

-- Drop RBAC tables
DROP TABLE role_permissions CASCADE;
DROP TABLE permissions CASCADE;  
DROP TABLE roles CASCADE;

-- Drop new column
ALTER TABLE users DROP COLUMN role_id;

-- Restore old constraints
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
CREATE INDEX idx_users_role ON users(role);
COMMIT;
```

---

### 009_add_roles_permission.sql

**Version:** 4.0.1  
**Date:** 2026-03-13  
**Breaking Change:** No

**Description:**

Adds the `roles:read` permission to enable viewing individual role details via API.

**Changes:**

- Inserts `roles:read` permission in `roles` category
- Brings total canonical permissions to 20

**Permission Added:**
```sql
INSERT INTO permissions (name, description, category) 
VALUES ('roles:read', 'Voir les détails d''un rôle', 'roles');
```

**Rollback:**

```sql
BEGIN;
DELETE FROM role_permissions 
WHERE permission_id = (SELECT id FROM permissions WHERE name = 'roles:read');

DELETE FROM permissions WHERE name = 'roles:read';
COMMIT;
```

---

### 010_remove_phantom_permissions.sql

**Version:** 4.0.2  
**Date:** 2026-03-13  
**Breaking Change:** No

**Description:**

Cleanup migration that removes any non-canonical permissions that may exist in the database from manual modifications or historical data.

**Changes:**

- Defines the canonical set of 20 permissions (at time of migration)
- Removes any permissions not in the canonical list
- Removes associated role_permissions entries
- Logs removed permissions for audit trail

**Canonical Permissions (20 total):**
- users: list, create, update, delete (4)
- scraper: trigger, trigger_single (2)  
- cinemas: create, update, delete (3)
- settings: read, update, reset, export, import (5)
- reports: list, view (2)
- system: info, health, migrations (3)
- roles: read (1)

**Safety:**
- Uses transaction to ensure atomicity
- Only removes non-canonical permissions
- Preserves all legitimate permissions and role assignments

**Rollback:**

No automatic rollback available - this migration only removes invalid data. If legitimate permissions were accidentally removed, they would need to be manually re-added.

---

### 011_add_roles_crud_permissions.sql

**Version:** 4.1.0  
**Date:** 2026-03-13  
**Breaking Change:** No

**Description:**

Adds full CRUD permissions for roles management. Previously, roles management endpoints used `users:*` permissions as a workaround. This migration adds dedicated roles permissions for better separation of concerns.

**Changes:**

- Inserts 4 new roles CRUD permissions: `roles:list`, `roles:create`, `roles:update`, `roles:delete`
- Updates `roles:read` description for consistency
- Brings total canonical permissions from 20 to 24

**Permissions Added:**
```sql
INSERT INTO permissions (name, description, category) VALUES
  ('roles:list',   'Lister les rôles',                    'roles'),
  ('roles:create', 'Créer des rôles',                     'roles'),
  ('roles:update', 'Modifier des rôles et permissions',   'roles'),
  ('roles:delete', 'Supprimer des rôles',                 'roles');
```

**Rollback:**

```sql
BEGIN;
DELETE FROM role_permissions 
WHERE permission_id IN (
  SELECT id FROM permissions 
  WHERE name IN ('roles:list', 'roles:create', 'roles:update', 'roles:delete')
);

DELETE FROM permissions 
WHERE name IN ('roles:list', 'roles:create', 'roles:update', 'roles:delete');
COMMIT;
```

---

### 012_add_read_permissions.sql

**Version:** 4.2.0  
**Date:** 2026-03-13  
**Breaking Change:** No

**Description:**

Fixes phantom permissions issue (#442) by adding `cinemas:read` and `users:read` permissions that were referenced in client code but missing from the database. Also assigns these permissions to the operator role for consistency.

**Changes:**

- Inserts `cinemas:read` permission in `cinemas` category
- Inserts `users:read` permission in `users` category
- Assigns both permissions to operator role via `role_permissions` table
- Brings total canonical permissions from 24 to 26
- Updates operator role from 7 to 9 permissions

**Permissions Added:**
```sql
INSERT INTO permissions (name, description, category) VALUES
  ('cinemas:read', 'Voir la liste des cinémas', 'cinemas'),
  ('users:read',   'Voir les détails utilisateur', 'users');
```

**Rationale:**

These permissions were being checked in client code (`CinemasPage.tsx`, permission tests) but didn't exist in the database canonical permission list, creating inconsistency. Rather than removing these checks, we added the permissions to support fine-grained read access separate from write permissions.

**Rollback:**

```sql
BEGIN;
DELETE FROM role_permissions 
WHERE permission_id IN (
  SELECT id FROM permissions 
  WHERE name IN ('cinemas:read', 'users:read')
);

DELETE FROM permissions 
WHERE name IN ('cinemas:read', 'users:read');
COMMIT;
```

---

## Creating New Migrations

### Step 1: Determine Migration Number

Find the highest existing migration number and increment:

```bash
ls migrations/*.sql | sort | tail -1
# Output: migrations/007_seed_default_admin.sql

# Next migration: 008_your_feature.sql
```

### Step 2: Write Migration SQL

Create file `migrations/008_your_feature.sql`:

```sql
-- Migration: Add geolocation to cinemas
-- Version: 3.2.0
-- Date: 2026-03-15
-- Description: Adds latitude/longitude columns for map features
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_008.sql

BEGIN;

-- Add new columns
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS latitude REAL;
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS longitude REAL;

-- Create spatial index (if using PostGIS)
-- CREATE INDEX IF NOT EXISTS idx_cinemas_location 
--   ON cinemas USING GIST (ll_to_earth(latitude, longitude));

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='cinemas' AND column_name='latitude'
    ) THEN
        RAISE NOTICE 'Migration successful: latitude column exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: latitude column missing';
    END IF;
END $$;

COMMIT;

-- Rollback:
-- BEGIN;
-- ALTER TABLE cinemas DROP COLUMN IF EXISTS latitude;
-- ALTER TABLE cinemas DROP COLUMN IF EXISTS longitude;
-- COMMIT;
```

### Step 3: Make It Idempotent

**Always use:**

- `IF NOT EXISTS` for `CREATE TABLE`, `CREATE INDEX`, `CREATE EXTENSION`
- `IF EXISTS` for `DROP TABLE`, `DROP INDEX`, `DROP COLUMN`
- `DO $$ ... END $$;` blocks with conditional logic for complex changes

**Example Idempotent Patterns:**

```sql
-- Safe column addition
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='films' AND column_name='imdb_id'
    ) THEN
        ALTER TABLE films ADD COLUMN imdb_id TEXT;
    END IF;
END $$;

-- Safe index creation
CREATE INDEX IF NOT EXISTS idx_films_imdb ON films(imdb_id);

-- Safe constraint addition
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='films_imdb_unique'
    ) THEN
        ALTER TABLE films ADD CONSTRAINT films_imdb_unique UNIQUE (imdb_id);
    END IF;
END $$;
```

### Step 4: Test Locally

1. **Apply migration:**

```bash
# Automatic mode (recommended)
docker compose restart ics-web

# Manual mode (if AUTO_MIGRATE=false)
docker compose exec -T ics-db psql -U postgres -d ics < migrations/008_your_feature.sql
```

2. **Verify:**

```bash
# Check schema
docker compose exec ics-db psql -U postgres -d ics -c "\d cinemas"

# Check migration tracking
docker compose exec ics-db psql -U postgres -d ics -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
```

3. **Test idempotency** (apply twice, verify no errors):

```bash
docker compose exec -T ics-db psql -U postgres -d ics < migrations/008_your_feature.sql
# Should see "Migration skipped" notices
```

### Step 5: Document Migration

Update `migrations/README.md` with:

- Migration number and description
- Version number
- Breaking change status
- Rollback instructions

### Step 6: Commit and Deploy

```bash
git add migrations/008_your_feature.sql
git commit -m "feat(db): add geolocation columns to cinemas table

refs #<issue-number>"
```

On deployment, the migration runs automatically when the server starts.

---

## Manual Migration (Legacy Method)

**When to Use:**

- `AUTO_MIGRATE=false` in `.env`
- Testing migrations before enabling auto-migration
- Emergency rollback scenarios

### Method 1: Docker Compose (Recommended)

```bash
# Backup database first
docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_migration.sql

# Apply migration
docker compose exec -T ics-db psql -U postgres -d ics < migrations/008_your_feature.sql

# Verify
docker compose exec ics-db psql -U postgres -d ics -c "\d your_table"
```

### Method 2: Inside Container

```bash
# Enter container
docker compose exec ics-db sh

# Inside container, apply migration
psql -U postgres -d ics -f /app/migrations/008_your_feature.sql

# Exit container
exit
```

### Method 3: Remote Database (Production)

```bash
# Set connection variables
export PGHOST=your-db-host.com
export PGUSER=postgres
export PGDATABASE=ics
export PGPASSWORD=your-password

# Backup
pg_dump > backup_before_migration.sql

# Apply
psql < migrations/008_your_feature.sql
```

---

## Rollback Strategies

### Option 1: Rollback SQL (Preferred)

Each migration documents rollback SQL in comments:

```bash
# Extract rollback SQL from migration file
grep -A 10 "Rollback:" migrations/008_your_feature.sql

# Apply rollback
docker compose exec -T ics-db psql -U postgres -d ics <<EOF
BEGIN;
ALTER TABLE cinemas DROP COLUMN IF EXISTS latitude;
ALTER TABLE cinemas DROP COLUMN IF EXISTS longitude;
COMMIT;
EOF

# Remove from tracking table
docker compose exec ics-db psql -U postgres -d ics -c \
  "DELETE FROM schema_migrations WHERE version = '008_your_feature.sql';"
```

### Option 2: Restore from Backup

```bash
# Restore database from backup
docker compose exec -T ics-db psql -U postgres -d ics < backup_before_migration.sql

# Recreate schema_migrations table if needed
docker compose restart ics-web  # Re-runs migration system
```

### Option 3: Forward-Only Migration

**Best Practice:** Instead of rolling back, write a **new migration** that undoes the change:

```sql
-- migrations/009_remove_geolocation.sql
BEGIN;
ALTER TABLE cinemas DROP COLUMN IF EXISTS latitude;
ALTER TABLE cinemas DROP COLUMN IF EXISTS longitude;
COMMIT;
```

**Why?**

- Preserves migration history
- Works in production without downtime
- Matches "migrations are immutable" principle

---

## Best Practices

### ✅ DO

1. **Always backup before manual migrations:**
   ```bash
   docker compose exec -T ics-db pg_dump -U postgres ics > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Make migrations idempotent:**
   - Use `IF NOT EXISTS` and `IF EXISTS` guards
   - Safe to run multiple times without errors

3. **Test migrations locally first:**
   - Apply to dev database
   - Verify schema changes: `\d table_name`
   - Test rollback
   - Re-apply to verify idempotency

4. **Use transactions (BEGIN/COMMIT):**
   - Entire migration rolls back on error
   - Database stays consistent

5. **Verify after applying:**
   ```sql
   -- Check column exists
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'your_table';
   
   -- Check index exists
   SELECT indexname FROM pg_indexes WHERE tablename = 'your_table';
   ```

6. **Document rollback steps:**
   - Include rollback SQL in migration comments
   - Explain manual steps if needed

7. **Increment version numbers semantically:**
   - Major (v3.0.0) - Breaking change (column rename, type change)
   - Minor (v3.1.0) - New feature (new table, new column)
   - Patch (v3.0.1) - Bug fix (schema correction)

### ❌ DON'T

1. **Don't modify migrations after applying:**
   - Once applied to production, migrations are **immutable**
   - If you need to change something, create a new migration

2. **Don't skip sequential numbering:**
   - Always use next number in sequence
   - Gaps are confusing (001, 002, 005)

3. **Don't assume migration order:**
   - Migrations run in **filename sort order** (001 before 002)
   - Use 3-digit numbers (001-999, not 1-9)

4. **Don't use non-idempotent operations:**
   - Avoid `ALTER TABLE ... ADD COLUMN` without `IF NOT EXISTS`
   - Avoid `INSERT` without `ON CONFLICT DO NOTHING`

5. **Don't forget data migrations:**
   - Schema changes are easy; data transformations are hard
   - Test with realistic data volumes

6. **Don't rely on manual steps:**
   - Everything should be automated in SQL
   - If manual steps needed, document clearly

---

## Troubleshooting

### Migration fails with "column already exists"

**Cause:** Migration is not idempotent.

**Solution:** Update migration to use `IF NOT EXISTS`:

```sql
-- Before (fails on re-run)
ALTER TABLE films ADD COLUMN imdb_id TEXT;

-- After (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='films' AND column_name='imdb_id'
    ) THEN
        ALTER TABLE films ADD COLUMN imdb_id TEXT;
    END IF;
END $$;
```

### Checksum mismatch warning

**Cause:** Migration file modified after being applied.

**Solution:**

1. Check git history:
   ```bash
   git log -p migrations/006_fix_app_settings_schema.sql
   ```

2. If intentional change:
   - Understand that the change **won't be applied** (migration already ran)
   - If you need the change, create a **new migration**

3. If unintentional:
   - Revert file to original version
   - Restart server (warning will disappear)

### Server fails to start after migration

**Cause:** Migration error or database connection issue.

**Solution:**

1. Check server logs:
   ```bash
   docker compose logs ics-web | grep -i migration
   ```

2. Check database logs:
   ```bash
   docker compose logs ics-db | tail -50
   ```

3. Test database connection:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics -c "SELECT 1;"
   ```

4. If migration is broken:
   - Rollback migration (see Rollback Strategies)
   - Fix migration SQL
   - Re-apply

### No admin password logged on fresh install

**Cause:** Migration 007 detected an existing admin user.

**Solution:**

```bash
# Check existing users
docker compose exec ics-db psql -U postgres -d ics -c "SELECT username, role FROM users;"

# If admin exists with wrong role, migration will fix it automatically
# If no admin exists, check migration logs for errors
```

### Migration stuck or taking too long

**Cause:** Large dataset migration or table lock.

**Solution:**

1. Check active queries:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics -c \
     "SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';"
   ```

2. Check table locks:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics -c \
     "SELECT locktype, relation::regclass, mode, granted FROM pg_locks WHERE NOT granted;"
   ```

3. If safe, terminate stuck query:
   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```

4. Restart database:
   ```bash
   docker compose restart ics-db
   ```

### AUTO_MIGRATE=false but tables don't exist

**Cause:** You disabled automatic migrations but never ran manual migrations.

**Solution:**

**Option A (Recommended):** Enable automatic migrations:

```bash
# Edit .env
AUTO_MIGRATE=true

# Restart server
docker compose restart ics-web
```

**Option B:** Apply migrations manually:

```bash
for migration in migrations/*.sql; do
  echo "Applying $migration..."
  docker compose exec -T ics-db psql -U postgres -d ics < "$migration"
done
```

---

## See Also

- [Database Schema Reference](./schema.md) - Complete table definitions
- [Troubleshooting: Database](../../troubleshooting/database.md) - Database issues
- [Production Deployment Guide](../../guides/deployment/production.md) - Deployment workflows
- [AGENTS.md](../../../AGENTS.md) - Development workflow (includes migration guidelines)
