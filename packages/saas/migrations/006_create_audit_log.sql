-- Phase 5: audit_log table (public schema)
-- Records sensitive superadmin actions: impersonation sessions, plan overrides,
-- org suspensions/reactivations, trial resets.
--
-- Idempotent: safe to run on fresh installs and existing databases.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      INT NOT NULL REFERENCES superadmins(id),
  action        TEXT NOT NULL,            -- e.g. 'impersonate', 'suspend_org', 'change_plan'
  target_type   TEXT,                     -- e.g. 'organization'
  target_id     TEXT,                     -- UUID of the affected resource
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor    ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target   ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log(created_at DESC);

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    RAISE EXCEPTION 'Migration failed: public.audit_log does not exist';
  ELSE
    RAISE NOTICE 'Migration successful: public.audit_log exists';
  END IF;
END $$;

COMMIT;
