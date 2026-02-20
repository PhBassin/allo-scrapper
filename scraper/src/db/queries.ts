import { type DB } from './client.js';
import type { Cinema, Film, Showtime, WeeklyProgram } from '../types/scraper.js';

// --- Database Row Interfaces ---

export interface CinemaRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  image_url: string | null;
  url: string | null;
}

export interface FilmRow {
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
  actors: string | null; // JSON string
  synopsis: string | null;
  certificate: string | null;
  press_rating: number | null;
  audience_rating: number | null;
  source_url: string;
}

export interface ShowtimeRow {
  id: string;
  film_id: number;
  cinema_id: string;
  date: string;
  time: string;
  datetime_iso: string;
  version: string | null;
  format: string | null;
  experiences: string | null; // JSON string
  week_start: string;
}

// Insertion ou mise à jour d'un cinéma
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void> {
  await db.query(
    `
      INSERT INTO cinemas (id, name, address, postal_code, city, screen_count, image_url, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(id) DO UPDATE SET
        name = $2,
        address = $3,
        postal_code = $4,
        city = $5,
        screen_count = $6,
        image_url = $7,
        url = COALESCE($8, cinemas.url)
    `,
    [
      cinema.id,
      cinema.name,
      cinema.address ?? null,
      cinema.postal_code ?? null,
      cinema.city ?? null,
      cinema.screen_count ?? null,
      cinema.image_url ?? null,
      cinema.url ?? null,
    ]
  );
}

// Récupérer les cinémas configurés pour le scraping (ceux avec une URL)
export async function getCinemaConfigs(db: DB): Promise<Array<{ id: string; name: string; url: string }>> {
  const result = await db.query<{ id: string; name: string; url: string }>(
    'SELECT id, name, url FROM cinemas WHERE url IS NOT NULL ORDER BY name'
  );
  return result.rows;
}

// Récupérer un film par son ID
export async function getFilm(db: DB, filmId: number): Promise<Film | undefined> {
  const result = await db.query<FilmRow>(
    'SELECT * FROM films WHERE id = $1',
    [filmId]
  );

  const row = result.rows[0];
  if (!row) return undefined;

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
    actors: JSON.parse(row.actors ?? '[]'),
    synopsis: row.synopsis ?? undefined,
    certificate: row.certificate ?? undefined,
    press_rating: row.press_rating ?? undefined,
    audience_rating: row.audience_rating ?? undefined,
    source_url: row.source_url,
  };
}

// Insertion ou mise à jour d'un film
export async function upsertFilm(db: DB, film: Film): Promise<void> {
  await db.query(
    `
      INSERT INTO films (
        id, title, original_title, poster_url, duration_minutes,
        release_date, rerelease_date, genres, nationality, director,
        actors, synopsis, certificate, press_rating, audience_rating, source_url
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT(id) DO UPDATE SET
        title = $2,
        original_title = $3,
        poster_url = $4,
        duration_minutes = COALESCE($5, films.duration_minutes),
        release_date = COALESCE($6, films.release_date),
        rerelease_date = $7,
        genres = $8,
        nationality = $9,
        director = $10,
        actors = $11,
        synopsis = $12,
        certificate = $13,
        press_rating = $14,
        audience_rating = $15,
        source_url = $16
    `,
    [
      film.id,
      film.title,
      film.original_title ?? null,
      film.poster_url ?? null,
      film.duration_minutes ?? null,
      film.release_date ?? null,
      film.rerelease_date ?? null,
      JSON.stringify(film.genres),
      film.nationality ?? null,
      film.director ?? null,
      JSON.stringify(film.actors),
      film.synopsis ?? null,
      film.certificate ?? null,
      film.press_rating ?? null,
      film.audience_rating ?? null,
      film.source_url,
    ]
  );
}

// Insertion ou mise à jour d'une séance
export async function upsertShowtime(db: DB, showtime: Showtime): Promise<void> {
  await db.query(
    `
      INSERT INTO showtimes (
        id, film_id, cinema_id, date, time, datetime_iso,
        version, format, experiences, week_start
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      ON CONFLICT(id) DO UPDATE SET
        date = $4,
        time = $5,
        datetime_iso = $6,
        version = $7,
        format = $8,
        experiences = $9,
        week_start = $10
    `,
    [
      showtime.id,
      showtime.film_id,
      showtime.cinema_id,
      showtime.date,
      showtime.time,
      showtime.datetime_iso,
      showtime.version || null,
      showtime.format || null,
      JSON.stringify(showtime.experiences),
      showtime.week_start,
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
      program.cinema_id,
      program.film_id,
      program.week_start,
      program.is_new_this_week ? 1 : 0,
      program.scraped_at
    );
    paramIndex += 5;
  }

  await db.query(
    `
      INSERT INTO weekly_programs (cinema_id, film_id, week_start, is_new_this_week, scraped_at)
      VALUES ${valueSets.join(', ')}
      ON CONFLICT(cinema_id, film_id, week_start) DO UPDATE SET
        is_new_this_week = EXCLUDED.is_new_this_week,
        scraped_at = EXCLUDED.scraped_at
    `,
    values
  );
}

// ============================================================================
// SCRAPE REPORTS QUERIES
// ============================================================================

export interface ScrapeReport {
  id: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  trigger_type: 'manual' | 'cron';
  total_cinemas?: number;
  successful_cinemas?: number;
  failed_cinemas?: number;
  total_films_scraped?: number;
  total_showtimes_scraped?: number;
  errors?: unknown[];
  progress_log?: unknown[];
}

// Create a new scrape report
export async function createScrapeReport(
  db: DB,
  triggerType: 'manual' | 'cron'
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO scrape_reports (started_at, status, trigger_type)
     VALUES (NOW(), 'running', $1)
     RETURNING id`,
    [triggerType]
  );
  return result.rows[0].id;
}

// Update a scrape report
export async function updateScrapeReport(
  db: DB,
  reportId: number,
  data: Partial<Omit<ScrapeReport, 'id' | 'started_at'>>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.completed_at !== undefined) {
    fields.push(`completed_at = $${paramIndex++}`);
    values.push(data.completed_at);
  }
  if (data.status) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.total_cinemas !== undefined) {
    fields.push(`total_cinemas = $${paramIndex++}`);
    values.push(data.total_cinemas);
  }
  if (data.successful_cinemas !== undefined) {
    fields.push(`successful_cinemas = $${paramIndex++}`);
    values.push(data.successful_cinemas);
  }
  if (data.failed_cinemas !== undefined) {
    fields.push(`failed_cinemas = $${paramIndex++}`);
    values.push(data.failed_cinemas);
  }
  if (data.total_films_scraped !== undefined) {
    fields.push(`total_films_scraped = $${paramIndex++}`);
    values.push(data.total_films_scraped);
  }
  if (data.total_showtimes_scraped !== undefined) {
    fields.push(`total_showtimes_scraped = $${paramIndex++}`);
    values.push(data.total_showtimes_scraped);
  }
  if (data.errors !== undefined) {
    fields.push(`errors = $${paramIndex++}`);
    values.push(JSON.stringify(data.errors));
  }
  if (data.progress_log !== undefined) {
    fields.push(`progress_log = $${paramIndex++}`);
    values.push(JSON.stringify(data.progress_log));
  }

  if (fields.length === 0) return;

  values.push(reportId);
  await db.query(
    `UPDATE scrape_reports SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}
