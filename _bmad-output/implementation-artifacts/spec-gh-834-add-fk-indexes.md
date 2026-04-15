---
title: 'Add foreign key indexes to org schema bootstrap'
type: 'perf'
created: '2026-04-15'
status: 'ready-for-dev'
baseline_commit: '0473b29db8b8f9e8f8f8f8f8f8f8f8f8f8f8f8f8'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Foreign key columns in org schemas lack indexes, causing slow JOIN queries as orgs scale. Queries like `SELECT u.*, r.name FROM users u JOIN roles r ON u.role_id = r.id` perform full table scans without indexes.

**Approach:** Add indexes to all FK columns in the bootstrap template and create a migration to backfill existing org schemas.

## Boundaries & Constraints

**Always:**
- Add indexes to ALL foreign key columns in bootstrap template
- Create migration to backfill indexes for existing org schemas
- Use `IF NOT EXISTS` for idempotency
- Follow PostgreSQL index naming convention: `idx_{table}_{column}`

**Ask First:**
- If adding composite indexes (not needed for single-column FKs)
- If changing existing index definitions

**Never:**
- Remove existing indexes (only add new ones)
- Create duplicate indexes
- Use non-standard index names

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bootstrap new org | Fresh org schema with no indexes | Indexes created automatically via bootstrap template | N/A - bootstrap creates indexes |
| Migrate existing org | Existing org schema with no FK indexes | Migration adds missing indexes with IF NOT EXISTS | Idempotent - safe to re-run |
| Re-run migration | Org schema already has indexes | Migration skips (IF NOT EXISTS) | No errors, no duplicate indexes |
| Concurrent migrations | Two processes run migration simultaneously | PostgreSQL locks prevent duplicate indexes | Safe - DDL operations serialized |

</frozen-after-approval>

## Code Map

- `packages/saas/migrations/org_schema/000_bootstrap.sql` -- Bootstrap template for new orgs (needs indexes added)
- `packages/saas/migrations/saas_010_add_fk_indexes.sql` -- New migration to backfill existing orgs (to be created)
- `packages/saas/src/plugin.test.ts` -- Migration inventory test (needs update)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/saas/migrations/org_schema/000_bootstrap.sql` -- Add 4 missing FK indexes after table definitions
- [ ] `packages/saas/migrations/saas_010_add_fk_indexes.sql` -- Create migration to backfill indexes for existing org schemas
- [ ] `packages/saas/src/plugin.test.ts` -- Update migration inventory test to include saas_010

**Acceptance Criteria:**
- Given a new org is created, when bootstrap runs, then all FK columns have indexes
- Given an existing org schema, when migration runs, then missing indexes are added
- Given migration runs twice, when IF NOT EXISTS is used, then no errors occur
- Given 1000+ users in an org, when JOIN queries run, then performance is improved (index scan instead of seq scan)

## Spec Change Log

## Design Notes

**Foreign keys requiring indexes:**

From `000_bootstrap.sql`:

1. **users.role_id** (line 27) → `REFERENCES roles(id)`
   - Used in: `SELECT u.*, r.name FROM users u JOIN roles r ON u.role_id = r.id`
   - Frequency: Every user listing/permission check

2. **invitations.role_id** (line 41) → `REFERENCES roles(id)`
   - Used in: `SELECT i.*, r.name FROM invitations i JOIN roles r ON i.role_id = r.id`
   - Frequency: Every invitation listing

3. **invitations.created_by** (line 45) → `REFERENCES users(id)`
   - Used in: `SELECT i.*, u.username FROM invitations i JOIN users u ON i.created_by = u.id`
   - Frequency: Audit trails, invitation management

4. **org_settings.updated_by** (line 68) → `REFERENCES users(id)`
   - Used in: `SELECT s.*, u.username FROM org_settings s JOIN users u ON s.updated_by = u.id`
   - Frequency: Settings audit trail

**Index placement in bootstrap template:**

Add indexes immediately after the table they reference, following existing pattern:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (...);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);  -- NEW

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (...);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON invitations(role_id);  -- NEW
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON invitations(created_by);  -- NEW

-- Org Settings table
CREATE TABLE IF NOT EXISTS org_settings (...);
-- Add index after table definition
CREATE INDEX IF NOT EXISTS idx_org_settings_updated_by ON org_settings(updated_by);  -- NEW
```

**Migration template:**

```sql
-- saas_010_add_fk_indexes.sql
-- Add missing foreign key indexes to existing org schemas
-- Idempotent - safe to re-run

BEGIN;

DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT slug FROM organizations LOOP
    RAISE NOTICE 'Adding FK indexes to org_%', org_record.slug;
    
    -- Add indexes with IF NOT EXISTS
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_users_role_id ON %I.users(role_id)', 'org_' || org_record.slug);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON %I.invitations(role_id)', 'org_' || org_record.slug);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON %I.invitations(created_by)', 'org_' || org_record.slug);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_org_settings_updated_by ON %I.org_settings(updated_by)', 'org_' || org_record.slug);
  END LOOP;
  
  RAISE NOTICE 'FK indexes migration complete';
END $$;

COMMIT;
```

## Verification

**Commands:**
- `cd packages/saas && npm test` -- expected: migration inventory test passes
- `psql -c "\d org_ics.users"` -- expected: idx_users_role_id appears in index list
- `psql -c "\d org_ics.invitations"` -- expected: idx_invitations_role_id and idx_invitations_created_by appear
- `psql -c "\d org_ics.org_settings"` -- expected: idx_org_settings_updated_by appears

**Manual checks:**
- Verify index naming follows convention
- Verify IF NOT EXISTS used everywhere
- Verify migration is idempotent (can run twice)
