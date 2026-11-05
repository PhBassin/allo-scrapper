-- Migration 026: Link each rotated refresh token to its successor
-- A token revoked by rotation points at the token that replaced it, so reuse
-- detection can tell a rotation (a replay of it is a theft signal) from a
-- deliberate revocation (logout, password change, admin action), and can tell
-- whether the successor was ever used.

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS replaced_by_id INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL;

-- ON DELETE SET NULL looks up referencing rows for every deleted token
-- (cleanup, user deletion): index it so that is not a scan per row.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by_id ON refresh_tokens(replaced_by_id);
