-- Migration: Add rate_limit_configs table
-- Version: 5.0.0
-- Date: 2026-03-25
-- Description: Dynamic rate limit configuration management
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Create rate_limit_configs table (singleton pattern like app_settings)
CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Global window (shared by most limiters)
  window_ms INTEGER NOT NULL DEFAULT 900000 CHECK (window_ms >= 60000 AND window_ms <= 3600000), -- 1 min to 1 hour
  
  -- General API limiter
  general_max INTEGER NOT NULL DEFAULT 100 CHECK (general_max >= 10 AND general_max <= 1000),
  
  -- Auth limiter (login)
  auth_max INTEGER NOT NULL DEFAULT 5 CHECK (auth_max >= 3 AND auth_max <= 50),
  
  -- Register limiter
  register_max INTEGER NOT NULL DEFAULT 3 CHECK (register_max >= 1 AND register_max <= 20),
  register_window_ms INTEGER NOT NULL DEFAULT 3600000 CHECK (register_window_ms >= 300000 AND register_window_ms <= 86400000), -- 5 min to 24h
  
  -- Protected endpoints limiter (reports, etc.)
  protected_max INTEGER NOT NULL DEFAULT 60 CHECK (protected_max >= 10 AND protected_max <= 500),
  
  -- Scraper limiter (expensive operations)
  scraper_max INTEGER NOT NULL DEFAULT 10 CHECK (scraper_max >= 5 AND scraper_max <= 100),
  
  -- Public endpoints limiter (cinemas, films)
  public_max INTEGER NOT NULL DEFAULT 100 CHECK (public_max >= 20 AND public_max <= 1000),
  
  -- Health check limiter
  health_max INTEGER NOT NULL DEFAULT 10 CHECK (health_max >= 5 AND health_max <= 100),
  health_window_ms INTEGER NOT NULL DEFAULT 60000 CHECK (health_window_ms = 60000), -- Fixed at 1 minute
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id),
  environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  
  -- Singleton constraint
  CONSTRAINT singleton_check CHECK (id = 1)
);

-- Create audit log table for rate limit changes (security requirement)
CREATE TABLE IF NOT EXISTS rate_limit_audit_log (
  id SERIAL PRIMARY KEY,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_by_username TEXT NOT NULL, -- Denormalized for audit permanence
  changed_by_role TEXT NOT NULL,     -- Denormalized for audit permanence
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  user_ip TEXT,
  user_agent TEXT
);

-- Insert default settings (singleton)
INSERT INTO rate_limit_configs (id) 
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_updated_at ON rate_limit_configs(updated_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_log_changed_at ON rate_limit_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_log_changed_by ON rate_limit_audit_log(changed_by);

-- Verification
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'rate_limit_configs'
    ) THEN
        RAISE NOTICE 'Migration successful: rate_limit_configs table exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: rate_limit_configs table does not exist';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'rate_limit_audit_log'
    ) THEN
        RAISE NOTICE 'Migration successful: rate_limit_audit_log table exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: rate_limit_audit_log table does not exist';
    END IF;
    
    -- Verify singleton row exists
    IF EXISTS (SELECT 1 FROM rate_limit_configs WHERE id = 1) THEN
        RAISE NOTICE 'Migration successful: default rate limit config row exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: default rate limit config row does not exist';
    END IF;
END $$;

COMMIT;
