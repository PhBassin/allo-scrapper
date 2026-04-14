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

-- Wrap entire migration in single DO block for proper early exit (P2 fix)
DO $$
DECLARE
  should_migrate BOOLEAN := FALSE;
  free_plan_id INT;
  source_count INT;
  target_count INT;
  has_scraper_name BOOLEAN;
  has_is_system_role BOOLEAN;
  inserted_count INT;
BEGIN
  -- Step 1: Check if org 'ics' already exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'ics') THEN
    RAISE NOTICE 'Organization "ics" does not exist - proceeding with creation';
    should_migrate := TRUE;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') THEN
    RAISE WARNING 'Organization ics exists but schema org_ics is missing - recreating schema';
    should_migrate := TRUE;
  ELSE
    RAISE NOTICE 'Schema org_ics exists - migration already completed, skipping';
    RETURN; -- Exit entire migration
  END IF;

  IF NOT should_migrate THEN
    RETURN;
  END IF;

  -- Step 2: Create organization record with plan validation (P6 fix)
  SELECT id INTO free_plan_id FROM public.plans WHERE name = 'free' LIMIT 1;
  
  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create default org: free plan not found in public.plans';
  END IF;
  
  INSERT INTO public.organizations (name, slug, plan_id, schema_name, status, trial_ends_at)
  SELECT 
    'Independent Cinema Showtimes', 
    'ics', 
    free_plan_id,
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
    role_id              INTEGER NOT NULL REFERENCES org_ics.roles(id),
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
    role_id     INTEGER NOT NULL REFERENCES org_ics.roles(id),
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cinemas') THEN
    SELECT COUNT(*) INTO source_count FROM public.cinemas;
    
    INSERT INTO org_ics.cinemas (id, name, address, postal_code, city, screen_count, image_url, url, source)
    SELECT id, name, address, postal_code, city, screen_count, image_url, url, source
    FROM public.cinemas
    ON CONFLICT (id) DO NOTHING;
    
    SELECT COUNT(*) INTO target_count FROM org_ics.cinemas;
    RAISE NOTICE 'Migrated cinemas: % source rows, % rows now in target', source_count, target_count;
  ELSE
    RAISE NOTICE 'Table public.cinemas does not exist, skipping migration';
  END IF;

  -- Migrate films
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'films') THEN
    SELECT COUNT(*) INTO source_count FROM public.films;
    
    INSERT INTO org_ics.films (id, title, original_title, poster_url, duration_minutes, release_date, 
                                rerelease_date, genres, nationality, director, screenwriters, actors, 
                                synopsis, certificate, press_rating, audience_rating, source_url, trailer_url)
    SELECT id, title, original_title, poster_url, duration_minutes, release_date,
           rerelease_date, genres, nationality, director, screenwriters, actors,
           synopsis, certificate, press_rating, audience_rating, source_url, trailer_url
    FROM public.films
    ON CONFLICT (id) DO NOTHING;
    
    SELECT COUNT(*) INTO target_count FROM org_ics.films;
    RAISE NOTICE 'Migrated films: % source rows, % rows now in target', source_count, target_count;
  ELSE
    RAISE NOTICE 'Table public.films does not exist, skipping migration';
  END IF;

  -- Migrate showtimes (P7 fix - filter orphaned FK references)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'showtimes') THEN
    SELECT COUNT(*) INTO source_count FROM public.showtimes;
    
    INSERT INTO org_ics.showtimes (id, film_id, cinema_id, date, time, datetime_iso, version, format, experiences, week_start)
    SELECT s.id, s.film_id, s.cinema_id, s.date, s.time, s.datetime_iso, s.version, s.format, s.experiences, s.week_start
    FROM public.showtimes s
    INNER JOIN org_ics.films f ON s.film_id = f.id
    INNER JOIN org_ics.cinemas c ON s.cinema_id = c.id
    ON CONFLICT (id) DO NOTHING;
    
    SELECT COUNT(*) INTO target_count FROM org_ics.showtimes;
    RAISE NOTICE 'Migrated showtimes: % source rows, % rows now in target', source_count, target_count;
    
    -- Log orphaned rows
    SELECT COUNT(*) INTO source_count
    FROM public.showtimes s
    WHERE NOT EXISTS (SELECT 1 FROM public.films WHERE id = s.film_id)
       OR NOT EXISTS (SELECT 1 FROM public.cinemas WHERE id = s.cinema_id);
    
    IF source_count > 0 THEN
      RAISE WARNING 'Skipped % orphaned showtime rows with invalid FK references', source_count;
    END IF;
  ELSE
    RAISE NOTICE 'Table public.showtimes does not exist, skipping migration';
  END IF;

  -- Migrate weekly_programs (P8 fix - populate film_name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_programs') THEN
    SELECT COUNT(*) INTO source_count FROM public.weekly_programs;
    
    INSERT INTO org_ics.weekly_programs (cinema_id, film_id, film_name, week_start, is_new_this_week, scraped_at)
    SELECT wp.cinema_id, wp.film_id, f.title, wp.week_start, wp.is_new_this_week, wp.scraped_at
    FROM public.weekly_programs wp
    LEFT JOIN public.films f ON wp.film_id = f.id
    ON CONFLICT (cinema_id, film_id, week_start) DO NOTHING;
    
    SELECT COUNT(*) INTO target_count FROM org_ics.weekly_programs;
    RAISE NOTICE 'Migrated weekly_programs: % source rows, % rows now in target', source_count, target_count;
  ELSE
    RAISE NOTICE 'Table public.weekly_programs does not exist, skipping migration';
  END IF;

  -- Migrate scrape_reports (P4 fix - check scraper_name column exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scrape_reports') THEN
    SELECT COUNT(*) INTO source_count FROM public.scrape_reports;
    
    -- Check if scraper_name column exists in source table
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'scrape_reports' 
        AND column_name = 'scraper_name'
    ) INTO has_scraper_name;
    
    IF has_scraper_name THEN
      INSERT INTO org_ics.scrape_reports (id, scraper_name, started_at, completed_at, status, trigger_type, 
                                          total_cinemas, successful_cinemas, failed_cinemas, 
                                          total_films_scraped, total_showtimes_scraped, errors, progress_log)
      SELECT id, scraper_name, started_at, completed_at, status, trigger_type,
             total_cinemas, successful_cinemas, failed_cinemas,
             total_films_scraped, total_showtimes_scraped, errors, progress_log
      FROM public.scrape_reports
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO org_ics.scrape_reports (id, started_at, completed_at, status, trigger_type, 
                                          total_cinemas, successful_cinemas, failed_cinemas, 
                                          total_films_scraped, total_showtimes_scraped, errors, progress_log)
      SELECT id, started_at, completed_at, status, trigger_type,
             total_cinemas, successful_cinemas, failed_cinemas,
             total_films_scraped, total_showtimes_scraped, errors, progress_log
      FROM public.scrape_reports
      ON CONFLICT (id) DO NOTHING;
    END IF;
    
    SELECT COUNT(*) INTO target_count FROM org_ics.scrape_reports;
    RAISE NOTICE 'Migrated scrape_reports: % source rows, % rows now in target', source_count, target_count;
    
    -- P3 fix - Reset sequence to avoid collisions
    PERFORM setval('org_ics.scrape_reports_id_seq', 
      COALESCE((SELECT MAX(id) FROM org_ics.scrape_reports), 0) + 1, 
      false);
  ELSE
    RAISE NOTICE 'Table public.scrape_reports does not exist, skipping migration';
  END IF;

  -- Step 6: Associate system admin user as org member (P5 fix - improved FOUND check)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Check if is_system_role column exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'is_system_role'
    ) INTO has_is_system_role;
    
    IF has_is_system_role THEN
      -- Use is_system_role filter - find first system admin regardless of username
      INSERT INTO org_ics.users (username, password_hash, role_id, email_verified)
      SELECT u.username, u.password_hash, r.id, true
      FROM public.users u
      CROSS JOIN org_ics.roles r
      WHERE u.is_system_role = true AND r.name = 'admin'
      ORDER BY u.id ASC
      LIMIT 1
      ON CONFLICT (username) DO NOTHING;
    ELSE
      -- Fallback: use username='admin'
      INSERT INTO org_ics.users (username, password_hash, role_id, email_verified)
      SELECT u.username, u.password_hash, r.id, true
      FROM public.users u
      CROSS JOIN org_ics.roles r
      WHERE u.username = 'admin' AND r.name = 'admin'
      ON CONFLICT (username) DO NOTHING;
    END IF;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    IF inserted_count > 0 THEN
      RAISE NOTICE 'System admin user associated with org_ics';
    ELSIF EXISTS (SELECT 1 FROM org_ics.users WHERE username IN (SELECT username FROM public.users WHERE is_system_role = true OR username = 'admin')) THEN
      RAISE NOTICE 'System admin user already exists in org_ics';
    ELSE
      RAISE WARNING 'System admin user not found in public.users';
    END IF;
  ELSE
    RAISE WARNING 'Table public.users does not exist, skipping admin association';
  END IF;

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
  DECLARE
    org_count INT;
    schema_exists BOOL;
    admin_exists BOOL;
    quota_exists BOOL;
    quota_counts RECORD;
  BEGIN
    SELECT COUNT(*) INTO org_count FROM public.organizations WHERE slug = 'ics';
    SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_ics') INTO schema_exists;
    SELECT EXISTS(SELECT 1 FROM org_ics.users LIMIT 1) INTO admin_exists;
    
    -- P10 fix: Verify quota exists AND has correct initial values
    SELECT cinemas_count, users_count, scrapes_count, api_calls_count
    INTO quota_counts
    FROM public.org_usage
    WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'ics')
    LIMIT 1;
    
    quota_exists := FOUND;
    
    IF org_count = 0 THEN
      RAISE EXCEPTION 'Migration verification failed: org ics not created';
    END IF;
    
    IF NOT schema_exists THEN
      RAISE EXCEPTION 'Migration verification failed: schema org_ics not created';
    END IF;
    
    IF NOT quota_exists THEN
      RAISE EXCEPTION 'Migration verification failed: quota tracking not initialized';
    END IF;
    
    -- P10 fix: Warn if quota counts are non-zero (indicates re-run of migration)
    IF quota_counts.cinemas_count != 0 OR quota_counts.users_count != 0 OR 
       quota_counts.scrapes_count != 0 OR quota_counts.api_calls_count != 0 THEN
      RAISE WARNING 'Quota tracking exists but counts are non-zero (migration may have been re-run): cinemas=%, users=%, scrapes=%, api_calls=%',
        quota_counts.cinemas_count, quota_counts.users_count, quota_counts.scrapes_count, quota_counts.api_calls_count;
    END IF;
    
    IF NOT admin_exists THEN
      RAISE WARNING 'No users migrated to org_ics - manual intervention may be required';
    END IF;
    
    RAISE NOTICE 'Migration saas_008_create_default_ics_org successful: org=%, schema=%, users_exist=%, quota=%', 
      org_count, schema_exists, admin_exists, quota_exists;
  END;
END $$;

COMMIT;
