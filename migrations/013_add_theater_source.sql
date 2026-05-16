-- Migration: Add source column to theaters table for strategy pattern support
-- Issue: #452
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='theaters' AND column_name='source'
    ) THEN
        -- Add source column with default value
        ALTER TABLE theaters ADD COLUMN source VARCHAR(50) DEFAULT 'allocine';
        RAISE NOTICE 'Column theaters.source added successfully';
    ELSE
        RAISE NOTICE 'Column theaters.source already exists, skipping';
    END IF;
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='theaters' AND column_name='source'
    ) THEN
        RAISE NOTICE 'Migration successful: theaters.source exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: theaters.source does not exist';
    END IF;
END $$;

COMMIT;
