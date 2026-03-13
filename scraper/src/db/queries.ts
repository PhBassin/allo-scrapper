import { type DB } from './client.js';
import type { Film, Showtime, WeeklyProgram } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

// --- Database Row Interfaces ---

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

/**
 * Batch insert/update multiple showtimes in a single SQL query.
 * Significantly more performant than calling upsertShowtime() in a loop.
 */
export async function upsertShowtimes(db: DB, showtimes: Showtime[]): Promise<void> {
  if (showtimes.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: any[] = [];
  const valueSets: string[] = [];
  let paramIndex = 1;

  for (const showtime of showtimes) {
    valueSets.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`
    );
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
