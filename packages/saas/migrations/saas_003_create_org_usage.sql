-- Migration: Create org_usage table for quota tracking
-- Idempotent: safe to run on fresh install or existing DB

BEGIN;

CREATE TABLE IF NOT EXISTS org_usage (
  id            SERIAL PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric        VARCHAR(50) NOT NULL,
  value         INTEGER NOT NULL DEFAULT 0,
  period_start  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (org_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_org_usage_org_id ON org_usage (org_id);

COMMIT;
