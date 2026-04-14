# Migration Test Plan - Issue #832

**Migration:** `saas_008_create_default_ics_org.sql`  
**Test Date:** 2026-04-14  
**Test Environment:** Docker Compose (PostgreSQL 15)

---

## Test Objectives

1. ✅ Verify migration runs successfully on fresh database
2. ✅ Verify migration is idempotent (can run twice without errors)
3. ✅ Verify all data structures created correctly
4. ✅ Verify data migration works (if public schema has data)
5. ✅ Verify quota initialization
6. ✅ Verify admin user association

---

## Prerequisites

```bash
# Ensure Docker containers are running
sudo docker compose ps

# Should show:
# - ics-db (healthy)
# - ics-web (healthy)
# - ics-redis (healthy)
```

---

## Test 1: Fresh Database Migration

### Step 1.1: Backup current database state

```bash
# Backup current database
sudo docker compose exec -T ics-db pg_dump -U postgres -d ics > /tmp/ics_backup_before_test.sql

echo "✅ Database backed up to /tmp/ics_backup_before_test.sql"
```

### Step 1.2: Check if migration already applied

```bash
# Check if org 'ics' exists
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT slug, name, schema_name, status 
FROM public.organizations 
WHERE slug = 'ics';
"

# Expected: Empty result (0 rows) OR existing org if already migrated
```

### Step 1.3: Run the migration

```bash
# Run saas_008 migration
sudo docker compose exec -T ics-db psql -U postgres -d ics < packages/saas/migrations/saas_008_create_default_ics_org.sql

# Expected output:
# NOTICE: Organization "ics" does not exist - proceeding with creation
# NOTICE: Migrated cinemas: X source rows, Y rows now in target
# NOTICE: Migrated films: X source rows, Y rows now in target
# ...
# NOTICE: Migration saas_008_create_default_ics_org successful
# COMMIT
```

### Step 1.4: Verify org created

```bash
# Query org table
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT o.id, o.slug, o.name, o.schema_name, o.status, p.name as plan_name
FROM public.organizations o
LEFT JOIN public.plans p ON o.plan_id = p.id
WHERE o.slug = 'ics';
"

# Expected output:
# id | slug | name                            | schema_name | status | plan_name
# ----+------+---------------------------------+-------------+--------+-----------
#  1 | ics  | Independent Cinema Showtimes    | org_ics     | active | free
```

### Step 1.5: Verify schema created

```bash
# Check schema exists
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'org_ics';
"

# Expected: 1 row (org_ics)
```

### Step 1.6: Verify tables created in org schema

```bash
# List tables in org_ics schema
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'org_ics' 
ORDER BY table_name;
"

# Expected tables:
# - cinemas
# - films
# - invitations
# - org_settings
# - roles
# - scrape_reports
# - showtimes
# - users
# - weekly_programs
```

### Step 1.7: Verify roles seeded

```bash
# Check roles
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT id, name, description, is_system 
FROM org_ics.roles 
ORDER BY id;
"

# Expected rows:
# id | name   | description                         | is_system
# ----+--------+-------------------------------------+-----------
#  1 | admin  | Full access to all org resources    | t
#  2 | editor | Can manage cinemas and trigger...   | t
#  3 | viewer | Read-only access                    | t
```

### Step 1.8: Verify admin user associated

```bash
# Check admin user in org_ics schema
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT u.id, u.username, r.name as role_name, u.email_verified
FROM org_ics.users u
JOIN org_ics.roles r ON u.role_id = r.id;
"

# Expected: 1 row with admin user
# id | username | role_name | email_verified
# ----+----------+-----------+----------------
#  1 | admin    | admin     | t
```

### Step 1.9: Verify quota initialized

```bash
# Check quota tracking
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT 
  ou.org_id,
  o.slug,
  ou.month,
  ou.cinemas_count,
  ou.users_count,
  ou.scrapes_count,
  ou.api_calls_count
FROM public.org_usage ou
JOIN public.organizations o ON ou.org_id = o.id
WHERE o.slug = 'ics';
"

# Expected: 1 row with zero counts
# org_id | slug | month      | cinemas_count | users_count | scrapes_count | api_calls_count
# --------+------+------------+---------------+-------------+---------------+-----------------
#     1  | ics  | 2026-04-01 |       0       |      0      |       0       |        0
```

### Step 1.10: Verify data migrated (if public schema had data)

```bash
# Count records in org_ics tables
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT 
  (SELECT COUNT(*) FROM org_ics.cinemas) as cinemas,
  (SELECT COUNT(*) FROM org_ics.films) as films,
  (SELECT COUNT(*) FROM org_ics.showtimes) as showtimes,
  (SELECT COUNT(*) FROM org_ics.weekly_programs) as weekly_programs,
  (SELECT COUNT(*) FROM org_ics.scrape_reports) as scrape_reports;
"

# Expected: counts matching public schema (or 0 if fresh install)
```

---

## Test 2: Idempotency (Run Migration Twice)

### Step 2.1: Run migration again

```bash
# Run migration second time
sudo docker compose exec -T ics-db psql -U postgres -d ics < packages/saas/migrations/saas_008_create_default_ics_org.sql

# Expected output:
# NOTICE: Schema org_ics exists - migration already completed, skipping
# COMMIT
```

### Step 2.2: Verify no duplicate data

```bash
# Check org count (should still be 1)
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT COUNT(*) as org_count 
FROM public.organizations 
WHERE slug = 'ics';
"

# Expected: 1

# Check user count (should still be 1 if only admin)
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT COUNT(*) as user_count 
FROM org_ics.users;
"

# Expected: 1 (admin user, no duplicates)
```

### Step 2.3: Verify quota not duplicated

```bash
# Check quota rows (should still be 1)
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT COUNT(*) as quota_rows
FROM public.org_usage ou
JOIN public.organizations o ON ou.org_id = o.id
WHERE o.slug = 'ics';
"

# Expected: 1 (no duplicate rows)
```

---

## Test 3: Data Migration Validation

### Step 3.1: Check film_name populated in weekly_programs

```bash
# Verify film_name is not NULL
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT 
  COUNT(*) as total_rows,
  COUNT(film_name) as rows_with_film_name,
  COUNT(*) - COUNT(film_name) as null_film_names
FROM org_ics.weekly_programs;
"

# Expected: null_film_names should be 0 or very low (only if film was deleted)
```

### Step 3.2: Check no orphaned FK references in showtimes

```bash
# Check all showtimes have valid film_id and cinema_id
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT 
  (SELECT COUNT(*) FROM org_ics.showtimes WHERE film_id NOT IN (SELECT id FROM org_ics.films)) as orphaned_films,
  (SELECT COUNT(*) FROM org_ics.showtimes WHERE cinema_id NOT IN (SELECT id FROM org_ics.cinemas)) as orphaned_cinemas;
"

# Expected: both should be 0
```

### Step 3.3: Check sequence reset for scrape_reports

```bash
# Insert test scrape report to verify sequence works
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
INSERT INTO org_ics.scrape_reports (scraper_name, started_at, status, trigger_type)
VALUES ('test', NOW(), 'success', 'manual')
RETURNING id;
"

# Expected: Should succeed without unique violation
# (id should be max(existing_ids) + 1)
```

---

## Test 4: Patch Verification

### Step 4.1: Verify P2 fix (early exit works)

**Already tested in Test 2 (idempotency check)**

✅ Migration exits early with NOTICE when org already exists

---

### Step 4.2: Verify P5 fix (FOUND flag logic)

```bash
# Check migration logs from Step 1.3 output
# Should show:
# ✅ "System admin user associated with org_ics" (if admin found)
# OR
# ⚠️  "System admin user not found in public.users" (if no admin)

# NOT: Misleading "User already exists" when it doesn't
```

---

### Step 4.3: Verify P6 fix (free plan validation)

```bash
# Test what happens if free plan missing (manual corruption test)
# DO NOT RUN IN PRODUCTION

# 1. Delete free plan temporarily
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
DELETE FROM public.plans WHERE name = 'free';
"

# 2. Try to run migration (should fail with clear error)
sudo docker compose exec -T ics-db psql -U postgres -d ics < packages/saas/migrations/saas_008_create_default_ics_org.sql 2>&1 | grep -i "free plan"

# Expected output:
# ERROR: Cannot create default org: free plan not found in public.plans. Run SaaS plugin migrations first.

# 3. Restore free plan
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
INSERT INTO public.plans (name, display_name, price_monthly, max_cinemas, max_users)
VALUES ('free', 'Free Plan', 0, 5, 3)
ON CONFLICT DO NOTHING;
"
```

---

### Step 4.4: Verify P9 fix (no hardcoded DEFAULT 1)

```bash
# Check users table definition
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'org_ics' 
  AND table_name = 'users' 
  AND column_name = 'role_id';
"

# Expected: column_default should be NULL (no DEFAULT 1)
```

---

### Step 4.5: Verify P10 fix (quota verification checks values)

```bash
# Check migration output from Step 1.3
# If quota counts are non-zero (re-run scenario), should see:
# ⚠️  WARNING: Quota tracking exists but counts are non-zero (migration may have been re-run): cinemas=X, users=Y, ...

# No warning expected on first run (all zeros)
```

---

## Test 5: Rollback Test

### Step 5.1: Simulate migration failure mid-way

```bash
# Inject error to test rollback
# (Use a modified migration with intentional error after Step 3)

# Expected: Entire transaction rolled back, no partial state
# - org 'ics' NOT created
# - schema org_ics NOT created  
# - No quota row
```

**Note:** This test requires manual modification of migration file. Skip if not testing rollback behavior.

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1 Backup database | ⬜ | |
| 1.2 Check pre-migration state | ⬜ | |
| 1.3 Run migration | ⬜ | |
| 1.4 Verify org created | ⬜ | |
| 1.5 Verify schema created | ⬜ | |
| 1.6 Verify tables created | ⬜ | |
| 1.7 Verify roles seeded | ⬜ | |
| 1.8 Verify admin associated | ⬜ | |
| 1.9 Verify quota initialized | ⬜ | |
| 1.10 Verify data migrated | ⬜ | |
| 2.1 Run migration twice | ⬜ | |
| 2.2 Verify no duplicates | ⬜ | |
| 2.3 Verify quota not duplicated | ⬜ | |
| 3.1 film_name populated | ⬜ | |
| 3.2 No orphaned FKs | ⬜ | |
| 3.3 Sequence reset works | ⬜ | |
| 4.1 P2 fix (early exit) | ⬜ | |
| 4.2 P5 fix (FOUND flag) | ⬜ | |
| 4.3 P6 fix (plan validation) | ⬜ | |
| 4.4 P9 fix (no DEFAULT 1) | ⬜ | |
| 4.5 P10 fix (quota values) | ⬜ | |

---

## Cleanup After Testing

```bash
# Option 1: Restore from backup
sudo docker compose exec -T ics-db psql -U postgres -d ics < /tmp/ics_backup_before_test.sql

# Option 2: Manually remove test org
sudo docker compose exec -T ics-db psql -U postgres -d ics -c "
DELETE FROM public.org_usage WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'ics');
DELETE FROM public.organizations WHERE slug = 'ics';
DROP SCHEMA IF EXISTS org_ics CASCADE;
"

# Option 3: Keep test org (if testing on dev environment)
```

---

## Success Criteria

Migration is considered successful if:

- ✅ All commands in Test 1 pass without errors
- ✅ Idempotency test (Test 2) runs without errors or warnings
- ✅ No orphaned data (Test 3)
- ✅ All patches verified (Test 4)
- ✅ Zero manual intervention required

If any test fails, investigate logs and file issue with:
- Exact command that failed
- Error message
- Database state before/after
- Migration file version (commit hash)
