-- Migration: Add dark mode color palette to app_settings
-- Issue: #569
-- Description: Adds dark mode color columns with intelligent defaults for dark theme support
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Dark Mode Colors (Material Design dark theme defaults)
-- Background: dark surfaces
-- Text: light text on dark backgrounds
-- Primary/Secondary/Accent: slightly brighter versions for better contrast

-- Check and add color_primary_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_primary_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_primary_dark TEXT NOT NULL DEFAULT '#FDD835';
        RAISE NOTICE 'Column app_settings.color_primary_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_primary_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_secondary_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_secondary_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_secondary_dark TEXT NOT NULL DEFAULT '#37474F';
        RAISE NOTICE 'Column app_settings.color_secondary_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_secondary_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_accent_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_accent_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_accent_dark TEXT NOT NULL DEFAULT '#42A5F5';
        RAISE NOTICE 'Column app_settings.color_accent_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_accent_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_background_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_background_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_background_dark TEXT NOT NULL DEFAULT '#121212';
        RAISE NOTICE 'Column app_settings.color_background_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_background_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_surface_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_surface_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_surface_dark TEXT NOT NULL DEFAULT '#1E1E1E';
        RAISE NOTICE 'Column app_settings.color_surface_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_surface_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_text_primary_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_text_primary_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_text_primary_dark TEXT NOT NULL DEFAULT '#E0E0E0';
        RAISE NOTICE 'Column app_settings.color_text_primary_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_text_primary_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_text_secondary_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_text_secondary_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_text_secondary_dark TEXT NOT NULL DEFAULT '#9E9E9E';
        RAISE NOTICE 'Column app_settings.color_text_secondary_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_text_secondary_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_success_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_success_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_success_dark TEXT NOT NULL DEFAULT '#66BB6A';
        RAISE NOTICE 'Column app_settings.color_success_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_success_dark already exists, skipping';
    END IF;
END $$;

-- Check and add color_error_dark
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='app_settings' AND column_name='color_error_dark'
    ) THEN
        ALTER TABLE app_settings 
        ADD COLUMN color_error_dark TEXT NOT NULL DEFAULT '#EF5350';
        RAISE NOTICE 'Column app_settings.color_error_dark added successfully';
    ELSE
        RAISE NOTICE 'Column app_settings.color_error_dark already exists, skipping';
    END IF;
END $$;

-- Verify all dark mode columns exist
DO $$ 
DECLARE
    missing_columns TEXT[];
    expected_columns TEXT[] := ARRAY[
        'color_primary_dark',
        'color_secondary_dark',
        'color_accent_dark',
        'color_background_dark',
        'color_surface_dark',
        'color_text_primary_dark',
        'color_text_secondary_dark',
        'color_success_dark',
        'color_error_dark'
    ];
    col TEXT;
BEGIN
    missing_columns := ARRAY[]::TEXT[];
    
    FOREACH col IN ARRAY expected_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name='app_settings' AND column_name=col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Migration failed: missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'Migration successful: all 9 dark mode color columns exist';
    END IF;
END $$;

COMMIT;

-- Post-migration verification (uncomment to verify):
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'app_settings' AND column_name LIKE '%_dark'
-- ORDER BY column_name;

-- SELECT 
--   color_primary_dark, 
--   color_background_dark, 
--   color_text_primary_dark 
-- FROM app_settings;

-- Rollback instructions:
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_primary_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_secondary_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_accent_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_background_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_surface_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_text_primary_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_text_secondary_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_success_dark;
-- ALTER TABLE app_settings DROP COLUMN IF EXISTS color_error_dark;
-- COMMIT;
