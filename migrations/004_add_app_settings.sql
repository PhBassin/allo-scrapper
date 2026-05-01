-- Migration: Add app_settings table for white-label branding
-- Version: 3.0.0
-- Date: 2026-03-01
-- Description: Creates app_settings table with singleton constraint to store branding configuration
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_app_settings.sql
--
-- Apply this migration:
--   docker compose exec -T ics-db psql -U postgres -d ics < migrations/004_add_app_settings.sql

BEGIN;

-- Create app_settings table if not exists (with FINAL schema matching TypeScript types)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Identity
  site_name TEXT NOT NULL DEFAULT 'Allo-Scrapper',
  logo_base64 TEXT,
  favicon_base64 TEXT,
  
  -- Color palette (hex #RRGGBB)
  color_primary TEXT NOT NULL DEFAULT '#FECC00',
  color_secondary TEXT NOT NULL DEFAULT '#1F2937',
  color_accent TEXT NOT NULL DEFAULT '#F59E0B',
  color_background TEXT NOT NULL DEFAULT '#FFFFFF',
  color_surface TEXT NOT NULL DEFAULT '#F3F4F6',
  color_text_primary TEXT NOT NULL DEFAULT '#111827',
  color_text_secondary TEXT NOT NULL DEFAULT '#6B7280',
  color_success TEXT NOT NULL DEFAULT '#10B981',
  color_error TEXT NOT NULL DEFAULT '#EF4444',
  
  -- Typography
  font_primary TEXT NOT NULL DEFAULT 'Inter',
  font_secondary TEXT NOT NULL DEFAULT 'Roboto',
  
  -- Footer
  footer_text TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
  footer_links JSONB DEFAULT '[]'::jsonb,
  
  -- Email branding (for future notifications)
  email_from_name TEXT DEFAULT 'Allo-Scrapper',
  email_from_address TEXT DEFAULT 'no-reply@allocine-scrapper.com',
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id),
  
  -- Singleton constraint
  CONSTRAINT singleton_check CHECK (id = 1)
);

-- Insert default settings (singleton)
INSERT INTO app_settings (id) 
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at);

-- Verify the table was created
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'app_settings'
          AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: table app_settings was not created';
    END IF;
    RAISE NOTICE 'VERIFICATION PASSED: table app_settings exists';
END $$;

-- Verify index was created
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_app_settings_updated_at'
          AND schemaname = current_schema()
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: index idx_app_settings_updated_at was not created';
    END IF;
    RAISE NOTICE 'VERIFICATION PASSED: index idx_app_settings_updated_at exists';
END $$;

-- Verify singleton constraint
DO $$ 
DECLARE
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO settings_count FROM app_settings;
    IF settings_count = 1 THEN
        RAISE NOTICE 'Singleton verification successful: exactly 1 row exists';
    ELSIF settings_count = 0 THEN
        RAISE EXCEPTION 'Migration verification failed: no default settings row';
    ELSE
        RAISE EXCEPTION 'Migration verification failed: multiple settings rows exist';
    END IF;
END $$;

-- Verify default values and final schema columns
DO $$ 
DECLARE
    settings_row app_settings%ROWTYPE;
BEGIN
    SELECT * INTO settings_row FROM app_settings WHERE id = 1;
    
    -- Verify new schema columns exist
    IF settings_row.color_text_primary IS NULL THEN
        RAISE EXCEPTION 'Schema error: color_text_primary is NULL';
    END IF;
    
    IF settings_row.color_text_secondary IS NULL THEN
        RAISE EXCEPTION 'Schema error: color_text_secondary is NULL';
    END IF;
    
    IF settings_row.color_surface IS NULL THEN
        RAISE EXCEPTION 'Schema error: color_surface is NULL';
    END IF;
    
    IF settings_row.font_primary IS NULL THEN
        RAISE EXCEPTION 'Schema error: font_primary is NULL';
    END IF;
    
    IF settings_row.font_secondary IS NULL THEN
        RAISE EXCEPTION 'Schema error: font_secondary is NULL';
    END IF;
    
    IF settings_row.email_from_address IS NULL THEN
        RAISE EXCEPTION 'Schema error: email_from_address is NULL';
    END IF;
    
    -- Verify core values
    IF settings_row.site_name != 'Allo-Scrapper' THEN
        RAISE EXCEPTION 'Default site_name incorrect: %', settings_row.site_name;
    END IF;
    
    IF settings_row.color_primary != '#FECC00' THEN
        RAISE EXCEPTION 'Default color_primary incorrect: %', settings_row.color_primary;
    END IF;
    
    RAISE NOTICE 'Default values and schema verification successful';
END $$;

COMMIT;

-- Post-migration verification queries
-- Uncomment to verify after migration

-- SELECT * FROM app_settings;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'app_settings' ORDER BY ordinal_position;

-- Rollback instructions:
-- To rollback this migration, run:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_app_settings_updated_at;
-- DROP TABLE IF EXISTS app_settings CASCADE;
-- COMMIT;
