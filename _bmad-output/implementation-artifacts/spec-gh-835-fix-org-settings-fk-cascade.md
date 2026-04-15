---
title: 'Fix org_settings.updated_by FK cascade behavior'
type: 'bugfix'
created: '2026-04-14'
status: 'done'
baseline_commit: '19aeb2d1f358a9ed03ec65f60e712646020813f4'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `org_settings.updated_by` FK references `users(id)` without `ON DELETE` action. Deleting a user fails if they last updated org settings with error: `update or delete on table "users" violates foreign key constraint "org_settings_updated_by_fkey"`.

**Approach:** Add `ON DELETE SET NULL` to the FK constraint in the bootstrap template, and create a migration to fix all existing org schemas.

## Boundaries & Constraints

**Always:**
- Fix the bootstrap template (`packages/saas/migrations/org_schema/000_bootstrap.sql`) for future orgs
- Create an idempotent migration to fix all existing org schemas
- Use `ON DELETE SET NULL` (not CASCADE) - we want to preserve the settings record
- Follow existing migration patterns (checksum-tracked SQL files in `packages/saas/migrations/`)

**Ask First:**
- If migration fails on any existing org schema and requires manual intervention

**Never:**
- Use `ON DELETE CASCADE` (would delete org_settings when user is deleted)
- Modify core migrations (changes must be in SaaS plugin migrations only)
- Break idempotency - migration must be safe to run multiple times

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete user who updated settings | User ID exists in `org_settings.updated_by`, attempt `DELETE FROM users WHERE id=X` | User deleted successfully, `org_settings.updated_by` set to NULL | None - operation succeeds |
| Delete user who never touched settings | User ID not in `org_settings.updated_by` | User deleted successfully | None - operation succeeds |
| Run migration on fresh org (no FK yet) | Bootstrap template just ran, FK constraint doesn't exist | FK constraint created with `ON DELETE SET NULL` | None - idempotent check |
| Run migration on existing org (FK exists) | FK constraint `org_settings_updated_by_fkey` exists without `ON DELETE` | FK constraint dropped and recreated with `ON DELETE SET NULL` | None - idempotent check |
| Run migration twice on same org | FK constraint already has `ON DELETE SET NULL` | Migration detects existing correct constraint, skips modification | None - early exit with NOTICE |

</frozen-after-approval>

## Code Map

- `packages/saas/migrations/org_schema/000_bootstrap.sql` -- Bootstrap template for new org schemas (lines 52-74: org_settings table definition)
- `packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql` -- New migration to fix existing org schemas
- `packages/saas/src/plugin.test.ts` -- Migration inventory test (verify saas_009 is tracked)

## Tasks & Acceptance

**Execution:**
- [x] `packages/saas/migrations/org_schema/000_bootstrap.sql` -- Add `ON DELETE SET NULL` to `updated_by` FK constraint definition (line 68) -- Ensures all future orgs have correct FK behavior
- [x] `packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql` -- Create migration that loops through all org schemas and fixes FK constraint -- Repairs all existing org schemas
- [x] `packages/saas/src/plugin.test.ts` -- Add migration inventory test for saas_009 -- Ensures migration is tracked and checksummed

**Acceptance Criteria:**
- Given a fresh org created after bootstrap update, when user who updated settings is deleted, then deletion succeeds and `updated_by` is NULL
- Given an existing org before migration, when migration runs, then FK constraint is updated to include `ON DELETE SET NULL`
- Given an existing org with already-fixed constraint, when migration runs again, then migration exits early with NOTICE
- Given any org schema, when user who updated settings is deleted, then deletion succeeds without FK violation error

## Spec Change Log

## Design Notes

**Bootstrap Template Change:**

```sql
-- Before (line 68):
updated_by INTEGER REFERENCES users(id)

-- After:
updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
```

**Migration Pattern:**

The migration loops through all org schemas and applies idempotent FK constraint fix:

```sql
DO $$
DECLARE
  org_record RECORD;
  fk_exists BOOLEAN;
BEGIN
  -- Loop through all organizations
  FOR org_record IN SELECT schema_name FROM public.organizations LOOP
    -- Check if FK constraint exists and needs fixing
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_schema = org_record.schema_name
        AND tc.table_name = 'org_settings'
        AND tc.constraint_name = 'org_settings_updated_by_fkey'
        AND rc.delete_rule != 'SET NULL'
    ) INTO fk_exists;
    
    -- Fix constraint if needed
    IF fk_exists THEN
      EXECUTE format('
        ALTER TABLE %I.org_settings
        DROP CONSTRAINT org_settings_updated_by_fkey,
        ADD CONSTRAINT org_settings_updated_by_fkey 
          FOREIGN KEY (updated_by) REFERENCES %I.users(id) 
          ON DELETE SET NULL
      ', org_record.schema_name, org_record.schema_name);
      
      RAISE NOTICE 'Fixed FK constraint in schema: %', org_record.schema_name;
    ELSE
      RAISE NOTICE 'FK constraint already correct or does not exist in schema: %', org_record.schema_name;
    END IF;
  END LOOP;
END $$;
```

**Idempotency Mechanism:**

- Check `delete_rule != 'SET NULL'` before modifying
- If constraint already correct, skip with NOTICE
- Safe to run multiple times without errors

## Verification

**Commands:**
- `cd server && npm run test:run` -- expected: all tests pass including new migration inventory test
- `docker compose exec -T ics-db psql -U postgres -d ics -c "SELECT delete_rule FROM information_schema.referential_constraints WHERE constraint_name='org_settings_updated_by_fkey' AND constraint_schema='org_ics'"` -- expected: `SET NULL`

**Manual checks:**
- Verify bootstrap template has `ON DELETE SET NULL` at line 68
- Test user deletion: Create test user, update org_settings, delete user (should succeed with updated_by set to NULL)
- Run migration twice (second run should show NOTICE messages, no errors)

## Suggested Review Order

**Bootstrap Template Fix**

- Added `ON DELETE SET NULL` to prevent FK violations on user deletion
  [`000_bootstrap.sql:68`](../../packages/saas/migrations/org_schema/000_bootstrap.sql#L68)

**Migration for Existing Orgs**

- Idempotent migration loops through all org schemas and fixes FK constraint
  [`saas_009_fix_org_settings_fk_cascade.sql:33`](../../packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql#L33)

- Query checks `delete_rule` before modifying to ensure idempotency
  [`saas_009_fix_org_settings_fk_cascade.sql:46`](../../packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql#L46)

- ALTER TABLE uses format() with %I for SQL injection protection
  [`saas_009_fix_org_settings_fk_cascade.sql:60`](../../packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql#L60)

**Test Coverage**

- Migration inventory test verifies saas_009 is tracked
  [`plugin.test.ts:76`](../../packages/saas/src/plugin.test.ts#L76)

