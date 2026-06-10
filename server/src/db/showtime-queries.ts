// fallow-ignore-file security-sink
import { type DB } from './client.js';
import type { Theater, Movie, Showtime, WeeklyProgram } from '../types/scraper.js';
import { parseJSONMemoized } from '../utils/json-parse-cache.js';

// --- Database Row Interfaces ---

interface ShowtimeRow {
  id: string;
  movie_id: number;
  theater_id: string;
  date: string;
  time: string;
  datetime_iso: string;
  version: string | null;
  format: string | null;
  experiences: string | null; // JSON string
  week_start: string;
}

interface ShowtimeWithMovieRow extends ShowtimeRow {
  movie_title: string;
  original_title: string | null;
  poster_url: string | null;
  duration_minutes: number | null;
  release_date: string | null;
  rerelease_date: string | null;
  genres: string | null;
  nationality: string | null;
  director: string | null;
  screenwriters: string | null;
  actors: string | null;
  synopsis: string | null;
  certificate: string | null;
  press_rating: number | null;
  audience_rating: number | null;
  source_url: string;
  trailer_url: string | null;
}

interface ShowtimeWithTheaterRow extends ShowtimeRow {
  theater_name: string;
  theater_address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  theater_image_url: string | null;
}

// --- Row Mapping Helpers ---

function mapRowToShowtime(row: ShowtimeRow): Showtime {
  return {
    id: row.id,
    movie_id: row.movie_id,
    theater_id: row.theater_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
  };
}

function mapRowToMovie(row: ShowtimeWithMovieRow): Movie {
  return {
    id: row.movie_id,
    title: row.movie_title,
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

function mapRowToTheater(row: ShowtimeWithTheaterRow): Theater {
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

// Insertion ou mise à jour de plusieurs séances
export async function upsertShowtimes(db: DB, showtimes: Showtime[]): Promise<void> {
  if (showtimes.length === 0) return;

  const values: any[] = [];
  const valueSets: string[] = [];
  let paramIndex = 1;

  for (const showtime of showtimes) {
    valueSets.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`);
    values.push(
      showtime.id,
      showtime.movie_id,
      showtime.theater_id,
      showtime.date,
      showtime.time,
      showtime.datetime_iso,
      showtime.version || null,
      showtime.format || null,
      JSON.stringify(showtime.experiences),
      showtime.week_start
    );
    paramIndex += 10;
  }

  await db.query(
    `
      INSERT INTO showtimes (
        id, movie_id, theater_id, date, time, datetime_iso,
        version, format, experiences, week_start
      )
      VALUES ${valueSets.join(', ')}
      ON CONFLICT(id) DO UPDATE SET
        date = EXCLUDED.date,
        time = EXCLUDED.time,
        datetime_iso = EXCLUDED.datetime_iso,
        version = EXCLUDED.version,
        format = EXCLUDED.format,
        experiences = EXCLUDED.experiences,
        week_start = EXCLUDED.week_start
    `,
    values
  );
}

// Insertion ou mise à jour d'un programme hebdomadaire
export async function upsertWeeklyProgram(db: DB, program: WeeklyProgram): Promise<void> {
  await db.query(
    `
      INSERT INTO weekly_programs (theater_id, movie_id, week_start, is_new_this_week, scraped_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(theater_id, movie_id, week_start) DO UPDATE SET
        is_new_this_week = $4,
        scraped_at = $5
    `,
    [
      program.theater_id,
      program.movie_id,
      program.week_start,
      program.is_new_this_week ? 1 : 0,
      program.scraped_at,
    ]
  );
}

// Insertion ou mise à jour de plusieurs programmes hebdomadaires
export async function upsertWeeklyPrograms(db: DB, programs: WeeklyProgram[]): Promise<void> {
  if (programs.length === 0) return;

  const values: any[] = [];
  const valueSets: string[] = [];
  let paramIndex = 1;

  for (const program of programs) {
    valueSets.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
    values.push(
      program.theater_id,
      program.movie_id,
      program.week_start,
      program.is_new_this_week ? 1 : 0,
      program.scraped_at
    );
    paramIndex += 5;
  }

  await db.query(
    `
      INSERT INTO weekly_programs (theater_id, movie_id, week_start, is_new_this_week, scraped_at)
      VALUES ${valueSets.join(', ')}
      ON CONFLICT(theater_id, movie_id, week_start) DO UPDATE SET
        is_new_this_week = EXCLUDED.is_new_this_week,
        scraped_at = EXCLUDED.scraped_at
    `,
    values
  );
}

// Récupérer les séances d'un theater pour une semaine donnée
export async function getShowtimesByTheaterAndWeek(
  db: DB,
  theaterId: string,
  weekStart: string
): Promise<Array<Showtime & { movie: Movie }>> {
  const result = await db.query<ShowtimeWithMovieRow>(
    `
      SELECT 
        s.*,
        f.id as movie_id,
        f.title as movie_title,
        f.original_title,
        f.poster_url,
        f.duration_minutes,
        f.release_date,
        f.rerelease_date,
        f.genres,
        f.nationality,
        f.director,
        f.screenwriters,
        f.actors,
        f.synopsis,
        f.certificate,
        f.press_rating,
        f.audience_rating,
        f.source_url,
        f.trailer_url
      FROM showtimes s
      JOIN movies f ON s.movie_id = f.id
      WHERE s.theater_id = $1 AND s.week_start = $2
      ORDER BY s.date, f.title, s.time
    `,
    [theaterId, weekStart]
  );

  return result.rows.map((row) => ({
    ...mapRowToShowtime(row),
    movie: mapRowToMovie(row),
  }));
}

// Récupérer les séances pour une date spécifique
export async function getShowtimesByDate(
  db: DB,
  date: string,
  weekStart: string
): Promise<Array<Showtime & { theater: Theater }>> {
  const result = await db.query<ShowtimeWithTheaterRow>(
    `
      SELECT 
        s.*,
        c.id as theater_id,
        c.name as theater_name,
        c.address as theater_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as theater_image_url
      FROM showtimes s
      JOIN theaters c ON s.theater_id = c.id
      WHERE s.date = $1 AND s.week_start = $2
      ORDER BY s.time, c.name
    `,
    [date, weekStart]
  );

  return result.rows.map((row) => ({
    ...mapRowToShowtime(row),
    theater: mapRowToTheater(row),
  }));
}

// Récupérer les séances d'un movie pour une semaine donnée, groupées par theater
export async function getShowtimesByMovieAndWeek(
  db: DB,
  movieId: number,
  weekStart: string
): Promise<Array<Showtime & { theater: Theater }>> {
  const result = await db.query<ShowtimeWithTheaterRow>(
    `
      SELECT 
        s.*,
        c.id as theater_id,
        c.name as theater_name,
        c.address as theater_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as theater_image_url
      FROM showtimes s
      JOIN theaters c ON s.theater_id = c.id
      WHERE s.movie_id = $1 AND s.week_start = $2
      ORDER BY s.date, s.time, c.name
    `,
    [movieId, weekStart]
  );

  return result.rows.map((row) => ({
    ...mapRowToShowtime(row),
    theater: mapRowToTheater(row),
  }));
}

// Récupérer toutes les séances de la semaine pour tous les movies
export async function getWeeklyShowtimes(
  db: DB,
  weekStart: string
): Promise<Array<Showtime & { theater: Theater }>> {
  const result = await db.query<ShowtimeWithTheaterRow>(
    `
      SELECT 
        s.*,
        c.id as theater_id,
        c.name as theater_name,
        c.address as theater_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as theater_image_url
      FROM showtimes s
      JOIN theaters c ON s.theater_id = c.id
      WHERE s.week_start = $1
      ORDER BY s.date, s.time, c.name
    `,
    [weekStart]
  );

  return result.rows.map((row) => ({
    ...mapRowToShowtime(row),
    theater: mapRowToTheater(row),
  }));
}

