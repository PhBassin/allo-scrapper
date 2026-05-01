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

-- Promote default admin user to admin role (idempotent - only if user exists)
UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin';

-- Verify role column exists and has correct constraint
DO $$ 
DECLARE
    role_column_exists BOOLEAN;
    role_constraint_exists BOOLEAN;
    role_index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users'
          AND column_name = 'role'
          AND table_schema = current_schema()
    ) INTO role_column_exists;
    
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'users'
          AND constraint_name = 'users_role_check'
          AND table_schema = current_schema()
    ) INTO role_constraint_exists;
    
    SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_users_role'
          AND schemaname = current_schema()
    ) INTO role_index_exists;
    
    IF NOT role_column_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: column users.role was not created';
    END IF;
    IF NOT role_constraint_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: constraint users_role_check was not created';
    END IF;
    IF NOT role_index_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: index idx_users_role was not created';
    END IF;
    
    RAISE NOTICE 'VERIFICATION PASSED: role column, constraint, and index verified';
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
