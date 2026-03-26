-- Migration 019: Add permission category labels table
-- Date: 2026-03-26
-- Description: Create table to store multilingual display labels for permission categories
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- 1. Create permission_category_labels table
CREATE TABLE IF NOT EXISTS permission_category_labels (
  id SERIAL PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  label_en TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create index on category_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_permission_category_labels_key ON permission_category_labels(category_key);

-- 3. Seed category labels (idempotent)
INSERT INTO permission_category_labels (category_key, label_en, label_fr) VALUES
  ('users', 'Users', 'Utilisateurs'),
  ('roles', 'Roles', 'Rôles'),
  ('scraper', 'Scraping', 'Scraping'),
  ('schedules', 'Schedules', 'Planification'),
  ('cinemas', 'Cinemas', 'Cinémas'),
  ('settings', 'Settings', 'Paramètres'),
  ('reports', 'Reports', 'Rapports'),
  ('system', 'System', 'Système'),
  ('security', 'Security', 'Sécurité')
ON CONFLICT (category_key) DO NOTHING;

-- 4. Verify all 9 category labels were created
DO $$
DECLARE
  label_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO label_count
  FROM permission_category_labels;
  
  IF label_count >= 9 THEN
    RAISE NOTICE 'Migration successful: Permission category labels table created with % entries', label_count;
  ELSE
    RAISE EXCEPTION 'Migration failed: Expected at least 9 category labels, found %', label_count;
  END IF;
END $$;

COMMIT;
