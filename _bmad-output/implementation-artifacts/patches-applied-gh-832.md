# Patches Applied - Issue #832

**Commit:** 896c1b4  
**Date:** 2026-04-14  
**Status:** 6 critical patches APPLIED ✅

---

## Applied Patches Summary

| ID | Issue | Status | Severity |
|----|-------|--------|----------|
| P1 | Quota initialization missing | ✅ FALSE POSITIVE | N/A |
| P2 | Race condition in early exit | ✅ APPLIED | Critical |
| P3 | Sequence drift on scrape_reports | ✅ APPLIED | High |
| P4 | Missing scraper_name column check | ✅ APPLIED | Medium |
| P5 | FOUND flag logic incorrect | ✅ APPLIED | Medium |
| P6 | No free plan validation | ✅ APPLIED | High |
| P7 | Orphaned FK references | ✅ APPLIED | High |
| P8 | film_name not populated | ✅ APPLIED | Medium |

---

## Patch Details

### P1: Quota Initialization - ✅ FALSE POSITIVE

**Finding:** Acceptance Auditor reported quota initialization missing  
**Reality:** Code WAS present at lines 341-354 of original migration  
**Action:** No patch needed - verified code exists

```sql
-- Step 7: Initialize quota tracking in public.org_usage
INSERT INTO public.org_usage (org_id, month, cinemas_count, users_count, scrapes_count, api_calls_count)
SELECT 
  o.id,
  DATE_TRUNC('month', CURRENT_DATE),
  0, 0, 0, 0
FROM public.organizations o
WHERE o.slug = 'ics'
ON CONFLICT (org_id, month) DO NOTHING;
```

---

### P2: Race Condition in Early Exit - ✅ APPLIED

**Issue:** `RETURN` inside DO block only exits that block, not the transaction  
**Impact:** Steps 2-8 execute even when org already exists  
**Fix:** Wrapped entire migration in single DO block with proper early exit

**Before:**
```sql
DO $$
BEGIN
  IF EXISTS (...) THEN
    RAISE NOTICE 'Already exists';
    RETURN; -- ❌ Only exits this DO block
  END IF;
END $$;

-- Steps 2-8 execute anyway ❌
```

**After:**
```sql
DO $$
DECLARE
  should_migrate BOOLEAN := FALSE;
BEGIN
  -- Step 1: Check existence
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics') THEN
    should_migrate := TRUE;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') THEN
    RAISE WARNING 'Organization exists but schema missing';
    should_migrate := TRUE;
  ELSE
    RAISE NOTICE 'Migration already completed, skipping';
    RETURN; -- ✅ Exits entire migration
  END IF;
  
  -- All steps 2-8 wrapped in same block
  ...
END $$;
```

---

### P3: Sequence Drift on scrape_reports - ✅ APPLIED

**Issue:** IDs copied from public.scrape_reports, but sequence not reset  
**Impact:** Next INSERT generates duplicate ID → constraint violation  
**Fix:** Reset sequence after data migration

**Added:**
```sql
-- Reset sequence to max(id) + 1
SELECT setval('org_ics.scrape_reports_id_seq', 
  COALESCE((SELECT MAX(id) FROM org_ics.scrape_reports), 0) + 1, 
  false);

RAISE NOTICE 'scrape_reports: % rows migrated, sequence reset', source_count;
```

---

### P4: Missing scraper_name Column Check - ✅ APPLIED

**Issue:** Migration didn't verify if source table has scraper_name column before attempting to migrate it  
**Impact:** Migration fails if column doesn't exist in old schema  
**Fix:** Added column existence check before migration

**Added:**
```sql
-- Check if scraper_name column exists in source
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'scrape_reports' 
    AND column_name = 'scraper_name'
) INTO has_scraper_name;

-- Conditional SELECT based on column existence
IF has_scraper_name THEN
  INSERT INTO org_ics.scrape_reports (id, scraper_name, started_at, ...)
  SELECT id, scraper_name, started_at, ...
  FROM public.scrape_reports
  ON CONFLICT (id) DO NOTHING;
ELSE
  INSERT INTO org_ics.scrape_reports (id, started_at, ...)
  SELECT id, started_at, ...
  FROM public.scrape_reports
  ON CONFLICT (id) DO NOTHING;
END IF;
```

---

### P5: FOUND Flag Logic Incorrect - ✅ APPLIED

**Issue:** `IF FOUND THEN` after `ON CONFLICT DO NOTHING` returns false even when row already exists  
**Impact:** Misleading warning messages  
**Fix:** Use GET DIAGNOSTICS to properly detect inserted vs conflicted rows

**Before:**
```sql
INSERT INTO org_ics.users (...)
SELECT ...
ON CONFLICT (username) DO NOTHING;

IF FOUND THEN
  RAISE NOTICE 'User associated'; -- ❌ Never fires when conflict occurs
ELSE
  RAISE WARNING 'User not found'; -- ❌ Fires even when user exists
END IF;
```

**After:**
```sql
INSERT INTO org_ics.users (...)
SELECT ...
ON CONFLICT (username) DO NOTHING;

GET DIAGNOSTICS inserted_count = ROW_COUNT;

IF inserted_count > 0 THEN
  RAISE NOTICE 'System admin user associated with org_ics'; -- ✅ Correct
ELSIF EXISTS (SELECT 1 FROM org_ics.users WHERE username = 'admin') THEN
  RAISE NOTICE 'System admin user already exists in org_ics'; -- ✅ Correct
ELSE
  RAISE WARNING 'System admin user not found in public.users'; -- ✅ Correct
END IF;
```

---

### P6: No Free Plan Validation - ✅ APPLIED

**Issue:** If 'free' plan doesn't exist, subquery returns NULL → org created with NULL plan_id  
**Impact:** FK constraint violation or application logic failure  
**Fix:** Validate plan exists before org creation, fail fast with explicit error

**Added:**
```sql
-- Validate free plan exists
SELECT id INTO free_plan_id 
FROM public.plans 
WHERE name = 'free' 
LIMIT 1;

IF free_plan_id IS NULL THEN
  RAISE EXCEPTION 'Cannot create default org: free plan not found in public.plans. Run SaaS plugin migrations first.';
END IF;

-- Use validated plan_id
INSERT INTO public.organizations (name, slug, plan_id, schema_name, status, trial_ends_at)
SELECT 
  'Independent Cinema Showtimes',
  'ics',
  free_plan_id, -- ✅ Guaranteed non-NULL
  'org_ics',
  'active',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics');
```

---

### P7: Orphaned FK References - ✅ APPLIED

**Issue:** Orphaned FKs in source data (e.g., showtime → non-existent film) cause constraint violations  
**Impact:** Migration fails halfway through, requires manual cleanup  
**Fix:** Use INNER JOIN to filter out orphaned references

**Before:**
```sql
INSERT INTO org_ics.showtimes (...)
SELECT *
FROM public.showtimes -- ❌ Includes orphaned FKs
ON CONFLICT (...) DO NOTHING;
```

**After:**
```sql
INSERT INTO org_ics.showtimes (...)
SELECT s.*
FROM public.showtimes s
INNER JOIN org_ics.films f ON s.film_id = f.id -- ✅ Skip if film doesn't exist
INNER JOIN org_ics.cinemas c ON s.cinema_id = c.id -- ✅ Skip if cinema doesn't exist
ON CONFLICT (...) DO NOTHING;
```

---

### P8: film_name Not Populated - ✅ APPLIED

**Issue:** weekly_programs migration doesn't populate film_name column → all NULL  
**Impact:** Queries return incomplete data, requires backfill  
**Fix:** JOIN with films table to populate film_name during migration

**Before:**
```sql
INSERT INTO org_ics.weekly_programs (cinema_id, film_id, week_start, ...)
SELECT cinema_id, film_id, week_start, ...
FROM public.weekly_programs
ON CONFLICT (...) DO NOTHING;
-- film_name column left NULL ❌
```

**After:**
```sql
INSERT INTO org_ics.weekly_programs (cinema_id, film_id, film_name, week_start, ...)
SELECT wp.cinema_id, wp.film_id, f.title, wp.week_start, ... -- ✅ Populate from films.title
FROM public.weekly_programs wp
LEFT JOIN public.films f ON wp.film_id = f.id
ON CONFLICT (...) DO NOTHING;
```

---

## Remaining Issues (Not Applied)

**"Should fix" patches (P9-P15):** 7 remaining  
**"Could fix" patches (P16):** 1 remaining  
**Deferred items:** 20 items documented in review-triage-gh-832.md  

**Decision:** Critical patches applied. Remaining items can be addressed in follow-up issues if needed.

---

## Verification Checklist

Before considering this issue complete, verify:

- [ ] Migration file passes syntax check: `psql -f packages/saas/migrations/saas_008_create_default_ics_org.sql --dry-run`
- [ ] Migration runs successfully on fresh database
- [ ] Migration is idempotent (can run multiple times without errors)
- [ ] All data migrated correctly (cinemas, films, showtimes, etc.)
- [ ] System admin user associated with org_ics
- [ ] Quota tracking initialized
- [ ] No orphaned FK violations
- [ ] Sequences reset correctly
- [ ] film_name populated in weekly_programs

---

## Next Steps

1. ✅ Commit patches (DONE - 896c1b4)
2. ⏭️ Test migration on fresh database
3. ⏭️ Test migration idempotency (run twice)
4. ⏭️ Decide on P9-P15 patches (apply or defer)
5. ⏭️ Create follow-up issues for 20 deferred items
6. ⏭️ Update spec status to `done` when verified
7. ⏭️ Continue to Step 5 (Present) of Quick Dev workflow
