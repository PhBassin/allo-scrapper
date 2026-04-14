-- Migration: Create default ICS organization in SaaS mode
-- This migration is idempotent - safe to run multiple times
--
-- Purpose: On first SaaS activation, create a default organization (slug: ics)
--          and migrate all existing data from public schema to org_ics schema.
--
-- Steps:
--   1. Check if org 'ics' exists; exit early if already created
--   2. Create organization record in public.organizations
--   3. Create org_ics schema
--   4. Bootstrap org schema tables (from 000_bootstrap.sql)
--   5. Migrate data from public schema to org_ics schema
--   6. Associate system admin user as org member
--   7. Initialize quota tracking in public.org_usage
--   8. Verify migration succeeded

BEGIN;

-- Step 1: Check if org 'ics' already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics') THEN
    RAISE NOTICE 'Organization "ics" already exists - checking schema consistency';
    
    -- If org exists but schema is missing, recreate schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') THEN
      RAISE WARNING 'Organization ics exists but schema org_ics is missing - recreating schema';
      CREATE SCHEMA org_ics;
    ELSE
      RAISE NOTICE 'Schema org_ics exists - migration already completed, skipping';
      RETURN; -- Exit early - already migrated
    END IF;
  ELSE
    RAISE NOTICE 'Organization "ics" does not exist - proceeding with creation';
  END IF;
END $$;

-- Step 2: Create organization record (only if not exists)
INSERT INTO public.organizations (name, slug, plan_id, schema_name, status, trial_ends_at)
SELECT 
  'Independent Cinema Showtimes', 
  'ics', 
  (SELECT id FROM public.plans WHERE name = 'free' LIMIT 1),
  'org_ics',
  'active',
  NULL  -- No trial end date for default org
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics');

-- Step 3: Create schema (idempotent)
CREATE SCHEMA IF NOT EXISTS org_ics;

-- Step 4: Bootstrap org schema tables
-- NOTE: This is inline rather than calling bootstrap script to ensure idempotency

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set search path to org_ics for table creation
SET search_path TO org_ics, public;

-- Roles table (system roles for tenant users)
CREATE TABLE IF NOT EXISTS org_ics.roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed system roles
INSERT INTO org_ics.roles (name, description, is_system)
VALUES
  ('admin',  'Full access to all org resources',         TRUE),
  ('editor', 'Can manage cinemas and trigger scrapes',   TRUE),
  ('viewer', 'Read-only access',                         TRUE)
ON CONFLICT (name) DO NOTHING;

-- Users table (tenant members)
CREATE TABLE IF NOT EXISTS org_ics.users (
  id                   SERIAL PRIMARY KEY,
  username             VARCHAR(255) NOT NULL UNIQUE,
  password_hash        TEXT,
  role_id              INTEGER NOT NULL DEFAULT 1 REFERENCES org_ics.roles(id),
  email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token   TEXT,
  verification_expires TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON org_ics.users (username);

-- Invitations table
CREATE TABLE IF NOT EXISTS org_ics.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  role_id     INTEGER NOT NULL DEFAULT 1 REFERENCES org_ics.roles(id),
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by  INTEGER REFERENCES org_ics.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON org_ics.invitations (token);

-- Org Settings table
CREATE TABLE IF NOT EXISTS org_ics.org_settings (
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
  updated_by          INTEGER REFERENCES org_ics.users(id)
);

-- Seed default org settings
INSERT INTO org_ics.org_settings (id, site_name)
VALUES (1, 'Independent Cinema Showtimes')
ON CONFLICT (id) DO NOTHING;

-- Core data tables (cinemas, films, showtimes, etc.)

-- Cinemas table
CREATE TABLE IF NOT EXISTS org_ics.cinemas (
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

-- Films table
CREATE TABLE IF NOT EXISTS org_ics.films (
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

-- Index for films title (trigram similarity for fuzzy search)
CREATE INDEX IF NOT EXISTS idx_films_title_trgm ON org_ics.films USING gin(title gin_trgm_ops);

-- Showtimes table
CREATE TABLE IF NOT EXISTS org_ics.showtimes (
  id TEXT PRIMARY KEY,
  film_id INTEGER NOT NULL,
  cinema_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  datetime_iso TEXT NOT NULL,
  version TEXT,
  format TEXT,
  experiences TEXT,
  week_start TEXT NOT NULL,
  FOREIGN KEY (film_id) REFERENCES org_ics.films(id),
  FOREIGN KEY (cinema_id) REFERENCES org_ics.cinemas(id) ON DELETE CASCADE
);

-- Indexes for showtimes
CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON org_ics.showtimes(cinema_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_film_date ON org_ics.showtimes(film_id, date);
CREATE INDEX IF NOT EXISTS idx_showtimes_week ON org_ics.showtimes(week_start);

-- Weekly programs table
CREATE TABLE IF NOT EXISTS org_ics.weekly_programs (
  id SERIAL PRIMARY KEY,
  cinema_id TEXT NOT NULL,
  film_id INTEGER NOT NULL,
  film_name TEXT,
  week_start TEXT NOT NULL,
  is_new_this_week INTEGER NOT NULL DEFAULT 0,
  scraped_at TEXT NOT NULL,
  FOREIGN KEY (cinema_id) REFERENCES org_ics.cinemas(id) ON DELETE CASCADE,
  FOREIGN KEY (film_id) REFERENCES org_ics.films(id),
  UNIQUE(cinema_id, film_id, week_start)
);

-- Index for weekly_programs
CREATE INDEX IF NOT EXISTS idx_weekly_programs_week ON org_ics.weekly_programs(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_programs_film_name ON org_ics.weekly_programs USING gin(film_name gin_trgm_ops);

-- Scrape reports table
CREATE TABLE IF NOT EXISTS org_ics.scrape_reports (
  id SERIAL PRIMARY KEY,
  scraper_name TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  total_cinemas INTEGER,
  successful_cinemas INTEGER,
  failed_cinemas INTEGER,
  total_films_scraped INTEGER,
  total_showtimes_scraped INTEGER,
  errors JSONB,
  progress_log JSONB
);

-- Indexes for scrape_reports
CREATE INDEX IF NOT EXISTS idx_scrape_reports_started_at ON org_ics.scrape_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_reports_status ON org_ics.scrape_reports(status);

-- Reset search path
SET search_path TO public;

-- Step 5: Migrate data from public schema to org_ics schema
-- Only migrate if tables exist in public schema

-- Migrate cinemas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cinemas') THEN
    INSERT INTO org_ics.cinemas (id, name, address, postal_code, city, screen_count, image_url, url, source)
    SELECT id, name, address, postal_code, city, screen_count, image_url, url, source
    FROM public.cinemas
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.cinemas', (SELECT COUNT(*) FROM public.cinemas);
  ELSE
    RAISE NOTICE 'Table public.cinemas does not exist, skipping migration';
  END IF;
END $$;

-- Migrate films
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'films') THEN
    INSERT INTO org_ics.films (id, title, original_title, poster_url, duration_minutes, release_date, 
                                rerelease_date, genres, nationality, director, screenwriters, actors, 
                                synopsis, certificate, press_rating, audience_rating, source_url, trailer_url)
    SELECT id, title, original_title, poster_url, duration_minutes, release_date,
           rerelease_date, genres, nationality, director, screenwriters, actors,
           synopsis, certificate, press_rating, audience_rating, source_url, trailer_url
    FROM public.films
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.films', (SELECT COUNT(*) FROM public.films);
  ELSE
    RAISE NOTICE 'Table public.films does not exist, skipping migration';
  END IF;
END $$;

-- Migrate showtimes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'showtimes') THEN
    INSERT INTO org_ics.showtimes (id, film_id, cinema_id, date, time, datetime_iso, version, format, experiences, week_start)
    SELECT id, film_id, cinema_id, date, time, datetime_iso, version, format, experiences, week_start
    FROM public.showtimes
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.showtimes', (SELECT COUNT(*) FROM public.showtimes);
  ELSE
    RAISE NOTICE 'Table public.showtimes does not exist, skipping migration';
  END IF;
END $$;

-- Migrate weekly_programs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_programs') THEN
    -- Note: weekly_programs in org schema has film_name column added
    INSERT INTO org_ics.weekly_programs (cinema_id, film_id, week_start, is_new_this_week, scraped_at)
    SELECT cinema_id, film_id, week_start, is_new_this_week, scraped_at
    FROM public.weekly_programs
    ON CONFLICT (cinema_id, film_id, week_start) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.weekly_programs', (SELECT COUNT(*) FROM public.weekly_programs);
  ELSE
    RAISE NOTICE 'Table public.weekly_programs does not exist, skipping migration';
  END IF;
END $$;

-- Migrate scrape_reports
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scrape_reports') THEN
    INSERT INTO org_ics.scrape_reports (id, started_at, completed_at, status, trigger_type, 
                                        total_cinemas, successful_cinemas, failed_cinemas, 
                                        total_films_scraped, total_showtimes_scraped, errors, progress_log)
    SELECT id, started_at, completed_at, status, trigger_type,
           total_cinemas, successful_cinemas, failed_cinemas,
           total_films_scraped, total_showtimes_scraped, errors, progress_log
    FROM public.scrape_reports
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated % rows from public.scrape_reports', (SELECT COUNT(*) FROM public.scrape_reports);
  ELSE
    RAISE NOTICE 'Table public.scrape_reports does not exist, skipping migration';
  END IF;
END $$;

-- Step 6: Associate system admin user as org member
-- Find admin user from public.users with is_system_role=true and add to org_ics.users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    INSERT INTO org_ics.users (username, password_hash, role_id, email_verified)
    SELECT u.username, u.password_hash, r.id, true
    FROM public.users u
    CROSS JOIN org_ics.roles r
    WHERE u.username = 'admin' 
      AND u.is_system_role = true 
      AND r.name = 'admin'
    ON CONFLICT (username) DO NOTHING;
    
    IF FOUND THEN
      RAISE NOTICE 'System admin user associated with org_ics';
    ELSE
      RAISE WARNING 'System admin user not found or already associated';
    END IF;
  ELSE
    RAISE WARNING 'Table public.users does not exist, skipping admin association';
  END IF;
END $$;

-- Step 7: Initialize quota tracking in public.org_usage
INSERT INTO public.org_usage (org_id, month, cinemas_count, users_count, scrapes_count, api_calls_count)
SELECT 
  o.id,
  DATE_TRUNC('month', CURRENT_DATE),
  0,
  0,
  0,
  0
FROM public.organizations o
WHERE o.slug = 'ics'
ON CONFLICT (org_id, month) DO NOTHING;

RAISE NOTICE 'Quota tracking initialized for org ics';

-- Step 8: Verify migration succeeded
DO $$
DECLARE
  org_count INT;
  schema_exists BOOL;
  admin_exists BOOL;
  quota_exists BOOL;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations WHERE slug = 'ics';
  SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') INTO schema_exists;
  SELECT EXISTS(SELECT 1 FROM org_ics.users WHERE username = 'admin') INTO admin_exists;
  SELECT EXISTS(SELECT 1 FROM public.org_usage WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'ics')) INTO quota_exists;
  
  IF org_count = 0 THEN
    RAISE EXCEPTION 'Migration verification failed: org ics not created';
  END IF;
  
  IF NOT schema_exists THEN
    RAISE EXCEPTION 'Migration verification failed: schema org_ics not created';
  END IF;
  
  IF NOT quota_exists THEN
    RAISE EXCEPTION 'Migration verification failed: quota tracking not initialized';
  END IF;
  
  IF NOT admin_exists THEN
    RAISE WARNING 'Admin user not migrated to org_ics - manual intervention may be required';
  END IF;
  
  RAISE NOTICE 'Migration saas_008_create_default_ics_org successful: org=%, schema=%, admin=%, quota=%', 
    org_count, schema_exists, admin_exists, quota_exists;
END $$;

COMMIT;
