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

-- Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Identité
  site_name TEXT NOT NULL DEFAULT 'Allo-Scrapper',
  logo_base64 TEXT,
  favicon_base64 TEXT,
  
  -- Palette de couleurs (hex #RRGGBB)
  color_primary TEXT NOT NULL DEFAULT '#FECC00',
  color_secondary TEXT NOT NULL DEFAULT '#1F2937',
  color_accent TEXT NOT NULL DEFAULT '#3B82F6',
  color_background TEXT NOT NULL DEFAULT '#F9FAFB',
  color_text TEXT NOT NULL DEFAULT '#111827',
  color_link TEXT NOT NULL DEFAULT '#2563EB',
  color_success TEXT NOT NULL DEFAULT '#10B981',
  color_warning TEXT NOT NULL DEFAULT '#F59E0B',
  color_error TEXT NOT NULL DEFAULT '#EF4444',
  
  -- Typographies
  font_family_heading TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
  font_family_body TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
  
  -- Footer
  footer_text TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
  footer_copyright TEXT DEFAULT '{site_name} © {year}',
  footer_links JSONB DEFAULT '[]'::jsonb,
  
  -- Email branding (pour futures notifications)
  email_from_name TEXT DEFAULT 'Allo-Scrapper',
  email_header_color TEXT DEFAULT '#FECC00',
  email_footer_text TEXT,
  
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
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'app_settings'
    ) THEN
        RAISE NOTICE 'Migration successful: app_settings table exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: app_settings table does not exist';
    END IF;
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

-- Verify default values
DO $$ 
DECLARE
    settings_row app_settings%ROWTYPE;
BEGIN
    SELECT * INTO settings_row FROM app_settings WHERE id = 1;
    
    IF settings_row.site_name != 'Allo-Scrapper' THEN
        RAISE EXCEPTION 'Default site_name incorrect: %', settings_row.site_name;
    END IF;
    
    IF settings_row.color_primary != '#FECC00' THEN
        RAISE EXCEPTION 'Default color_primary incorrect: %', settings_row.color_primary;
    END IF;
    
    IF settings_row.color_secondary != '#1F2937' THEN
        RAISE EXCEPTION 'Default color_secondary incorrect: %', settings_row.color_secondary;
    END IF;
    
    RAISE NOTICE 'Default values verification successful';
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
