-- Migration 001: Initial core schema
-- Creates theaters, movies, showtimes, weekly_programs, scrape_reports tables.
-- This is a greenfield schema using 'movies' terminology throughout.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.

BEGIN;

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Table: theaters
CREATE TABLE IF NOT EXISTS theaters (
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

-- Table: movies
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  poster_url TEXT,
  duration_minutes INTEGER,
  release_date TEXT,
  rerelease_date TEXT,
  genres TEXT,         -- JSON array
  nationality TEXT,
  director TEXT,
  screenwriters TEXT,  -- JSON array
  actors TEXT,         -- JSON array
  synopsis TEXT,
  certificate TEXT,
  press_rating REAL,
  audience_rating REAL,
  source_url TEXT NOT NULL,
  trailer_url TEXT
);

-- Index for movies title (trigram similarity for fuzzy search)
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING gin(title gin_trgm_ops);

-- Table: showtimes
CREATE TABLE IF NOT EXISTS showtimes (
  id TEXT PRIMARY KEY,
  movie_id INTEGER NOT NULL,
  theater_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  datetime_iso TEXT NOT NULL,
  version TEXT,
  format TEXT,
  experiences TEXT,    -- JSON array
  week_start TEXT NOT NULL,
  FOREIGN KEY (movie_id) REFERENCES movies(id),
  FOREIGN KEY (theater_id) REFERENCES theaters(id) ON DELETE CASCADE,
  CONSTRAINT uq_showtimes_business_key UNIQUE (theater_id, movie_id, date, time, version, format)
);

-- Indexes for showtimes
CREATE INDEX IF NOT EXISTS idx_showtimes_theater_date ON showtimes(theater_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_movie_date ON showtimes(movie_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_week ON showtimes(week_start);

-- Partial unique index for rows where format IS NULL
-- PostgreSQL treats NULLs as distinct in UNIQUE constraints, so this index fills that gap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_showtimes_business_key_null_format
  ON showtimes (theater_id, movie_id, date, time, version)
  WHERE format IS NULL;

-- Table: weekly_programs
CREATE TABLE IF NOT EXISTS weekly_programs (
  id SERIAL PRIMARY KEY,
  theater_id TEXT NOT NULL,
  movie_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  is_new_this_week INTEGER NOT NULL DEFAULT 0,
  scraped_at TEXT NOT NULL,
  FOREIGN KEY (theater_id) REFERENCES theaters(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id),
  UNIQUE(theater_id, movie_id, week_start)
);

-- Index for weekly_programs
CREATE INDEX IF NOT EXISTS idx_weekly_programs_week ON weekly_programs(week_start);

-- Table: scrape_reports
CREATE TABLE IF NOT EXISTS scrape_reports (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_success', 'failed', 'rate_limited')),
  trigger_type TEXT NOT NULL,
  total_theaters INTEGER,
  successful_theaters INTEGER,
  failed_theaters INTEGER,
  total_movies_scraped INTEGER,
  total_showtimes_scraped INTEGER,
  errors JSONB,
  progress_log JSONB
);

-- Indexes for scrape_reports
CREATE INDEX IF NOT EXISTS idx_scrape_reports_started_at ON scrape_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_reports_status ON scrape_reports(status);

-- Verification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'movies' AND table_schema = current_schema()) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: table movies was not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'showtimes' AND column_name = 'movie_id' AND table_schema = current_schema()) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: showtimes.movie_id was not created';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: core schema with movies/movie_id exists';
END $$;

COMMIT;
