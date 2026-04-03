-- Migration: Create plans table for SaaS tier management
-- Idempotent: safe to run on fresh install or existing DB

BEGIN;

CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50) NOT NULL UNIQUE,
  max_cinemas   INTEGER NOT NULL DEFAULT 3,
  max_users     INTEGER NOT NULL DEFAULT 5,
  max_scrapes_per_day INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans (idempotent)
INSERT INTO plans (name, max_cinemas, max_users, max_scrapes_per_day)
VALUES
  ('free',       3,    5,   10),
  ('starter',   10,   10,   50),
  ('pro',       50,   50,  500),
  ('enterprise', 999, 999, 9999)
ON CONFLICT (name) DO NOTHING;

COMMIT;
