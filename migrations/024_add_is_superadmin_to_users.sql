-- Migration: Add is_superadmin flag to users table
-- Idempotent: safe to run on both fresh and existing databases.
--
-- Strategy:
--   - Add BOOLEAN column is_superadmin (default FALSE) to public.users
--   - Auto-set TRUE for any user whose role is the system 'admin' role
--   - The superadmins SaaS table is intentionally left untouched (abandoned)

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_superadmin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Column users.is_superadmin added successfully';
    ELSE
        RAISE NOTICE 'Column users.is_superadmin already exists, skipping';
    END IF;
END $$;

-- Auto-set is_superadmin=true for users with the system admin role
UPDATE users u
SET is_superadmin = TRUE
FROM roles r
WHERE u.role_id = r.id
  AND r.name = 'admin'
  AND r.is_system = TRUE
  AND u.is_superadmin = FALSE;

-- Verification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_superadmin'
    ) THEN
        RAISE NOTICE 'Migration successful: users.is_superadmin exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: users.is_superadmin does not exist';
    END IF;
END $$;

COMMIT;
