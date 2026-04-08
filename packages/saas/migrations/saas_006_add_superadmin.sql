-- Migration: Add superadmin support with audit logging
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Create superadmins table (global, not per-org)
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create audit_log table for tracking superadmin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,  -- references superadmins.id, but no FK for flexibility
  action TEXT NOT NULL,      -- 'suspend_org', 'reactivate_org', 'change_plan', 'impersonate', etc.
  target_type TEXT NOT NULL,  -- 'organization', 'user'
  target_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for audit_log queries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_log_actor') THEN
    CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
    RAISE NOTICE 'Index idx_audit_log_actor created';
  ELSE
    RAISE NOTICE 'Index idx_audit_log_actor already exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_log_created') THEN
    CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
    RAISE NOTICE 'Index idx_audit_log_created created';
  ELSE
    RAISE NOTICE 'Index idx_audit_log_created already exists';
  END IF;
END $$;

-- Verify tables exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='superadmins') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='audit_log') THEN
    RAISE NOTICE 'Migration saas_006_add_superadmin successful';
  ELSE
    RAISE EXCEPTION 'Migration saas_006_add_superadmin failed: tables not created';
  END IF;
END $$;

COMMIT;
