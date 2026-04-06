-- Migration: Fix org_usage schema — replace EAV model with columnar model
-- The original saas_003 created an EAV table (org_id, metric, value, period_start).
-- QuotaService requires a columnar schema with named counters and a monthly key.
-- This migration is idempotent: safe to run on fresh install or existing DB.

BEGIN;

-- Drop the EAV table if it exists (safe at this stage — no production data yet)
DROP TABLE IF EXISTS org_usage;

-- Recreate with the columnar schema expected by QuotaService
CREATE TABLE IF NOT EXISTS org_usage (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month           DATE         NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  cinemas_count   INTEGER      NOT NULL DEFAULT 0,
  users_count     INTEGER      NOT NULL DEFAULT 0,
  scrapes_count   INTEGER      NOT NULL DEFAULT 0,
  api_calls_count INTEGER      NOT NULL DEFAULT 0,
  UNIQUE (org_id, month)
);

CREATE INDEX IF NOT EXISTS idx_org_usage_org_id ON org_usage (org_id);
CREATE INDEX IF NOT EXISTS idx_org_usage_month  ON org_usage (org_id, month);

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'org_usage'
  ) THEN
    RAISE NOTICE 'Migration saas_005 successful: org_usage table exists with columnar schema';
  ELSE
    RAISE EXCEPTION 'Migration saas_005 failed: org_usage table not found';
  END IF;
END $$;

COMMIT;
