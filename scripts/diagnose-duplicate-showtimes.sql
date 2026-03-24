-- =====================================================
-- Diagnostic script for duplicate showtimes
-- =====================================================
-- Purpose: Identify duplicate movie showtimes in database
-- Usage: docker compose exec -T ics-db psql -U postgres -d ics < scripts/diagnose-duplicate-showtimes.sql
-- Issue: #648

-- =====================================================
-- 1. Count total showtimes
-- =====================================================
\echo '===================================================='
\echo '1. TOTAL SHOWTIMES COUNT'
\echo '===================================================='

SELECT 
  COUNT(*) as total_showtimes,
  COUNT(DISTINCT id) as unique_ids,
  COUNT(*) - COUNT(DISTINCT id) as impossible_duplicates_same_id
FROM showtimes;

\echo ''

-- =====================================================
-- 2. Count logical duplicates (same screening, different IDs)
-- =====================================================
\echo '===================================================='
\echo '2. LOGICAL DUPLICATES (same cinema/film/date/time/version)'
\echo '===================================================='

WITH duplicate_groups AS (
  SELECT 
    cinema_id, 
    film_id, 
    date, 
    time, 
    COALESCE(version, 'NULL') as version,
    COUNT(*) as duplicate_count,
    COUNT(DISTINCT id) as unique_ids_in_group
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, COALESCE(version, 'NULL')
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) as total_duplicate_groups,
  SUM(duplicate_count) as total_duplicate_showtimes,
  SUM(duplicate_count - 1) as redundant_records,
  MIN(duplicate_count) as min_duplicates_per_group,
  MAX(duplicate_count) as max_duplicates_per_group,
  ROUND(AVG(duplicate_count), 2) as avg_duplicates_per_group
FROM duplicate_groups;

\echo ''

-- =====================================================
-- 3. Show worst offenders (most duplicated screenings)
-- =====================================================
\echo '===================================================='
\echo '3. TOP 10 MOST DUPLICATED SCREENINGS'
\echo '===================================================='

WITH duplicate_groups AS (
  SELECT 
    cinema_id, 
    film_id, 
    date, 
    time, 
    COALESCE(version, 'NULL') as version,
    COUNT(*) as duplicate_count
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, COALESCE(version, 'NULL')
  HAVING COUNT(*) > 1
)
SELECT 
  dg.cinema_id,
  c.name as cinema_name,
  dg.film_id,
  f.title as film_title,
  dg.date,
  dg.time,
  dg.version,
  dg.duplicate_count
FROM duplicate_groups dg
LEFT JOIN cinemas c ON dg.cinema_id = c.id
LEFT JOIN films f ON dg.film_id = f.id
ORDER BY dg.duplicate_count DESC, dg.date DESC
LIMIT 10;

\echo ''

-- =====================================================
-- 4. Show example duplicate IDs for inspection
-- =====================================================
\echo '===================================================='
\echo '4. EXAMPLE DUPLICATE IDs (first 5 groups)'
\echo '===================================================='

WITH duplicate_groups AS (
  SELECT 
    cinema_id, 
    film_id, 
    date, 
    time, 
    COALESCE(version, 'NULL') as version,
    COUNT(*) as duplicate_count
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, COALESCE(version, 'NULL')
  HAVING COUNT(*) > 1
  LIMIT 5
)
SELECT 
  s.id,
  s.cinema_id,
  c.name as cinema_name,
  s.film_id,
  f.title as film_title,
  s.date,
  s.time,
  s.version,
  s.format,
  s.experiences,
  s.datetime_iso
FROM showtimes s
INNER JOIN duplicate_groups dg 
  ON s.cinema_id = dg.cinema_id 
  AND s.film_id = dg.film_id 
  AND s.date = dg.date 
  AND s.time = dg.time 
  AND COALESCE(s.version, 'NULL') = dg.version
LEFT JOIN cinemas c ON s.cinema_id = c.id
LEFT JOIN films f ON s.film_id = f.id
ORDER BY s.cinema_id, s.film_id, s.date, s.time, s.id;

\echo ''

-- =====================================================
-- 5. Analyze ID patterns (AlloCiné source ID changes)
-- =====================================================
\echo '===================================================='
\echo '5. ID PATTERN ANALYSIS'
\echo '===================================================='

WITH duplicate_groups AS (
  SELECT 
    cinema_id, 
    film_id, 
    date, 
    time, 
    COALESCE(version, 'NULL') as version,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY id) as all_ids
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, COALESCE(version, 'NULL')
  HAVING COUNT(*) > 1
  LIMIT 3
)
SELECT 
  cinema_id,
  film_id,
  date,
  time,
  version,
  duplicate_count,
  all_ids,
  array_length(all_ids, 1) as id_count
FROM duplicate_groups;

\echo ''

-- =====================================================
-- 6. Duplicates by date (recent vs old)
-- =====================================================
\echo '===================================================='
\echo '6. DUPLICATES BY DATE RANGE'
\echo '===================================================='

WITH duplicate_groups AS (
  SELECT 
    cinema_id, 
    film_id, 
    date, 
    time, 
    COALESCE(version, 'NULL') as version
  FROM showtimes
  GROUP BY cinema_id, film_id, date, time, COALESCE(version, 'NULL')
  HAVING COUNT(*) > 1
)
SELECT 
  s.date,
  COUNT(*) as duplicate_showtimes_on_this_date
FROM showtimes s
INNER JOIN duplicate_groups dg 
  ON s.cinema_id = dg.cinema_id 
  AND s.film_id = dg.film_id 
  AND s.date = dg.date 
  AND s.time = dg.time 
  AND COALESCE(s.version, 'NULL') = dg.version
GROUP BY s.date
ORDER BY s.date DESC
LIMIT 20;

\echo ''

-- =====================================================
-- 7. Summary and recommendations
-- =====================================================
\echo '===================================================='
\echo '7. DIAGNOSTIC SUMMARY'
\echo '===================================================='

WITH stats AS (
  SELECT 
    COUNT(*) as total_showtimes,
    COUNT(DISTINCT (cinema_id, film_id, date, time, COALESCE(version, 'NULL'))) as unique_logical_showtimes,
    COUNT(*) - COUNT(DISTINCT (cinema_id, film_id, date, time, COALESCE(version, 'NULL'))) as redundant_records
  FROM showtimes
)
SELECT 
  total_showtimes,
  unique_logical_showtimes,
  redundant_records,
  ROUND(100.0 * redundant_records / total_showtimes, 2) as duplicate_percentage
FROM stats;

\echo ''
\echo 'RECOMMENDATIONS:'
\echo '  - If redundant_records > 0: Add UNIQUE constraint on (cinema_id, film_id, date, time, version)'
\echo '  - If redundant_records > 100: Run cleanup script before adding constraint'
\echo '  - If duplicate_percentage > 10%: Investigate scraper logic for deduplication'
\echo ''
\echo 'Next steps: Review issue #648 for action plan'
\echo '===================================================='
