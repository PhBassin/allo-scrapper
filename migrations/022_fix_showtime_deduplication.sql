-- Migration: Fix showtime deduplication
-- Idempotency: Safe (DELETE is idempotent, UNIQUE constraint guarded by DO $$ IF NOT EXISTS)
-- Version: 4.7.0
-- Date: 2026-03-30
--
-- PROBLEM: Showtime IDs were generated from Allociné's ephemeral internalId
-- (data-showtime-id), which changes on every HTTP request. This caused a new
-- row to be inserted for the same physical screening on each scrape run.
--
-- FIX: Showtime IDs are now deterministic:
--   {cinema_id}_{film_id}_{date}_{time}_{version}_{format}
-- This ensures ON CONFLICT(id) correctly deduplicates on re-scrapes.
--
-- This migration:
--   1. Removes existing duplicate showtimes (keeps one per business key)
--   2. Adds a UNIQUE constraint on (cinema_id, film_id, date, time, version, format)
--      as an additional safety net
--
-- IMPORTANT: Backup your database before running!
--   docker compose exec -T db pg_dump -U postgres its > backup_before_022.sql
--
-- Apply:
--   docker compose exec -T db psql -U postgres -d its -f migrations/022_fix_showtime_deduplication.sql

BEGIN;

-- Step 1: Remove duplicate showtimes
-- Keep the row with the lowest id (arbitrary but consistent) for each business key.
-- A "duplicate" is defined as same (cinema_id, film_id, date, time, version, format).
DELETE FROM showtimes
WHERE id NOT IN (
  SELECT MIN(id)
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, version, COALESCE(format, '')
);

-- Step 2: Add UNIQUE constraint on business key fields as a safety net.
-- This prevents future duplicates even if a bug re-introduces non-deterministic IDs.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_showtimes_business_key' AND table_name = 'showtimes'
  ) THEN
    ALTER TABLE showtimes
      ADD CONSTRAINT uq_showtimes_business_key
      UNIQUE (cinema_id, film_id, date, time, version, format);
    RAISE NOTICE 'Constraint uq_showtimes_business_key added';
  ELSE
    RAISE NOTICE 'Constraint uq_showtimes_business_key already exists, skipping';
  END IF;
END $$;

-- Verify constraint was added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_showtimes_business_key'
      AND table_name = 'showtimes'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: constraint uq_showtimes_business_key was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: constraint uq_showtimes_business_key exists';
END $$;

-- Add partial unique index for rows where format IS NULL
-- PostgreSQL treats NULLs as distinct in UNIQUE constraints, so the main
-- constraint won't catch duplicates with NULL format. This index fills that gap.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_showtimes_business_key_null_format'
      AND schemaname = current_schema()
  ) THEN
    CREATE UNIQUE INDEX uq_showtimes_business_key_null_format
      ON showtimes (cinema_id, film_id, date, time, version)
      WHERE format IS NULL;
    RAISE NOTICE 'Index uq_showtimes_business_key_null_format created';
  ELSE
    RAISE NOTICE 'Index uq_showtimes_business_key_null_format already exists, skipping';
  END IF;
END $$;

-- Verify the NULL-format index was created
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_showtimes_business_key_null_format'
      AND schemaname = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: index uq_showtimes_business_key_null_format was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: index uq_showtimes_business_key_null_format exists';
END $$;

COMMIT;

-- Post-migration verification
-- SELECT COUNT(*) FROM showtimes;
-- SELECT cinema_id, film_id, date, time, version, format, COUNT(*) as cnt
--   FROM showtimes
--   GROUP BY cinema_id, film_id, date, time, version, format
--   HAVING COUNT(*) > 1;
