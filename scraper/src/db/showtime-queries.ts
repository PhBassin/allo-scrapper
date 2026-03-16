import { type DB } from './client.js';
import type { Film, Showtime, WeeklyProgram } from '../types/scraper.js';

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

export async function upsertShowtimes(db: DB, showtimes: Showtime[]): Promise<void> {
  if (showtimes.length === 0) return;

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
