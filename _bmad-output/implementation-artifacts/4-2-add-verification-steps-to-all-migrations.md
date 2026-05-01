# Story 4.2: Add Verification Steps to All Migrations

Status: done

## Story

As a database administrator,
I want migrations to include verification steps that confirm schema changes,
so that migration failures are detected immediately.

## Acceptance Criteria

1. **Given** a migration adds a column **When** the migration completes **Then** a verification step queries `information_schema.columns` **And** if the column exists, the migration logs "Migration successful" **And** if the column is missing, the migration raises an exception

2. **Given** a migration creates a table **When** the migration completes **Then** a verification step queries `information_schema.tables` **And** if the table exists, the migration logs "Table created successfully" **And** if the table is missing, the migration raises an exception

3. **Given** a migration verification fails **When** the exception is raised **Then** the migration transaction is rolled back **And** the database state is unchanged **And** the failure is logged with detailed error context

## Tasks / Subtasks

- [x] Task 1: Design verification pattern and helper utilities (AC: 1, 2, 3)
  - [x] 1.1 — Define canonical verification pattern per DDL type (CREATE TABLE, ADD COLUMN, ADD CONSTRAINT, CREATE INDEX, INSERT/seed)
  - [x] 1.2 — Create helper file `migrations/verify_helpers.sql` with reusable verification functions
  - [x] 1.3 — Document the pattern in a `migrations/VERIFICATION_PATTERNS.md` reference

- [x] Task 2: Retrofit verification steps into all existing migrations (AC: 1, 2)
  - [x] 2.1 — Add column verification: `006_fix_app_settings_schema`, `013_add_cinema_source`, `023_add_scrape_settings`, `005_add_user_roles`, `008_permission_based_roles`, `014_add_scrape_schedules`
  - [x] 2.2 — Add table verification: `003_add_users_table`, `004_add_app_settings`, `008_permission_based_roles`, `014_add_scrape_schedules`
  - [x] 2.3 — Add constraint verification: `022_fix_showtime_deduplication`, `023_add_scrape_settings`, `005_add_user_roles`
  - [x] 2.4 — Add index verification: `004_add_app_settings`, `005_add_user_roles`, `008_permission_based_roles`, `014_add_scrape_schedules`
  - [x] 2.5 — Document self-verifying seed migrations (INSERT returns row count): 007, 009, 010, 011, 012, 015, 016, 017, 018, 019, 020, 021

- [x] Task 3: Write integration tests for verification failure scenarios (AC: 3)
  - [x] 3.1 — Test: verification raises on missing column after ADD COLUMN
  - [x] 3.2 — Test: verification raises on missing table after CREATE TABLE
  - [x] 3.3 — Test: transaction rollback confirmed when verification fails
  - [x] 3.4 — Test: verification passes on idempotent re-run (2nd execution)
  - [x] 3.5 — Run full suite: `cd server && npm run test:run` green

- [x] Task 4: Update migration template (if exists) or AGENTS.md
  - [x] 4.1 — Add verification step as mandatory section in migration template
  - [x] 4.2 — Update AGENTS.md migration conventions if needed

- [ ] Task 5: CI validation
  - [ ] 5.1 — `cd server && npx tsc --noEmit` green
  - [ ] 5.2 — `cd server && npm run test:run` green
  - [ ] 5.3 — `cd server && npm run test:integration` green (Testcontainers)

## Dev Notes

### Verification Pattern (canonical — use these)

The pattern follows Story 4.1's idempotency guards. After each DDL statement, add a verification block that queries `information_schema` and raises if the expected state is not found.

**Column verification:**
```sql
-- Verify column was added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_name'
      AND column_name = 'column_name'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: column table_name.column_name was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: column table_name.column_name exists';
END $$;
```

**Table verification:**
```sql
-- Verify table was created
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'table_name'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: table table_name was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: table table_name exists';
END $$;
```

**Constraint verification:**
```sql
-- Verify constraint was added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'constraint_name'
      AND table_name = 'table_name'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: constraint constraint_name was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: constraint constraint_name exists';
END $$;
```

**Index verification:**
```sql
-- Verify index was created
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'index_name'
      AND schemaname = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: index index_name was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: index index_name exists';
END $$;
```

### Key Design Rules

1. **Verification goes inside the `BEGIN/COMMIT` block** — ensures transaction rollback on failure
2. **Use `current_schema()` not hardcoded schema** — works across tenants and test environments
3. **`RAISE EXCEPTION` triggers automatic rollback** — no manual ROLLBACK needed
4. **Seed migrations (INSERT) are self-verifying** — they return row counts; if `ON CONFLICT DO NOTHING` is used, verify with `SELECT COUNT(*)` against expected

### Migration Files to Modify

All modifications add verification blocks AFTER existing statements but BEFORE `COMMIT`:

| File | DDL Operations | Verification Needed |
|---|---|---|
| `003_add_users_table.sql` | CREATE TABLE | Table verification |
| `004_add_app_settings.sql` | CREATE TABLE, CREATE INDEX, INSERT | Table + index verification |
| `005_add_user_roles.sql` | CREATE INDEX, ADD COLUMN, ADD CONSTRAINT | Index + column + constraint |
| `006_fix_app_settings_schema.sql` | ADD COLUMN, DROP | Column verification |
| `008_permission_based_roles.sql` | CREATE TABLE, CREATE INDEX, ADD COLUMN, INSERT | Table + index + column |
| `009_add_roles_permission.sql` | INSERT (seed) | Self-verifying (row count) |
| `013_add_cinema_source.sql` | ADD COLUMN | Column verification |
| `014_add_scrape_schedules.sql` | CREATE TABLE, CREATE INDEX, ADD COLUMN, INSERT | Table + index + column |
| `022_fix_showtime_deduplication.sql` | DELETE, ADD CONSTRAINT | Constraint verification |
| `023_add_scrape_settings.sql` | ADD COLUMN, ADD CONSTRAINT | Column + constraint verification |

Seed-only migrations are self-verifying via row counts: 007, 010 (DELETE, inherently idempotent), 011, 012, 015, 016, 017a, 017b, 018a, 018b, 019, 020, 021.

### Existing Infrastructure to Reuse

- **`server/src/db/migrations.ts`** — `applyMigration()` at line 130 applies SQL via `db.query()`. Already has `verifyChecksums()` (line 164) for integrity checks. Verification `RAISE EXCEPTION` errors will be caught as query errors.
- **`server/src/db/migrations-idempotency.integration.test.ts`** — existing integration test from Story 4.1. Extend with verification failure scenarios.
- **`server/src/db/migrations.test.ts`** — unit tests for migration functions. Add verification-specific unit tests here.

### Project Structure Notes

- Migration files: `migrations/*.sql` — verification blocks added inline
- Migration runner: `server/src/db/migrations.ts:130` — `applyMigration()` applies SQL verbatim; `RAISE EXCEPTION` is caught as a query error and logged via `logger.error('Migration failed', ...)`
- No transaction wrapper in runner — migrations must include their own `BEGIN/COMMIT`
- `AUTO_MIGRATE=true` default — verification failures on startup will prevent server from booting, which is the desired behavior (fail-fast on corrupted schema)
- Helper file location: `migrations/verify_helpers.sql` is optional but recommended for reusability; if created, it must be loaded before migrations via `readMigrationFile()` or embedded with `\i`
- Story 4.1 established idempotency patterns — this story adds verification on top of those patterns without modifying them

### Rollback Strategy

**Scenario 1: Verification fails (schema element missing)**
- **Action:** Automatic transaction rollback (RAISE EXCEPTION triggers ROLLBACK)
- **Validation:** Schema state verified unchanged
- **Downtime:** 0 minutes (atomic transaction)

**Scenario 2: Verification passes but post-deployment issues occur**
- **Action:** Same as Story 4.1 Scenario 2 (reverse migration)
- **Validation:** Verification steps in reverse migration confirm cleanup
- **Downtime:** 2-5 minutes

### Existing Story 4.1 Patterns to Reuse

- Idempotency patterns: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ IF NOT EXISTS` for constraints
- Migration audit results: all 23 migrations are now idempotent or safe
- Transaction wrapping: `BEGIN` / `COMMIT` pattern
- Comment conventions: `-- Migration: title`, `-- Idempotency: strategy`, `-- Version: x.y.z`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md:1124`
- Story 4.1 (idempotency patterns): `_bmad-output/implementation-artifacts/4-1-enforce-migration-idempotency.md`
- Migration runner: `server/src/db/migrations.ts:130`
- Example migration with structure: `migrations/022_fix_showtime_deduplication.sql`
- AGENTS.md: migration auto-apply behaviour, test commands
- PostgreSQL docs: `information_schema` views for columns, tables, constraints

## Dev Agent Record

### Agent Model Used

_(to be filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List
