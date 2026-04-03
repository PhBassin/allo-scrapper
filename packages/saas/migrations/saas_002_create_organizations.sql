-- Migration: Create organizations table
-- Idempotent: safe to run on fresh install or existing DB

BEGIN;

CREATE TABLE IF NOT EXISTS organizations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(50)  NOT NULL UNIQUE,
  plan_id       INTEGER      NOT NULL DEFAULT 1 REFERENCES plans(id),
  schema_name   VARCHAR(63)  NOT NULL UNIQUE,
  status        VARCHAR(20)  NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('trial', 'active', 'suspended', 'canceled')),
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug   ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations (status);

COMMIT;
