# Migration Verification Patterns

This document defines the canonical verification patterns used in all migrations to confirm that DDL statements actually applied the expected schema changes.

## Design Principles

1. **Verification goes inside the `BEGIN/COMMIT` block** — ensures transaction rollback on failure
2. **Use `current_schema()` not hardcoded schema** — works across tenants and test environments
3. **`RAISE EXCEPTION` triggers automatic rollback** — no manual ROLLBACK needed
4. **Seed migrations (INSERT) are self-verifying** — they return row counts; if `ON CONFLICT DO NOTHING` is used, verify with `SELECT COUNT(*)` against expected

## Canonical Patterns

### Table Verification

After `CREATE TABLE IF NOT EXISTS`, verify the table exists:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = '{table_name}'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: table {table_name} was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: table {table_name} exists';
END $$;
```

### Column Verification

After `ADD COLUMN IF NOT EXISTS`, verify the column exists:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '{table_name}'
      AND column_name = '{column_name}'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: column {table_name}.{column_name} was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: column {table_name}.{column_name} exists';
END $$;
```

### Constraint Verification

After `ADD CONSTRAINT`, verify the constraint exists:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = '{constraint_name}'
      AND table_name = '{table_name}'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: constraint {constraint_name} was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: constraint {constraint_name} exists';
END $$;
```

### Index Verification

After `CREATE INDEX IF NOT EXISTS`, verify the index exists:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = '{index_name}'
      AND schemaname = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: index {index_name} was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: index {index_name} exists';
END $$;
```

### Seed Migration Verification (Self-Verifying)

Seed migrations that use `INSERT ... ON CONFLICT DO NOTHING` are self-verifying because PostgreSQL returns the row count. Optional additional check:

```sql
DO $$ DECLARE seed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO seed_count FROM {table_name};
  IF seed_count < {expected_min} THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: seed data missing (found % rows, expected >= %)',
      seed_count, {expected_min};
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: seed data present (% rows)', seed_count;
END $$;
```

## Migration File Coverage

| File | Verifications |
|------|--------------|
| 003_add_users_table.sql | Table: `users` |
| 004_add_app_settings.sql | Table: `app_settings`, Index: `idx_app_settings_updated_at` |
| 005_add_user_roles.sql | Index: `idx_users_role`, Column: `users.role`, Constraint: `users_role_check` |
| 006_fix_app_settings_schema.sql | Column: `app_settings.color_text_primary` |
| 008_permission_based_roles.sql | Tables: `roles`, `permissions`, `role_permissions`, Index: `idx_users_role_id`, Column: `users.role_id` |
| 013_add_cinema_source.sql | Column: `cinemas.source` |
| 014_add_scrape_schedules.sql | Table: `scrape_schedules`, Index: `idx_scrape_schedules_enabled`, Column: `scrape_reports.schedule_id` |
| 022_fix_showtime_deduplication.sql | Constraint: `uq_showtimes_business_key` |
| 023_add_scrape_settings.sql | Columns: `app_settings.scrape_mode`, `app_settings.scrape_days`, Constraints: `valid_scrape_mode`, `valid_scrape_days` |

Seed migrations (007, 009-021) are self-verifying — no additional verification blocks needed.

## Helper Functions

See `migrations/verify_helpers.sql` for reusable SQL functions:
- `verify_table_exists(p_table_name)` → BOOLEAN
- `verify_column_exists(p_table_name, p_column_name)` → BOOLEAN
- `verify_constraint_exists(p_constraint_name, p_table_name)` → BOOLEAN
- `verify_index_exists(p_index_name)` → BOOLEAN

These functions can be loaded before migrations to simplify verification blocks.
