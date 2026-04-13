-- Migration: Unify superadmin and admin credentials
-- This migration is idempotent - safe to run multiple times
--
-- Context: Previously, superadmin credentials were stored in a separate
-- 'superadmins' table, which created a duplicate credential store that
-- diverged when passwords were changed via /api/auth/change-password.
--
-- Solution: SuperadminAuthService.login() now queries public.users directly
-- for system admin accounts (is_system_role = true AND role_name = 'admin').
-- The superadmins table is no longer needed.

BEGIN;

-- Drop the superadmins table if it exists
-- Note: audit_log.actor_id is a soft reference (no FK), so this is safe
DROP TABLE IF EXISTS superadmins CASCADE;

-- Notify about the migration success
DO $$
BEGIN
  RAISE NOTICE 'Migration saas_007_unify_superadmin_credentials successful';
  RAISE NOTICE 'Superadmin login now uses public.users for system admin accounts';
  RAISE NOTICE 'Credentials stay in sync - password changes via /api/auth/change-password now work for both regular admin and superadmin login';
END $$;

COMMIT;
