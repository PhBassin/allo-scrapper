-- Migration: Add 'rate_limited' status to scrape_reports
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Check if column exists before adding
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scrape_reports_status_check' 
        AND table_name = 'scrape_reports'
    ) THEN
        ALTER TABLE scrape_reports DROP CONSTRAINT scrape_reports_status_check;
        RAISE NOTICE 'Dropped existing status constraint';
    END IF;
    
    -- Add new constraint with rate_limited status
    ALTER TABLE scrape_reports 
        ADD CONSTRAINT scrape_reports_status_check 
        CHECK (status IN ('running', 'success', 'partial_success', 'failed', 'rate_limited'));
    
    RAISE NOTICE 'Added rate_limited status to scrape_reports';
END $$;

-- Verify the change
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scrape_reports_status_check' 
        AND table_name = 'scrape_reports'
    ) THEN
        RAISE NOTICE 'Migration successful: rate_limited status available';
    ELSE
        RAISE EXCEPTION 'Migration failed: status constraint not found';
    END IF;
END $$;

COMMIT;
