-- Phase 6: add custom_domain to organizations (Enterprise plan only)
-- Idempotent migration

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'custom_domain'
  ) THEN
    ALTER TABLE organizations ADD COLUMN custom_domain TEXT;
    RAISE NOTICE 'Column organizations.custom_domain added successfully';
  ELSE
    RAISE NOTICE 'Column organizations.custom_domain already exists, skipping';
  END IF;
END $$;

-- Unique index (a domain can only belong to one org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_custom_domain
  ON organizations(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'custom_domain'
  ) THEN
    RAISE NOTICE 'Migration successful: organizations.custom_domain exists';
  ELSE
    RAISE EXCEPTION 'Migration failed: organizations.custom_domain does not exist';
  END IF;
END $$;

COMMIT;
