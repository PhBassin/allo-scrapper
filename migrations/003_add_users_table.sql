-- Migration: Add users table for authentication
-- Version: 2.2.0
-- Date: 2026-02-26
-- Description: Creates users table for JWT authentication (admin seed moved to migration 007)
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

COMMIT;

-- Post-migration verification queries
-- Uncomment to verify after migration

-- SELECT COUNT(*) as total_users FROM users;
-- SELECT id, username, created_at FROM users;
