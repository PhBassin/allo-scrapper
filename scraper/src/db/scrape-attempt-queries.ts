import { type DB } from './client.js';

export interface ScrapeAttempt {
  id: number;
  report_id: number;
  cinema_id: string;
  date: string;
  status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
  error_type?: string | null;
  error_message?: string | null;
  http_status_code?: number | null;
  films_scraped: number;
  showtimes_scraped: number;
  attempted_at: string;
}

export interface CreateScrapeAttemptInput {
  report_id: number;
  cinema_id: string;
  date: string;
  status?: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
}

export interface UpdateScrapeAttemptInput {
  status?: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
  error_type?: string;
  error_message?: string;
  http_status_code?: number;
  films_scraped?: number;
  showtimes_scraped?: number;
}

// Create a new scrape attempt
export async function createScrapeAttempt(
  db: DB,
  input: CreateScrapeAttemptInput
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO scrape_attempts (report_id, cinema_id, date, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (report_id, cinema_id, date) DO UPDATE
     SET status = EXCLUDED.status, attempted_at = NOW()
     RETURNING id`,
    [input.report_id, input.cinema_id, input.date, input.status || 'pending']
  );
  return result.rows[0].id;
}

// Update a scrape attempt
export async function updateScrapeAttempt(
  db: DB,
  attemptId: number,
  data: UpdateScrapeAttemptInput
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.status) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.error_type !== undefined) {
    fields.push(`error_type = $${paramIndex++}`);
    values.push(data.error_type);
  }
  if (data.error_message !== undefined) {
    fields.push(`error_message = $${paramIndex++}`);
    values.push(data.error_message);
  }
  if (data.http_status_code !== undefined) {
    fields.push(`http_status_code = $${paramIndex++}`);
    values.push(data.http_status_code);
  }
  if (data.films_scraped !== undefined) {
    fields.push(`films_scraped = $${paramIndex++}`);
    values.push(data.films_scraped);
  }
  if (data.showtimes_scraped !== undefined) {
    fields.push(`showtimes_scraped = $${paramIndex++}`);
    values.push(data.showtimes_scraped);
  }

  if (fields.length === 0) return;

  values.push(attemptId);
  await db.query(
    `UPDATE scrape_attempts
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}`,
    values
  );
}

// Get pending scrape attempts (failed, rate_limited, or not_attempted)
export async function getPendingScrapeAttempts(
  db: DB,
  reportId: number
): Promise<ScrapeAttempt[]> {
  const result = await db.query<ScrapeAttempt>(
    `SELECT * FROM scrape_attempts
     WHERE report_id = $1
     AND status IN ('failed', 'rate_limited', 'not_attempted')
     ORDER BY cinema_id, date`,
    [reportId]
  );
  return result.rows;
}

// Get all scrape attempts for a report
export async function getScrapeAttemptsByReport(
  db: DB,
  reportId: number
): Promise<ScrapeAttempt[]> {
  const result = await db.query<ScrapeAttempt>(
    `SELECT * FROM scrape_attempts
     WHERE report_id = $1
     ORDER BY cinema_id, date`,
    [reportId]
  );
  return result.rows;
}

// Get scrape attempt by report, cinema, and date
export async function getScrapeAttempt(
  db: DB,
  reportId: number,
  cinemaId: string,
  date: string
): Promise<ScrapeAttempt | null> {
  const result = await db.query<ScrapeAttempt>(
    `SELECT * FROM scrape_attempts
     WHERE report_id = $1 AND cinema_id = $2 AND date = $3`,
    [reportId, cinemaId, date]
  );
  return result.rows[0] || null;
}

// Check if a cinema/date was successfully scraped in any report
export async function hasSuccessfulAttempt(
  db: DB,
  cinemaId: string,
  date: string
): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM scrape_attempts
       WHERE cinema_id = $1 AND date = $2 AND status = 'success'
     ) as exists`,
    [cinemaId, date]
  );
  return result.rows[0].exists;
}
