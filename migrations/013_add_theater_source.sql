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

-- Verify the column was added
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'theaters'
          AND column_name = 'source'
          AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: column theaters.source was not created';
    END IF;
    RAISE NOTICE 'VERIFICATION PASSED: column theaters.source exists';
END $$;

COMMIT;
