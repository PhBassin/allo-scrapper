-- Bootstrap SQL for a newly created org schema.
-- Runs inside the org's own schema (search_path is SET before this runs).
-- Must be idempotent.

-- Roles table (system roles for tenant users)
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed system roles
INSERT INTO roles (name, description, is_system)
VALUES
  ('admin',  'Full access to all org resources',         TRUE),
  ('editor', 'Can manage cinemas and trigger scrapes',   TRUE),
  ('viewer', 'Read-only access',                         TRUE)
ON CONFLICT (name) DO NOTHING;

-- Users table (tenant members — one record per human per org)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  role_id       INTEGER NOT NULL DEFAULT 1 REFERENCES roles(id),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
