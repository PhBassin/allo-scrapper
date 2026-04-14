-- Migration: Fix org_settings.updated_by FK cascade behavior
-- Issue: #835
-- Date: 2026-04-14
--
-- Problem: org_settings.updated_by FK references users(id) without ON DELETE action.
--          Deleting a user fails if they last updated org settings.
--
-- Solution: Add ON DELETE SET NULL to the FK constraint in all existing org schemas.
--
-- Idempotency: Safe to run multiple times. Checks delete_rule before modifying.

BEGIN;

DO $$
DECLARE
  org_record RECORD;
  fk_needs_fix BOOLEAN;
BEGIN
  RAISE NOTICE 'Starting FK cascade fix for org_settings.updated_by across all org schemas';
  
  -- Loop through all organizations
  FOR org_record IN 
    SELECT schema_name FROM public.organizations ORDER BY schema_name
  LOOP
    -- Check if FK constraint exists and needs fixing
    -- We query information_schema to check the delete_rule
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
        AND tc.constraint_schema = rc.constraint_schema
      WHERE tc.table_schema = org_record.schema_name
        AND tc.table_name = 'org_settings'
        AND tc.constraint_name = 'org_settings_updated_by_fkey'
        AND rc.delete_rule != 'SET NULL'
    ) INTO fk_needs_fix;
    
    -- Fix constraint if needed
    IF fk_needs_fix THEN
      EXECUTE format('
        ALTER TABLE %I.org_settings
        DROP CONSTRAINT org_settings_updated_by_fkey,
        ADD CONSTRAINT org_settings_updated_by_fkey 
          FOREIGN KEY (updated_by) REFERENCES %I.users(id) 
          ON DELETE SET NULL
      ', org_record.schema_name, org_record.schema_name);
      
      RAISE NOTICE 'Fixed FK constraint in schema: %', org_record.schema_name;
    ELSE
      RAISE NOTICE 'FK constraint already correct or does not exist in schema: %', org_record.schema_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'FK cascade fix completed successfully';
END $$;

COMMIT;
