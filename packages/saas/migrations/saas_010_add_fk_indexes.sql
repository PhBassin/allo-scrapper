-- saas_010_add_fk_indexes.sql
-- Add missing foreign key indexes to existing org schemas for improved query performance
-- Idempotent - safe to re-run

BEGIN;

DO $$
DECLARE
  org_record RECORD;
  org_schema TEXT;
BEGIN
  RAISE NOTICE 'Starting FK indexes migration for existing org schemas';
  
  -- Iterate over all organizations and add indexes to their schemas
  FOR org_record IN SELECT slug FROM organizations LOOP
    org_schema := 'org_' || org_record.slug;
    RAISE NOTICE 'Adding FK indexes to %', org_schema;
    
    -- Add index on users.role_id
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_users_role_id ON %I.users(role_id)', org_schema);
    
    -- Add index on invitations.role_id
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON %I.invitations(role_id)', org_schema);
    
    -- Add index on invitations.created_by
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON %I.invitations(created_by)', org_schema);
    
    -- Add index on org_settings.updated_by
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_org_settings_updated_by ON %I.org_settings(updated_by)', org_schema);
    
    RAISE NOTICE '✓ Indexes added to %', org_schema;
  END LOOP;
  
  RAISE NOTICE 'FK indexes migration complete for all org schemas';
END $$;

COMMIT;
