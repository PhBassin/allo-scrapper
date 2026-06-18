import { type DB } from './client.js';
import type { Theater, Movie } from '../types/scraper.js';
import { logger } from '../utils/logger.js';
import { parseJSONMemoized } from '../utils/json-parse-cache.js';

// --- Database Row Interfaces ---

interface MovieRow {
  id: number;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  duration_minutes: number | null;
  release_date: string | null;
  rerelease_date: string | null;
  genres: string | null; // JSON string
  nationality: string | null;
  director: string | null;
  screenwriters: string | null; // JSON string
  actors: string | null; // JSON string
  synopsis: string | null;
  certificate: string | null;
  press_rating: number | null;
  audience_rating: number | null;
  source_url: string;
  trailer_url: string | null;
}

interface WeeklyMovieRow extends MovieRow {
  theater_id: string;
  theater_name: string;
  theater_address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  theater_image_url: string | null;
}

// --- Sanitization ---

/**
 * Numeric Movie fields that can carry NaN/Infinity from upstream parsers.
 * Defense-in-depth: the parser should already filter these, but the DB layer
 * must never accept NaN/Infinity (Postgres rejects with `invalid input syntax`).
 */
const NUMERIC_MOVIE_FIELDS = ['duration_minutes', 'press_rating', 'audience_rating'] as const;

/**
 * Sanitize a single numeric value: returns null for non-finite numbers (NaN, Infinity).
 */
function sanitizeNumericValue(
  value: number | undefined | null,
  fieldName: string,
  movieId: number
): number | null {
  if (value === undefined || value === null) return null;

  if (!Number.isFinite(value)) {
    logger.warn(`⚠️  Invalid ${fieldName} value (${value}) for movie ID ${movieId}, converting to null`);
    return null;
  }

  return value;
}

/**
 * Sanitize a Movie object before database insertion to prevent NaN/Infinity errors.
 * Defense-in-depth layer in case the parser doesn't catch all edge cases.
 */
function sanitizeMovie(movie: Movie): Movie {
  const sanitized: Movie = { ...movie };

  for (const field of NUMERIC_MOVIE_FIELDS) {
    const value = sanitized[field];
    const sanitizedValue =
      value !== undefined ? sanitizeNumericValue(value, field, movie.id) ?? undefined : undefined;
    // Numeric Movie fields are optional `number | undefined`; assign through unknown
    // to bypass the discriminated-union type check.
    (sanitized as unknown as Record<string, unknown>)[field] = sanitizedValue;
  }

  return sanitized;
}

// --- Row → Domain mapping ---

/**
 * Transform a raw MovieRow (from database) into a Movie domain object.
 *
 * Handles all nullish-coalescing (null → undefined) and JSON parsing
 * (genres, screenwriters, actors) in one place. Used by getMovie,
 * getMoviesByDate, getWeeklyMovies, and searchMovies.
 */
export function formatMovieRow(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    original_title: row.original_title ?? undefined,
    poster_url: row.poster_url ?? undefined,
    duration_minutes: row.duration_minutes ?? undefined,
    release_date: row.release_date ?? undefined,
    rerelease_date: row.rerelease_date ?? undefined,
    genres: parseJSONMemoized(row.genres),
    nationality: row.nationality ?? undefined,
    director: row.director ?? undefined,
    screenwriters: parseJSONMemoized(row.screenwriters),
    actors: parseJSONMemoized(row.actors),
    synopsis: row.synopsis ?? undefined,
    certificate: row.certificate ?? undefined,
    press_rating: row.press_rating ?? undefined,
    audience_rating: row.audience_rating ?? undefined,
    source_url: row.source_url,
    trailer_url: row.trailer_url ?? undefined,
  };
}

/**
 * Extract a Theater domain object from a WeeklyMovieRow's joined columns.
 */
function theaterFromWeeklyRow(row: WeeklyMovieRow): Theater {
  return {
    id: row.theater_id,
    name: row.theater_name,
    address: row.theater_address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    screen_count: row.screen_count ?? undefined,
    image_url: row.theater_image_url ?? undefined,
  };
}

/**
 * Group weekly-movie rows into distinct movies, each carrying the list of
 * theaters that programmed it. Used by both getMoviesByDate and getWeeklyMovies.
 */
function groupMoviesWithTheaters(
  rows: WeeklyMovieRow[]
): Array<Movie & { theaters: Theater[] }> {
  const moviesMap = new Map<number, Movie & { theaters: Theater[] }>();

  for (const row of rows) {
    let entry = moviesMap.get(row.id);
    if (!entry) {
      entry = { ...formatMovieRow(row), theaters: [] };
      moviesMap.set(row.id, entry);
    }
    entry.theaters.push(theaterFromWeeklyRow(row));
  }

  return Array.from(moviesMap.values());
}

// --- Insertion / Updates ---

/**
 * Insert or update a Movie record.
 *
 * Sanitizes numeric fields first to prevent NaN/Infinity from reaching the database.
 * COALESCE on duration_minutes / trailer_url preserves existing values when the
 * incoming payload sets them to null (treats null as "don't touch").
 */
export async function upsertMovie(db: DB, movie: Movie): Promise<void> {
  const sanitized = sanitizeMovie(movie);

  await db.query(
    `
      INSERT INTO movies (
        id, title, original_title, poster_url, duration_minutes,
        release_date, rerelease_date, genres, nationality, director,
        screenwriters, actors, synopsis, certificate, press_rating, audience_rating, source_url, trailer_url
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT(id) DO UPDATE SET
        title = $2,
        original_title = $3,
        poster_url = $4,
        duration_minutes = COALESCE($5, movies.duration_minutes),
        release_date = COALESCE($6, movies.release_date),
        rerelease_date = $7,
        genres = $8,
        nationality = $9,
        director = $10,
        screenwriters = $11,
        actors = $12,
        synopsis = $13,
        certificate = $14,
        press_rating = $15,
        audience_rating = $16,
        source_url = $17,
        trailer_url = COALESCE($18, movies.trailer_url)
    `,
    [
      sanitized.id,
      sanitized.title,
      sanitized.original_title ?? null,
      sanitized.poster_url ?? null,
      sanitized.duration_minutes ?? null,
      sanitized.release_date ?? null,
      sanitized.rerelease_date ?? null,
      JSON.stringify(sanitized.genres),
      sanitized.nationality ?? null,
      sanitized.director ?? null,
      JSON.stringify(sanitized.screenwriters ?? []),
      JSON.stringify(sanitized.actors),
      sanitized.synopsis ?? null,
      sanitized.certificate ?? null,
      sanitized.press_rating ?? null,
      sanitized.audience_rating ?? null,
      sanitized.source_url,
      sanitized.trailer_url ?? null,
    ]
  );
}

// --- Lookups by ID / date / week ---

/**
 * Fetch a single movie by its primary key.
 */
export async function getMovie(db: DB, movieId: number): Promise<Movie | undefined> {
  const result = await db.query<MovieRow>(
    'SELECT * FROM movies WHERE id = $1',
    [movieId]
  );

  const row = result.rows[0];
  return row ? formatMovieRow(row) : undefined;
}

/**
 * Movies programmed on a specific date within a given week, each carrying the
 * list of theaters that screen it on that date.
 */
export async function getMoviesByDate(
  db: DB,
  date: string,
  weekStart: string
): Promise<Array<Movie & { theaters: Theater[] }>> {
  const result = await db.query<WeeklyMovieRow>(
    `
      SELECT DISTINCT
        f.*,
        c.id as theater_id,
        c.name as theater_name,
        c.address as theater_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as theater_image_url
      FROM showtimes s
      JOIN movies f ON s.movie_id = f.id
      JOIN theaters c ON s.theater_id = c.id
      WHERE s.date = $1 AND s.week_start = $2
      ORDER BY f.title
    `,
    [date, weekStart]
  );

  return groupMoviesWithTheaters(result.rows);
}

/**
 * Movies programmed during a given week, each carrying the list of theaters
 * that include it in their weekly program.
 */
export async function getWeeklyMovies(
  db: DB,
  weekStart: string
): Promise<Array<Movie & { theaters: Theater[] }>> {
  const result = await db.query<WeeklyMovieRow>(
    `
      SELECT DISTINCT
        f.*,
        c.id as theater_id,
        c.name as theater_name,
        c.address as theater_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as theater_image_url
      FROM weekly_programs wp
      JOIN movies f ON wp.movie_id = f.id
      JOIN theaters c ON wp.theater_id = c.id
      WHERE wp.week_start = $1
      ORDER BY f.title
    `,
    [weekStart]
  );

  return groupMoviesWithTheaters(result.rows);
}

// --- Movie Search ---

/**
 * Scoring CASE expression for movie search.
 *
 * Strategies (ordered by priority):
 *  1. Exact match on title or original_title      (score 1.0 / 0.95)
 *  2. Prefix match                                  (score 0.9 / 0.85)
 *  3. High trigram similarity (>0.3)                (score 0.6–0.8)
 *  4. Moderate trigram similarity (>0.1)            (score 0.5–0.6)
 *  5. Substring match (ILIKE %query%)               (score 0.4 / 0.35)
 *  6. Fallback                                       (score 0.1)
 */
const MOVIE_SEARCH_SCORING_SQL = `
  CASE
    WHEN LOWER(title) = LOWER($1) THEN 1.0
    WHEN original_title IS NOT NULL AND LOWER(original_title) = LOWER($1) THEN 0.95
    WHEN LOWER(title) LIKE LOWER($1) || '%' THEN 0.9
    WHEN original_title IS NOT NULL AND LOWER(original_title) LIKE LOWER($1) || '%' THEN 0.85
    WHEN similarity(title, $1) > 0.3 THEN similarity(title, $1) * 0.8
    WHEN original_title IS NOT NULL AND similarity(original_title, $1) > 0.3 THEN similarity(original_title, $1) * 0.75
    WHEN similarity(title, $1) > 0.1 THEN similarity(title, $1) * 0.6
    WHEN original_title IS NOT NULL AND similarity(original_title, $1) > 0.1 THEN similarity(original_title, $1) * 0.55
    WHEN title ILIKE '%' || $1 || '%' THEN 0.4
    WHEN original_title IS NOT NULL AND original_title ILIKE '%' || $1 || '%' THEN 0.35
    ELSE 0.1
  END
`;

/**
 * Search movies using fuzzy matching (trigram similarity + partial match)
 * with multi-strategy scoring for permissive results.
 *
 * See {@link MOVIE_SEARCH_SCORING_SQL} for the priority order of match strategies.
 *
 * @param db    Database connection
 * @param query Search query string
 * @param limit Maximum number of results (default: 10)
 */
export async function searchMovies(
  db: DB,
  query: string,
  limit: number = 10
): Promise<Movie[]> {
  const result = await db.query<MovieRow>(
    `SELECT
      id, title, original_title, poster_url, duration_minutes,
      release_date, rerelease_date, genres, nationality, director,
      screenwriters, actors, synopsis, certificate, press_rating, audience_rating,
      source_url,
      trailer_url,
      ${MOVIE_SEARCH_SCORING_SQL} AS score
    FROM movies
    WHERE
      similarity(title, $1) > 0.1
      OR (original_title IS NOT NULL AND similarity(original_title, $1) > 0.1)
      OR title ILIKE '%' || $1 || '%'
      OR (original_title IS NOT NULL AND original_title ILIKE '%' || $1 || '%')
    ORDER BY score DESC, title ASC
    LIMIT $2`,
    [query, limit]
  );

  return result.rows.map(formatMovieRow);
}