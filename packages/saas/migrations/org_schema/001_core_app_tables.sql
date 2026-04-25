-- Bootstrap core app tables inside each tenant schema.
-- Runs with search_path already set to the target org schema.

CREATE TABLE IF NOT EXISTS cinemas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  screen_count INTEGER,
  image_url TEXT,
  url TEXT,
  source TEXT DEFAULT 'allocine'
);

CREATE TABLE IF NOT EXISTS films (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  poster_url TEXT,
  duration_minutes INTEGER,
  release_date TEXT,
  rerelease_date TEXT,
  genres TEXT,
  nationality TEXT,
  director TEXT,
  screenwriters TEXT,
  actors TEXT,
  synopsis TEXT,
  certificate TEXT,
  press_rating REAL,
  audience_rating REAL,
  source_url TEXT NOT NULL,
  trailer_url TEXT
);

CREATE TABLE IF NOT EXISTS showtimes (
  id TEXT PRIMARY KEY,
  film_id INTEGER NOT NULL REFERENCES films(id),
  cinema_id TEXT NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  datetime_iso TEXT NOT NULL,
  version TEXT,
  format TEXT,
  experiences TEXT,
  week_start TEXT NOT NULL,
  CONSTRAINT uq_showtimes_business_key UNIQUE (cinema_id, film_id, date, time, version, format)
);

CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON showtimes(cinema_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_film_date ON showtimes(film_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_week ON showtimes(week_start);

CREATE TABLE IF NOT EXISTS weekly_programs (
  id SERIAL PRIMARY KEY,
  cinema_id TEXT NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  film_id INTEGER NOT NULL REFERENCES films(id),
  week_start TEXT NOT NULL,
  is_new_this_week INTEGER NOT NULL DEFAULT 0,
  scraped_at TEXT NOT NULL,
  UNIQUE (cinema_id, film_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_programs_week ON weekly_programs(week_start);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'Allo-Scrapper',
  logo_base64 TEXT,
  favicon_base64 TEXT,
  color_primary TEXT NOT NULL DEFAULT '#FECC00',
  color_secondary TEXT NOT NULL DEFAULT '#1F2937',
  color_accent TEXT NOT NULL DEFAULT '#F59E0B',
  color_background TEXT NOT NULL DEFAULT '#FFFFFF',
  color_surface TEXT NOT NULL DEFAULT '#F3F4F6',
  color_text_primary TEXT NOT NULL DEFAULT '#111827',
  color_text_secondary TEXT NOT NULL DEFAULT '#6B7280',
  color_success TEXT NOT NULL DEFAULT '#10B981',
  color_error TEXT NOT NULL DEFAULT '#EF4444',
  font_primary TEXT NOT NULL DEFAULT 'Inter',
  font_secondary TEXT NOT NULL DEFAULT 'Roboto',
  footer_text TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
  footer_links JSONB DEFAULT '[]'::jsonb,
  email_from_name TEXT DEFAULT 'Allo-Scrapper',
  email_from_address TEXT DEFAULT 'no-reply@allocine-scrapper.com',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id),
  scrape_mode TEXT NOT NULL DEFAULT 'from_today_limited',
  scrape_days INTEGER NOT NULL DEFAULT 7,
  CONSTRAINT singleton_check CHECK (id = 1),
  CONSTRAINT valid_scrape_mode CHECK (scrape_mode = ANY (ARRAY['weekly'::text, 'from_today'::text, 'from_today_limited'::text])),
  CONSTRAINT valid_scrape_days CHECK (scrape_days >= 1 AND scrape_days <= 14)
);

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at);

CREATE TABLE IF NOT EXISTS scrape_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  target_cinemas JSONB,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_scrape_schedules_enabled ON scrape_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_scrape_schedules_name ON scrape_schedules(name);

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
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO scrape_schedules (name, description, cron_expression, enabled)
VALUES ('Weekly Wednesday Scrape', 'Default weekly scrape - every Wednesday at 3am', '0 3 * * 3', true)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS scrape_reports (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'partial_success'::text, 'failed'::text, 'rate_limited'::text])),
  trigger_type TEXT NOT NULL,
  total_cinemas INTEGER,
  successful_cinemas INTEGER,
  failed_cinemas INTEGER,
  total_films_scraped INTEGER,
  total_showtimes_scraped INTEGER,
  errors JSONB,
  progress_log JSONB,
  schedule_id INTEGER REFERENCES scrape_schedules(id),
  parent_report_id INTEGER REFERENCES scrape_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_scrape_reports_started_at ON scrape_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_reports_status ON scrape_reports(status);

CREATE TABLE IF NOT EXISTS scrape_attempts (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES scrape_reports(id) ON DELETE CASCADE,
  cinema_id TEXT NOT NULL REFERENCES cinemas(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'rate_limited'::text, 'not_attempted'::text])),
  error_type TEXT,
  error_message TEXT,
  http_status_code INTEGER,
  films_scraped INTEGER DEFAULT 0,
  showtimes_scraped INTEGER DEFAULT 0,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_id, cinema_id, date)
);

CREATE INDEX IF NOT EXISTS idx_scrape_attempts_report_id ON scrape_attempts(report_id);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_report_status ON scrape_attempts(report_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_cinema_date ON scrape_attempts(cinema_id, date);
