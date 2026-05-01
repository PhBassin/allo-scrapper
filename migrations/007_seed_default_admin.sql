-- Migration: Seed default admin user (if needed)
-- Idempotency: Safe (Marker migration only. Admin seeding logic in migrations runner uses COUNT checks and ON CONFLICT DO NOTHING)
-- Version: 3.1.0
-- Date: 2026-03-01
-- Description: Creates default admin user with random password if no admin exists
--
-- IMPORTANT: This migration is handled specially by the migration runner
-- The actual admin seeding logic is in server/src/db/migrations.ts
--
-- This file serves as a marker to trigger admin seed logic after migrations 003 and 005

BEGIN;

-- Check if any admin exists
DO $$ 
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
    
    IF admin_count = 0 THEN
        RAISE NOTICE 'No admin user found - admin creation will be handled by migration runner';
        RAISE NOTICE 'The migration runner will generate a secure random password and log it';
    ELSE
        RAISE NOTICE 'Admin user already exists (count: %), skipping seed', admin_count;
    END IF;
END $$;

COMMIT;

-- POST-MIGRATION NOTE:
-- If this is a fresh install and no admin existed, check server logs for:
--   🔐 DEFAULT ADMIN USER CREATED
--   Username: admin
--   Password: <randomly-generated-16-char-password>
--
-- SECURITY:
--   - Save the password immediately
--   - Change it after first login
--   - The password will NOT be shown again
