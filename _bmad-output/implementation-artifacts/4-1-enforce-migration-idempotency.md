# Story 4.1: Enforce Migration Idempotency Checks in Migrations

Status: done

## Story

As a backend developer,
I want all migrations to check if schema elements exist before creating them,
so that migrations can be re-run safely without errors.

## Acceptance Criteria

1. **Given** a migration adds a new column **When** the migration script executes **Then** the script checks if the column exists before adding it **And** if the column exists, the migration logs "Column already exists, skipping" **And** if the column doesn't exist, the migration adds it and logs "Column added successfully"

2. **Given** a migration creates a new table **When** the migration script executes **Then** the script uses `CREATE TABLE IF NOT EXISTS` **And** the migration succeeds on both fresh and populated databases **And** no duplicate table errors occur

3. **Given** a migration creates an index **When** the migration script executes **Then** the script checks if the index exists before creating it **And** if the index exists, the migration skips creation **And** if the index doesn't exist, the migration creates it

4. **Given** a new migration is created **When** the migration is submitted for code review **Then** the migration includes comments documenting idempotency strategy **And** the migration has been tested against all 4 scenarios **And** test results are included in the PR description

**Test Matrix — all retrofitted migrations must pass:**
- Scenario 1: Fresh DB + run once → SUCCESS
- Scenario 2: Fresh DB + run twice → SUCCESS (no errors on 2nd run)
- Scenario 3: Populated DB + run once → SUCCESS
- Scenario 4: Populated DB + run twice → SUCCESS

## Tasks / Subtasks

- [x] Task 1: Retrofit non-idempotent migrations (AC: 1, 2, 3)
  - [x] 1.1 — `007_seed_default_admin.sql`: confirm this marker migration remains safe and document that actual admin seeding is handled in `server/src/db/migrations.ts`
  - [x] 1.2 — `010_remove_phantom_permissions.sql`: verify current DELETE remains safely re-runnable and document the idempotency strategy
  - [x] 1.3 — `011_add_roles_crud_permissions.sql`: confirm the permission INSERT + description UPDATE remain safely re-runnable; add comment if needed
  - [x] 1.4 — `022_fix_showtime_deduplication.sql`: replace `ADD CONSTRAINT` with `DO $$ IF NOT EXISTS` guard
  - [x] 1.5 — `023_add_scrape_settings.sql`: add `IF NOT EXISTS` guard to `ADD CONSTRAINT` line (column already guarded)
  - [x] 1.6 — Confirm `012`, `015`, `016` are fully idempotent (`ON CONFLICT DO NOTHING` + `DO NOTHING` on role_permissions) — add comments if confirmed
  - [x] 1.7 — Explicitly leave historical duplicate numeric prefixes (`017_*`, `018_*`) unchanged in this story and document why filename-based migration tracking makes renaming unsafe

- [x] Task 2: Add idempotency comments to all retrofitted files (AC: 4)
  - [x] 2.1 — Add header comment block to each changed migration: `-- Idempotency: <strategy>`

- [x] Task 3: Write/extend integration tests for idempotency (AC: 1–4)
  - [x] 3.1 — Add test in `server/src/db/migrations.test.ts` (or new file) covering Scenarios 1–4 for each retrofitted migration
  - [x] 3.2 — Run full suite: `cd server && npm run test:run` green

- [x] Task 4: Verify CI integrity
  - [x] 4.1 — Run `cd server && npx tsc --noEmit` — no type errors
  - [x] 4.2 — Run `cd server && npm run test:run` — all passing
  - [x] 4.3 — Run `cd server && npm run test:integration` — passing (Testcontainers)

## Dev Notes

### Idempotency Patterns (canonical — use these)

**Tables / indexes:**
```sql
CREATE TABLE IF NOT EXISTS ...;
CREATE INDEX IF NOT EXISTS ...;
```

**Columns (PostgreSQL < 9.6 workaround not needed — use directly):**
```sql
ALTER TABLE t ADD COLUMN IF NOT EXISTS col TYPE;
```

**Constraints:**
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'constraint_name' AND table_name = 'table_name'
  ) THEN
    ALTER TABLE table_name ADD CONSTRAINT constraint_name ...;
    RAISE NOTICE 'Constraint added';
  ELSE
    RAISE NOTICE 'Constraint already exists, skipping';
  END IF;
END $$;
```

**Seed data (INSERT):**
```sql
INSERT INTO table (...) VALUES (...) ON CONFLICT (col) DO NOTHING;
```

**Role assignments:**
```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = '...' AND p.name IN (...)
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

**DELETE (already idempotent — no guard needed):** DELETE is safe to run multiple times; no change required for `010`.

### Migration Audit Results

| File | Status | Issue | Fix |
|------|--------|-------|-----|
| 001 | ✅ Idempotent | — | — |
| 002 | ✅ Idempotent | — | — |
| 003 | ✅ Idempotent | — | — |
| 004 | ✅ Idempotent | — | — |
| 005 | ✅ Idempotent | — | — |
| 006 | ✅ Idempotent | — | — |
| 007 | ✅ Safe | Marker migration only; admin seed runs in migration runner | Add clarifying idempotency comment |
| 008 | ✅ Idempotent | — | — |
| 009 | ✅ Idempotent | — | — |
| 010 | ✅ Safe | DELETE is inherently idempotent | Add comment |
| 011 | ✅ Safe | `INSERT ... ON CONFLICT DO NOTHING` + repeatable `UPDATE ... WHERE name = 'roles:read'` | Add clarifying idempotency comment |
| 012 | ✅ Idempotent | `ON CONFLICT DO NOTHING` | Add comment |
| 013 | ✅ Idempotent | — | — |
| 014 | ✅ Idempotent | — | — |
| 015 | ✅ Idempotent | `ON CONFLICT DO NOTHING` | Add comment |
| 016 | ✅ Idempotent | `ON CONFLICT DO NOTHING` | Add comment |
| 017a | ✅ Idempotent | Duplicate prefix ⚠️ | Leave filename unchanged; document tracking caveat |
| 017b | ✅ Idempotent | Duplicate prefix ⚠️ | Leave filename unchanged; document tracking caveat |
| 018a | ✅ Idempotent | Duplicate prefix ⚠️ | Leave filename unchanged; document tracking caveat |
| 018b | ✅ Idempotent | Duplicate prefix ⚠️ | Leave filename unchanged; document tracking caveat |
| 021 | ✅ Idempotent | — | — |
| 022 | 🔴 Non-idempotent | `ADD CONSTRAINT` no guard | `DO $$ IF NOT EXISTS` block |
| 023 | ⚠️ Partial | `ADD COLUMN IF NOT EXISTS` ✅ but `ADD CONSTRAINT` not guarded | `DO $$ IF NOT EXISTS` block |

### Project Structure Notes

- Migration files: `migrations/*.sql` — 25 files currently present, read by `server/src/db/migrations.ts:83` via `readMigrationFile()`
- Migration runner: `server/src/db/migrations.ts` — `applyMigration()` at line 130 applies SQL verbatim via `db.query(sql)`
- No transaction wrapper in runner — migrations must include their own `BEGIN/COMMIT`
- `AUTO_MIGRATE=true` default: migrations run on every server start → idempotency is production-critical
- Duplicate prefix files (`017`, `018`) are both loaded and sorted lexicographically — do not rename historical files in this story because the runner tracks applied migrations by filename in `schema_migrations`

### Rollback Strategy

- **Migration fails during execution:** Transaction auto-rollback (wrap in `BEGIN/COMMIT`)
- **Migration succeeds but breaks app:** Run reverse migration (`DROP COLUMN IF EXISTS`, `DROP CONSTRAINT IF EXISTS`)
- **Data corrupted:** Restore from backup + replay WAL

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md:1138`
- Migration runner: `server/src/db/migrations.ts:130`
- Migrations directory: `migrations/` (23 files, `001`–`023`)
- AGENTS.md: migration auto-apply behaviour, test commands

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

### Completion Notes List

### File List
