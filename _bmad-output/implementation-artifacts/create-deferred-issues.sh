#!/bin/bash
# Script to create high-priority follow-up issues from #832 deferred items
# Usage: ./create-deferred-issues.sh

set -e

echo "Creating 5 high-priority follow-up issues from #832..."
echo ""

# D2: Password sync design
echo "Creating D2: Password sync architecture..."
gh issue create \
  --title "enhancement(saas): design password sync mechanism for multi-tenant architecture" \
  --body "**Deferred from:** #832

**Description:** Admin password hash is duplicated across schemas (public.users and org_ics.users). Changes to admin password in one location don't propagate to other schemas.

**Why deferred:** 
- Inherent to schema-per-tenant architecture
- Password sync is a future SaaS feature, not a migration bug
- Requires architectural design decision

**Potential solutions:**
1. Shared password table (public.user_credentials) referenced by all org schemas
2. Trigger-based sync on password_hash updates
3. Polling-based sync via background worker
4. Application-level sync on password change API

**Recommended approach:** Shared credentials table with soft references (username-based, not FK)

**Related files:**
- \`packages/saas/migrations/saas_008_create_default_ics_org.sql\` (lines 384-399)
- \`packages/saas/migrations/org_schema/000_bootstrap.sql\` (users table)

**Acceptance criteria:**
- Design document created in \`packages/saas/docs/password-sync-design.md\`
- Tradeoffs analyzed (shared table vs triggers vs polling)
- Migration path defined for existing deployments
- Security implications documented

See: \`_bmad-output/implementation-artifacts/deferred-issues-gh-832.md\` (D2)" \
  --label "enhancement,saas-architecture,documentation" \
  --milestone "SaaS MVP"

echo "✅ Created D2 issue"
echo ""

# D3: FK indexes
echo "Creating D3: Add FK indexes for performance..."
gh issue create \
  --title "perf(saas): add foreign key indexes to org schema bootstrap" \
  --body "**Deferred from:** #832

**Description:** Foreign key columns like \`org_ics.users.role_id\` lack indexes, causing slow JOIN queries as org scales.

**Why deferred:**
- Performance optimization, not correctness issue
- Default org has minimal users (1-5), no noticeable impact
- Should be addressed during performance tuning phase

**Impact:**
- Queries like \`SELECT u.*, r.name FROM users u JOIN roles r ON u.role_id = r.id\` do full table scan
- Becomes noticeable with >1000 users per org

**Proposed fix:**
\`\`\`sql
-- Add to packages/saas/migrations/org_schema/000_bootstrap.sql
CREATE INDEX idx_users_role_id ON {schema}.users(role_id);
CREATE INDEX idx_invitations_role_id ON {schema}.invitations(role_id);
CREATE INDEX idx_invitations_created_by ON {schema}.invitations(created_by);
CREATE INDEX idx_org_settings_updated_by ON {schema}.org_settings(updated_by);
\`\`\`

**Migration for existing orgs:**
\`\`\`sql
-- Run against all existing org schemas
DO \$\$
DECLARE
  org_schema TEXT;
BEGIN
  FOR org_schema IN SELECT schema_name FROM public.organizations LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_users_role_id ON %I.users(role_id)', org_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON %I.invitations(role_id)', org_schema);
    -- ... repeat for other FKs
  END LOOP;
END \$\$;
\`\`\`

**Acceptance criteria:**
- Indexes added to bootstrap template
- Migration script created for existing org schemas
- Performance benchmarks before/after (1000+ user org)

See: \`_bmad-output/implementation-artifacts/deferred-issues-gh-832.md\` (D3)" \
  --label "performance,saas,patch" \
  --milestone "Performance Tuning"

echo "✅ Created D3 issue"
echo ""

# D5: FK cascade fix
echo "Creating D5: Fix FK cascade in org_settings..."
gh issue create \
  --title "fix(saas): add ON DELETE SET NULL to org_settings.updated_by FK" \
  --body "**Deferred from:** #832

**Description:** \`org_settings.updated_by\` references \`users(id)\` without ON DELETE action. Deleting a user fails if they last updated org settings.

**Why deferred:**
- Pre-existing schema design issue, not introduced by #832 migration
- Affects all org schemas via bootstrap template
- Should be fixed in bootstrap template, not one-off migration

**Impact:**
- Cannot delete user who last updated org settings
- Error: \`update or delete on table \"users\" violates foreign key constraint \"org_settings_updated_by_fkey\"\`

**Proposed fix:**

1. **Update bootstrap template** (\`packages/saas/migrations/org_schema/000_bootstrap.sql\`):
\`\`\`sql
CREATE TABLE IF NOT EXISTS {schema}.org_settings (
  ...
  updated_by INTEGER REFERENCES {schema}.users(id) ON DELETE SET NULL,
  ...
);
\`\`\`

2. **Migrate existing org schemas**:
\`\`\`sql
-- Migration: packages/saas/migrations/saas_009_fix_org_settings_fk.sql
DO \$\$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT schema_name FROM public.organizations LOOP
    EXECUTE format('
      ALTER TABLE %I.org_settings
      DROP CONSTRAINT IF EXISTS org_settings_updated_by_fkey,
      ADD CONSTRAINT org_settings_updated_by_fkey 
        FOREIGN KEY (updated_by) REFERENCES %I.users(id) 
        ON DELETE SET NULL
    ', org_record.schema_name, org_record.schema_name);
    
    RAISE NOTICE 'Fixed FK cascade for org schema: %', org_record.schema_name;
  END LOOP;
END \$\$;
\`\`\`

**Acceptance criteria:**
- Bootstrap template updated
- Migration script tested on existing org schemas
- Manual test: Delete user who updated org settings (should succeed, updated_by set to NULL)

See: \`_bmad-output/implementation-artifacts/deferred-issues-gh-832.md\` (D5)" \
  --label "bug,saas,schema-design,patch" \
  --milestone "SaaS MVP"

echo "✅ Created D5 issue"
echo ""

# D8: Integration tests
echo "Creating D8: Add integration tests for SaaS migrations..."
gh issue create \
  --title "test(saas): add integration tests for SaaS migration files" \
  --body "**Deferred from:** #832

**Description:** Current test only verifies migration file exists (\`plugin.test.ts\`), doesn't run migration against test database.

**Why deferred:**
- Test inventory pattern used throughout project
- Functional tests exist elsewhere (manual QA, staging deployments)
- File existence test catches accidental deletion/rename

**Gap:**
- No automated verification that migration SQL is syntactically valid
- No automated verification that migration produces expected schema state
- Regressions could slip through code review

**Proposed enhancement:**

Create \`packages/saas/src/migrations.integration.test.ts\`:

\`\`\`typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

describe('SaaS Migrations Integration', () => {
  let pool: Pool;
  
  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost',
      database: 'ics_test',
      user: 'postgres',
      password: 'postgres'
    });
  });
  
  afterAll(async () => {
    await pool.end();
  });
  
  it('should run saas_008 migration successfully', async () => {
    const sql = readFileSync('packages/saas/migrations/saas_008_create_default_ics_org.sql', 'utf-8');
    
    // Run migration
    await pool.query(sql);
    
    // Verify org exists
    const orgResult = await pool.query(
      \"SELECT * FROM public.organizations WHERE slug='ics'\"
    );
    expect(orgResult.rows).toHaveLength(1);
    
    // Verify schema exists
    const schemaResult = await pool.query(
      \"SELECT schema_name FROM information_schema.schemata WHERE schema_name='org_ics'\"
    );
    expect(schemaResult.rows).toHaveLength(1);
    
    // Verify quota initialized
    const quotaResult = await pool.query(
      \"SELECT * FROM public.org_usage WHERE org_id = (SELECT id FROM public.organizations WHERE slug='ics')\"
    );
    expect(quotaResult.rows).toHaveLength(1);
    expect(quotaResult.rows[0].cinemas_count).toBe(0);
  });
  
  it('should be idempotent (run twice without errors)', async () => {
    const sql = readFileSync('packages/saas/migrations/saas_008_create_default_ics_org.sql', 'utf-8');
    
    // Run migration twice
    await pool.query(sql);
    await expect(pool.query(sql)).resolves.not.toThrow();
  });
});
\`\`\`

**Acceptance criteria:**
- Integration test suite created with test database setup
- Tests cover: successful migration, idempotency, data migration, quota init
- CI pipeline runs integration tests before merge
- Documentation updated with local test database setup instructions

See: \`_bmad-output/implementation-artifacts/deferred-issues-gh-832.md\` (D8)" \
  --label "testing,saas,enhancement" \
  --milestone "Test Coverage"

echo "✅ Created D8 issue"
echo ""

# D15: Large dataset migration
echo "Creating D15: Design batched migration for large existing deployments..."
gh issue create \
  --title "enhancement(saas): design batched migration tooling for large existing deployments" \
  --body "**Deferred from:** #832

**Description:** Current migration loads entire tables into memory, could exhaust memory on deployments with millions of records.

**Why deferred:**
- Not a concern for default org (fresh installs have minimal data)
- Real issue is for existing production instances migrating to SaaS
- Requires separate design for customer migration tooling

**Impact:**
- Deployment with 10M+ showtimes could hit memory limits during migration
- PostgreSQL OOM killer could terminate migration mid-way
- Customer onboarding blocked for large cinema chains

**Current migration pattern:**
\`\`\`sql
INSERT INTO org_ics.showtimes (...)
SELECT * FROM public.showtimes; -- ❌ Loads all rows into memory
\`\`\`

**Proposed batched migration pattern:**
\`\`\`sql
DO \$\$
DECLARE
  batch_size INT := 10000;
  offset_val INT := 0;
  rows_copied INT;
BEGIN
  LOOP
    INSERT INTO org_ics.showtimes (...)
    SELECT * FROM public.showtimes
    ORDER BY id
    LIMIT batch_size OFFSET offset_val
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS rows_copied = ROW_COUNT;
    
    RAISE NOTICE 'Copied % showtimes (offset %)', rows_copied, offset_val;
    
    EXIT WHEN rows_copied < batch_size;
    offset_val := offset_val + batch_size;
  END LOOP;
END \$\$;
\`\`\`

**Deliverables:**

1. **Design document:** \`docs/saas-migration-large-datasets.md\`
   - Batching strategy (cursor vs OFFSET vs temp tables)
   - Memory profiling for different dataset sizes
   - Rollback strategy for failed batches

2. **Migration script:** \`scripts/migrate-existing-to-saas.sh\`
   - Prompts for org slug, validates data integrity
   - Runs batched migration with progress reporting
   - Verification step after completion

3. **Runbook:** \`docs/runbooks/migrate-customer-to-saas.md\`
   - Pre-migration checklist (backup, maintenance mode)
   - Estimated migration time by dataset size
   - Rollback procedure

**Acceptance criteria:**
- Tested on 10M+ record dataset without memory issues
- Migration completes in <1 hour for 10M showtimes
- Idempotent (safe to resume after failure)
- Production-ready for customer onboarding

See: \`_bmad-output/implementation-artifacts/deferred-issues-gh-832.md\` (D15)" \
  --label "enhancement,saas,scalability,customer-onboarding" \
  --milestone "Customer Migration Tooling"

echo "✅ Created D15 issue"
echo ""

echo "=========================================="
echo "✅ All 5 high-priority issues created!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review issues in GitHub: gh issue list --label saas"
echo "2. Prioritize in backlog refinement meeting"
echo "3. Assign to milestones based on roadmap"
echo ""
echo "Remaining 15 deferred items documented in:"
echo "_bmad-output/implementation-artifacts/deferred-issues-gh-832.md"
echo ""
echo "Create additional issues as needed based on roadmap priorities."
