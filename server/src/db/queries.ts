import { type DB } from './client.js';
import type { Cinema, Film, Showtime, WeeklyProgram } from '../types/scraper.js';
import { logger } from '../utils/logger.js';
import { parseJSONMemoized } from '../utils/json-parse-cache.js';

// --- Database Row Interfaces ---

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
  created_at: string;
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

export interface ShowtimeWithFilmRow extends ShowtimeRow {
  film_title: string;
  original_title: string | null;
  poster_url: string | null;
  duration_minutes: number | null;
  release_date: string | null;
  rerelease_date: string | null;
  genres: string | null;
  nationality: string | null;
  director: string | null;
  actors: string | null;
  synopsis: string | null;
  certificate: string | null;
  press_rating: number | null;
  audience_rating: number | null;
  source_url: string;
}

export interface ShowtimeWithCinemaRow extends ShowtimeRow {
  cinema_name: string;
  cinema_address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  cinema_image_url: string | null;
}

// Helper to handle parameter syntax for PostgreSQL
// We convert from named parameters (conceptually) to numbered parameters ($1, $2, etc.)

// --- Auth / User Queries ---

export async function getUserByUsername(db: DB, username: string): Promise<UserRow | undefined> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.username, u.password_hash, u.role_id,
            r.name AS role_name, r.is_system AS is_system_role, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = $1`,
    [username]
  );
  return result.rows[0];
}

export async function createUser(db: DB, username: string, passwordHash: string): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash,
       role_id,
       (SELECT name FROM roles WHERE id = role_id) AS role_name,
       (SELECT is_system FROM roles WHERE id = role_id) AS is_system_role,
       created_at`,
    [username, passwordHash]
  );
  return result.rows[0];
}

export async function updateUserPassword(db: DB, userId: number, newPasswordHash: string): Promise<void> {
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, userId]
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
      showtime.film_id,
      showtime.cinema_id,
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
        id, film_id, cinema_id, date, time, datetime_iso,
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
      INSERT INTO weekly_programs (cinema_id, film_id, week_start, is_new_this_week, scraped_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(cinema_id, film_id, week_start) DO UPDATE SET
        is_new_this_week = $4,
        scraped_at = $5
    `,
    [
      program.cinema_id,
      program.film_id,
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


// Récupérer les séances d'un cinéma pour une date
export async function getShowtimesByCinema(
  db: DB,
  cinemaId: string,
  date: string
): Promise<Array<Showtime & { film: Film }>> {
  const result = await db.query<ShowtimeWithFilmRow>(
    `
      SELECT 
        s.*,
        f.id as film_id,
        f.title as film_title,
        f.original_title,
        f.poster_url,
        f.duration_minutes,
        f.release_date,
        f.rerelease_date,
        f.genres,
        f.nationality,
        f.director,
        f.actors,
        f.synopsis,
        f.certificate,
        f.press_rating,
        f.audience_rating,
        f.source_url
      FROM showtimes s
      JOIN films f ON s.film_id = f.id
      WHERE s.cinema_id = $1 AND s.date = $2
      ORDER BY f.title, s.time
    `,
    [cinemaId, date]
  );

  return result.rows.map((row) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
    film: {
      id: row.film_id,
      title: row.film_title,
      original_title: row.original_title ?? undefined,
      poster_url: row.poster_url ?? undefined,
      duration_minutes: row.duration_minutes ?? undefined,
      release_date: row.release_date ?? undefined,
      rerelease_date: row.rerelease_date ?? undefined,
      genres: parseJSONMemoized(row.genres),
      nationality: row.nationality ?? undefined,
      director: row.director ?? undefined,
      actors: parseJSONMemoized(row.actors),
      synopsis: row.synopsis ?? undefined,
      certificate: row.certificate ?? undefined,
      press_rating: row.press_rating ?? undefined,
      audience_rating: row.audience_rating ?? undefined,
      source_url: row.source_url,
    },
  }));
}

// Récupérer les séances d'un cinéma pour une semaine donnée
export async function getShowtimesByCinemaAndWeek(
  db: DB,
  cinemaId: string,
  weekStart: string
): Promise<Array<Showtime & { film: Film }>> {
  const result = await db.query<ShowtimeWithFilmRow>(
    `
      SELECT 
        s.*,
        f.id as film_id,
        f.title as film_title,
        f.original_title,
        f.poster_url,
        f.duration_minutes,
        f.release_date,
        f.rerelease_date,
        f.genres,
        f.nationality,
        f.director,
        f.actors,
        f.synopsis,
        f.certificate,
        f.press_rating,
        f.audience_rating,
        f.source_url
      FROM showtimes s
      JOIN films f ON s.film_id = f.id
      WHERE s.cinema_id = $1 AND s.week_start = $2
      ORDER BY s.date, f.title, s.time
    `,
    [cinemaId, weekStart]
  );

  return result.rows.map((row) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
    film: {
      id: row.film_id,
      title: row.film_title,
      original_title: row.original_title ?? undefined,
      poster_url: row.poster_url ?? undefined,
      duration_minutes: row.duration_minutes ?? undefined,
      release_date: row.release_date ?? undefined,
      rerelease_date: row.rerelease_date ?? undefined,
      genres: parseJSONMemoized(row.genres),
      nationality: row.nationality ?? undefined,
      director: row.director ?? undefined,
      actors: parseJSONMemoized(row.actors),
      synopsis: row.synopsis ?? undefined,
      certificate: row.certificate ?? undefined,
      press_rating: row.press_rating ?? undefined,
      audience_rating: row.audience_rating ?? undefined,
      source_url: row.source_url,
    },
  }));
}

// Récupérer les séances pour une date spécifique
export async function getShowtimesByDate(
  db: DB,
  date: string,
  weekStart: string
): Promise<Array<Showtime & { cinema: Cinema }>> {
  const result = await db.query<ShowtimeWithCinemaRow>(
    `
      SELECT 
        s.*,
        c.id as cinema_id,
        c.name as cinema_name,
        c.address as cinema_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as cinema_image_url
      FROM showtimes s
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE s.date = $1 AND s.week_start = $2
      ORDER BY s.time, c.name
    `,
    [date, weekStart]
  );

  return result.rows.map((row) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
    cinema: {
      id: row.cinema_id,
      name: row.cinema_name,
      address: row.cinema_address ?? undefined,
      postal_code: row.postal_code ?? undefined,
      city: row.city ?? undefined,
      screen_count: row.screen_count ?? undefined,
      image_url: row.cinema_image_url ?? undefined,
    },
  }));
}

// Récupérer les séances d'un film pour une semaine donnée, groupées par cinéma
export async function getShowtimesByFilmAndWeek(
  db: DB,
  filmId: number,
  weekStart: string
): Promise<Array<Showtime & { cinema: Cinema }>> {
  const result = await db.query<ShowtimeWithCinemaRow>(
    `
      SELECT 
        s.*,
        c.id as cinema_id,
        c.name as cinema_name,
        c.address as cinema_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as cinema_image_url
      FROM showtimes s
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE s.film_id = $1 AND s.week_start = $2
      ORDER BY s.date, s.time, c.name
    `,
    [filmId, weekStart]
  );

  return result.rows.map((row) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
    cinema: {
      id: row.cinema_id,
      name: row.cinema_name,
      address: row.cinema_address ?? undefined,
      postal_code: row.postal_code ?? undefined,
      city: row.city ?? undefined,
      screen_count: row.screen_count ?? undefined,
      image_url: row.cinema_image_url ?? undefined,
    },
  }));
}

// Récupérer toutes les séances de la semaine pour tous les films
export async function getWeeklyShowtimes(
  db: DB,
  weekStart: string
): Promise<Array<Showtime & { cinema: Cinema }>> {
  const result = await db.query<ShowtimeWithCinemaRow>(
    `
      SELECT 
        s.*,
        c.id as cinema_id,
        c.name as cinema_name,
        c.address as cinema_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as cinema_image_url
      FROM showtimes s
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE s.week_start = $1
      ORDER BY s.date, s.time, c.name
    `,
    [weekStart]
  );

  return result.rows.map((row) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version ?? '',
    format: row.format ?? undefined,
    experiences: parseJSONMemoized(row.experiences),
    week_start: row.week_start,
    cinema: {
      id: row.cinema_id,
      name: row.cinema_name,
      address: row.cinema_address ?? undefined,
      postal_code: row.postal_code ?? undefined,
      city: row.city ?? undefined,
      screen_count: row.screen_count ?? undefined,
      image_url: row.cinema_image_url ?? undefined,
    },
  }));
}

// Supprimer les séances passées (optionnel, pour cleanup)
export async function deleteOldShowtimes(db: DB, beforeDate: string): Promise<void> {
  const result = await db.query(
    'DELETE FROM showtimes WHERE date < $1',
    [beforeDate]
  );
  logger.info(`🗑️  Supprimé ${result.rowCount} séances avant ${beforeDate}`);
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

// Get a scrape report by ID
export async function getScrapeReport(db: DB, reportId: number): Promise<ScrapeReport | undefined> {
  const result = await db.query<ScrapeReport>(
    'SELECT * FROM scrape_reports WHERE id = $1',
    [reportId]
  );
  return result.rows[0];
}

// Get all scrape reports (paginated)
export async function getScrapeReports(
  db: DB,
  options: {
    limit?: number;
    offset?: number;
    status?: 'running' | 'success' | 'partial_success' | 'failed';
    triggerType?: 'manual' | 'cron';
  } = {}
): Promise<{ reports: ScrapeReport[]; total: number }> {
  const { limit = 20, offset = 0, status, triggerType } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  if (triggerType) {
    conditions.push(`trigger_type = $${paramIndex++}`);
    params.push(triggerType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM scrape_reports ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results
  params.push(limit, offset);
  const result = await db.query<ScrapeReport>(
    `SELECT * FROM scrape_reports 
     ${whereClause}
     ORDER BY started_at DESC 
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    params
  );

  return {
    reports: result.rows,
    total
  };
}

// Get the most recent scrape report
export async function getLatestScrapeReport(db: DB): Promise<ScrapeReport | undefined> {
  const result = await db.query<ScrapeReport>(
    'SELECT * FROM scrape_reports ORDER BY started_at DESC LIMIT 1'
  );
  return result.rows[0];
}


