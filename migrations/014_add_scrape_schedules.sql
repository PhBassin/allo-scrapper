-- Migration 014: Add scrape_schedules table
-- Stores configurable scrape job schedules for the cron scraper.
-- Supports custom cron expressions and enables/disables individual schedules.

BEGIN;

-- Create scrape_schedules table
CREATE TABLE IF NOT EXISTS scrape_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  target_cinemas JSONB, -- Array of cinema IDs to scrape (null = all)
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT, -- 'success', 'failed', 'partial_success'
  UNIQUE(name)
);

-- Index for finding enabled schedules
CREATE INDEX IF NOT EXISTS idx_scrape_schedules_enabled ON scrape_schedules(enabled);

-- Index for ordering by name
CREATE INDEX IF NOT EXISTS idx_scrape_schedules_name ON scrape_schedules(name);

-- Add created_by and updated_by columns to scrape_reports for tracking
ALTER TABLE scrape_reports ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES scrape_schedules(id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_scrape_schedules_updated_at ON scrape_schedules;
CREATE TRIGGER update_scrape_schedules_updated_at
  BEFORE UPDATE ON scrape_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'scrape_schedules'
  ) THEN
    RAISE NOTICE 'Migration successful: scrape_schedules table created';
  ELSE
    RAISE EXCEPTION 'Migration failed: scrape_schedules table not created';
  END IF;
END $$;

COMMIT;
