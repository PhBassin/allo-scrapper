-- Phase 1: plans table
-- Run in public schema

CREATE TABLE IF NOT EXISTS plans (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,                -- Free, Starter, Pro, Enterprise
  max_cinemas           INT,                          -- NULL = unlimited
  max_users             INT,
  max_scrapes_per_month INT,
  scrape_frequency_min  INT,                          -- minimum interval between scrapes
  price_monthly_cents   INT NOT NULL DEFAULT 0,
  price_yearly_cents    INT NOT NULL DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  features              JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Seed default plans
INSERT INTO plans (name, max_cinemas, max_users, max_scrapes_per_month, scrape_frequency_min, price_monthly_cents, price_yearly_cents)
VALUES
  ('Free',       1,  1,   4,   10080, 0,      0),       -- 7 days minimum
  ('Starter',    5,  3,   20,  2880,  1900,   18000),   -- 2 days minimum
  ('Pro',        20, 10,  100, 360,   4900,   47000),   -- 6 hours minimum
  ('Enterprise', NULL, NULL, NULL, 60, 0, 0)            -- 1 hour minimum, custom pricing
ON CONFLICT DO NOTHING;
