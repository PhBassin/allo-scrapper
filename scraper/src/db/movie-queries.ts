import { type DB } from './client.js';
import type { Movie } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

// --- Database Row Interfaces ---

export interface MovieRow {
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

// Récupérer un film par son ID
export async function getMovie(db: DB, movieId: number): Promise<Movie | undefined> {
  const result = await db.query<MovieRow>(
    'SELECT * FROM movies WHERE id = $1',
    [movieId]
  );

  const row = result.rows[0];
  if (!row) return undefined;

  return rowToMovie(row);
}

/**
 * Récupérer plusieurs films par leurs IDs en une seule requête.
 * Évite le N+1 lorsqu'on traite plusieurs films dans une boucle.
 */
export async function getMoviesBatch(db: DB, movieIds: number[]): Promise<Map<number, Movie>> {
  if (movieIds.length === 0) return new Map();

  const result = await db.query<MovieRow>(
    'SELECT * FROM movies WHERE id = ANY($1)',
    [movieIds]
  );

  const map = new Map<number, Movie>();
  for (const row of result.rows) {
    map.set(row.id, rowToMovie(row));
  }
  return map;
}

function rowToMovie(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    original_title: row.original_title ?? undefined,
    poster_url: row.poster_url ?? undefined,
    duration_minutes: row.duration_minutes ?? undefined,
    release_date: row.release_date ?? undefined,
    rerelease_date: row.rerelease_date ?? undefined,
    genres: JSON.parse(row.genres ?? '[]'),
    nationality: row.nationality ?? undefined,
    director: row.director ?? undefined,
    screenwriters: JSON.parse(row.screenwriters ?? '[]'),
    actors: JSON.parse(row.actors ?? '[]'),
    synopsis: row.synopsis ?? undefined,
    certificate: row.certificate ?? undefined,
    press_rating: row.press_rating ?? undefined,
    audience_rating: row.audience_rating ?? undefined,
    source_url: row.source_url,
    trailer_url: row.trailer_url ?? undefined,
  };
}

/**
 * Sanitize numeric fields in a Movie object to prevent NaN/Infinity from being inserted.
 * Converts NaN and Infinity to null with warning logs.
 */
function sanitizeNumericValue(value: number | undefined | null, fieldName: string, movieId: number): number | null {
  if (value === undefined || value === null) return null;
  
  if (!Number.isFinite(value)) {
    logger.warn('Invalid numeric value detected', { field: fieldName, value, movieId });
    return null;
  }
  
  return value;
}

/**
 * Sanitize a Movie object before database insertion to prevent NaN/Infinity errors.
 * This is a defense-in-depth layer in case the parser doesn't catch all edge cases.
 */
function sanitizeMovie(movie: Movie): Movie {
  return {
    ...movie,
    duration_minutes: movie.duration_minutes !== undefined
      ? sanitizeNumericValue(movie.duration_minutes, 'duration_minutes', movie.id) ?? undefined
      : undefined,
    press_rating: movie.press_rating !== undefined
      ? sanitizeNumericValue(movie.press_rating, 'press_rating', movie.id) ?? undefined
      : undefined,
    audience_rating: movie.audience_rating !== undefined
      ? sanitizeNumericValue(movie.audience_rating, 'audience_rating', movie.id) ?? undefined
      : undefined,
  };
}

// Insertion ou mise à jour d'un film
export async function upsertMovie(db: DB, movie: Movie): Promise<void> {
  // Sanitize movie data to prevent NaN/Infinity from reaching the database
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
