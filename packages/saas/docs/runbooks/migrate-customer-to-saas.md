# Runbook: Migrate Existing Customer to SaaS Mode

**Purpose:** Migrate an existing production deployment with large datasets to SaaS multi-tenant mode  
**Audience:** DevOps, Database Administrators  
**Estimated Duration:** 30-60 minutes (depending on dataset size)  
**Downtime Required:** Yes (30-60 minutes recommended)

---

## Prerequisites

### System Requirements

- **PostgreSQL Version:** 15 or later
- **Free Disk Space:** At least 2x current database size
- **Memory:** 4GB+ RAM recommended
- **Network:** Low-latency connection to database

### Data Requirements

- System admin user exists in `public.users` with `is_system_role=true`
- Free plan exists in `public.plans`
- Backup completed and verified

### Access Requirements

- PostgreSQL superuser credentials or `CREATEDB` privilege
- SSH access to application server (for maintenance mode)

---

## Pre-Migration Checklist

### 1. Assess Dataset Size

```sql
-- Check row counts for each table
SELECT 'cinemas' AS table_name, COUNT(*) AS row_count FROM public.cinemas
UNION ALL
SELECT 'films', COUNT(*) FROM public.films
UNION ALL
SELECT 'showtimes', COUNT(*) FROM public.showtimes
UNION ALL
SELECT 'weekly_programs', COUNT(*) FROM public.weekly_programs;
```

**Decision:**
- **< 100K showtimes:** Use standard `saas_008_create_default_ics_org.sql` migration
- **> 100K showtimes:** Use batched `migrate-large-deployment.sql` script (this runbook)

### 2. Verify Admin User Exists

```sql
SELECT id, username, role_name, is_system_role
FROM public.users
WHERE is_system_role = true;
```

**Expected:** At least one row with `is_system_role = true`  
**If missing:** Create admin user first (see troubleshooting)

### 3. Check Free Plan Exists

```sql
SELECT id, name FROM public.plans WHERE name = 'free';
```

**Expected:** One row  
**If missing:** Insert free plan:

```sql
INSERT INTO public.plans (name, price, max_requests_per_month)
VALUES ('free', 0, 10000);
```

### 4. Backup Database

```bash
# Create timestamped backup
pg_dump -h localhost -U postgres -d ics > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
grep -q "PostgreSQL database dump complete" backup_*.sql && echo "✓ Backup valid"
```

### 5. Estimate Downtime

| Showtimes Count | Estimated Migration Time |
|----------------|-------------------------|
| 100K - 1M | 5-10 minutes |
| 1M - 5M | 10-30 minutes |
| 5M - 10M | 30-45 minutes |
| 10M+ | 45-60 minutes |

**Add 10 minutes buffer** for verification and switchover.

---

## Migration Execution

### Step 1: Enable Maintenance Mode

**Purpose:** Prevent writes during migration

```bash
# Option A: Application-level maintenance mode
echo "MAINTENANCE_MODE=true" >> /app/.env
systemctl reload allo-scrapper

# Option B: Database-level read-only mode
psql -U postgres -d ics -c "ALTER DATABASE ics SET default_transaction_read_only = on;"
```

**Verification:**
```bash
# Test write is blocked
psql -U postgres -d ics -c "INSERT INTO cinemas (id, name) VALUES (999999, 'test');"
# Expected: ERROR: cannot execute INSERT in a read-only transaction
```

### Step 2: Run Batched Migration

```bash
# From project root
cd packages/saas

# Run migration script
psql -h localhost -U postgres -d ics \
  -f scripts/migrate-large-deployment.sql \
  2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log
```

**Expected output:**
```
NOTICE: [Step 1/8] Organization "ics" does not exist - proceeding with creation
NOTICE: [Step 2/8] Creating organization record...
NOTICE: [Step 3/8] Creating org_ics schema and bootstrapping tables...
NOTICE: [Step 4/8] Migrating small tables (cinemas, films)...
NOTICE:   - Cinemas: 234 rows migrated
NOTICE:   - Films: 45678 rows migrated
NOTICE: [Step 5/8] Migrating showtimes (batched, batch_size=10000)
NOTICE:   - Showtimes batch: 10000 rows (total: 10000, last_id: 150234, batch_time: 45ms, elapsed: 1s)
NOTICE:   - Showtimes batch: 10000 rows (total: 20000, last_id: 300567, batch_time: 42ms, elapsed: 2s)
...
NOTICE: [Step 5/8] Showtimes migrated: 10000000 total rows in 1800s
NOTICE: [Step 6/8] Migrating weekly_programs (batched, batch_size=10000)
...
NOTICE: [Step 7/8] Associating admin user...
NOTICE: [Step 8/8] Initializing API usage quota...
NOTICE: ================================
NOTICE: Migration completed successfully!
NOTICE: ================================
COMMIT
```

**If migration fails:** See Troubleshooting section below.

### Step 3: Verify Migration

```bash
# Run verification queries
psql -h localhost -U postgres -d ics -f scripts/verify-migration.sql
```

**Manual verification queries:**

```sql
-- 1. Verify schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'org_ics';
-- Expected: 1 row

-- 2. Verify row counts match
SELECT 
  (SELECT COUNT(*) FROM public.cinemas) AS public_cinemas,
  (SELECT COUNT(*) FROM org_ics.cinemas) AS org_cinemas,
  (SELECT COUNT(*) FROM public.showtimes) AS public_showtimes,
  (SELECT COUNT(*) FROM org_ics.showtimes) AS org_showtimes;
-- Expected: public counts == org counts

-- 3. Verify admin user associated
SELECT username, role_id, email_verified FROM org_ics.users;
-- Expected: At least 1 row (admin user)

-- 4. Verify quota initialized
SELECT * FROM org_ics.api_usage_quota;
-- Expected: 1 row with requests_used=0, requests_limit=10000

-- 5. Spot-check sample data
SELECT c.name, f.title, s.showtime 
FROM org_ics.showtimes s
JOIN org_ics.cinemas c ON c.id = s.cinema_id
JOIN org_ics.films f ON f.id = s.film_id
LIMIT 5;
-- Expected: 5 rows with real data
```

### Step 4: Update Application Configuration

```bash
# Enable SaaS mode
echo "SAAS_ENABLED=true" >> /app/.env

# Restart application
systemctl restart allo-scrapper

# Verify application starts successfully
systemctl status allo-scrapper
journalctl -u allo-scrapper -f
```

### Step 5: Disable Maintenance Mode

```bash
# Option A: Application-level
sed -i '/MAINTENANCE_MODE/d' /app/.env
systemctl reload allo-scrapper

# Option B: Database-level
psql -U postgres -d ics -c "ALTER DATABASE ics SET default_transaction_read_only = off;"
```

### Step 6: Verify Application Functionality

```bash
# Test health check
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","database":"connected"}

# Test login (if SaaS mode)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>"}'
# Expected: {"token":"<jwt>","user":{...}}

# Test data retrieval
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/cinemas
# Expected: JSON array of cinemas
```

---

## Post-Migration Checklist

- [ ] Verify all row counts match (`public.* == org_ics.*`)
- [ ] Admin user can log in
- [ ] API endpoints return data
- [ ] Scraper can be triggered
- [ ] Performance is acceptable (no slowdown)
- [ ] Monitoring/alerting configured
- [ ] Documentation updated (mark deployment as "SaaS-enabled")

---

## Rollback Procedure

### If migration fails or needs to be reverted:

#### Step 1: Stop Application

```bash
systemctl stop allo-scrapper
```

#### Step 2: Drop org_ics Schema

```sql
DROP SCHEMA IF NOT EXISTS org_ics CASCADE;
DELETE FROM public.organizations WHERE slug = 'ics';
```

#### Step 3: Restore from Backup (if needed)

```bash
# Only if data was corrupted
psql -h localhost -U postgres -d ics < backup_YYYYMMDD_HHMMSS.sql
```

#### Step 4: Disable SaaS Mode

```bash
sed -i '/SAAS_ENABLED/d' /app/.env
systemctl start allo-scrapper
```

---

## Troubleshooting

### Migration Script Hangs

**Symptom:** No NOTICE logs for >5 minutes

**Diagnosis:**
```sql
-- Check for blocking locks
SELECT 
  pid, 
  usename, 
  pg_blocking_pids(pid) AS blocked_by, 
  query 
FROM pg_stat_activity 
WHERE datname = 'ics' AND state != 'idle';
```

**Solution:**
- Terminate blocking queries: `SELECT pg_terminate_backend(<pid>);`
- Re-run migration script (idempotent)

---

### Out of Memory Error

**Symptom:** `ERROR: out of memory` in logs

**Diagnosis:**
```bash
# Check PostgreSQL memory settings
psql -U postgres -c "SHOW work_mem;"
psql -U postgres -c "SHOW shared_buffers;"
```

**Solution:**
- Reduce batch size in script: Edit `batch_size := 5000;`
- Increase work_mem: `SET work_mem TO '512MB';`
- Re-run migration

---

### Admin User Not Found

**Symptom:** `WARNING: Admin user not found in public.users`

**Solution:**
```sql
-- Check if admin exists
SELECT * FROM public.users WHERE is_system_role = true;

-- If missing, create admin user
INSERT INTO public.users (username, password_hash, role_id, is_system_role)
SELECT 'admin', '<bcrypt_hash>', r.id, true
FROM public.roles r
WHERE r.name = 'admin' AND r.is_system_role = true;
```

---

### Row Count Mismatch

**Symptom:** `org_ics.showtimes` has fewer rows than `public.showtimes`

**Diagnosis:**
```sql
-- Find missing rows
SELECT id FROM public.showtimes
EXCEPT
SELECT id FROM org_ics.showtimes
ORDER BY id
LIMIT 10;
```

**Solution:**
- Re-run migration script (idempotent, will copy missing rows)
- OR manually copy missing range:
  ```sql
  INSERT INTO org_ics.showtimes (id, cinema_id, film_id, showtime, version, created_at)
  SELECT id, cinema_id, film_id, showtime, version, created_at
  FROM public.showtimes
  WHERE id IN (<missing_ids>)
  ON CONFLICT (id) DO NOTHING;
  ```

---

## Performance Tuning

### If migration is too slow (>1 hour for 10M rows):

#### Option 1: Increase Batch Size

```sql
-- Edit script line 20
batch_size INT := 50000;  -- Increased from 10000
```

**Trade-off:** Higher memory usage per batch

#### Option 2: Disable Indexes During Migration

```sql
-- Before migration
DROP INDEX IF EXISTS org_ics.idx_showtimes_cinema;
DROP INDEX IF EXISTS org_ics.idx_showtimes_film;
DROP INDEX IF EXISTS org_ics.idx_showtimes_showtime;

-- Run migration
\i scripts/migrate-large-deployment.sql

-- Recreate indexes after migration
CREATE INDEX idx_showtimes_cinema ON org_ics.showtimes (cinema_id);
CREATE INDEX idx_showtimes_film ON org_ics.showtimes (film_id);
CREATE INDEX idx_showtimes_showtime ON org_ics.showtimes (showtime);
```

**Trade-off:** More complex procedure, but 2-3x faster

#### Option 3: Parallel Batching (Advanced)

Split table into ranges, run in parallel:

```bash
# Terminal 1: IDs 1-5M
psql -c "INSERT INTO org_ics.showtimes SELECT * FROM public.showtimes WHERE id BETWEEN 1 AND 5000000" &

# Terminal 2: IDs 5M-10M
psql -c "INSERT INTO org_ics.showtimes SELECT * FROM public.showtimes WHERE id BETWEEN 5000001 AND 10000000" &

wait
```

**Trade-off:** Complex coordination, requires careful planning

---

## Contact & Escalation

**For urgent issues during migration:**
- Slack: `#ops-alerts`
- PagerDuty: Escalate to Database Team
- Email: devops@example.com

**For post-migration performance issues:**
- Create Jira ticket: Project ICS, Component: SaaS Migration
- Attach migration log file
