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
  total_theaters?: number;
  successful_theaters?: number;
  failed_theaters?: number;
  total_movies_scraped?: number;
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

  // Get total count and paginated results concurrently (Promise.all)
  const countParams = [...params];
  const listParams = [...params, limit, offset];

  const [countResult, result] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM scrape_reports ${whereClause}`,
      countParams
    ),
    db.query<ScrapeReport>(
      `SELECT * FROM scrape_reports 
       ${whereClause}
       ORDER BY started_at DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      listParams
    )
  ]);

  const total = parseInt(countResult.rows[0].count);

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
