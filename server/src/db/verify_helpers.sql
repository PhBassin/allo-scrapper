-- ============================================================================
-- Migration Verification Helper Functions
-- ============================================================================
-- These helper functions provide canonical verification patterns for all
-- DDL operations. They query information_schema (or pg_indexes) to confirm
-- that schema changes were actually applied.
--
-- Usage: Called from within DO $$ blocks inside migration BEGIN/COMMIT,
--        AFTER the DDL statement but BEFORE COMMIT.
--
-- On failure, RAISE EXCEPTION triggers automatic transaction rollback.
-- Uses current_schema() for portability across tenants/test environments.
-- ============================================================================

-- Verify a table exists in the current schema
CREATE OR REPLACE FUNCTION verify_table_exists(p_table_name text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = p_table_name
      AND table_schema = current_schema()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Verify a column exists on a table in the current schema
CREATE OR REPLACE FUNCTION verify_column_exists(p_table_name text, p_column_name text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name
      AND column_name = p_column_name
      AND table_schema = current_schema()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Verify a constraint exists on a table in the current schema
CREATE OR REPLACE FUNCTION verify_constraint_exists(p_constraint_name text, p_table_name text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = p_constraint_name
      AND table_name = p_table_name
      AND table_schema = current_schema()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Verify an index exists in the current schema
CREATE OR REPLACE FUNCTION verify_index_exists(p_index_name text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = p_index_name
      AND schemaname = current_schema()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Canonical Verification Patterns (for reference / inline use)
-- ============================================================================
-- These are the canonical DO $$ blocks to use when verification functions
-- are not pre-loaded. Each pattern queries information_schema, uses
-- current_schema(), RAISE EXCEPTION on failure, and sits inside BEGIN/COMMIT.
--
-- ## Table Verification
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.tables
--     WHERE table_name = '{table_name}'
--       AND table_schema = current_schema()
--   ) THEN
--     RAISE EXCEPTION 'VERIFICATION FAILED: table {table_name} was not created';
--   END IF;
--   RAISE NOTICE 'VERIFICATION PASSED: table {table_name} exists';
-- END $$;
--
-- ## Column Verification
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name = '{table_name}'
--       AND column_name = '{column_name}'
--       AND table_schema = current_schema()
--   ) THEN
--     RAISE EXCEPTION 'VERIFICATION FAILED: column {table_name}.{column_name} was not created';
--   END IF;
--   RAISE NOTICE 'VERIFICATION PASSED: column {table_name}.{column_name} exists';
-- END $$;
--
-- ## Constraint Verification
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.table_constraints
--     WHERE constraint_name = '{constraint_name}'
--       AND table_name = '{table_name}'
--       AND table_schema = current_schema()
--   ) THEN
--     RAISE EXCEPTION 'VERIFICATION FAILED: constraint {constraint_name} was not created';
--   END IF;
--   RAISE NOTICE 'VERIFICATION PASSED: constraint {constraint_name} exists';
-- END $$;
--
-- ## Index Verification
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_indexes
--     WHERE indexname = '{index_name}'
--       AND schemaname = current_schema()
--   ) THEN
--     RAISE EXCEPTION 'VERIFICATION FAILED: index {index_name} was not created';
--   END IF;
--   RAISE NOTICE 'VERIFICATION PASSED: index {index_name} exists';
-- END $$;
--
-- ## Seed / INSERT Verification (Self-Verifying)
-- Seed migrations using INSERT ... ON CONFLICT DO NOTHING are self-verifying.
-- Optional check: SELECT COUNT(*) and assert expected row count.
-- ============================================================================
