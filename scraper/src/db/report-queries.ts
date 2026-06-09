// fallow-ignore-file security-sink
import { type DB } from './client.js';

export interface ScrapeReport {
  id: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  trigger_type: 'manual' | 'cron';
  total_theaters?: number;
  successful_theaters?: number;
  failed_theaters?: number;
  total_movies_scraped?: number;
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
  if (data.total_theaters !== undefined) {
    fields.push(`total_theaters = $${paramIndex++}`);
    values.push(data.total_theaters);
  }
  if (data.successful_theaters !== undefined) {
    fields.push(`successful_theaters = $${paramIndex++}`);
    values.push(data.successful_theaters);
  }
  if (data.failed_theaters !== undefined) {
    fields.push(`failed_theaters = $${paramIndex++}`);
    values.push(data.failed_theaters);
  }
  if (data.total_movies_scraped !== undefined) {
    fields.push(`total_movies_scraped = $${paramIndex++}`);
    values.push(data.total_movies_scraped);
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
