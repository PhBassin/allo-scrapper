-- Migration script: Neutralize brand-specific references
-- Version: 2.0.1
-- Date: 2026-02-15
-- 
-- This migration renames the 'allocine_url' column to 'source_url' in the films table
-- to use neutral terminology throughout the database schema.
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T db pg_dump -U postgres its > backup_before_neutralize.sql
--
-- Apply this migration:
--   docker compose exec -T db psql -U postgres -d its -f migrations/001_neutralize_references.sql

BEGIN;

-- Check if column exists before renaming
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='films' AND column_name='allocine_url'
    ) THEN
        -- Rename column from allocine_url to source_url
        ALTER TABLE films RENAME COLUMN allocine_url TO source_url;
        RAISE NOTICE 'Column films.allocine_url renamed to films.source_url';
    ELSE
        RAISE NOTICE 'Column films.allocine_url does not exist, skipping rename';
    END IF;
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='films' AND column_name='source_url'
    ) THEN
        RAISE NOTICE 'Migration successful: films.source_url exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: films.source_url does not exist';
    END IF;
END $$;

COMMIT;

-- Post-migration verification queries
-- Uncomment to verify data integrity after migration

-- SELECT COUNT(*) as total_films FROM films;
-- SELECT COUNT(*) as films_with_source_url FROM films WHERE source_url IS NOT NULL;
-- SELECT id, title, source_url FROM films LIMIT 5;
