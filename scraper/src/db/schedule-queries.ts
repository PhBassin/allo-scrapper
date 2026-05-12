import { type DB } from './client.js';

export interface ScrapeSchedule {
  id: number;
  name: string;
  description: string | null;
  cron_expression: string;
  enabled: boolean;
  target_theaters: string[] | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
}

function rowToSchedule(row: any): ScrapeSchedule {
  return {
    ...row,
    target_theaters: typeof row.target_theaters === 'string' 
      ? JSON.parse(row.target_theaters) 
      : row.target_theaters,
  };
}

export async function getEnabledSchedules(db: DB): Promise<ScrapeSchedule[]> {
  const result = await db.query(
    'SELECT * FROM scrape_schedules WHERE enabled = true ORDER BY name ASC'
  );
  return result.rows.map(rowToSchedule);
}

export async function updateScheduleRunStatus(
  db: DB,
  id: number,
  status: 'success' | 'failed' | 'partial_success'
): Promise<void> {
  await db.query(
    `UPDATE scrape_schedules 
     SET last_run_at = NOW(), last_run_status = $1
     WHERE id = $2`,
    [status, id]
  );
}
