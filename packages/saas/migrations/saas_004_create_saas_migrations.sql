-- Migration: Create saas_migrations tracking table
-- Allows the SaaS plugin to track which org-schema bootstrap scripts have run
-- Idempotent: safe to run on fresh install or existing DB

BEGIN;

CREATE TABLE IF NOT EXISTS saas_migrations (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
