-- Migration: Seed superadmin from default admin user
-- This assumes that migration 007_seed_default_admin.sql in core has already run
-- and created an admin user in public.users.

BEGIN;

INSERT INTO superadmins (username, password_hash)
SELECT username, password_hash
FROM users
WHERE username = 'admin'
ON CONFLICT (username) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM superadmins WHERE username = 'admin') THEN
    RAISE NOTICE 'Migration saas_007_seed_superadmin successful: default admin seeded as superadmin';
  ELSE
    RAISE NOTICE 'Migration saas_007_seed_superadmin: no admin user found to seed';
  END IF;
END $$;

COMMIT;
