-- Migration: Add scrape_attempts table for granular per-cinema/per-date tracking
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Add parent_report_id to scrape_reports for tracking resume chains
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='scrape_reports' AND column_name='parent_report_id'
    ) THEN
        ALTER TABLE scrape_reports 
        ADD COLUMN parent_report_id INTEGER REFERENCES scrape_reports(id);
        RAISE NOTICE 'Column scrape_reports.parent_report_id added successfully';
    ELSE
        RAISE NOTICE 'Column scrape_reports.parent_report_id already exists, skipping';
    END IF;
END $$;

-- Create scrape_attempts table for per-cinema/per-date tracking
CREATE TABLE IF NOT EXISTS scrape_attempts (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES scrape_reports(id) ON DELETE CASCADE,
    cinema_id TEXT NOT NULL REFERENCES cinemas(id),
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'success', 'failed', 'rate_limited', 'not_attempted')
    ),
    error_type TEXT,
    error_message TEXT,
    http_status_code INTEGER,
    films_scraped INTEGER DEFAULT 0,
    showtimes_scraped INTEGER DEFAULT 0,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(report_id, cinema_id, date)
);

-- Add indexes for performance (check if they exist first)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'scrape_attempts' AND indexname = 'idx_scrape_attempts_report_id'
    ) THEN
        CREATE INDEX idx_scrape_attempts_report_id ON scrape_attempts(report_id);
        RAISE NOTICE 'Index idx_scrape_attempts_report_id created successfully';
    ELSE
        RAISE NOTICE 'Index idx_scrape_attempts_report_id already exists, skipping';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'scrape_attempts' AND indexname = 'idx_scrape_attempts_report_status'
    ) THEN
        CREATE INDEX idx_scrape_attempts_report_status ON scrape_attempts(report_id, status);
        RAISE NOTICE 'Index idx_scrape_attempts_report_status created successfully';
    ELSE
        RAISE NOTICE 'Index idx_scrape_attempts_report_status already exists, skipping';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'scrape_attempts' AND indexname = 'idx_scrape_attempts_cinema_date'
    ) THEN
        CREATE INDEX idx_scrape_attempts_cinema_date ON scrape_attempts(cinema_id, date);
        RAISE NOTICE 'Index idx_scrape_attempts_cinema_date created successfully';
    ELSE
        RAISE NOTICE 'Index idx_scrape_attempts_cinema_date already exists, skipping';
    END IF;
END $$;

-- Verify the migration
DO $$ 
BEGIN
    -- Verify parent_report_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='scrape_reports' AND column_name='parent_report_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: scrape_reports.parent_report_id does not exist';
    END IF;
    
    -- Verify scrape_attempts table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name='scrape_attempts'
    ) THEN
        RAISE EXCEPTION 'Migration failed: scrape_attempts table does not exist';
    END IF;
    
    RAISE NOTICE 'Migration 018 successful: scrape_attempts table and parent_report_id column verified';
END $$;

COMMIT;
