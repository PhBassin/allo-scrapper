-- Phase 5: superadmins table (public schema)
-- Stores system-level administrator accounts that are NOT tied to any org.
-- These accounts authenticate with a separate JWT secret (SUPERADMIN_JWT_SECRET)
-- and have access to the /api/superadmin/* routes.
--
-- Idempotent: safe to run on fresh installs and existing databases.

BEGIN;

CREATE TABLE IF NOT EXISTS superadmins (
  id              SERIAL PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'superadmins'
  ) THEN
    RAISE EXCEPTION 'Migration failed: public.superadmins does not exist';
  ELSE
    RAISE NOTICE 'Migration successful: public.superadmins exists';
  END IF;
END $$;

COMMIT;
