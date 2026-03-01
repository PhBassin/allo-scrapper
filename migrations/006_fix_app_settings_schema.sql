-- Migration: Fix app_settings schema to match TypeScript types
-- Version: 3.0.1
-- Date: 2026-03-01
-- Description: Aligns database columns with server/src/types/settings.ts
--
-- Changes:
--   - Rename color_text -> color_text_primary
--   - Add color_text_secondary, color_surface
--   - Rename font_family_heading -> font_primary
--   - Rename font_family_body -> font_secondary
--   - Remove color_link, color_warning, footer_copyright, email_header_color, email_footer_text
--   - Add email_from_address
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_schema_fix.sql
--
-- Apply this migration:
--   docker compose exec -T ics-db psql -U postgres -d ics < migrations/006_fix_app_settings_schema.sql

BEGIN;

-- Add new columns
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS color_text_primary TEXT NOT NULL DEFAULT '#111827';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS color_text_secondary TEXT NOT NULL DEFAULT '#6B7280';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS color_surface TEXT NOT NULL DEFAULT '#F3F4F6';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS font_primary TEXT NOT NULL DEFAULT 'Inter';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS font_secondary TEXT NOT NULL DEFAULT 'Roboto';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_from_address TEXT DEFAULT 'no-reply@allocine-scrapper.com';

-- Copy values from old columns to new columns (with IF EXISTS guards)
DO $$
BEGIN
  -- Only perform updates if old columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='app_settings' AND column_name='color_text'
  ) THEN
    UPDATE app_settings SET 
      color_text_primary = color_text,
      font_primary = font_family_heading,
      font_secondary = font_family_body
    WHERE id = 1;
    RAISE NOTICE 'Copied values from old columns to new columns';
  ELSE
    RAISE NOTICE 'Old columns not found (fresh install), skipping value copy';
  END IF;
END $$;

-- Drop old columns
ALTER TABLE app_settings DROP COLUMN IF EXISTS color_text;
ALTER TABLE app_settings DROP COLUMN IF EXISTS color_link;
ALTER TABLE app_settings DROP COLUMN IF EXISTS color_warning;
ALTER TABLE app_settings DROP COLUMN IF EXISTS font_family_heading;
ALTER TABLE app_settings DROP COLUMN IF EXISTS font_family_body;
ALTER TABLE app_settings DROP COLUMN IF EXISTS footer_copyright;
ALTER TABLE app_settings DROP COLUMN IF EXISTS email_header_color;
ALTER TABLE app_settings DROP COLUMN IF EXISTS email_footer_text;

-- Verify footer_links is a valid JSONB array (not empty string)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_settings WHERE id = 1) THEN
    UPDATE app_settings 
    SET footer_links = '[]'::jsonb 
    WHERE id = 1 AND (footer_links IS NULL OR footer_links::text = '');
    RAISE NOTICE 'Verified footer_links is valid JSONB';
  END IF;
END $$;

-- Verify the migration
DO $$ 
DECLARE
    settings_row app_settings%ROWTYPE;
BEGIN
    SELECT * INTO settings_row FROM app_settings WHERE id = 1;
    
    -- Check new columns exist
    IF settings_row.color_text_primary IS NULL THEN
        RAISE EXCEPTION 'Migration failed: color_text_primary is NULL';
    END IF;
    
    IF settings_row.color_text_secondary IS NULL THEN
        RAISE EXCEPTION 'Migration failed: color_text_secondary is NULL';
    END IF;
    
    IF settings_row.color_surface IS NULL THEN
        RAISE EXCEPTION 'Migration failed: color_surface is NULL';
    END IF;
    
    IF settings_row.font_primary IS NULL THEN
        RAISE EXCEPTION 'Migration failed: font_primary is NULL';
    END IF;
    
    IF settings_row.font_secondary IS NULL THEN
        RAISE EXCEPTION 'Migration failed: font_secondary is NULL';
    END IF;
    
    IF settings_row.email_from_address IS NULL THEN
        RAISE EXCEPTION 'Migration failed: email_from_address is NULL';
    END IF;
    
    -- Check footer_links is valid JSON
    IF settings_row.footer_links IS NULL THEN
        RAISE EXCEPTION 'Migration failed: footer_links is NULL';
    END IF;
    
    RAISE NOTICE 'Migration successful: all new columns exist with correct values';
END $$;

COMMIT;

-- Post-migration verification
-- Uncomment to verify schema matches TypeScript types
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'app_settings' 
-- ORDER BY ordinal_position;

-- Expected columns after migration:
-- id, site_name, logo_base64, favicon_base64,
-- color_primary, color_secondary, color_accent, color_background, color_surface,
-- color_text_primary, color_text_secondary, color_success, color_error,
-- font_primary, font_secondary,
-- footer_text, footer_links,
-- email_from_name, email_from_address,
-- updated_at, updated_by

-- Rollback instructions:
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE app_settings ADD COLUMN color_text TEXT;
-- ALTER TABLE app_settings ADD COLUMN font_family_heading TEXT;
-- ALTER TABLE app_settings ADD COLUMN font_family_body TEXT;
-- UPDATE app_settings SET color_text = color_text_primary, font_family_heading = font_primary, font_family_body = font_secondary;
-- ALTER TABLE app_settings DROP COLUMN color_text_primary;
-- ALTER TABLE app_settings DROP COLUMN color_text_secondary;
-- ALTER TABLE app_settings DROP COLUMN color_surface;
-- ALTER TABLE app_settings DROP COLUMN font_primary;
-- ALTER TABLE app_settings DROP COLUMN font_secondary;
-- ALTER TABLE app_settings DROP COLUMN email_from_address;
-- COMMIT;
