-- Phase 1: org_usage and org_migrations tracking tables
-- Run in public schema

CREATE TABLE IF NOT EXISTS org_usage (
  id              SERIAL PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month           DATE NOT NULL,                      -- first day of month
  cinemas_count   INT NOT NULL DEFAULT 0,
  scrapes_count   INT NOT NULL DEFAULT 0,
  api_calls_count BIGINT NOT NULL DEFAULT 0,
  UNIQUE (org_id, month)
);

-- Tracks which org-level migrations have been applied per org schema
CREATE TABLE IF NOT EXISTS org_migrations (
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  migration_name TEXT NOT NULL,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, migration_name)
);
