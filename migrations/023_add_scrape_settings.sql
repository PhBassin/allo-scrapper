-- Add scrape configuration settings to app_settings table
-- Idempotency: Safe (ADD COLUMN IF NOT EXISTS, constraints guarded by DO $$ IF NOT EXISTS)
-- These replace the SCRAPE_MODE and SCRAPE_DAYS environment variables
BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS scrape_mode TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS scrape_days INTEGER NOT NULL DEFAULT 7;

-- Add constraint to ensure valid scrape_mode values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_scrape_mode' AND table_name = 'app_settings'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT valid_scrape_mode CHECK (scrape_mode IN ('weekly', 'from_today', 'from_today_limited'));
    RAISE NOTICE 'Constraint valid_scrape_mode added';
  ELSE
    RAISE NOTICE 'Constraint valid_scrape_mode already exists, skipping';
  END IF;
END $$;

-- Add constraint to ensure valid scrape_days range (1-14)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_scrape_days' AND table_name = 'app_settings'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT valid_scrape_days CHECK (scrape_days >= 1 AND scrape_days <= 14);
    RAISE NOTICE 'Constraint valid_scrape_days added';
  ELSE
    RAISE NOTICE 'Constraint valid_scrape_days already exists, skipping';
  END IF;
END $$;

-- Verify columns were added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'scrape_mode'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: column app_settings.scrape_mode was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: column app_settings.scrape_mode exists';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'scrape_days'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: column app_settings.scrape_days was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: column app_settings.scrape_days exists';
END $$;

-- Verify constraints were added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_scrape_mode'
      AND table_name = 'app_settings'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: constraint valid_scrape_mode was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: constraint valid_scrape_mode exists';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_scrape_days'
      AND table_name = 'app_settings'
      AND table_schema = current_schema()
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: constraint valid_scrape_days was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: constraint valid_scrape_days exists';
END $$;

COMMIT;
