---
title: 'Design batched migration tooling for large existing deployments'
type: 'enhancement'
created: '2026-04-15'
status: 'ready-for-dev'
baseline_commit: '0473b29db8b8f9e8f8f8f8f8f8f8f8f8f8f8f8f8'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Current saas_008 migration loads entire tables into memory during data copy (`INSERT INTO org_ics.showtimes SELECT * FROM public.showtimes`). For existing deployments with millions of records, this could exhaust memory and cause OOM killer to terminate the migration.

**Approach:** Design and implement batched migration tooling for migrating large existing deployments to SaaS mode without memory exhaustion.

## Boundaries & Constraints

**Always:**
- Use cursor-based pagination or LIMIT/OFFSET batching for large tables
- Make migrations idempotent (safe to resume after failure)
- Log progress for observability (rows copied per batch, ETA)
- Test on dataset with 1M+ records
- Document migration procedure in runbook

**Ask First:**
- If requiring downtime during migration (prefer zero-downtime)
- If modifying existing saas_008 migration (prefer separate tooling)

**Never:**
- Load entire table into memory in a single query
- Break transactional guarantees (each batch should be atomic)
- Skip idempotency checks (must be safe to re-run)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Migrate 10M showtimes | Fresh org schema, 10M rows in public.showtimes | Rows copied in batches of 10K, completes in <1 hour | Log progress, resume from last batch on failure |
| Migration interrupted | 5M rows copied, network failure mid-batch | Resume from last successful batch, no duplicates | ON CONFLICT clauses prevent duplicates |
| Re-run after completion | All rows already copied | Skip already-migrated rows, complete instantly | Idempotent checks via ON CONFLICT |
| Concurrent writes | New rows added to public.showtimes during migration | Migration completes, new rows handled by next sync | Document: migration is point-in-time snapshot |
| Memory-constrained environment | 512MB RAM limit | Migration completes without OOM | Batch size tunable via env var |

</frozen-after-approval>

## Code Map

- `packages/saas/docs/batched-migration-design.md` -- Design document (to be created)
- `packages/saas/scripts/migrate-large-deployment.sql` -- Batched migration script (to be created)
- `packages/saas/docs/runbooks/migrate-customer-to-saas.md` -- Runbook (to be created)
- `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Current migration (reference)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/saas/docs/batched-migration-design.md` -- Design document analyzing batching strategies
- [ ] `packages/saas/scripts/migrate-large-deployment.sql` -- SQL script with batched INSERT pattern
- [ ] `packages/saas/docs/runbooks/migrate-customer-to-saas.md` -- Step-by-step migration runbook
- [ ] Test script on database with 1M+ showtimes

**Acceptance Criteria:**
- Given a deployment with 10M showtimes, when batched migration runs, then memory usage stays under 1GB
- Given migration is interrupted, when script re-runs, then it resumes from last batch without duplicates
- Given batched migration completes, when schema state is verified, then all data is present and correct
- Given runbook is followed, when DevOps executes migration, then they understand each step and can troubleshoot issues

## Spec Change Log

## Design Notes

**Batching strategies:**

**1. LIMIT/OFFSET (simple but slow for large offsets):**
```sql
DO $$
DECLARE
  batch_size INT := 10000;
  offset_val INT := 0;
  rows_copied INT;
BEGIN
  LOOP
    INSERT INTO org_ics.showtimes (cinema_id, film_id, showtime, version, created_at)
    SELECT cinema_id, film_id, showtime, version, created_at
    FROM public.showtimes
    ORDER BY id  -- CRITICAL: must order for deterministic pagination
    LIMIT batch_size OFFSET offset_val
    ON CONFLICT (id) DO NOTHING;  -- Idempotency
    
    GET DIAGNOSTICS rows_copied = ROW_COUNT;
    RAISE NOTICE 'Copied % rows (offset %)', rows_copied, offset_val;
    
    EXIT WHEN rows_copied < batch_size;
    offset_val := offset_val + batch_size;
    
    COMMIT;  -- Commit each batch
  END LOOP;
  
  RAISE NOTICE 'Migration complete';
END $$;
```

**Pros:** Simple, easy to understand  
**Cons:** Slow for large offsets (OFFSET 1000000 scans 1M rows), not efficient for 10M+ rows

---

**2. Cursor-based pagination (faster, O(1) for each batch):**
```sql
DO $$
DECLARE
  batch_size INT := 10000;
  last_id INT := 0;
  rows_copied INT;
BEGIN
  LOOP
    INSERT INTO org_ics.showtimes (id, cinema_id, film_id, showtime, version, created_at)
    SELECT id, cinema_id, film_id, showtime, version, created_at
    FROM public.showtimes
    WHERE id > last_id  -- Cursor: start from last processed ID
    ORDER BY id
    LIMIT batch_size
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS rows_copied = ROW_COUNT;
    
    -- Update cursor position
    SELECT MAX(id) INTO last_id FROM (
      SELECT id FROM public.showtimes WHERE id > last_id ORDER BY id LIMIT batch_size
    ) t;
    
    RAISE NOTICE 'Copied % rows (last_id: %)', rows_copied, last_id;
    
    EXIT WHEN rows_copied < batch_size;
    
    COMMIT;  -- Commit each batch
  END LOOP;
  
  RAISE NOTICE 'Migration complete';
END $$;
```

**Pros:** O(1) performance per batch, fast for any dataset size  
**Cons:** Slightly more complex, requires ID column to be monotonic

---

**3. Parallel batching (for very large datasets):**

Split table into ranges and run multiple connections in parallel:

```bash
# Connection 1: IDs 1-1000000
psql -c "INSERT INTO org_ics.showtimes SELECT * FROM public.showtimes WHERE id BETWEEN 1 AND 1000000"

# Connection 2: IDs 1000001-2000000
psql -c "INSERT INTO org_ics.showtimes SELECT * FROM public.showtimes WHERE id BETWEEN 1000001 AND 2000000"

# ... and so on
```

**Pros:** Fastest for very large datasets  
**Cons:** Complex coordination, requires good table statistics

---

**Recommended approach: Cursor-based pagination**

- Fast O(1) performance per batch
- Simple enough for runbook
- Idempotent via ON CONFLICT
- Easy to resume after failure

---

**Tables requiring batched migration:**

From saas_008 migration, these tables have potentially large datasets:

1. **cinemas** — ~100-1000 rows (small, no batching needed)
2. **films** — ~10K-100K rows (small-medium, no batching needed)
3. **showtimes** — **10M+ rows** (large, requires batching ⚠️)
4. **weekly_programs** — **1M+ rows** (medium-large, consider batching)
5. **film_aliases** — ~100K rows (small-medium, no batching needed)

**Only showtimes and weekly_programs need batching for production deployments.**

---

**Script structure:**

```sql
-- migrate-large-deployment.sql
-- Batched migration for existing deployments with large datasets

BEGIN;

-- 1. Create org and schema (reuse saas_008 early sections)
-- ...

-- 2. Migrate small tables (no batching)
INSERT INTO org_ics.cinemas (...) SELECT * FROM public.cinemas;
INSERT INTO org_ics.films (...) SELECT * FROM public.films;

-- 3. Migrate large tables (with batching)

-- 3a. Showtimes (10M+ rows)
DO $$
DECLARE
  batch_size INT := 10000;
  last_id INT := 0;
  rows_copied INT;
  start_time TIMESTAMPTZ := NOW();
BEGIN
  RAISE NOTICE 'Starting showtimes migration (batched)';
  
  LOOP
    INSERT INTO org_ics.showtimes (...)
    SELECT * FROM public.showtimes
    WHERE id > last_id
    ORDER BY id
    LIMIT batch_size
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS rows_copied = ROW_COUNT;
    
    SELECT MAX(id) INTO last_id FROM (
      SELECT id FROM public.showtimes WHERE id > last_id ORDER BY id LIMIT batch_size
    ) t;
    
    RAISE NOTICE 'Copied % rows (last_id: %, elapsed: %)', 
      rows_copied, last_id, NOW() - start_time;
    
    EXIT WHEN rows_copied < batch_size;
  END LOOP;
  
  RAISE NOTICE 'Showtimes migration complete (elapsed: %)', NOW() - start_time;
END $$;

-- 3b. Weekly programs (1M+ rows)
DO $$
DECLARE
  batch_size INT := 10000;
  last_id INT := 0;
  rows_copied INT;
BEGIN
  RAISE NOTICE 'Starting weekly_programs migration (batched)';
  
  LOOP
    INSERT INTO org_ics.weekly_programs (...)
    SELECT * FROM public.weekly_programs
    WHERE id > last_id
    ORDER BY id
    LIMIT batch_size
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS rows_copied = ROW_COUNT;
    
    SELECT MAX(id) INTO last_id FROM (
      SELECT id FROM public.weekly_programs WHERE id > last_id ORDER BY id LIMIT batch_size
    ) t;
    
    EXIT WHEN rows_copied < batch_size;
  END LOOP;
  
  RAISE NOTICE 'Weekly programs migration complete';
END $$;

-- 4. Associate admin user (same as saas_008)
-- ...

-- 5. Initialize quota (same as saas_008)
-- ...

COMMIT;
```

---

**Runbook structure:**

1. **Prerequisites**
   - PostgreSQL version
   - Estimated dataset size
   - Downtime window requirements

2. **Pre-migration checklist**
   - Backup database
   - Verify admin user exists
   - Check disk space for new schema

3. **Migration execution**
   - Run script with psql
   - Monitor progress via NOTICE logs
   - Handle interruptions (how to resume)

4. **Post-migration verification**
   - Row count verification
   - Sample data spot-checks
   - Performance testing

5. **Rollback procedure**
   - Drop schema
   - Restore from backup

---

## Verification

**Commands:**
- `psql -f packages/saas/scripts/migrate-large-deployment.sql` -- expected: migration completes without OOM
- `psql -c "SELECT COUNT(*) FROM org_ics.showtimes"` -- expected: matches public.showtimes count
- `psql -c "SELECT COUNT(*) FROM org_ics.weekly_programs"` -- expected: matches public.weekly_programs count

**Manual checks:**
- Verify script logs progress every 10K rows
- Verify script can be interrupted and resumed
- Verify memory usage stays under 1GB during migration
