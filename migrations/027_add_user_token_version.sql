-- Migration 027: Per-user credential version bound into every access token
-- Bumped on password change/reset, role change, and edits to the user's role
-- (name or permissions). requireAuth rejects an access token whose `ver` claim
-- no longer matches, so those changes take effect immediately instead of when
-- the token expires. Existing tokens carry no `ver` and are refreshed once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
