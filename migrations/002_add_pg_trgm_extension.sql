-- Migration: Enable pg_trgm extension for fuzzy text search
-- Version: 2.1.0
-- Date: 2026-02-21
-- Description: Adds PostgreSQL trigram extension for fuzzy film title search

BEGIN;

-- Enable pg_trgm extension for similarity calculations
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on films.title for fast trigram similarity searches
-- This index improves performance of similarity() and ILIKE queries
CREATE INDEX IF NOT EXISTS idx_films_title_trgm 
  ON films USING gin(title gin_trgm_ops);

-- Verify the extension was created
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'pg_trgm'
    ) THEN
        RAISE NOTICE 'pg_trgm extension enabled successfully';
    ELSE
        RAISE EXCEPTION 'Failed to enable pg_trgm extension';
    END IF;
END $$;

COMMIT;
