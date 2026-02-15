# Database Migrations

This directory contains SQL migration scripts for the cinema showtimes database.

## Overview

Migrations are numbered sequentially and should be applied in order. Each migration is idempotent (safe to run multiple times).

## Available Migrations

### 001_neutralize_references.sql
**Version:** 2.0.1  
**Date:** 2026-02-15  
**Description:** Renames `allocine_url` column to `source_url` in the `films` table to use neutral terminology.

**Breaking Change:** Yes - affects database schema

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
docker compose exec -T db pg_dump -U postgres allocine > backup_before_migration.sql

# 2. Apply migration
docker compose exec -T db psql -U postgres -d allocine < migrations/001_neutralize_references.sql
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
