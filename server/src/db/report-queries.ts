import { type DB } from './client.js';

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
  parent_report_id?: number;
}

// Create a new scrape report
export async function createScrapeReport(
  db: DB,
  triggerType: 'manual' | 'cron',
  parentReportId?: number
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO scrape_reports (started_at, status, trigger_type, parent_report_id)
     VALUES (NOW(), 'running', $1, $2)
     RETURNING id`,
    [triggerType, parentReportId || null]
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
