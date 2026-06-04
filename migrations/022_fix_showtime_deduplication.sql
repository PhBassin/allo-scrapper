-- Migration: Fix showtime deduplication
-- Version: 4.7.0
-- Date: 2026-03-30
--
-- PROBLEM: Showtime IDs were generated from Allociné's ephemeral internalId
-- (data-showtime-id), which changes on every HTTP request. This caused a new
-- row to be inserted for the same physical screening on each scrape run.
--
-- FIX: Showtime IDs are now deterministic:
--   {theater_id}_{movie_id}_{date}_{time}_{version}_{format}
-- This ensures ON CONFLICT(id) correctly deduplicates on re-scrapes.
--
-- This migration:
--   1. Removes existing duplicate showtimes (keeps one per business key)
--   2. Adds a UNIQUE constraint on (theater_id, movie_id, date, time, version, format)
--      as an additional safety net
--
-- IMPORTANT: Backup your database before running!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_022.sql
--
-- Apply:
--   docker compose exec -T ics-db psql -U postgres -d ics -f migrations/022_fix_showtime_deduplication.sql

BEGIN;

-- Step 1: Remove duplicate showtimes
-- Keep the row with the lowest id (arbitrary but consistent) for each business key.
-- A "duplicate" is defined as same (theater_id, movie_id, date, time, version, format).
DELETE FROM showtimes
WHERE id NOT IN (
  SELECT MIN(id)
  FROM showtimes
  GROUP BY theater_id, movie_id, date, time, version, COALESCE(format, '')
);

-- Step 2: Add UNIQUE constraint on business key fields as a safety net.
-- This prevents future duplicates even if a bug re-introduces non-deterministic IDs.
ALTER TABLE showtimes
  ADD CONSTRAINT uq_showtimes_business_key
  UNIQUE (theater_id, movie_id, date, time, version, format);

COMMIT;

-- Post-migration verification
-- SELECT COUNT(*) FROM showtimes;
-- SELECT theater_id, movie_id, date, time, version, format, COUNT(*) as cnt
--   FROM showtimes
--   GROUP BY theater_id, movie_id, date, time, version, format
--   HAVING COUNT(*) > 1;
