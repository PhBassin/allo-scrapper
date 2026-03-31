-- Phase 1: organizations table
-- Run in public schema

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  plan_id      INT REFERENCES plans(id) DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'trial',         -- trial | active | suspended | canceled
  schema_name  TEXT NOT NULL,                         -- 'org_' || slug
  trial_ends_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
