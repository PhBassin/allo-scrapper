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

-- Verify the column was added
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cinemas'
          AND column_name = 'source'
          AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: column cinemas.source was not created';
    END IF;
    RAISE NOTICE 'VERIFICATION PASSED: column cinemas.source exists';
END $$;

COMMIT;
