-- Migration: Add source column to cinemas table for strategy pattern support
-- Issue: #452
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='cinemas' AND column_name='source'
    ) THEN
        -- Add source column with default value
        ALTER TABLE cinemas ADD COLUMN source VARCHAR(50) DEFAULT 'allocine';
        RAISE NOTICE 'Column cinemas.source added successfully';
    ELSE
        RAISE NOTICE 'Column cinemas.source already exists, skipping';
    END IF;
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='cinemas' AND column_name='source'
    ) THEN
        RAISE NOTICE 'Migration successful: cinemas.source exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: cinemas.source does not exist';
    END IF;
END $$;

COMMIT;
