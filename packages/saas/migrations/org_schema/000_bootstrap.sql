-- Org schema bootstrap: creates all core tables for a new tenant schema.
-- This runs with search_path already set to org_{slug}, so all tables
-- are created in the org's private schema.
--
-- NOTE: films stay in public schema (shared) — showtimes reference public.films

-- Enable pg_trgm for full-text search (extension is global but must be visible)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Roles & Permissions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS permission_category_labels (
  id          SERIAL PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  label_en    TEXT NOT NULL,
  label_fr    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_category_labels_key
  ON permission_category_labels(category_key);

-- Seed default roles
INSERT INTO roles (name, description, is_system) VALUES
  ('admin', 'Full access', true),
  ('user',  'Read-only access', true)
ON CONFLICT (name) DO NOTHING;

-- ─── Users ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  username             VARCHAR(255) UNIQUE NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  role_id              INTEGER NOT NULL REFERENCES roles(id),
  email_verified       BOOLEAN NOT NULL DEFAULT false,
  verification_token   TEXT,
  verification_expires TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ─── Org settings (replaces app_settings singleton) ─────────────────────────

CREATE TABLE IF NOT EXISTS org_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  site_name            TEXT NOT NULL DEFAULT 'Allo-Scrapper',
  logo_base64          TEXT,
  favicon_base64       TEXT,
  color_primary        TEXT NOT NULL DEFAULT '#FECC00',
  color_secondary      TEXT NOT NULL DEFAULT '#1F2937',
  color_accent         TEXT NOT NULL DEFAULT '#F59E0B',
  color_background     TEXT NOT NULL DEFAULT '#FFFFFF',
  color_surface        TEXT NOT NULL DEFAULT '#F3F4F6',
  color_text_primary   TEXT NOT NULL DEFAULT '#111827',
  color_text_secondary TEXT NOT NULL DEFAULT '#6B7280',
  color_success        TEXT NOT NULL DEFAULT '#10B981',
  color_error          TEXT NOT NULL DEFAULT '#EF4444',
  font_primary         TEXT NOT NULL DEFAULT 'Inter',
  font_secondary       TEXT NOT NULL DEFAULT 'Roboto',
  footer_text          TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
  footer_links         JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_from_name      TEXT DEFAULT 'Allo-Scrapper',
  email_from_address   TEXT DEFAULT 'no-reply@allocine-scrapper.com',
  scrape_mode          TEXT NOT NULL DEFAULT 'weekly',
  scrape_days          INTEGER NOT NULL DEFAULT 7,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by           INTEGER REFERENCES users(id),
  CONSTRAINT singleton_check CHECK (id = 1),
  CONSTRAINT valid_scrape_mode CHECK (scrape_mode IN ('weekly', 'from_today', 'from_today_limited')),
  CONSTRAINT valid_scrape_days CHECK (scrape_days >= 1 AND scrape_days <= 14)
);

CREATE INDEX IF NOT EXISTS idx_org_settings_updated_at ON org_settings(updated_at);

INSERT INTO org_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─── Cinemas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cinemas (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT,
  postal_code  TEXT,
  city         TEXT,
  screen_count INTEGER,
  image_url    TEXT,
  url          TEXT,
  source       VARCHAR(50) DEFAULT 'allocine'
);

-- ─── Showtimes (references public.films) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS showtimes (
  id            TEXT PRIMARY KEY,
  film_id       INTEGER NOT NULL REFERENCES public.films(id),
  cinema_id     TEXT NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  datetime_iso  TEXT NOT NULL,
  version       TEXT,
  format        TEXT,
  experiences   TEXT,
  week_start    TEXT NOT NULL,
  UNIQUE (cinema_id, film_id, date, time, version, format)
);

CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON showtimes(cinema_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_film_date   ON showtimes(film_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_week        ON showtimes(week_start);

-- ─── Scrape schedules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_schedules (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL UNIQUE,
  description      TEXT,
  cron_expression  VARCHAR(100) NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  target_cinemas   JSONB,
  created_by       INTEGER REFERENCES users(id),
  updated_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at      TIMESTAMPTZ,
  last_run_status  TEXT
);

CREATE INDEX IF NOT EXISTS idx_scrape_schedules_enabled ON scrape_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_scrape_schedules_name    ON scrape_schedules(name);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scrape_schedules_updated_at ON scrape_schedules;
CREATE TRIGGER update_scrape_schedules_updated_at
  BEFORE UPDATE ON scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Scrape reports ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_reports (
  id                    SERIAL PRIMARY KEY,
  started_at            TIMESTAMPTZ NOT NULL,
  completed_at          TIMESTAMPTZ,
  status                TEXT NOT NULL,
  trigger_type          TEXT NOT NULL,
  total_cinemas         INTEGER,
  successful_cinemas    INTEGER,
  failed_cinemas        INTEGER,
  total_films_scraped   INTEGER,
  total_showtimes_scraped INTEGER,
  errors                JSONB,
  progress_log          JSONB,
  schedule_id           INTEGER REFERENCES scrape_schedules(id),
  parent_report_id      INTEGER REFERENCES scrape_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_scrape_reports_started_at ON scrape_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_reports_status     ON scrape_reports(status);

-- ─── Scrape attempts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_attempts (
  id                  SERIAL PRIMARY KEY,
  report_id           INTEGER NOT NULL REFERENCES scrape_reports(id) ON DELETE CASCADE,
  cinema_id           TEXT NOT NULL REFERENCES cinemas(id),
  date                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'rate_limited', 'not_attempted')),
  error_type          TEXT,
  error_message       TEXT,
  http_status_code    INTEGER,
  films_scraped       INTEGER DEFAULT 0,
  showtimes_scraped   INTEGER DEFAULT 0,
  attempted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_id, cinema_id, date)
);

CREATE INDEX IF NOT EXISTS idx_scrape_attempts_report_id     ON scrape_attempts(report_id);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_report_status ON scrape_attempts(report_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_cinema_date   ON scrape_attempts(cinema_id, date);

-- ─── Rate limit configs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id                INTEGER PRIMARY KEY DEFAULT 1,
  window_ms         INTEGER NOT NULL DEFAULT 900000
    CHECK (window_ms >= 60000 AND window_ms <= 3600000),
  general_max       INTEGER NOT NULL DEFAULT 100
    CHECK (general_max >= 10 AND general_max <= 1000),
  auth_max          INTEGER NOT NULL DEFAULT 5
    CHECK (auth_max >= 3 AND auth_max <= 50),
  register_max      INTEGER NOT NULL DEFAULT 3
    CHECK (register_max >= 1 AND register_max <= 20),
  register_window_ms INTEGER NOT NULL DEFAULT 3600000
    CHECK (register_window_ms >= 300000 AND register_window_ms <= 86400000),
  protected_max     INTEGER NOT NULL DEFAULT 60
    CHECK (protected_max >= 10 AND protected_max <= 500),
  scraper_max       INTEGER NOT NULL DEFAULT 10
    CHECK (scraper_max >= 5 AND scraper_max <= 100),
  public_max        INTEGER NOT NULL DEFAULT 100
    CHECK (public_max >= 20 AND public_max <= 1000),
  health_max        INTEGER NOT NULL DEFAULT 10
    CHECK (health_max >= 5 AND health_max <= 100),
  health_window_ms  INTEGER NOT NULL DEFAULT 60000
    CHECK (health_window_ms = 60000),
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by        INTEGER REFERENCES users(id),
  environment       TEXT DEFAULT 'production'
    CHECK (environment IN ('development', 'staging', 'production')),
  CONSTRAINT singleton_check CHECK (id = 1)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_updated_at ON rate_limit_configs(updated_at);

INSERT INTO rate_limit_configs (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limit_audit_log (
  id                  SERIAL PRIMARY KEY,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by          INTEGER NOT NULL REFERENCES users(id),
  changed_by_username TEXT NOT NULL,
  changed_by_role     TEXT NOT NULL,
  field_name          TEXT NOT NULL,
  old_value           TEXT NOT NULL,
  new_value           TEXT NOT NULL,
  user_ip             TEXT,
  user_agent          TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_log_changed_at ON rate_limit_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_log_changed_by ON rate_limit_audit_log(changed_by);

-- ─── Invitations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role_id     INTEGER NOT NULL REFERENCES roles(id),
  token       TEXT NOT NULL UNIQUE,
  invited_by  INTEGER NOT NULL REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_token      ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
