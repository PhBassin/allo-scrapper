-- Add scrape configuration settings to app_settings table
-- These replace the SCRAPE_MODE and SCRAPE_DAYS environment variables
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS scrape_mode TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS scrape_days INTEGER NOT NULL DEFAULT 7;

-- Add constraint to ensure valid scrape_mode values
ALTER TABLE app_settings
  ADD CONSTRAINT valid_scrape_mode CHECK (scrape_mode IN ('weekly', 'from_today', 'from_today_limited'));

-- Add constraint to ensure valid scrape_days range (1-14)
ALTER TABLE app_settings
  ADD CONSTRAINT valid_scrape_days CHECK (scrape_days >= 1 AND scrape_days <= 14);
