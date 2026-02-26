-- Migration: Add users table for authentication
-- Version: 2.2.0
-- Date: 2026-02-26
-- Description: Creates users table with default admin account for JWT authentication
--
-- IMPORTANT: Backup your database before running this migration!
--   docker compose exec -T db pg_dump -U postgres its > backup_before_users_table.sql
--
-- Apply this migration:
--   docker compose exec -T db psql -U postgres -d its -f migrations/003_add_users_table.sql

BEGIN;

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed default admin user (password: admin)
-- Uses bcrypt hash: $2b$10$X1jI1OAR61W6fUxWcM.wD.vuMMVkDT3HdkHxC5.3KJZ0ZfPwW9gP6
DO $$ 
BEGIN
    -- Only insert if admin user doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE username = 'admin'
    ) THEN
        INSERT INTO users (username, password_hash)
        VALUES ('admin', '$2b$10$X1jI1OAR61W6fUxWcM.wD.vuMMVkDT3HdkHxC5.3KJZ0ZfPwW9gP6');
        RAISE NOTICE 'Default admin user created (username: admin, password: admin)';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping seed';
    END IF;
END $$;

-- Verify the table was created
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'users'
    ) THEN
        RAISE NOTICE 'Migration successful: users table exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: users table does not exist';
    END IF;
END $$;

-- Verify the admin user exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM users WHERE username = 'admin'
    ) THEN
        RAISE NOTICE 'Admin user verification successful';
    ELSE
        RAISE EXCEPTION 'Migration verification failed: admin user does not exist';
    END IF;
END $$;

COMMIT;

-- Post-migration verification queries
-- Uncomment to verify after migration

-- SELECT COUNT(*) as total_users FROM users;
-- SELECT id, username, created_at FROM users;
