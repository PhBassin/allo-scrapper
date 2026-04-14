# Review Findings Classification - Issue #832

**Feature:** Create default ICS organization in SaaS mode  
**Spec:** `spec-gh-832-default-ics-org.md`  
**Status:** In Review - Classification Complete  
**Date:** 2026-04-14

---

## Classification Summary

| Category | Count | Action |
|----------|-------|--------|
| `bad_spec` | 1 | Loop back to Step 2, amend spec |
| `patch` | 6 | Fix in implementation |
| `defer` | 18 | Document for future work |
| `reject` | 0 | No findings rejected |

**Decision:** Loop back to Step 2 to amend spec with quota initialization instructions, then re-implement.

---

## bad_spec (1 finding - REQUIRES SPEC AMENDMENT)

### Finding: Missing quota initialization instructions

**Source:** Acceptance Auditor - BLOCKER #1

**Description:**  
The frozen intent explicitly states "Never skip quota initialization for the default org" (line 36), but the Design Notes and Tasks sections do NOT include instructions for initializing the `public.org_usage` table with default quota values.

**Why bad_spec:**  
- Frozen intent makes a promise about behavior
- Design Notes don't explain HOW to fulfill that promise
- Tasks section doesn't include a task to implement it
- Implementation will be incomplete without explicit guidance

**Required Spec Amendment:**

**Location:** Design Notes section (after line 118)

**Content to add:**
```markdown
**Quota initialization:**

The default organization must have quota tracking initialized in `public.org_usage`:

```sql
-- Initialize quota tracking for default org
INSERT INTO public.org_usage (org_id, scrapes_used, last_reset_date)
SELECT id, 0, CURRENT_DATE
FROM public.organizations
WHERE slug = 'ics'
ON CONFLICT (org_id) DO NOTHING;
```

Default quota limits come from the plan associated with the org (typically the "free" plan).
```

**Additional Task Required:**

Add to Tasks section after line 64:
```markdown
- [ ] `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Initialize quota tracking in `public.org_usage` for default org with zero usage and current date -- Ensures quota enforcement works immediately
```

---

## patch (6 findings - FIX IN IMPLEMENTATION)

### 1. Test path bug - Relative import error

**Source:** Acceptance Auditor - BLOCKER #2

**Issue:** `plugin.test.ts` uses `../migrations` but should use `./migrations` (both test and migrations are in same `packages/saas/src/` directory)

**Fix:**
```typescript
// File: packages/saas/src/plugin.test.ts
// Line: ~20
const migrationsDir = path.join(__dirname, './migrations'); // Changed from '../migrations'
```

---

### 2. Missing ON CONFLICT for scrape_reports migration

**Source:** Blind Hunter - Issue #2

**Issue:** `INSERT INTO org_ics.scrape_reports ... ON CONFLICT DO NOTHING` missing `(id)` specification

**Fix:**
```sql
-- File: packages/saas/migrations/saas_008_create_default_ics_org.sql
-- Section: Step 5 - Migrate data
INSERT INTO org_ics.scrape_reports (id, scraper_name, status, started_at, ...)
SELECT id, scraper_name, status, started_at, ...
FROM public.scrape_reports
ON CONFLICT (id) DO NOTHING; -- Add explicit conflict target
```

---

### 3. Missing table existence checks for public schema

**Source:** Blind Hunter - Issue #3

**Issue:** Migration assumes `public.cinemas`, `public.films`, etc. exist. If schema was manually modified, migration fails.

**Fix:**
```sql
-- Before each data migration block, add existence check
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cinemas') THEN
    INSERT INTO org_ics.cinemas (...) SELECT ... FROM public.cinemas ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.cinemas', (SELECT COUNT(*) FROM public.cinemas);
  ELSE
    RAISE NOTICE 'Table public.cinemas does not exist, skipping migration';
  END IF;
END $$;
```

---

### 4. Missing pg_trgm extension check before creating index

**Source:** Edge Case Hunter - Case #7

**Issue:** `weekly_programs` index uses `gin_trgm_ops` but doesn't verify `pg_trgm` extension exists

**Fix:**
```sql
-- In bootstrap.sql or migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_weekly_programs_film_name 
  ON org_ics.weekly_programs USING gin(film_name gin_trgm_ops);
```

---

### 5. Missing schema existence check in org record

**Source:** Blind Hunter - Issue #7

**Issue:** If org record exists but schema was dropped, migration doesn't recreate schema

**Fix:**
```sql
-- After checking org existence
DO $$
BEGIN
  -- If org exists but schema doesn't, recreate schema
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') THEN
      RAISE WARNING 'Organization ics exists but schema org_ics is missing - recreating schema';
      CREATE SCHEMA org_ics;
      -- Re-run bootstrap steps
    END IF;
  END IF;
END $$;
```

---

### 6. Add verification step at end of migration

**Source:** Edge Case Hunter - Case #1

**Issue:** No verification that migration actually succeeded

**Fix:**
```sql
-- At end of migration, before COMMIT
DO $$
DECLARE
  org_count INT;
  schema_exists BOOL;
  admin_exists BOOL;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations WHERE slug = 'ics';
  SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') INTO schema_exists;
  SELECT EXISTS(SELECT 1 FROM org_ics.users WHERE username = 'admin') INTO admin_exists;
  
  IF org_count = 0 THEN
    RAISE EXCEPTION 'Migration verification failed: org ics not created';
  END IF;
  IF NOT schema_exists THEN
    RAISE EXCEPTION 'Migration verification failed: schema org_ics not created';
  END IF;
  IF NOT admin_exists THEN
    RAISE WARNING 'Admin user not migrated to org_ics - manual intervention may be required';
  END IF;
  
  RAISE NOTICE 'Migration verification passed: org=%, schema=%, admin=%', org_count, schema_exists, admin_exists;
END $$;
```

---

## defer (18 findings - DOCUMENT FOR FUTURE)

### Database-level issues (defer to ops)

**Source:** Edge Case Hunter

1. **Case #2:** Insufficient disk space during data migration → Add disk space check docs
2. **Case #3:** Database connection pool exhaustion → Document tuning `max_connections`
3. **Case #18:** Database backup interrupted during migration → Document backup strategy
4. **Case #19:** Transaction log (WAL) fills up during large migration → Document WAL monitoring

**Reasoning:** These are operational concerns, not code issues. Document in deployment guide.

---

### Performance issues (defer - not in scope)

**Source:** Edge Case Hunter

5. **Case #4:** Migration timeout on large datasets (10M+ rows) → Document manual migration process
6. **Case #22:** Schema creation on slow storage (network-mounted volumes) → Document storage requirements

**Reasoning:** Default org migration is one-time operation. Performance optimization not critical for MVP.

---

### Rollback/recovery (defer - not MVP requirement)

**Source:** Edge Case Hunter

7. **Case #5:** Migration fails halfway, needs rollback → Document manual rollback steps
8. **Case #6:** Duplicate data detection if migration runs twice with data changes → Accept risk (ON CONFLICT handles)
9. **Case #8:** Corrupted public schema data (invalid foreign keys) → Document data validation pre-checks

**Reasoning:** Transaction wrapper provides atomic rollback. Manual recovery for edge cases acceptable.

---

### Permission/security (defer - ops concern)

**Source:** Edge Case Hunter

10. **Case #9:** Insufficient PostgreSQL permissions to create schema → Document required permissions
11. **Case #10:** Read-only replica database (can't create org) → Document deployment modes
12. **Case #16:** PostgreSQL user lacks CREATEDB or schema creation privileges → Document setup requirements

**Reasoning:** Database setup is prerequisite, not runtime concern.

---

### Data integrity corner cases (defer - edge cases)

**Source:** Edge Case Hunter

13. **Case #11:** Multiple admin users with `is_system_role=true` → Document: first one wins
14. **Case #12:** Admin user exists in public but has `email_verified=false` → Document: migrates as-is
15. **Case #13:** Admin user has custom role_id (not standard 'admin' role) → Document: requires standard role
16. **Case #14:** Public schema has cinemas with NULL coordinates → Document: migrates NULL values
17. **Case #15:** Films table has future showtimes with invalid cinema references → Accept: foreign keys will fail loudly

**Reasoning:** Rare edge cases. Fail loudly or document expected behavior.

---

### Monitoring/observability (defer - future enhancement)

**Source:** Edge Case Hunter

18. **Case #23:** No telemetry/metrics for migration progress → Future: add progress tracking

**Reasoning:** Not required for MVP. Migration logs provide basic observability.

---

## reject (0 findings)

No findings rejected.

---

## Next Actions

**Immediate (Step 2 - Amend Spec):**
1. ✅ Update Spec Change Log with bad_spec finding details
2. ✅ Add quota initialization instructions to Design Notes section
3. ✅ Add quota initialization task to Tasks section
4. ✅ Change spec status back to `ready-for-dev`

**After spec amendment (Step 3 - Re-implement):**
1. ❌ Revert current implementation files
2. ❌ Re-run Step 3 with updated spec (include quota init + 6 patches)
3. ❌ Update test suite to verify quota initialization

**After re-implementation (Step 4 - Re-review):**
1. ❌ Run adversarial review again to verify all patches applied
2. ❌ If clean, proceed to Step 5 (Present)

---

## Deferred Work Tracking

Create follow-up issues for deferred findings:

- [ ] **Issue:** Document operational requirements for default org migration (disk space, permissions, backup strategy)
- [ ] **Issue:** Add migration progress telemetry/metrics
- [ ] **Issue:** Create data validation pre-check script for public schema integrity
