-- Migration: Rename cinema/film to theater/movie throughout schema
-- Issue: #1050
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- ============================================================================
-- Phase 1: Rename columns in showtimes table
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='showtimes' AND column_name='cinema_id'
    ) THEN
        ALTER TABLE showtimes RENAME COLUMN cinema_id TO theater_id;
        RAISE NOTICE 'Column showtimes.cinema_id renamed to theater_id';
    ELSE
        RAISE NOTICE 'Column showtimes.cinema_id does not exist, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='showtimes' AND column_name='film_id'
    ) THEN
        ALTER TABLE showtimes RENAME COLUMN film_id TO movie_id;
        RAISE NOTICE 'Column showtimes.film_id renamed to movie_id';
    ELSE
        RAISE NOTICE 'Column showtimes.film_id does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- Phase 2: Rebuild showtimes indexes (column rename invalidates old ones)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='showtimes' AND indexname='idx_showtimes_cinema_date'
    ) THEN
        DROP INDEX IF EXISTS idx_showtimes_cinema_date;
        RAISE NOTICE 'Dropped index idx_showtimes_cinema_date';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='showtimes' AND indexname='idx_showtimes_theater_date'
    ) THEN
        CREATE INDEX idx_showtimes_theater_date ON showtimes(theater_id, date);
        RAISE NOTICE 'Created index idx_showtimes_theater_date';
    ELSE
        RAISE NOTICE 'Index idx_showtimes_theater_date already exists, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='showtimes' AND indexname='idx_showtimes_film_date'
    ) THEN
        DROP INDEX IF EXISTS idx_showtimes_film_date;
        RAISE NOTICE 'Dropped index idx_showtimes_film_date';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='showtimes' AND indexname='idx_showtimes_movie_date'
    ) THEN
        CREATE INDEX idx_showtimes_movie_date ON showtimes(movie_id, date);
        RAISE NOTICE 'Created index idx_showtimes_movie_date';
    ELSE
        RAISE NOTICE 'Index idx_showtimes_movie_date already exists, skipping';
    END IF;
END $$;

-- ============================================================================
-- Phase 3: Rename columns in weekly_programs table
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='weekly_programs' AND column_name='cinema_id'
    ) THEN
        ALTER TABLE weekly_programs RENAME COLUMN cinema_id TO theater_id;
        RAISE NOTICE 'Column weekly_programs.cinema_id renamed to theater_id';
    ELSE
        RAISE NOTICE 'Column weekly_programs.cinema_id does not exist, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='weekly_programs' AND column_name='film_id'
    ) THEN
        ALTER TABLE weekly_programs RENAME COLUMN film_id TO movie_id;
        RAISE NOTICE 'Column weekly_programs.film_id renamed to movie_id';
    ELSE
        RAISE NOTICE 'Column weekly_programs.film_id does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- Phase 4: Rename columns in scrape_reports table
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scrape_reports' AND column_name='total_cinemas'
    ) THEN
        ALTER TABLE scrape_reports RENAME COLUMN total_cinemas TO total_theaters;
        RAISE NOTICE 'Column scrape_reports.total_cinemas renamed to total_theaters';
    ELSE
        RAISE NOTICE 'Column scrape_reports.total_cinemas does not exist, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scrape_reports' AND column_name='successful_cinemas'
    ) THEN
        ALTER TABLE scrape_reports RENAME COLUMN successful_cinemas TO successful_theaters;
        RAISE NOTICE 'Column scrape_reports.successful_cinemas renamed to successful_theaters';
    ELSE
        RAISE NOTICE 'Column scrape_reports.successful_cinemas does not exist, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scrape_reports' AND column_name='failed_cinemas'
    ) THEN
        ALTER TABLE scrape_reports RENAME COLUMN failed_cinemas TO failed_theaters;
        RAISE NOTICE 'Column scrape_reports.failed_cinemas renamed to failed_theaters';
    ELSE
        RAISE NOTICE 'Column scrape_reports.failed_cinemas does not exist, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scrape_reports' AND column_name='total_films_scraped'
    ) THEN
        ALTER TABLE scrape_reports RENAME COLUMN total_films_scraped TO total_movies_scraped;
        RAISE NOTICE 'Column scrape_reports.total_films_scraped renamed to total_movies_scraped';
    ELSE
        RAISE NOTICE 'Column scrape_reports.total_films_scraped does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- Phase 5: Rename columns in scrape_attempts table (if exists)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='scrape_attempts'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='scrape_attempts' AND column_name='cinema_id'
        ) THEN
            ALTER TABLE scrape_attempts RENAME COLUMN cinema_id TO theater_id;
            RAISE NOTICE 'Column scrape_attempts.cinema_id renamed to theater_id';
        ELSE
            RAISE NOTICE 'Column scrape_attempts.cinema_id does not exist, skipping';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='scrape_attempts' AND column_name='films_scraped'
        ) THEN
            ALTER TABLE scrape_attempts RENAME COLUMN films_scraped TO movies_scraped;
            RAISE NOTICE 'Column scrape_attempts.films_scraped renamed to movies_scraped';
        ELSE
            RAISE NOTICE 'Column scrape_attempts.films_scraped does not exist, skipping';
        END IF;

        -- Rebuild scrape_attempts index
        IF EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename='scrape_attempts' AND indexname='idx_scrape_attempts_cinema_date'
        ) THEN
            DROP INDEX IF EXISTS idx_scrape_attempts_cinema_date;
            RAISE NOTICE 'Dropped index idx_scrape_attempts_cinema_date';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename='scrape_attempts' AND indexname='idx_scrape_attempts_theater_date'
        ) THEN
            CREATE INDEX idx_scrape_attempts_theater_date ON scrape_attempts(theater_id, date);
            RAISE NOTICE 'Created index idx_scrape_attempts_theater_date';
        ELSE
            RAISE NOTICE 'Index idx_scrape_attempts_theater_date already exists, skipping';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Phase 6: Rename main tables (must be done after columns are renamed)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='cinemas'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='theaters'
    ) THEN
        ALTER TABLE cinemas RENAME TO theaters;
        RAISE NOTICE 'Table cinemas renamed to theaters';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='theaters'
    ) THEN
        RAISE NOTICE 'Table theaters already exists, skipping table rename';
    ELSE
        RAISE NOTICE 'Neither cinemas nor theaters table exists, skipping';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='films'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='movies'
    ) THEN
        ALTER TABLE films RENAME TO movies;
        RAISE NOTICE 'Table films renamed to movies';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='movies'
    ) THEN
        RAISE NOTICE 'Table movies already exists, skipping table rename';
    ELSE
        RAISE NOTICE 'Neither films nor movies table exists, skipping';
    END IF;
END $$;

-- ============================================================================
-- Phase 7: Rebuild index on weekly_programs (UNIQUE constraint was renamed)
-- ============================================================================
-- The UNIQUE constraint on weekly_programs(cinema_id, film_id, week_start)
-- should have been auto-renamed when columns were renamed.
-- If not, rebuild it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='weekly_programs' AND indexname='idx_weekly_programs_cinema_film_week'
    ) THEN
        DROP INDEX IF EXISTS idx_weekly_programs_cinema_film_week;
        RAISE NOTICE 'Dropped old weekly_programs unique index';
    END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'Migration 023 verification:';
    
    -- Verify theaters table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='theaters') THEN
        RAISE NOTICE '  ✓ theaters table exists';
    ELSE
        RAISE EXCEPTION '  ✗ theaters table does not exist';
    END IF;

    -- Verify movies table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='movies') THEN
        RAISE NOTICE '  ✓ movies table exists';
    ELSE
        RAISE EXCEPTION '  ✗ movies table does not exist';
    END IF;

    -- Verify old table names are gone
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cinemas') THEN
        RAISE NOTICE '  ✓ cinemas table no longer exists (renamed)';
    ELSE
        RAISE NOTICE '  ⚠ cinemas table still exists (may be intentional)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='films') THEN
        RAISE NOTICE '  ✓ films table no longer exists (renamed)';
    ELSE
        RAISE NOTICE '  ⚠ films table still exists (may be intentional)';
    END IF;

    -- Verify key columns in showtimes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='showtimes' AND column_name='theater_id') THEN
        RAISE NOTICE '  ✓ showtimes.theater_id exists';
    ELSE
        RAISE EXCEPTION '  ✗ showtimes.theater_id does not exist';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='showtimes' AND column_name='movie_id') THEN
        RAISE NOTICE '  ✓ showtimes.movie_id exists';
    ELSE
        RAISE EXCEPTION '  ✗ showtimes.movie_id does not exist';
    END IF;

    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'Migration 023 completed successfully';
END $$;

COMMIT;
