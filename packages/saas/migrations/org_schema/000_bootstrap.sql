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
  id                   SERIAL PRIMARY KEY,
  username             VARCHAR(255) NOT NULL UNIQUE,
  password_hash        TEXT,
  role_id              INTEGER NOT NULL DEFAULT 1 REFERENCES roles(id),
  email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token   TEXT,
  verification_expires TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Invitations table (pending member invitations)
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  role_id     INTEGER NOT NULL DEFAULT 1 REFERENCES roles(id),
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON invitations(role_id);
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON invitations(created_by);

-- Org Settings table (white-label customization for this org)
CREATE TABLE IF NOT EXISTS org_settings (
  id                  SERIAL PRIMARY KEY,
  site_name           VARCHAR(255) NOT NULL DEFAULT 'My Cinema',
  logo_base64         TEXT,
  favicon_base64      TEXT,
  color_primary       VARCHAR(7) NOT NULL DEFAULT '#FECC00',
  color_secondary     VARCHAR(7) NOT NULL DEFAULT '#1F2937',
  font_primary        VARCHAR(100) NOT NULL DEFAULT 'Inter',
  font_secondary      VARCHAR(100) NOT NULL DEFAULT 'Roboto',
  footer_text         TEXT,
  footer_links        JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_from_name     VARCHAR(255) NOT NULL DEFAULT 'Cinema Team',
  email_from_address  VARCHAR(255) NOT NULL DEFAULT 'no-reply@example.com',
  scrape_mode         VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (scrape_mode IN ('daily', 'weekly', 'manual')),
  scrape_days         INTEGER NOT NULL DEFAULT 7 CHECK (scrape_days > 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_settings_updated_by ON org_settings(updated_by);

-- Seed default org settings (one row only)
INSERT INTO org_settings (id, site_name)
VALUES (1, 'My Cinema')
ON CONFLICT (id) DO NOTHING;
