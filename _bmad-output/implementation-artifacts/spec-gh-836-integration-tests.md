---
title: 'Add integration tests for SaaS migration files'
type: 'test'
created: '2026-04-15'
status: 'ready-for-dev'
baseline_commit: '0473b29db8b8f9e8f8f8f8f8f8f8f8f8f8f8f8f8'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Current test only verifies migration file exists (`plugin.test.ts`), doesn't run migrations against a test database. No automated verification that migration SQL is syntactically valid or produces expected schema state.

**Approach:** Create integration test suite that runs SaaS migrations against a test database and verifies post-migration state.

## Boundaries & Constraints

**Always:**
- Test against real PostgreSQL database (not mocks)
- Verify migration SQL is syntactically valid
- Verify migration produces expected schema state
- Test idempotency (can run migration twice without errors)
- Use test database credentials from environment variables

**Ask First:**
- If adding full E2E tests (not just migration execution)
- If requiring Docker for test database setup

**Never:**
- Test against production database
- Hard-code database credentials
- Leave test data in database after tests complete

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Run saas_008 migration | Fresh test database | Org 'ics' created, schema 'org_ics' exists, admin user associated | Migration succeeds |
| Run saas_008 twice | Database with existing ICS org | Migration skips (idempotent), no errors | ON CONFLICT clauses prevent duplicates |
| Run saas_009 migration | Database with org_settings FK | FK constraint updated to ON DELETE SET NULL | Migration succeeds |
| Run saas_010 migration | Database with org schemas missing indexes | Indexes added to all org schemas | Migration succeeds |
| Database connection fails | Invalid credentials | Test fails with connection error | Error message clearly indicates DB connection issue |

</frozen-after-approval>

## Code Map

- `packages/saas/src/migrations.integration.test.ts` -- New integration test file (to be created)
- `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Migration to test
- `packages/saas/migrations/saas_009_fix_org_settings_fk_cascade.sql` -- Migration to test
- `packages/saas/migrations/saas_010_add_fk_indexes.sql` -- Migration to test
- `packages/saas/vitest.config.ts` -- Vitest config (may need test database env vars)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/saas/src/migrations.integration.test.ts` -- Create integration test suite with database setup
- [ ] Test saas_008: verify org created, schema exists, admin user associated
- [ ] Test saas_008 idempotency: run twice without errors
- [ ] Test saas_009: verify FK cascade behavior
- [ ] Test saas_010: verify indexes added to org schemas
- [ ] Update README or test docs with test database setup instructions

**Acceptance Criteria:**
- Given a test database, when saas_008 runs, then org 'ics' exists with schema 'org_ics'
- Given saas_008 already ran, when it runs again, then no errors occur (idempotent)
- Given saas_009 runs, when org_settings.updated_by FK is checked, then ON DELETE SET NULL is present
- Given saas_010 runs, when org schema indexes are listed, then all FK columns have indexes
- Given integration tests run in CI, when a migration has syntax error, then tests fail before merge

## Spec Change Log

## Design Notes

**Test structure:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SaaS Migrations Integration', () => {
  let pool: Pool;
  
  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'ics_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    });
    
    // Clean up test database
    await pool.query('DROP SCHEMA IF EXISTS org_ics CASCADE');
    await pool.query('DELETE FROM organizations WHERE slug = $1', ['ics']);
  });
  
  afterAll(async () => {
    await pool.end();
  });
  
  describe('saas_008_create_default_ics_org', () => {
    it('should create ICS organization successfully', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_008_create_default_ics_org.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify org exists
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE slug = 'ics'"
      );
      expect(orgResult.rows).toHaveLength(1);
      expect(orgResult.rows[0].name).toBe('Internal Cinema System');
      
      // Verify schema exists
      const schemaResult = await pool.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'org_ics'"
      );
      expect(schemaResult.rows).toHaveLength(1);
      
      // Verify admin user associated
      const userResult = await pool.query(
        "SELECT * FROM org_ics.users WHERE username = 'admin'"
      );
      expect(userResult.rows.length).toBeGreaterThan(0);
    });
    
    it('should be idempotent (safe to re-run)', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_008_create_default_ics_org.sql'),
        'utf-8'
      );
      
      // Should not throw on second run
      await expect(pool.query(sql)).resolves.not.toThrow();
    });
  });
  
  describe('saas_009_fix_org_settings_fk_cascade', () => {
    it('should add ON DELETE SET NULL to org_settings.updated_by FK', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_009_fix_org_settings_fk_cascade.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify FK constraint exists with ON DELETE SET NULL
      const fkResult = await pool.query(`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname LIKE '%org_settings_updated_by_fkey%'
          AND connamespace = 'org_ics'::regnamespace
      `);
      
      expect(fkResult.rows).toHaveLength(1);
      expect(fkResult.rows[0].confdeltype).toBe('n'); // 'n' = SET NULL
    });
  });
  
  describe('saas_010_add_fk_indexes', () => {
    it('should add indexes to all FK columns', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_010_add_fk_indexes.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify indexes exist
      const indexResult = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'org_ics'
          AND indexname IN (
            'idx_users_role_id',
            'idx_invitations_role_id',
            'idx_invitations_created_by',
            'idx_org_settings_updated_by'
          )
        ORDER BY indexname
      `);
      
      expect(indexResult.rows).toHaveLength(4);
      expect(indexResult.rows.map(r => r.indexname)).toEqual([
        'idx_invitations_created_by',
        'idx_invitations_role_id',
        'idx_org_settings_updated_by',
        'idx_users_role_id',
      ]);
    });
  });
});
```

**Test database setup:**

Option 1: Use existing docker-compose database
```bash
# In docker-compose.yml, ensure test database exists
# Or create manually:
docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"
```

Option 2: Document in README
```markdown
## Running Integration Tests

Integration tests require a PostgreSQL test database:

1. Start the database:
   ```bash
   docker-compose up -d ics-db
   ```

2. Create test database:
   ```bash
   docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"
   ```

3. Run integration tests:
   ```bash
   cd packages/saas
   npm test -- migrations.integration.test.ts
   ```

Environment variables (optional):
- `TEST_DB_HOST` (default: localhost)
- `TEST_DB_PORT` (default: 5432)
- `TEST_DB_NAME` (default: ics_test)
- `TEST_DB_USER` (default: postgres)
- `TEST_DB_PASSWORD` (default: postgres)
```

**Skip integration tests in CI if no database available:**

```typescript
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('SaaS Migrations Integration', () => {
  // ... tests ...
});
```

## Verification

**Commands:**
- `cd packages/saas && npm test -- migrations.integration.test.ts` -- expected: all tests pass
- `docker-compose exec ics-db psql -U postgres -d ics_test -c "\dt org_ics.*"` -- expected: org_ics schema tables exist
- `docker-compose exec ics-db psql -U postgres -d ics_test -c "SELECT * FROM organizations WHERE slug='ics'"` -- expected: 1 row

**Manual checks:**
- Verify test cleans up after itself (can run multiple times)
- Verify test fails if migration has syntax error
- Verify test database is separate from dev database
