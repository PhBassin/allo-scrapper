-- Migration: Add user roles system (admin/user)
-- Version: 3.0.0
-- Date: 2026-03-01
-- Description: Adds role column to users table and promotes default admin user
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T ics-db pg_dump -U postgres ics > backup_before_user_roles.sql
--
-- Apply this migration:
--   docker compose exec -T ics-db psql -U postgres -d ics < migrations/005_add_user_roles.sql

BEGIN;

-- Add role column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
        
        RAISE NOTICE 'Added role column to users table';
    ELSE
        RAISE NOTICE 'Role column already exists, skipping';
    END IF;
END $$;

-- Add check constraint for valid roles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'users' AND constraint_name = 'users_role_check'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
        
        RAISE NOTICE 'Added role check constraint';
    ELSE
        RAISE NOTICE 'Role check constraint already exists, skipping';
    END IF;
END $$;

-- Create index on role column for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Promote default admin user to admin role
UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin';

-- Verify at least one admin exists
DO $$ 
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
    
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Migration safety check failed: No admin user found after migration';
    ELSIF admin_count = 1 THEN
        RAISE NOTICE 'Admin verification successful: exactly 1 admin user exists';
    ELSE
        RAISE NOTICE 'Admin verification successful: % admin users exist', admin_count;
    END IF;
END $$;

-- Verify role column exists and has correct constraint
DO $$ 
DECLARE
    role_column_exists BOOLEAN;
    role_constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) INTO role_column_exists;
    
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'users' AND constraint_name = 'users_role_check'
    ) INTO role_constraint_exists;
    
    IF role_column_exists AND role_constraint_exists THEN
        RAISE NOTICE 'Migration successful: role column and constraint verified';
    ELSE
        RAISE EXCEPTION 'Migration verification failed';
    END IF;
END $$;

-- Verify default admin user has admin role
DO $$ 
DECLARE
    admin_user_role TEXT;
BEGIN
    SELECT role INTO admin_user_role FROM users WHERE username = 'admin';
    
    IF admin_user_role = 'admin' THEN
        RAISE NOTICE 'Default admin user has admin role';
    ELSIF admin_user_role IS NULL THEN
        RAISE WARNING 'Default admin user not found';
    ELSE
        RAISE EXCEPTION 'Default admin user has incorrect role: %', admin_user_role;
    END IF;
END $$;

COMMIT;

-- Post-migration verification queries
-- Uncomment to verify after migration

-- SELECT id, username, role, created_at FROM users;
-- SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- Rollback instructions:
-- To rollback this migration, run:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_users_role;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- COMMIT;
